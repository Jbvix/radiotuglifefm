import XLSX from 'xlsx';
import { unzipSync } from 'fflate';
import assert from 'node:assert/strict';
import { parseWorkbook, serialToDate } from './parser.js';
import { comparar } from './regras.js';

const HDR = ['PORTO','SITUAÇÃO','POB','ERU','PRT','MNB','IMO','NAVIO','TIPO','STATUS','CALADO','DE','CB','PARA','CB','P','Q','RBQ','N','AMR','LOA','BOCA','LxB','ERU2','PRT2','OBS'];
const extra = []; for (let i=26;i<46;i++) extra.push('X'+i);
const H2 = [...HDR, ...extra.slice(0,20), 'RBQ 1','RBQ 2','RBQ 3'];
const ser = (iso) => (Date.parse(iso) - 3*3600000)/86400000 + 25569;    // local→serial
function row(o){ const r = new Array(H2.length).fill(null); const set=(n,v)=>{ r[H2.indexOf(n)] = v; };
  set('PORTO',o.porto||'SUA'); set('SITUAÇÃO',o.sit); set('POB',ser(o.pob)); set('MNB',o.mnb); set('IMO',o.imo); set('NAVIO',o.navio);
  set('CALADO',o.calado||10); set(o.mnb==='DS'?'DE':'PARA',o.berco||'CAIS 01/BB'); set('RBQ',o.rbq||'SAAM'); set('N',2); set('OBS',o.obs||null);
  set('RBQ 1',o.r1||null); set('RBQ 2',o.r2||null); return r; }
function book(rows){ const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['lixo'],['x']]), 'SETEMBRO');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([H2, ...rows.map(row)]), 'OUTUBRO');
  wb.Workbook = { Sheets: [{ Hidden: 1 }, { Hidden: 0 }] };
  return new Uint8Array(XLSX.write(wb, { type:'array', bookType:'xlsx', bookSST:true })); }

// 1) parser
assert.equal(serialToDate(46307.666666666664).toISOString(), '2026-10-12T19:00:00.000Z');
const base = [
  { sit:'PREVISTA', pob:'2026-10-12T16:00:00Z', mnb:'EA', imo:'9596844', navio:'BARBOSA LIMA SOBRINHO', r1:'PARINTINS (55)', r2:'HUGO (77)' },
  { sit:'PREVISTA', pob:'2026-10-12T21:00:00Z', mnb:'DS', imo:'9719874', navio:'CAPE PIONEER' },
  { sit:'PREVISTA', pob:'2026-10-12T22:00:00Z', mnb:'DS', imo:'9489900', navio:'SÉRGIO BUARQUE & CIA' },
  { sit:'PREVISTA', pob:'2026-10-13T02:00:00Z', mnb:'EA', imo:'1111111', navio:'OUTRA EMPRESA', rbq:'WS' },
  { sit:'PREVISTA', pob:'2026-10-13T03:00:00Z', mnb:'EA', imo:'2222222', navio:'DO RECIFE', porto:'REC' },
  { sit:'PREVISTA', pob:'2026-10-13T05:00:00Z', mnb:'EA', imo:'3333333', navio:'VAI SUMIR' },
  { sit:'PREVISTA', pob:'2026-10-13T06:00:00Z', mnb:'EA', imo:'4444444', navio:'VAI PARA WS' },
];
const p1 = parseWorkbook(book(base), unzipSync);
assert.deepEqual(p1.sheets, ['OUTUBRO']);
assert.equal(p1.rows.length, 6, 'só SUA');
const b = p1.rows.find(r=>r.imo==='9596844');
assert.equal(b.pob.toISOString(), '2026-10-12T16:00:00.000Z');
assert.deepEqual(b.rebocadores, ['PARINTINS (55)','HUGO (77)']);
assert.equal(b.para_local, 'CAIS 01/BB');
assert.equal(p1.rows.find(r=>r.imo==='9489900').navio, 'SÉRGIO BUARQUE & CIA');
console.log('parser OK', p1.rows.length, 'linhas SUA');

