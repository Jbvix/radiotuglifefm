/* ============================================================
   TugLife FM — Regras dos alertas SAAM (comparador)
   ------------------------------------------------------------
   Arquivo   : regras.js   (módulo puro: roda no Deno e no Node)
   Versão    : 1.0.0 (SPRINT 18)
   Data/Hora : 2026-10-12T15:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   A planilha não tem um "ID de manobra". Identificamos cada uma
   por NAVIO (IMO) + TIPO (EA/DS/DA) e casamos a leitura nova com a
   anterior pelo horário mais próximo, dentro de 48 h. Assim uma
   manobra antecipada de 18:00 para 16:00 continua sendo a mesma.

   ALERTAS (só para manobras da SAAM):
     CONFIRMADA  situação passou a CONFIRMADA
     CANCELADA   situação passou a CANCELADA; ou a manobra saiu da
                 SAAM (outra empresa); ou sumiu da planilha em 2
                 leituras seguidas antes de acontecer
     ANTECIPADA  horário (POB) adiantou 15 min ou mais
   Se confirmou e antecipou na mesma leitura, sai um só alerta
   (ANTECIPADA), com a confirmação no detalhe — o mais urgente.
   Na primeira leitura não há alertas: só se forma a "linha de base".
   ============================================================ */

export const ANTECIPA_MIN = 15;
const H = 3600000;
const ATIVAS = new Set(['PREVISTA', 'CONFIRMADA']);
const FINAIS = new Set(['REALIZADA', 'EM ANDAMENTO', 'CANCELADA', 'REMOVIDA']);

const hhmm = (d) => new Date(d).toLocaleString('pt-BR', {
  timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});
export const mnbNome = (m) => ({ EA: 'Entrada', DS: 'Desatracação', DA: 'Mudança' }[m] || m || 'Manobra');

/**
 * @param old      registros já salvos (com .chave, .pob Date|string, .ausencias)
 * @param rows     linhas lidas agora (parseWorkbook().rows — todas as empresas)
 * @param now      Date
 * @param baseline true na primeira leitura (não gera alertas)
 * @returns { upserts, eventos }
 */
export function comparar(old, rows, now, baseline) {
  const t = (d) => new Date(d).getTime();
  const livres = old.map((o) => ({ ...o, _pob: t(o.pob), _usado: false }));
  const upserts = [], eventos = [];
  const ev = (o, tipo, detalhe, pobAntes, pobDepois) => {
    if (!baseline) eventos.push({ chave: o.chave, tipo, navio: o.navio, mnb: o.mnb, pob_antes: pobAntes ?? null, pob_depois: pobDepois ?? null, detalhe });
  };

  // Mais antigas primeiro: quem chega antes pega o par mais provável
  const ordem = [...rows].sort((a, b) => t(a.pob) - t(b.pob));
  for (const r of ordem) {
    const rp = t(r.pob);
    let best = null;
    for (const o of livres) {
      if (o._usado || o.imo !== r.imo || o.mnb !== r.mnb) continue;
      const d = Math.abs(o._pob - rp);
      if (d <= 48 * H && (!best || d < Math.abs(best._pob - rp))) best = o;
    }
    const ehSaam = r.empresa === 'SAAM';

    if (!best) {
      if (!ehSaam) continue;                                  // não é nossa e nunca foi
      const novo = { ...r, chave: `${r.imo}|${r.mnb}|${new Date(rp).toISOString()}`, ausencias: 0 };
      upserts.push(novo);
      if (r.situacao === 'CONFIRMADA' && rp > t(now) - 0.5 * H) ev(novo, 'CONFIRMADA', 'Nova manobra já confirmada', null, r.pob);
      continue;
    }

    best._usado = true;
    const atual = { ...r, chave: best.chave, ausencias: 0 };
    const eraSaam = best.empresa === 'SAAM';
    upserts.push(atual);

    if (eraSaam && !ehSaam) {
      if (!FINAIS.has(best.situacao)) ev(atual, 'CANCELADA', `Manobra passou para ${r.empresa || 'outra empresa'}`, best.pob, r.pob);
      continue;
    }
    if (!ehSaam) continue;

    const virouConfirmada = r.situacao === 'CONFIRMADA' && (best.situacao !== 'CONFIRMADA' || !eraSaam);
    const virouCancelada = r.situacao === 'CANCELADA' && best.situacao !== 'CANCELADA';
    const adiantou = (best._pob - rp) / 60000;
    const antecipou = eraSaam && adiantou >= ANTECIPA_MIN && ATIVAS.has(r.situacao) && rp > t(now) - 0.5 * H;

    if (virouCancelada) ev(atual, 'CANCELADA', 'Situação: CANCELADA', best.pob, r.pob);
    else if (antecipou) ev(atual, 'ANTECIPADA',
      `De ${hhmm(best.pob)} para ${hhmm(r.pob)} (−${Math.round(adiantou)} min)` + (virouConfirmada ? ' · confirmada' : ''),
      best.pob, r.pob);
    else if (virouConfirmada) ev(atual, 'CONFIRMADA', 'Situação: CONFIRMADA', best.pob, r.pob);
  }

  // Manobras salvas que não apareceram nesta leitura
  for (const o of livres) {
    if (o._usado || o.empresa !== 'SAAM' || !ATIVAS.has(o.situacao)) continue;
    if (o._pob < t(now) - 1 * H || o._pob > t(now) + 10 * 24 * H) continue;   // passado ou longe demais
    const aus = (o.ausencias || 0) + 1;
    if (aus >= 2) {
      upserts.push({ ...strip(o), situacao: 'REMOVIDA', ausencias: aus });
      ev(o, 'CANCELADA', 'Retirada da programação', o.pob, null);
    } else {
      upserts.push({ ...strip(o), ausencias: aus });
    }
  }
  return { upserts, eventos };
}

function strip(o) {
  const { _pob, _usado, ...rest } = o;
  return rest;
}
