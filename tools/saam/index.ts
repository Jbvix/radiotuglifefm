/* ============================================================
   TugLife FM — Coletor "Programação SAAM · Suape"
   ------------------------------------------------------------
   Arquivo   : index.ts  (Supabase Edge Function: saam-suape-sync)
   Versão    : 1.0.0 (SPRINT 18)
   Data/Hora : 2026-10-12T15:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   Roda a cada 2 min (pg_cron). Ciclo:
     1. baixa a planilha da praticagem (link público do SharePoint)
     2. lê as manobras de Suape (parser.js)
     3. compara com a leitura anterior (regras.js)
     4. grava manobras e eventos; envia push para os inscritos
   Chamadas exigem o cabeçalho x-cron-token (saam_config.cron_token).
   ?dry=1 só lê e devolve o resumo, sem gravar nem alertar.
   ============================================================ */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { unzipSync } from 'npm:fflate@0.8.2';
import webpush from 'npm:web-push@3.6.7';
import { parseWorkbook } from './parser.js';
import { comparar, mnbNome } from './regras.js';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
});

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

const hora = (d: string | Date | null) => d ? new Date(d).toLocaleString('pt-BR', {
  timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
}) : '';

const TITULO: Record<string, string> = {
  CONFIRMADA: '✅ Manobra CONFIRMADA',
  CANCELADA: '❌ Manobra CANCELADA',
  ANTECIPADA: '⏩ Manobra ANTECIPADA'
};

async function config() {
  const { data, error } = await sb.from('saam_config').select('chave, valor');
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.chave, r.valor])) as Record<string, string>;
}

async function enviarPush(cfg: Record<string, string>, eventos: any[]) {
  if (!eventos.length) return { enviados: 0, removidos: 0 };
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  const { data: subs } = await sb.from('saam_push').select('*').lt('falhas', 99);
  let enviados = 0, removidos = 0;
  for (const e of eventos) {
    const payload = JSON.stringify({
      id: e.id, tipo: e.tipo, titulo: TITULO[e.tipo],
      corpo: `${e.navio} · ${mnbNome(e.mnb)} · ${hora(e.pob_depois || e.pob_antes)}\n${e.detalhe || ''}`.trim(),
      url: '/#card-saam'
    });
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload, { TTL: 3600, urgency: 'high', topic: `saam-${e.id}` });
        enviados++;
        await sb.from('saam_push').update({ ultimo_ok: new Date().toISOString(), falhas: 0 }).eq('endpoint', s.endpoint);
      } catch (err: any) {
        // 404/410 = inscrição expirada (app desinstalado, permissão retirada)
        const gone = err?.statusCode === 404 || err?.statusCode === 410;
        if (gone) removidos++;
        await sb.from('saam_push').update({ falhas: gone ? 99 : (s.falhas || 0) + 1 }).eq('endpoint', s.endpoint);
      }
    }));
  }
  return { enviados, removidos };
}

/* Link anônimo do SharePoint: a 1ª resposta é 302 + cookie FedAuth
   (sessão anônima); o arquivo só vem se o 2º pedido levar o cookie.
   O fetch padrão segue o redirecionamento SEM o cookie → 403.
   Então seguimos os saltos à mão, carregando os cookies.         */
