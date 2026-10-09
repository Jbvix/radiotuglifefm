# Calibração das marés com a Tábua DHN

Autor: Jossian Brito · SPRINT 16 · 2026-10-08

Ferramentas usadas para calibrar `tide-data.js` contra a Tábua das Marés DHN.
Os dados da DHN **não** ficam no repositório (licença CC BY-ND); refaça a
extração a cada ano a partir dos PDFs oficiais.

## Passos

1. `npm i @neaps/tide-database @neaps/tide-predictor` numa pasta de trabalho.
2. Para cada porto, gere `dhn/<porto>.txt` no formato:
   ```
   NIVEL <nível médio da tábua>
   MES 10
   <todos os números do mês, na ordem do texto extraído do PDF>
   MES 11
   <idem>
   ```
   O texto do PDF vem embaralhado (duas colunas); não precisa desembaralhar.
   O `calib.mjs` associa cada maré ao seu dia comparando com o modelo.
3. `./runall.sh` — calibra cada porto com as estações candidatas e 4 métodos
   (bruto, secundário, admitância, harmônica), ajustando em um mês e
   validando no seguinte.
4. `node assemble.mjs` — escolhe a melhor combinação por porto
   (erro = RMS Δt/10 min + RMS Δh/5 cm + (espúrios + faltantes)/10) e grava
   `tides-data-v2.json`, que alimenta `tide-data.js`.
