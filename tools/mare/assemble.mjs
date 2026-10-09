import fs from 'node:fs';
const old = JSON.parse(fs.readFileSync('tides-data.json','utf8'));
const score = v => v.dtRms / 10 + v.dhRms * 100 / 5 + ((v.spurious ?? 0) + (v.n - v.matched)) / 10;
const files = fs.readdirSync('fit');
const out = [];
for (const p of old) {
  const cands = files.filter(f => f.startsWith(p.id + '__')).map(f => JSON.parse(fs.readFileSync('fit/' + f, 'utf8')));
  if (!cands.length) {   // Amapá: sem tábua DHN na pasta
    // Nível médio estimado: razão média DHN/(MSL−MLWS) dos portos do Norte/NE (Itaqui 1,27; Pecém 1,25; Vila do Conde 1,12)
    out.push({ ...p, z0: +(p.z0 * 1.21).toFixed(3), calib: null });
    console.log(p.id.padEnd(15), 'sem DHN → TICON direto, Z0 estimado', (p.z0*1.21).toFixed(2));
    continue;
  }
  cands.sort((a, b) => score(a.val) - score(b.val));
  const b = cands[0];
  const v = b.val;
  out.push({ ...p, z0: b.z0, hc: b.hc,
    calib: { source: 'DHN Tábua das Marés 2026', method: b.method, refStation: b.station,
             fit: '2026-10', validation: '2026-11', n: v.matched, of: v.n,
             dtRms: Math.round(v.dtRms), dhRms: Math.round(v.dhRms * 100), spurious: v.spurious } });
  console.log(p.id.padEnd(15), b.method.padEnd(11), b.station.split('/')[1].split('-')[0].padEnd(18), `±${Math.round(v.dtRms)} min ±${Math.round(v.dhRms*100)} cm  (${v.matched}/${v.n}, espúrios ${v.spurious}/${v.model})  Z0 ${b.z0}`);
}
fs.writeFileSync('tides-data-v2.json', JSON.stringify(out));
