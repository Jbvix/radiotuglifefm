/* ============================================================
   TugLife FM — Leitor da programação de manobras da Praticagem RJ
   ------------------------------------------------------------
   Arquivo   : tools/saam-rj/parser.js
   Versão    : 1.0.0 (SPRINT 27 · app v3.9.0)
   Data/Hora : 2026-10-15T16:40:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v1.0.0  [NOVO] Lê a página pública https://www.praticagem-rj.com.br/
           (HTML gerado pelo servidor, ASP.NET, refeito a cada minuto),
           separa as manobras por área (Baía de Guanabara, Baía de
           Sepetiba, Porto do Forno, Porto do Açu…) e devolve objetos
           prontos para o app. Filtro por empresa de rebocador
           (coluna "EMP.RB"): 'SAA' = SAAM Towage.
   ------------------------------------------------------------
   COMO A PÁGINA É LIDA (sem DOM, só expressões regulares)
   O Deno da Edge Function não tem DOMParser, e a página é sempre
   a mesma "carta náutica": um título de área (lblArea1) seguido de
   uma tabela (tbManobrasArea) com um cabeçalho e uma linha por
   manobra (tr …_trManobraArea). As colunas são achadas PELO NOME do
   cabeçalho, não pela posição — se a praticagem inserir uma coluna
   nova, o leitor continua certo (como achar a boia pelo nome na
   carta, e não contando quantas boias passou).

   Cabeçalho atual (17 colunas):
     POB | Navio | Cal | LOA | Boca | DWT | GT | M | De | BD | Canal |
     Para | BD | CTB | RB | EMP.RB | Agência
   "BD" aparece duas vezes: é o bordo de atracação (BB = bombordo,
   BE = boreste) do berço de origem (De) e do de destino (Para).
   Por isso cada "BD" vira "<coluna anterior>_BD" (De_BD, Para_BD).

   M (tipo de manobra):  E = Entrada · S = Saída · M = Mudança
   EMP.RB: WIL = Wilson Sons · CAM = Camorim · SAA = SAAM ·
           VAL = Vale · N/A = sem rebocador.

   DATA SEM ANO
   O POB vem como "15/10 12:00" (sem ano, horário de Brasília).
   O ano é o que deixa a data mais perto de "agora":
       candidatos = ano−1, ano, ano+1 ;  escolhe min |data − agora|
   Ex.: agora = 30/12/2026 → "02/01 08:00" vira 02/01/2027 (e não
   02/01/2026, que estaria 362 dias para trás). O Brasil não tem
   horário de verão desde 2019, então o fuso é fixo: −03:00.
       instante_UTC = data_local + 3 h
   ============================================================ */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Decodifica entidades HTML (&amp; &#9898; &#xE7; …)
export const decode = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));

