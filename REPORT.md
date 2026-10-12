# Documentação do projeto — docs/PROJETO.md 1.0.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T17:45:00-03:00

- Novo `docs/PROJETO.md`: visão geral e princípios, árvore de diretórios com a função de cada arquivo, diagrama de arquitetura, ordem de carregamento dos scripts, tabela de módulos e contratos entre eles, dados no aparelho, backend Supabase (tabelas, funções, coletor SAAM e regras de alerta), fluxos (alerta SAAM, maré com a fórmula harmônica, ouvintes), interface, checklist de versão e deploy, testes, ferramentas, convenções, licenças de terceiros e limitações. Link no `README.md`.
- Conferido contra o código: conversão do serial do Excel (exemplo 46307,75 → 18:00 de Brasília), amplitude M2 de Suape (0,74 m), chaves de armazenamento, registro do service worker e regra do pico de ouvintes.

# SPRINT 21 — Grade semanal recolhível — v3.3.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T17:30:00-03:00

Implementação:
- Na aba Rádio, a grade semanal (dias, "Hoje" e lista) foi para um painel recolhível **"Grade da semana · Ver programação"**, no mesmo estilo dos outros painéis. Fechado no celular, aberto no computador. Ao abrir, volta para o dia de hoje e rola até o programa no ar. Relógio e data continuam sempre visíveis.
- Manual de bordo: item "Grade semanal" atualizado e novidade da v3.3.0. Novo campo `tourVersao` em `manual.js`: o tour só reaparece quando ele mudar (segue em 3.2.0), não a cada ajuste de texto. README regenerado.

Verificação: grade fechada no celular e aberta no computador; ao abrir, lista preenchida com o programa no ar visível; sem erros de JavaScript. Rolagem extra da aba Rádio em 390×844 caiu de 1.093 px para 572 px; o botão "Ouça Agora" termina a 666 px (dentro da primeira tela). Regressões: schedule.test, tabs, tide, crew, saam, browser (8 rodadas seguidas), pwa, equalizer e manual passaram.

Confirmação em campo: **push SAAM testado em celular real pelo Comandante — resultado satisfatório** (pendência da v3.0.0 encerrada).

Bugs encontrados e corrigidos:
- `browser-check.cjs` falhava de forma intermitente (1 em 5): checava `playCalls` logo após tocar no mini-player, mas o play passa pela preparação assíncrona do áudio. Agora espera a chamada (até 3 s).

Limitações: a aba Rádio ainda rola cerca de 570 px para mostrar o card do relógio, a faixa atual, os links (Store, Deezer, Alexa), Instalar/Compartilhar e o rodapé — tudo abaixo do player.

# SPRINT 20 — Manual de bordo (botão ?) e Tour guiado — v3.2.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T17:00:00-03:00

Implementação:
- Botão **?** no cabeçalho (todas as abas, celular e computador) abre o **Manual de bordo**: faixa de novidades da versão, chips Rádio · Maré · Manobras · Portos · App, funcionalidades em sanfona (22 itens) e atalho "Abrir a aba …" (em App, "Instalar na tela inicial"). No celular é uma folha em tela cheia; abre já na seção da aba em que o usuário está.
- **Tour guiado** de 6 passos (Rádio → Ouvir ao vivo → Maré → Manobras → Portos → botão ?) com destaque recortado sobre o elemento real; a caixa de texto vai para o lado com mais espaço. Aparece sozinho na 1ª abertura após cada nova versão do manual, só no celular e nunca quando o app é aberto pela notificação de manobra ou pelo link `#manual`. "Pular", "Voltar" e "Rever o tour" (no manual). No computador o tour destaca os cards.
- **Fonte única:** `manual.js` guarda textos do manual, novidades e passos do tour. `tools/manual/gerar-readme.mjs` gera a seção "Manual de bordo" do `README.md` (`--check` confere se está em dia).
- `tabs.js` expõe `window.TugTabs.abrir()`; link direto `#manual`; manual disponível offline (service worker).

Verificação: `manual-check.cjs` (novo, no repositório) em 390×844 e 1280×900 — tour automático com 6 passos e caixa sempre dentro da tela, só uma vez por versão, manual na seção da aba atual, chips, sanfona, "Abrir a aba Manobras", "Rever o tour", `#manual`, tema claro, computador sem tour automático; sem erros de JavaScript. Regressões: schedule.test, tabs, tide, crew, saam, browser, pwa e equalizer passaram. README conferido com `--check`.

Bugs encontrados e corrigidos:
- Os testes de celular que tocam na tela depois de 1,2 s esbarravam no tour automático (sobreposição intercepta o toque). Os testes agora marcam o tour como visto antes de abrir a página; os de maré e SAAM só passavam por chegarem antes do tour.

Limitações: os textos do manual são estáticos (editar `manual.js` e rodar o gerador). Sem busca no manual — com ~20 itens, os chips bastam.

