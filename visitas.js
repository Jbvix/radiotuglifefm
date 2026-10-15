/* ============================================================
   TugLife FM — Contador de visitas (diário de bordo anônimo)
   ------------------------------------------------------------
   Arquivo   : visitas.js
   Versão    : 3.10.0 (SPRINT 29)
   Data/Hora : 2026-10-15T18:45:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.10.0 [NOVO] Linha "👁️ N visitas · N aparelhos · N hoje" no
           rodapé (computador) e no painel "Mais da TugLife"
           (celular, onde o rodapé fica oculto).
           [NOVO] Registro anônimo pela função registrar_visita do
           Supabase (projeto tuglife-fm).
   ------------------------------------------------------------
   COMO CONTA (e o que NÃO guarda)
   • Aparelho: na 1ª abertura o app sorteia um código aleatório
     (UUID v4) e guarda só no aparelho (localStorage
     "tuglife_aparelho"). É como o número de casco de um bote:
     diz que é o mesmo bote, nunca quem é o tripulante.
     Nada de IP, nome, conta ou localização.
   • Visita: cada abertura do app chama registrar_visita(código).
     O SERVIDOR só conta se a última visita daquele aparelho foi
     há mais de 30 min — recargas e trocas de aba não inflam.
         conta = (agora − ultima_visita) > 30 min
     Ex.: abriu às 08:00 (conta), 08:10 (não), 08:45 (conta).
   • Totais devolvidos na mesma chamada:
         visitas   = Σ visitas de todos os dias
         aparelhos = nº de códigos já vistos
         hoje      = visitas do dia (fuso de Brasília)
   ------------------------------------------------------------
   PRINCÍPIO DE PROJETO
   Módulo independente, como um instrumento auxiliar no painel:
   se o Supabase falhar ou estiver em modo offline, as linhas
   continuam ocultas e o resto do app segue igual. Usa fetch
   direto na API REST (não depende do supabase-js).
   ============================================================ */

(() => {
  'use strict';

  /* ---------- 1. Configuração ---------- */
  const CFG = {
    // Mesmo projeto e mesma chave "publishable" de listeners.js:
    // pública por natureza, só executa o que o banco libera.
    RPC: 'https://udedhipgekgonnioofgk.supabase.co/rest/v1/rpc/registrar_visita',
    KEY: 'sb_publishable_eFnlzgsmvXurOo60X7OPcw_hlj_kFnt',
    STORE: 'tuglife_aparelho',
    TIMEOUT_MS: 8000
  };

  /* ---------- 2. Código anônimo do aparelho ----------
     crypto.randomUUID existe em todo navegador moderno com HTTPS;
     o plano B monta um UUID v4 com getRandomValues. Sem
     localStorage (modo anônimo) o código vale só para esta aba. */
  function novoCodigo() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;   // versão 4
    b[8] = (b[8] & 0x3f) | 0x80;   // variante RFC 4122
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function codigoDoAparelho() {
    try {
      let id = localStorage.getItem(CFG.STORE);
      if (!id || !UUID.test(id)) { id = novoCodigo(); localStorage.setItem(CFG.STORE, id); }
      return id;
    } catch (e) {
      return novoCodigo();
    }
  }

  /* ---------- 3. Formatação ----------
     12345 → "12.345" (padrão brasileiro); singular/plural. */
  const fmt = (n) => Number(n).toLocaleString('pt-BR');
  const plural = (n, um, varios) => `${fmt(n)} ${n === 1 ? um : varios}`;

  function render(t) {
    const ok = t && Number.isFinite(t.visitas) && Number.isFinite(t.aparelhos) && Number.isFinite(t.hoje);
    if (!ok || t.visitas < 1) return;
    const texto = `${plural(t.visitas, 'visita', 'visitas')} · ${plural(t.aparelhos, 'aparelho', 'aparelhos')} · ${fmt(t.hoje)} hoje`;
    document.querySelectorAll('[data-visitas]').forEach((linha) => {
      const alvo = linha.querySelector('[data-visitas-texto]');
      if (alvo) alvo.textContent = texto;
      linha.hidden = false;
    });
  }

  /* ---------- 4. Registro ----------
     Uma chamada por abertura da página. AbortController corta a
     espera em 8 s para não deixar conexão pendurada em rede ruim
     de bordo. Qualquer falha: silêncio (as linhas ficam ocultas). */
  async function registrar() {
    if (!document.querySelector('[data-visitas]')) return;   // marcação ausente: módulo dorme
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), CFG.TIMEOUT_MS);
    try {
      const r = await fetch(CFG.RPC, {
        method: 'POST',
        headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + CFG.KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_aparelho: codigoDoAparelho() }),
        signal: ctl.signal
      });
      if (r.ok) render(await r.json());
    } catch (e) {
      /* offline ou Supabase fora: o contador simplesmente não aparece */
    } finally {
      clearTimeout(t);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registrar);
  else registrar();
})();