// Texto puro de um trecho de HTML: sem tags, espaços colapsados
export const texto = (html) => decode(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Número no formato brasileiro ("12,10" → 12.1). Vazio → null.
export const num = (s) => {
  const t = String(s ?? '').trim().replace(/\./g, '').replace(',', '.');
  return t && Number.isFinite(Number(t)) ? Number(t) : null;
};

const MANOBRA = { E: 'Entrada', S: 'Saída', M: 'Mudança' };

/* Converte "dd/mm hh:mm" (Brasília) em ISO UTC, escolhendo o ano mais
   próximo de `agora`. Devolve null se o texto não for uma data. */
export function dataPob(s, agora = new Date()) {
  const m = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const [, d, mes, h, min] = m.map(Number);
  const ano0 = new Date(agora.getTime() - 3 * 3600000).getUTCFullYear();
  let melhor = null;
  for (const ano of [ano0 - 1, ano0, ano0 + 1]) {
    const t = Date.UTC(ano, mes - 1, d, h + 3, min);      // +3 h: Brasília → UTC
    if (!melhor || Math.abs(t - agora) < Math.abs(melhor - agora)) melhor = t;
  }
  return new Date(melhor).toISOString();
}

/* Nomeia as colunas a partir do cabeçalho. Duplicatas de "BD" viram
   "<anterior>_BD"; qualquer outra duplicata ganha sufixo _2, _3… */
function nomesColunas(cab) {
  const out = [];
  cab.forEach((nome, i) => {
    let n = nome;
    if (n === 'BD' && i > 0) n = out[i - 1].replace(/_BD$/, '') + '_BD';
    let k = n, c = 2;
    while (out.includes(k)) k = `${n}_${c++}`;
    out.push(k);
  });
  return out;
}

/* Retira cada ficha <div class='tooltipDivEscondida'>…</div> contando
   a profundidade dos <div> (a ficha tem divs dentro dela — um regex
   "até o primeiro </div>" pararia no meio). O tipo da ficha vem do
   gatilho showTooltipSincrono(this, "RB | 425538 | 0") logo antes. */
export function extrairDicas(html) {
  const dicas = [];
  let limpa = '', i = 0;
  const ABRE = "<div class='tooltipDivEscondida'>";
  for (;;) {
    const ini = html.indexOf(ABRE, i);
    if (ini < 0) { limpa += html.slice(i); break; }
    const gat = html.slice(i, ini).match(/showTooltipSincrono\(this, "([^"|]+?)\s*\|/g);
    const tipo = gat ? /"([^"|]+?)\s*\|/.exec(gat[gat.length - 1])[1] : '';
    let prof = 0, fim = html.length;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = ini;
    for (let t; (t = re.exec(html));) {
      prof += t[0] === '</div>' ? -1 : 1;
      if (prof === 0) { fim = t.index + 6; break; }
    }
    dicas.push({ tipo, html: html.slice(ini + ABRE.length, fim - 6) });
    limpa += html.slice(i, ini);
    i = fim;
  }
  return { limpa, dicas };
}

/* Ficha "RB": tabela REBOCADOR | FAINAS (1 ATR, 2 DES, 3 PON, 4 NAV).
   Nome no formato "SAAM HOLANDA [70,76] (AZ)":
     [70,76] = tração estática (bollard pull) em toneladas → 70,76 t
     (AZ)    = tipo de propulsão informado pela praticagem (AZ = azimutal)
   Bolinha verde = faina marcada para aquele rebocador.
   Linha vermelha = o rebocador também está escalado em outra manobra
   (o aviso vem no atributo title da linha). */
export function rebocadores(html) {
  const fainas = [...html.matchAll(/<th>\s*\d+\s+([^<]+?)\s*<\/th>/g)].map((m) => m[1].trim());
  const out = [];
  for (const m of html.matchAll(/<tr title='([^']*)' class='(linha\w+)'>([\s\S]*?)<\/tr>/g)) {
    const tds = [...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) => t[1]);
    if (!tds.length) continue;
    const bruto = texto(tds[0]);
    const n = /^(.*?)\s*\[([\d.,]+)\]\s*(?:\(([^)]+)\))?\s*$/.exec(bruto);
    out.push({
      nome: n ? n[1] : bruto,
      bp: n ? num(n[2]) : null,
      propulsao: n && n[3] ? n[3] : '',
      fainas: fainas.filter((_, k) => /SimboloFainaVerde/.test(tds[k + 1] || '')),
      aviso: m[2] === 'linhaVermelha' ? decode(m[1]) : ''
    });
  }
  return out;
}

/* Lê a página inteira.
   Devolve { areas: [{ area, barra, manobras: [...] }], total }.
   Cada manobra: { area, pob, pob_texto, navio, imo, calado, loa, boca,
   dwt, gt, tipo, tipo_nome, de, de_bordo, para, para_bordo, canal,
   obs, rebocadores, empresa, agencia }. Linhas repetidas (a página às vezes
   lista a mesma manobra duas vezes, uma por prático) são fundidas. */
