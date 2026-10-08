# SPRINT 15 — Tábua de Maré — v2.7.0
Autor: Jossian Brito  
Data/hora: 2026-10-08T18:30:00-03:00

Implementação: card "Tábua de Maré" com 13 portos (Suape, Salvador, Santos, Paranaguá, Rio de Janeiro, Itaqui, Vitória, Pecém, Vila do Conde, Rio Grande, Itajaí, Sepetiba, Amapá). Previsão harmônica no próprio aparelho (`tides.js` + `vendor/tide-engine.js` = @neaps/tide-predictor 0.11.0, MIT), com constantes de marégrafos TICON-4 (CC BY 4.0) da rede UHSLC em `tide-data.js`. Alturas referidas ao MLWS (≈ Nível de Redução da DHN) somando Z0 = MSL − MLWS. Mostra altura agora e tendência, próxima preamar/baixa-mar, extremos do dia e curva SVG de 24 h; navegação por dia; porto lembrado no aparelho; funciona offline (arquivos no cache do service worker v2.7.0).

Estações: 6 no porto (Amapá/Santana, Itaqui/Madeira, Suape, Salvador, Rio de Janeiro/Ilha Fiscal, Rio Grande), 2 próximas (Pecém ← Fortaleza 43 km; Vila do Conde ← Belém 30 km), 5 aproximadas (Sepetiba ← Ilha Fiscal 69 km; Paranaguá ← Cananéia 80 km; Santos ← Ubatuba 132 km; Itajaí ← Imbituba 147 km; Vitória ← Macaé 243 km). O card exibe selo de confiabilidade e aviso nos aproximados. Filtro remove pares de extremos com diferença < 8 cm (micromaré de Rio Grande).

Verificação: Playwright percorreu os 13 portos (extremos e altura presentes, sem erros), navegação de dias, sem overflow a 360 px; regressão do SPRINT 14 e schedule.test.cjs passaram; git diff --check passou. Coerência física: sizígia de 10/10 com baixa-mares ≈ 0 m (MLWS) e preamar de 5,3 m em Itaqui. NÃO validado contra a Tábua da DHN (site bloqueia acesso automatizado) — pendente comparação manual.

Lição aprendida: dimensionar o viewBox do SVG pela largura real evita distorção de pontos e textos que o preserveAspectRatio="none" causa.
