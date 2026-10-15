/* ============================================================
   TugLife FM — "Programação SAAM · Rio de Janeiro" (leitura pública)
   ------------------------------------------------------------
   Arquivo   : index.ts  (Supabase Edge Function: saam-rj)
   Versão    : 1.0.0 (SPRINT 27 · app v3.9.0)
   Data/Hora : 2026-10-15T16:40:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
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

   Uso:  GET  /functions/v1/saam-rj            → só SAAM (padrão)
         GET  /functions/v1/saam-rj?emp=WIL    → outra empresa (teste)
   Sem segredo: a fonte é pública; a função só lê, nada grava.
   ============================================================ */
import { parsePagina, daEmpresa } from './parser.js';

const FONTE = 'https://www.praticagem-rj.com.br/';
const CACHE_MS = 60_000;
const TIMEOUT_MS = 15_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info'
};

let cache: { lido_em: number; html: string } | null = null;
let ultimoErro = '';

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
  const url = new URL(req.url);
  const emp = (url.searchParams.get('emp') || 'SAA').toUpperCase().replace(/[^A-Z/]/g, '').slice(0, 6) || 'SAA';
  try {
    const p = await pagina();
    const tudo = parsePagina(p.html, { agora: new Date() });
    const sel = daEmpresa(tudo, emp);
    return new Response(JSON.stringify({
      ok: p.ok,
      mensagem: p.ok ? '' : ultimoErro,
      fonte: FONTE,
      empresa: emp,
      lido_em: new Date(p.lido_em).toISOString(),
      total_porto: tudo.total,
      total: sel.total,
      areas: sel.areas
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, mensagem: (e as Error).message, areas: [], total: 0 }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
});