export function parsePagina(html, { agora = new Date() } = {}) {
  const areas = [];
  const partes = String(html).split(/id="rptAreas_ctl\d+_lblArea1">/).slice(1);
  for (const parte of partes) {
    const area = texto(parte.slice(0, parte.indexOf('<')));
    const barraM = /_pnlBarra1">([\s\S]*?)<\/div>/.exec(parte);
    const barra = barraM ? texto(barraM[1]) : '';
    const tabI = parte.indexOf('tbManobrasArea');
    const cab = [];
    const fimCab = parte.indexOf('_trManobraArea', tabI);
    const trechoCab = parte.slice(tabI, fimCab > 0 ? fimCab : undefined);
    for (const m of trechoCab.matchAll(/class="spanCabecalho">([\s\S]*?)<\/span>/g)) cab.push(texto(m[1]));
    const col = nomesColunas(cab);

    const vistas = new Map();
    const manobras = [];
    const linhas = parte.split(/<tr id="rptAreas_ctl\d+_rptManobrasArea_ctl\d+_trManobraArea"[^>]*>/).slice(1);
    for (const bruta of linhas) {
      // 1º tira as "fichas" (tooltips): elas têm tabelas e <tr> próprios
      // que confundiriam o fim da linha. O conteúdo de cada uma fica em
      // `dicas` (Navio → IMO; RB → rebocadores; CTB → observação).
      const { limpa, dicas } = extrairDicas(bruta);
      const linha = limpa.slice(0, limpa.indexOf('</tr>') >= 0 ? limpa.indexOf('</tr>') : undefined);
      const cel = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => texto(m[1]));
      if (cel.length < 2) continue;
      const v = Object.fromEntries(col.map((c, i) => [c, cel[i] ?? '']));
      const tipo = (v.M || '').toUpperCase();
      const dNavio = dicas.find((d) => d.tipo === 'Navio');
      const imoM = dNavio && /id="ST_NR_IMO">\s*(\d+)/.exec(dNavio.html);
      const dRb = dicas.find((d) => d.tipo === 'RB');
      const dCtb = dicas.find((d) => d.tipo === 'CTB');
      const m = {
        area,
        pob: dataPob(v.POB, agora),
        pob_texto: v.POB || '',
        navio: v.Navio || '',
        imo: imoM ? imoM[1] : null,
        calado: num(v.Cal), loa: num(v.LOA), boca: num(v.Boca),
        dwt: num(v.DWT), gt: num(v.GT),
        tipo, tipo_nome: MANOBRA[tipo] || tipo,
        de: v.De || '', de_bordo: v.De_BD || '',
        canal: v.Canal || '',
        para: v.Para || '', para_bordo: v.Para_BD || '',
        obs: dCtb ? texto(dCtb.html.replace(/<style[\s\S]*?<\/style>/g, '')) : '',
        rebocadores: dRb ? rebocadores(dRb.html) : [],
        empresa: v['EMP.RB'] || '',
        agencia: v['Agência'] || ''
      };
      const chave = [m.pob_texto, m.navio, m.tipo, m.de, m.para, m.empresa].join('|');
      const ja = vistas.get(chave);
      if (ja) {
        // Linha repetida: soma os rebocadores que ainda não estavam na lista
        for (const r of m.rebocadores) if (!ja.rebocadores.some((x) => x.nome === r.nome)) ja.rebocadores.push(r);
        if (!ja.obs) ja.obs = m.obs;
        continue;
      }
      vistas.set(chave, m);
      manobras.push(m);
    }
    areas.push({ area, barra, manobras });
  }
  return { areas, total: areas.reduce((s, a) => s + a.manobras.length, 0) };
}

/* Mantém só as manobras de uma empresa de rebocador.
   'SAA' casa com "SAA", "SAA/WIL", "WIL-SAA"… mas não com "SAAB"
   (comparação por palavra inteira, separada por / - espaço , ;). */
export function daEmpresa(pagina, sigla = 'SAA') {
  const alvo = sigla.toUpperCase();
  const tem = (e) => String(e).toUpperCase().split(/[\s/,;+-]+/).includes(alvo);
  const areas = pagina.areas.map((a) => ({ ...a, manobras: a.manobras.filter((m) => tem(m.empresa)) }));
  return { areas, total: areas.reduce((s, a) => s + a.manobras.length, 0) };
}