async function baixarPlanilha(inicio: string): Promise<Uint8Array> {
  const jar = new Map<string, string>();
  let url = inicio;
  for (let salto = 0; salto < 6; salto++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const resp = await fetch(url, {
      redirect: 'manual', signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TugLifeFM-SAAM/1.0',
        'Accept': '*/*',
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {})
      }
    });
    clearTimeout(timer);
    for (const c of resp.headers.getSetCookie()) {
      const [par] = c.split(';');
      const i = par.indexOf('=');
      if (i > 0) jar.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      await resp.body?.cancel();
      if (!loc) throw new Error(`planilha: redirecionamento sem destino (${resp.status})`);
      url = new URL(loc, url).toString();
      continue;
    }
    if (!resp.ok) throw new Error(`planilha HTTP ${resp.status} (salto ${salto})`);
    return new Uint8Array(await resp.arrayBuffer());
  }
  throw new Error('planilha: redirecionamentos demais');
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const url = new URL(req.url);
  let cfg: Record<string, string>;
  try { cfg = await config(); } catch (e) { return json({ erro: 'config', detalhe: String(e) }, 500); }
  if (!cfg.cron_token || req.headers.get('x-cron-token') !== cfg.cron_token) return json({ erro: 'não autorizado' }, 401);
  const dry = url.searchParams.get('dry') === '1';

  const registrar = (ok: boolean, mensagem: string, linhas: number | null, extra: Record<string, unknown> = {}) =>
    dry ? Promise.resolve() : sb.from('saam_sync').update({ lido_em: new Date().toISOString(), ok, mensagem, linhas, ...extra }).eq('id', 1);

  try {
    // 1. planilha
    const bytes = await baixarPlanilha(cfg.planilha_url);
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('resposta não é .xlsx (link expirou?)');
    const tBaixar = Date.now() - t0;

    // 2. leitura
    const { sheets, rows } = parseWorkbook(bytes, unzipSync, { porto: 'SUA' });
    if (rows.length < 5) throw new Error(`poucas linhas de Suape (${rows.length}) nas abas ${sheets.join(', ')}`);
    const saam = rows.filter((r) => r.empresa === 'SAAM');
    const tLer = Date.now() - t0 - tBaixar;

    if (dry) {
      const agora = Date.now();
      return json({
        abas: sheets, linhas_suape: rows.length, linhas_saam: saam.length, ms: { baixar: tBaixar, ler: tLer },
        proximas_saam: saam.filter((r) => r.pob.getTime() > agora - 6 * 3600000)
          .sort((a, b) => a.pob.getTime() - b.pob.getTime()).slice(0, 15)
          .map((r) => ({ navio: r.navio, mnb: r.mnb, situacao: r.situacao, pob: hora(r.pob), rebocadores: r.rebocadores }))
      });
    }

    // 3. comparação com o que já está salvo
    const desde = new Date(Date.now() - 3 * 24 * 3600000).toISOString();
    const { data: old, error: eOld } = await sb.from('saam_manobras').select('*').gte('pob', desde);
    if (eOld) throw eOld;
    const { data: st } = await sb.from('saam_sync').select('primeira').eq('id', 1).single();
    const baseline = !!st?.primeira;
    const { upserts, eventos } = comparar(old || [], rows, new Date(), baseline);

    // 4. gravação
    const agoraIso = new Date().toISOString();
    for (let i = 0; i < upserts.length; i += 200) {
      const lote = upserts.slice(i, i + 200).map((u: any) => ({
        chave: u.chave, imo: u.imo, navio: u.navio, mnb: u.mnb, situacao: u.situacao,
        pob: new Date(u.pob).toISOString(), calado: u.calado, de_local: u.de_local, para_local: u.para_local,
        n_rebocadores: u.n_rebocadores, rebocadores: u.rebocadores || [], obs: u.obs, empresa: u.empresa,
        aba: u.aba, linha: u.linha, ausencias: u.ausencias || 0, atualizado_em: agoraIso
      }));
      const { error } = await sb.from('saam_manobras').upsert(lote, { onConflict: 'chave' });
      if (error) throw error;
    }
    let criados: any[] = [];
    if (eventos.length) {
      const { data, error } = await sb.from('saam_eventos').insert(eventos.map((e: any) => ({
        ...e, pob_antes: e.pob_antes ? new Date(e.pob_antes).toISOString() : null,
        pob_depois: e.pob_depois ? new Date(e.pob_depois).toISOString() : null
      }))).select('*');
      if (error) throw error;
      criados = data || [];
    }
    const push = await enviarPush(cfg, criados);

    // faxina: inscrições mortas, tentativas de PIN antigas, manobras com mais de 30 dias
    await sb.from('saam_push').delete().gte('falhas', 99);
    await sb.from('saam_pin_falhas').delete().lt('em', new Date(Date.now() - 24 * 3600000).toISOString());
    await sb.from('saam_manobras').delete().lt('pob', new Date(Date.now() - 30 * 24 * 3600000).toISOString());

    const msg = `${saam.length} manobras SAAM · ${criados.length} alerta(s)` + (baseline ? ' · linha de base' : '');
    await registrar(true, msg, rows.length, { primeira: false });
    return json({ ok: true, mensagem: msg, abas: sheets, eventos: criados.map((e) => `${e.tipo} ${e.navio}`), push, ms: Date.now() - t0 });
  } catch (e) {
    await registrar(false, String((e as Error).message || e).slice(0, 300), null);
    return json({ ok: false, erro: String((e as Error).message || e) }, 500);
  }
});
