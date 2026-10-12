# SPRINT 18 — Programação SAAM · Suape com alertas — v3.0.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T16:00:00-03:00

Implementação:
- Coletor `saam-suape-sync` (Supabase Edge Function, a cada 2 min via pg_cron): baixa a planilha de manobras da praticagem pelo link público do SharePoint (seguindo o redirecionamento com cookie FedAuth), lê só as abas visíveis, filtra Suape, casa cada manobra com a leitura anterior por IMO + tipo + horário mais próximo (≤ 48 h) e gera os alertas CONFIRMADA, CANCELADA (situação, troca de empresa ou retirada da planilha em 2 leituras seguidas) e ANTECIPADA (≥ 15 min). Adiamentos não alertam. Primeira leitura = linha de base, sem alertas.
- Banco: tabelas fechadas à API pública; acesso só por funções com PIN (hash bcrypt) e trava de 20 tentativas erradas em 10 min.
- App: card "Programação SAAM · Suape" com PIN da tripulação, manobras agrupadas por dia (horário, navio, tipo, situação, berço, calado, rebocadores, observação), alertas recentes, 3 sons sintetizados distintos + vibração + faixa colorida, e inscrição em Web Push (notificação com vibração por tipo e o som padrão do celular quando a tela está apagada).

Verificação: testes unitários do leitor e das regras (planilha sintética, 6 cenários); leitura real da planilha na nuvem (121 manobras em Suape, 74 SAAM, 0,9 s de download, 25 ms de leitura); linha de base gravada pelo cron; teste no navegador com dados reais (PIN errado/certo, renderização, teste de som, alerta novo no ciclo de 60 s, PIN lembrado, 360 px sem overflow); regressões de maré e ouvintes passaram.

Bug encontrado e corrigido no teste: sem nenhum alerta no histórico, o primeiro alerta real não tocaria (o código usava "último id > 0" como sinal de carga inicial).

Limitações: notificação com tela apagada usa o som padrão do celular (web não permite som próprio por tipo); no iPhone só funciona com o app instalado na tela de início.
