# SPRINT 17 — Rio Grande com nível real CIEX-FURG + Santana calibrado — v2.9.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T15:30:00-03:00

Implementação:
- Novo `ciex.js`: lê os JSON públicos do Monitoramento Hidrodinâmico CIEX-FURG (estação FURG_CCMAR) — nível medido a cada 30 min, previsão hidrodinâmica horária (~72 h, vento + vazão + maré) e erro médio da previsão corrigida. Acesso pelo proxy `/ciex/*` do novo `netlify.toml` (origem sem CORS). Atualiza a cada 15 min.
- Card de maré, porto Rio Grande: modo "nível real" em cm na régua CCMar-FURG — agora (medido ou previsto), tendência da última hora, alerta quando o modelo prevê ≥ 80 cm (cota de alerta usada pelo CIEX/Defesa Civil), picos e vales do dia (proeminência ≥ 3 cm), gráfico com medido (linha), previsão (tracejada), faixa ±erro e cota. Dias fora da cobertura, ou sem rede, voltam à maré astronômica calibrada.
- Amapá (Porto de Santana) calibrado com a Tábua DHN 2026: ±14 min / ±13 cm (validação nov/2026). 13/13 portos calibrados.

Verificação: Playwright com dados reais do CIEX de 12/10/2026 (fixture) e relógio fixo: modo online (76 cm medido, alerta, 6 extremos, gráfico), +2 dias, +3 dias (fallback), modo offline (fallback astronômico), sem overflow a 360 px, sem erros; regressões tide-check e crew-check passaram. Proxy Netlify verificado após deploy.

Observação: referencial da régua CCMar ≠ Nível de Redução DHN; por isso cm e rótulo próprio, sem misturar com a maré astronômica.
