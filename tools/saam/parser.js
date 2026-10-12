/* ============================================================
   TugLife FM — Leitor da planilha de manobras (Suape)
   ------------------------------------------------------------
   Arquivo   : parser.js   (módulo puro: roda no Deno e no Node)
   Versão    : 1.0.0 (SPRINT 18)
   Data/Hora : 2026-10-12T15:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   Um .xlsx é um ZIP de XMLs. Em vez de carregar uma biblioteca
   pesada (a função na nuvem tem pouco tempo de CPU), lemos só:
     xl/workbook.xml            → abas e quais estão visíveis
     xl/_rels/workbook.xml.rels → arquivo de cada aba
     xl/sharedStrings.xml       → textos (células guardam índices)
     xl/worksheets/sheetN.xml   → as linhas das abas visíveis
   As colunas são achadas pelo NOME do cabeçalho (linha 1), então
   se a praticagem inserir uma coluna nova o leitor continua certo.

   Horários: o Excel guarda data como "número de série" (dias desde
   30/12/1899). A planilha está em hora local de Pernambuco (UTC−3):
     UTC(ms) = (serial − 25569) · 86 400 000 + 3 h
     ex.: 46307.6667 → 12/10/2026 16:00 local → 19:00 UTC
   ============================================================ */

const dec = new TextDecoder('utf-8');

const unescapeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&');

function sharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let t = '';
    for (const m of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += m[1];
    out.push(unescapeXml(t));
  }
  return out;
}

function visibleSheets(workbookXml, relsXml) {
  const rels = {};
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0]), target = /Target="([^"]+)"/.exec(m[0]);
    if (id && target) rels[id[1]] = target[1].replace(/^\/?xl\//, '');
  }
  const sheets = [];
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = m[0];
    if (/state="(hidden|veryHidden)"/.test(tag)) continue;
    const name = /name="([^"]+)"/.exec(tag)[1];
    const rid = /r:id="([^"]+)"/.exec(tag)[1];
    sheets.push({ name: unescapeXml(name), path: 'xl/' + rels[rid] });
  }
  return sheets;
}

// Linhas → [{ letra: valor }]; valor de fórmula vem do <v> já calculado
function readRows(sheetXml, strings) {
  const rows = [];
  for (const r of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = { _linha: Number(r[1]) };
    for (const c of r[2].matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[2], inner = c[3] || '';
      let v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
      if (v === undefined) v = (/<t[^>]*>([\s\S]*?)<\/t>/.exec(inner) || [])[1];
      if (v === undefined || v === '') continue;
      if (/\bt="s"/.test(attrs)) v = strings[Number(v)];
      else v = unescapeXml(v);
      row[c[1]] = v;
    }
    rows.push(row);
  }
  return rows;
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

export function serialToDate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 30000) return null;           // vazio ou não-data
  return new Date(Math.round((n - 25569) * 86400000) + 3 * 3600000);
}

/* Lê o .xlsx e devolve as manobras de um porto (todas as empresas,
   para que o comparador perceba quando uma manobra sai da SAAM). */
export function parseWorkbook(bytes, unzipSync, { porto = 'SUA' } = {}) {
  const wanted = new Set(['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml']);
  // 1ª passada: só os índices (rápido)
  const idx = unzipSync(bytes, { filter: (f) => wanted.has(f.name) });
  const get = (z, n) => (z[n] ? dec.decode(z[n]) : '');
  const sheets = visibleSheets(get(idx, 'xl/workbook.xml'), get(idx, 'xl/_rels/workbook.xml.rels'));
  const strings = sharedStrings(get(idx, 'xl/sharedStrings.xml'));
  // 2ª passada: só as abas visíveis
  const paths = new Set(sheets.map((s) => s.path));
  const zs = unzipSync(bytes, { filter: (f) => paths.has(f.name) });

  const out = [];
  for (const sh of sheets) {
    const rows = readRows(get(zs, sh.path), strings);
    if (!rows.length) continue;
    // cabeçalho → letra da coluna (primeira ocorrência de cada nome)
    const col = {};
    for (const [k, v] of Object.entries(rows[0])) if (k !== '_linha' && !(norm(v) in col)) col[norm(v)] = k;
    const need = ['PORTO', 'SITUACAO', 'POB', 'MNB', 'IMO', 'NAVIO', 'RBQ'];
    if (!need.every((n) => n in col)) continue;               // aba sem o formato esperado
    const val = (row, name) => (col[name] ? row[col[name]] : undefined);

    for (const row of rows.slice(1)) {
      if (norm(val(row, 'PORTO')) !== porto) continue;
      const imo = String(val(row, 'IMO') ?? '').trim();
      const navio = String(val(row, 'NAVIO') ?? '').trim();
      const pob = serialToDate(val(row, 'POB'));
      if (!imo || !navio || navio === '0' || !pob) continue;
      const rebocadores = ['RBQ 1', 'RBQ 2', 'RBQ 3', 'RBQ 4', 'RBQ 5']
        .map((n) => String(val(row, n) ?? '').trim()).filter(Boolean);
      const calado = Number(val(row, 'CALADO'));
      out.push({
        imo, navio,
        mnb: norm(val(row, 'MNB')) || null,
        situacao: norm(val(row, 'SITUACAO')) || 'PREVISTA',
        pob,
        calado: Number.isFinite(calado) ? Math.round(calado * 100) / 100 : null,
        de_local: String(val(row, 'DE') ?? '').trim() || null,
        para_local: String(val(row, 'PARA') ?? '').trim() || null,
        n_rebocadores: Number(val(row, 'N')) || null,
        rebocadores,
        obs: String(val(row, 'OBS') ?? '').trim() || null,
        empresa: norm(val(row, 'RBQ')) || null,
        aba: sh.name,
        linha: row._linha
      });
    }
  }
  return { sheets: sheets.map((s) => s.name), rows: out };
}