# SPRINT 19 — Layout B: tela única com abas — v3.1.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T19:30:00-03:00

Implementação:
- Celular (até 760 px): o app virou uma tela única com barra de abas inferior **Rádio | Maré | Manobras | Portos** (`tabs.js` + bloco SPRINT 19 do `refresh.css`). Cabeçalho compacto fixo no topo; a página não rola, só o conteúdo da aba quando precisa. Fora da aba Rádio, a faixa "ao vivo" (mini-player) fica logo acima da barra.
- Cada bloco declara sua aba em `data-tab`; `tabs.js` só grava a aba ativa em `<body data-aba>` e o CSS faz o resto. Nenhum card é recriado — maré, SAAM e ouvintes seguem com os mesmos ids e scripts.
- Selo laranja na aba **Manobras** a cada alerta SAAM recebido em outra aba (`saam.js` emite o evento `saam:alerta`; testes de som não contam). Abrir a aba zera o selo.
- Clique na notificação push (`#card-saam`) abre direto a aba Manobras.
- Aba **Portos** abre o Painel do Marujo e só então carrega o mapa (economia de dados a bordo); mapa ocupa a altura útil.
- A aba escolhida é lembrada no aparelho.
- Computador: grade original inalterada, barra de abas oculta.
- Âncora/hélice flutuante (PixiJS) e o painel "Efeitos visuais" **desabilitados**: o script do PixiJS (CDN) não é mais carregado, o que tira um laço de animação a ~60 quadros/s que rodava mesmo com a rádio parada.

Verificação: Playwright em 390×844 nas 4 abas (página sem rolagem; só a aba ativa visível; mapa carregado só ao abrir Portos; curva da maré redesenhada na largura real do card; selo acende e apaga; `#card-saam` abre Manobras) e em 1280 px (grade com todos os cards, barra oculta); sem erros de JavaScript. Regressões: schedule.test, tide-check, crew-check, saam-check, pwa-check, equalizer-check e browser-check passaram.

Bugs encontrados e corrigidos:
- `browser-check.cjs` falhava desde a v2.7 (dois botões "Hoje": grade e maré). Agora usa `#schedule-today`; também passou a tocar numa aba antes do mini-player, que no layout novo não aparece na aba Rádio.

Limitações: a aba Rádio ainda rola para mostrar a grade semanal completa abaixo do player (player, faixa atual e botão "Ouça Agora" cabem na primeira tela de 844 px). Em telas muito baixas (< 700 px), Maré pode rolar alguns centímetros.

# SPRINT 18 — Programação SAAM · Suape com alertas — v3.0.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T16:00:00-03:00

Implementação:
- Coletor `saam-suape-sync` (Supabase Edge Function, a cada 2 min via pg_cron): baixa a planilha de manobras da praticagem pelo link público do SharePoint (seguindo o redirecionamento com cookie FedAuth), lê só as abas visíveis, filtra Suape, casa cada manobra com a leitura anterior por IMO + tipo + horário mais próximo (≤ 48 h) e gera os alertas CONFIRMADA, CANCELADA (situação, troca de empresa ou retirada da planilha em 2 leituras seguidas) e ANTECIPADA (≥ 15 min). Adiamentos não alertam. Primeira leitura = linha de base, sem alertas.
- Banco: tabelas fechadas à API pública; acesso só por funções com PIN (hash bcrypt) e trava de 20 tentativas erradas em 10 min.
- App: card "Programação SAAM · Suape" com PIN da tripulação, manobras agrupadas por dia (horário, navio, tipo, situação, berço, calado, rebocadores, observação), alertas recentes, 3 sons sintetizados distintos + vibração + faixa colorida, e inscrição em Web Push (notificação com vibração por tipo e o som padrão do celular quando a tela está apagada).

Verificação: testes unitários do leitor e das regras (planilha sintética, 6 cenários); leitura real da planilha na nuvem (121 manobras em Suape, 74 SAAM, 0,9 s de download, 25 ms de leitura); linha de base gravada pelo cron; teste no navegador com dados reais (PIN errado/certo, renderização, teste de som, alerta novo no ciclo de 60 s, PIN lembrado, 360 px sem overflow); regressões de maré e ouvintes passaram.

Bugs encontrados e corrigidos:
- Em produção, da 2ª leitura em diante o upsert falhou ("ON CONFLICT ... cannot affect row a second time"): linhas antigas da planilha (fora da janela de 3 dias carregada do banco) geravam chaves repetidas no mesmo lote. Agora o coletor só compara a janela de 3 dias, as chaves novas são garantidamente únicas e o lote é deduplicado. Teste de regressão incluído.
- No teste do navegador: sem nenhum alerta no histórico, o primeiro alerta real não tocaria (o código usava "último id > 0" como sinal de carga inicial).

Limitações: notificação com tela apagada usa o som padrão do celular (web não permite som próprio por tipo); no iPhone só funciona com o app instalado na tela de início.
