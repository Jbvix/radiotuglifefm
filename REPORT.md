# SPRINT 16 — Marés calibradas com a Tábua DHN — v2.8.0
Autor: Jossian Brito  
Data/hora: 2026-10-08T22:30:00-03:00

Implementação: 12 dos 13 portos calibrados contra a Tábua das Marés DHN 2026 (pasta "mares 2026" do Drive). O texto extraído dos PDFs vem embaralhado; `tools/mare/calib.mjs` associa cada preamar/baixa-mar ao seu dia comparando com o modelo, e ajusta por mínimos quadrados (h(tᵢ)=Hᵢ e h'(tᵢ)=0) quatro métodos: bruto, porto secundário (Δt + razão de amplitude), admitância por espécie e análise harmônica do próprio porto (com pontos de forma cossenoidais). Ajuste em out/2026, validação em nov/2026; escolhido o menor erro, penalizando extremos espúrios. Z0 passou a ser o nível médio sobre o Nível de Redução da DHN (antes MSL−MLWS, que deixava as alturas ~25 cm abaixo da tábua). O selo do card mostra o erro típico de cada porto.

Resultado (validação nov/2026, RMS): Pecém ±5 min/±4 cm; Salvador ±6/±3; Suape ±8/±3; Itaqui ±11/±8; Rio de Janeiro ±11/±4; Rio Grande ±12/±10; Vitória ±13/±8; Itajaí ±13/±13; Paranaguá ±16/±20; Sepetiba ±16/±10; Vila do Conde ±17/±16; Santos ±17/±15. Amapá sem tábua na pasta: estação local TICON, nível estimado.

Descoberta: o desvio de ~35 min observado contra tabuademares.com era erro do site; contra a DHN o modelo TICON já acertava Suape com ±8 min. A correção relevante era a altura de referência.

Verificação: Playwright 13 portos sem erros; conferência manual 08/10 Suape (DHN 02:14/08:31/14:38/20:44 × app 02:14/08:36/14:43/20:47) e Itaqui (DHN 05:19/11:29/17:46/23:53 × app 05:15/11:24/17:32/23:41); regressão do contador de ouvintes e schedule.test.cjs passaram.

Lição aprendida: validar só o horário dos extremos não basta — um modelo pode acertar os extremos e inventar oscilações entre eles. A métrica precisa contar extremos espúrios, e o ajuste precisa de pontos de forma entre os extremos.
