/* ============================================================
   TugLife FM — "Programação SAAM · Rio de Janeiro" (tripulação, com PIN)
   ------------------------------------------------------------
   Arquivo   : index.ts  (Supabase Edge Function: saam-rj)
   Versão    : 1.1.0 (SPRINT 28 · app v3.9.1)
   Data/Hora : 2026-10-15T17:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v1.1.0  [NOVO] Exige o PIN da tripulação (o mesmo de Suape) no
           cabeçalho x-saam-pin. A conferência é feita pela própria função
           SQL saam_programacao(p_pin): mesmo hash bcrypt e mesma trava de
           20 tentativas erradas em 10 min — nenhum segredo novo aqui.
           PIN certo fica lembrado 10 min nesta instância (só o hash
           SHA-256 dele, nunca o PIN em texto). PIN errado → HTTP 401.
           [MOD] Cache-Control: private, no-store (resposta protegida).
   v1.0.0  [NOVO] Ponte entre o app e a página pública de manobras da
           Praticagem RJ (https://www.praticagem-rj.com.br/).
   ------------------------------------------------------------
   POR QUE UMA PONTE?
   A página da praticagem não envia o cabeçalho CORS
   (Access-Control-Allow-Origin), então o navegador do tripulante não
   pode lê-la direto do app. Esta função busca a página, lê com
   parser.js, filtra a empresa de rebocador pedida (SAA = SAAM) e
   devolve um JSON pequeno (~5 KB em vez de ~630 KB de HTML — ótimo
   para a internet de bordo).

   CACHE (como a vigia do passadiço: um olha e todos sabem)
   A página da praticagem é regenerada a cada ~1 min. A função guarda a
   última leitura na memória por CACHE_MS = 60 s; dentro desse tempo,
   todos os aparelhos recebem a mesma resposta sem novo acesso ao site.
   Pior caso de carga no site da praticagem: 1 acesso/min por instância
   da função, independente do número de tripulantes com o app aberto.
   Se o site cair, devolve a última leitura boa com "ok:false" e a idade.

   Uso:  GET  /functions/v1/saam-rj   + cabeçalho x-saam-pin: <PIN>
         ?emp=WIL → outra empresa (teste)
   Só lê; nada grava (as tentativas erradas de PIN são registradas pela
   função SQL, que alimenta a trava contra adivinhação).
   ============================================================ */
import { parsePagina, daEmpresa } from './parser.js';

const FONTE = 'https://www.praticagem-rj.com.br/';
const CACHE_MS = 60_000;
const TIMEOUT_MS = 15_000;
const PIN_OK_MS = 10 * 60_000;
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, x-saam-pin'
};

let cache: { lido_em: number; html: string } | null = null;
let ultimoErro = '';
const pinsOk = new Map<string, number>();   // sha256(PIN) → válido até

const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))))
  .map((b) => b.toString(16).padStart(2, '0')).join('');

/* Confere o PIN pela função SQL do card de Suape. Ela devolve {erro}
   quando o PIN está errado (ou a trava está ativa) e registra a falha. */
async function pinValido(pin: string): Promise<boolean> {
  if (!/^\d{4,8}$/.test(pin)) return false;
  const h = await sha(pin);
  if ((pinsOk.get(h) || 0) > Date.now()) return true;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/saam_programacao`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pin: pin }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!r.ok) throw new Error('conferência do PIN: HTTP ' + r.status);
  const d = await r.json();
  if (d && d.erro) return false;
  pinsOk.set(h, Date.now() + PIN_OK_MS);
  return true;
}

async function pagina(): Promise<{ html: string; lido_em: number; ok: boolean }> {
  if (cache && Date.now() - cache.lido_em < CACHE_MS) return { ...cache, ok: true };
  try {
    const r = await fetch(FONTE, {
      headers: { 'User-Agent': 'TugLifeFM/3.9 (+app da tripulacao; leitura 1x/min)' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();
    if (!html.includes('tbManobrasArea')) throw new Error('página sem a tabela de manobras');
    cache = { lido_em: Date.now(), html };
    ultimoErro = '';
    return { ...cache, ok: true };
  } catch (e) {
    ultimoErro = (e as Error).message;
    if (cache) return { ...cache, ok: false };     // última leitura boa
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), {
    status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' }
  });
  try {
    if (!(await pinValido(req.headers.get('x-saam-pin') || ''))) return json({ ok: false, erro: 'PIN incorreto', areas: [], total: 0 }, 401);
  } catch (e) {
    return json({ ok: false, mensagem: (e as Error).message, areas: [], total: 0 }, 502);
  }
  const url = new URL(req.url);
  const emp = (url.searchParams.get('emp') || 'SAA').toUpperCase().replace(/[^A-Z/]/g, '').slice(0, 6) || 'SAA';
  try {
    const p = await pagina();
    const tudo = parsePagina(p.html, { agora: new Date() });
    const sel = daEmpresa(tudo, emp);
    return json({
      ok: p.ok,
      mensagem: p.ok ? '' : ultimoErro,
      fonte: FONTE,
      empresa: emp,
      lido_em: new Date(p.lido_em).toISOString(),
      total_porto: tudo.total,
      total: sel.total,
      areas: sel.areas
    });
  } catch (e) {
    return json({ ok: false, mensagem: (e as Error).message, areas: [], total: 0 }, 502);
  }
});