// 2) linha de base
const now = new Date('2026-10-12T14:00:00Z');
let r1 = comparar([], p1.rows, now, true);
assert.equal(r1.eventos.length, 0);
assert.equal(r1.upserts.length, 5, 'só SAAM é salva');
let db = r1.upserts;

// 3) mudanças
const changed = base.filter(x => x.imo !== '3333333').map(x => ({...x}));
changed.find(x=>x.imo==='9596844').sit = 'CONFIRMADA';
changed.find(x=>x.imo==='9719874').pob = '2026-10-12T20:00:00Z';         // −60 min
changed.find(x=>x.imo==='9489900').sit = 'CANCELADA';
changed.find(x=>x.imo==='4444444').rbq = 'WS';
const p2 = parseWorkbook(book(changed), unzipSync);
let r2 = comparar(db, p2.rows, now, false);
const tipos = Object.fromEntries(r2.eventos.map(e=>[e.navio, e.tipo+' · '+e.detalhe]));
console.log(tipos);
assert.match(tipos['BARBOSA LIMA SOBRINHO'], /^CONFIRMADA/);
assert.match(tipos['CAPE PIONEER'], /^ANTECIPADA.*−60 min/);
assert.match(tipos['SÉRGIO BUARQUE & CIA'], /^CANCELADA/);
assert.match(tipos['VAI PARA WS'], /^CANCELADA · Manobra passou para WS/);
assert.equal(tipos['VAI SUMIR'], undefined, '1ª ausência não alerta');
const key = r2.upserts.find(u=>u.imo==='9719874').chave;
assert.equal(key, db.find(u=>u.imo==='9719874').chave, 'mesma chave após antecipar');

// 4) 2ª ausência → cancelada
const db2 = Object.values(Object.fromEntries([...db, ...r2.upserts].map(u=>[u.chave,u])));
const r3 = comparar(db2, p2.rows, now, false);
assert.deepEqual(r3.eventos.map(e=>e.navio+':'+e.tipo), ['VAI SUMIR:CANCELADA']);
// 5) sem mudança → silêncio
const db3 = Object.values(Object.fromEntries([...db2, ...r3.upserts].map(u=>[u.chave,u])));
assert.equal(comparar(db3, p2.rows, now, false).eventos.length, 0);
// 6) atraso (adiada) não alerta; confirmada+antecipada = 1 alerta
const ch3 = changed.filter(x=>x.imo!=='3333333').map(x=>({...x}));
ch3.find(x=>x.imo==='9719874').pob = '2026-10-12T23:00:00Z';
const r4 = comparar(db3, parseWorkbook(book(ch3), unzipSync).rows, now, false);
assert.equal(r4.eventos.length, 0, 'adiamento não alerta');
const ch4 = ch3.map(x=>({...x})); const c = ch4.find(x=>x.imo==='9719874'); c.pob='2026-10-12T19:30:00Z'; c.sit='CONFIRMADA';
const db4 = Object.values(Object.fromEntries([...db3, ...r4.upserts].map(u=>[u.chave,u])));
const r5 = comparar(db4, parseWorkbook(book(ch4), unzipSync).rows, now, false);
assert.equal(r5.eventos.length, 1); assert.match(r5.eventos[0].detalhe, /confirmada/);
console.log('regras OK —', r5.eventos[0].tipo, r5.eventos[0].detalhe);

// 7) linhas duplicadas na planilha (mesmo IMO, tipo e horário)
const dup = [...base, { ...base[1] }];
const pd = parseWorkbook(book(dup), unzipSync);
const r6 = comparar([], pd.rows, now, true);
const chaves = r6.upserts.map(u => u.chave);
assert.equal(new Set(chaves).size, chaves.length, 'chaves únicas na linha de base');
const r7 = comparar(r6.upserts, pd.rows, now, false);
const ch7 = r7.upserts.map(u => u.chave);
assert.equal(new Set(ch7).size, ch7.length, 'chaves únicas na 2ª leitura');
assert.equal(r7.eventos.length, 0, 'duplicata não gera alerta');
console.log('duplicatas OK —', chaves.filter(k => k.includes('#')));
