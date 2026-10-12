/* ============================================================
   TugLife FM — Gerador da seção "Como usar" do README.md
   ------------------------------------------------------------
   Arquivo   : tools/manual/gerar-readme.mjs
   Versão    : 1.0.0 (SPRINT 20 · app v3.2.0)
   Data/Hora : 2026-10-12T17:00:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v1.0.0  [NOVO] Lê o objeto MANUAL de manual.js (fonte única) e
           reescreve o trecho do README entre os marcadores
           <!-- manual:inicio --> e <!-- manual:fim -->.
   ------------------------------------------------------------
   Uso:  node tools/manual/gerar-readme.mjs          (reescreve)
         node tools/manual/gerar-readme.mjs --check  (só confere;
               sai com código 1 se o README estiver desatualizado)
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANUAL = createRequire(import.meta.url)(join(raiz, 'manual.js'));
const INI = '<!-- manual:inicio -->', FIM = '<!-- manual:fim -->';

const linhas = [
  INI,
  `## Manual de bordo (v${MANUAL.versao})`,
  '',
  '_Gerado de `manual.js` por `tools/manual/gerar-readme.mjs` — edite lá, não aqui._',
  '',
  'No app: botão **?** no topo. No celular, a barra de abas embaixo leva a cada seção.',
  '',
  '**Novidades**',
  '',
  ...MANUAL.novidades.map((n) => `- v${n.versao}: ${n.texto}`),
  ''
];
for (const s of MANUAL.secoes) {
  linhas.push(`### ${s.label}`, '', s.resumo, '');
  for (const [t, txt] of s.itens) linhas.push(`- **${t}** — ${txt}`);
  linhas.push('');
}
linhas.push(FIM);
const bloco = linhas.join('\n');

const p = join(raiz, 'README.md');
const atual = readFileSync(p, 'utf8');
const i = atual.indexOf(INI), f = atual.indexOf(FIM);
if (i < 0 || f < 0) { console.error('Marcadores não encontrados no README.md'); process.exit(2); }
const novo = atual.slice(0, i) + bloco + atual.slice(f + FIM.length);
if (process.argv.includes('--check')) {
  if (novo !== atual) { console.error('README desatualizado: rode node tools/manual/gerar-readme.mjs'); process.exit(1); }
  console.log('README em dia com manual.js');
} else { writeFileSync(p, novo); console.log('README atualizado a partir de manual.js'); }
