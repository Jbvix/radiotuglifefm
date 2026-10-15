# v3.7.1 — Correção da aba Rádio com ouvintes conectados
Autor: Jossian Brito  
Data/hora: 2026-10-15T03:00:00-03:00

Achado pelo Comandante no preview (Moto G Power, 412×823): com ouvintes conectados, a linha "👥 a bordo · Pico hoje" encavalava o selo STANDBY e o "Mais da TugLife" ficava atrás da barra de abas. Os testes da v3.7.0 bloqueavam o Supabase, então a linha de ouvintes nunca aparecia neles.

Causa e correção:
- A linha de ouvintes tem `margin-top:-12px`, pensada para os 20 px de folga abaixo do selo; a v3.7.0 reduziu essa folga para 4 px no celular e a linha subiu 8 px sobre o selo. Agora, na aba Rádio do celular, ela fica sem margem negativa e com selos mais finos.
- Para caber de novo numa tela: logo de 84 px e "Próximo programa" numa linha só (rótulo e valor lado a lado).
- O painel `<details>` não pegava o `width:100%` das `<section>` e, fechado, ficava estreito; agora ocupa a largura toda.
- Versão 3.7.1 (cache novo no `sw.js`, para os celulares receberem o CSS).

Verificação: novo cenário 5 no `radio-check.cjs` (ouvintes conectados em 390×844 e 412×823): **falha com o CSS da v3.7.0** ("linha de ouvintes não encavala o STANDBY") e passa com a correção. Medido: 390×844 com 0 px de rolagem, 412×823 com 2 px, "Mais" à vista nas duas. Regressões: radio, manual, tide-live, schedule.test, browser, pwa e equalizer passaram.

# SPRINT 25 — Aba Rádio numa tela só (P2-A) — v3.7.0
Autor: Jossian Brito  
Data/hora: 2026-10-15T01:30:00-03:00

Antes: em 390×844 a aba Rádio media 1.394 px para 844 px de tela (~550 px de rolagem); abaixo da dobra ficavam relógio, grade, faixa atual, Instalar/Compartilhar, Store/Deezer/Alexa e o rodapé (com a data de atualização parada em 12/10).

Implementação (proposta P2-A aprovada pelo Comandante):
- **Faixa atual (♪) dentro do player**, logo abaixo do programa no ar; o card "Nesta frequência · faixa atual" deixou de existir. Mensagem de falha encurtada para "Faixa indisponível no momento." (cabe numa linha).
- **Painel recolhível "Mais da TugLife"** (`#more-panel`) com Instalar app, Compartilhar · QR Code, TugLife Store, Deezer e Alexa. Fechado no celular; ao abrir, a aba rola sozinha até os botões (parando acima da barra de abas). No computador abre sozinho, numa linha, logo abaixo do cabeçalho (onde ficava a barra Instalar/Compartilhar).
- **Celular:** logo de 100 px, legenda do espectro oculta (o selo Standby/Ao vivo já informa), relógio numa linha (data à esquerda, hora à direita, sem a linha do fuso), espaçamentos menores; rodapé só no computador.
- O botão "Instalar na tela inicial" do Manual de bordo agora abre a aba Rádio e o painel antes de instalar.
- Rodapé com a data de atualização correta. Manual de bordo (itens Faixa atual, Instalar, Compartilhar e novidade da v3.7.0), README regenerado, `docs/PROJETO.md` 1.4.0, versão 3.7.0.

Verificação: `radio-check.cjs` (novo) — 390×844 com **0 px de rolagem** e play, faixa, grade e "Mais" acima da barra de abas; faixa dentro do player; painel fechado e rodapé oculto no celular; abrir o painel rola até os botões; manual → App → "Instalar na tela inicial" volta à aba Rádio, abre o painel e o diálogo; 1280×900 com painel aberto numa linha entre o cabeçalho e o player, rodapé visível, sem rolagem lateral; sem erros de JavaScript. Medido também em 360×740: rolagem de ~130 px, com o play e a faixa à vista. Regressões: schedule.test, browser, pwa, equalizer, manual e tide-live passaram.

Bugs encontrados e corrigidos durante a sprint:
- Sem a barra Instalar/Compartilhar, a linha 2 da grade do computador ficou vazia e o card de Maré (largura total) subiu para lá, empurrando o player para baixo. O painel "Mais" passou a ocupar essa linha.
- A regra geral `.footer-actions {width:100%}` impedia os botões de ficarem numa linha no painel do computador.
- Um comentário `//` posto na mesma linha do `catch` engoliu a chave de fechamento e quebrou o script da faixa atual; o teste acusou o erro de JavaScript e o comentário foi para a linha de cima.

Limitações: em celulares baixos (≤ 740 px de altura) a aba ainda rola um pouco. A versão e o autor, antes no rodapé, só aparecem no computador e no Manual de bordo.

# SPRINT 24 — Nível medido em Pecém, Rio de Janeiro, Paranaguá e Salvador — v3.6.0
Autor: Jossian Brito  
Data/hora: 2026-10-15T00:30:00-03:00

Validação das fontes (30 dias, 15/09–15/10/2026, contra a previsão calibrada DHN de cada porto):

| Porto | Fonte | Correlação | Diferença típica | Zero do radar → NR | Oscilação semanal | Decisão |
|---|---|---|---|---|---|---|
| Pecém | SiMCosta 307 (no porto) | 1,00 | 3,5 cm | 9,293 m | 3,3 cm | ✅ ±3 cm |
| Salvador | IBGE/RMPG via IOC (`salv`) | 1,00 | 4,3 cm | 4,195 m | 1,1 cm | ✅ ±3 cm |
| Rio de Janeiro | SiMCosta 304 (Niterói/DHN) | 0,93 | 11,9 cm | 11,528 m | 13,9 cm | ✅ ±7 cm |
| Paranaguá | SiMCosta 300 (CEM/UFPR) | 0,86 | 28,4 cm (−78 a +91) | 11,295 m | 18,1 cm | ✅ ±9 cm |
| Itaqui | SiMCosta 302 (Ribamar) | 0,98 | 37 cm; 21 cm mesmo com amplitude ×0,82 e +11 min | — | — | ❌ |

- Itaqui fica de fora: Ribamar está em outra baía, com amplitude 18% menor; o erro de transferência apareceria como maré meteorológica falsa num porto de 6 m de maré.
- Sem fonte: Vitória (Aracruz mudo), Vila do Conde (Belém mudo), Amapá (Santana mudo no SiMCosta e intermitente na IOC), Santos (Ilhabela a ~100 km, correlação 0,83) e Itajaí (Imbituba a 147 km, 0,77).
- Salvador vem do IBGE pela IOC/UNESCO: dado com ~5 min (o SiMCosta chega com ~15–20 min), CORS `*`.

Implementação:
- `tide-live.js` 3.6.0: 4 portos novos em `ESTACOES`; segunda API (IOC) por adaptadores (`url` + `ler`), escolhida em `fonte.api`; `fonte.faixa` com as leituras válidas de cada radar; `fonte.sensor` filtra o sensor certo na resposta da IOC. Sinal de menos tipográfico no nível (−0,09 m).
- `tools/mare/simcosta-offset.mjs` 1.2.0: usa os adaptadores do app (SiMCosta e IOC) e sugere a incerteza (metade da oscilação semanal, mínimo 3 cm). Rodada nos 6 portos: todos os offsets conferem.
- Manual de bordo: item "Nível medido (6 portos)" e novidade da v3.6.0; README regenerado. `docs/PROJETO.md` 1.3.0 (§6.4 com tabela dos 6 portos e a decisão de Itaqui). Versão 3.6.0 em `VERSION.json`, `index.html`, `sw.js` e `manual.js`.

Verificação: `tide-live-check.cjs` com 11 cenários: os 4 portos novos com "+12 cm acima da previsão" na fonte certa e 1ª busca de 6 h; Salvador com a IOC simulada e um sensor de isca (`prs` = 9,999 m) que precisa ser ignorado; Itaqui sem nenhuma chamada de API; cenários anteriores intactos. Contra as APIs reais (00:2x de 15/10): Suape −5 cm, Rio Grande −9, Pecém −6, Rio +1, Paranaguá **−25 cm** (previsão "0,2 m enchendo", medido "−0,09 m vazando") e Salvador −3; sem erros de JavaScript. Regressões: schedule.test, browser, pwa, equalizer e manual passaram; README conferido com `--check`.

Limitações: 6 dos 13 portos com medição. Nível absoluto estimado (±3 a ±9 cm) até a amarração dos radares ao IBGE. Salvador depende da IOC continuar redistribuindo o marégrafo do IBGE.

# SPRINT 23 — Suape com nível do mar medido ao vivo (Recife + Tamandaré) — v3.5.0
Autor: Jossian Brito  
Data/hora: 2026-10-14T22:30:00-03:00

Validação da fonte (Etapa 1, pesquisa):
- O marégrafo de **Suape (SiMCosta id 311) está mudo**: nenhuma leitura de mar/2024 até hoje; também "fora do ar" na rede IOC/UNESCO. O radar dele (série 27092984) aparece em Tamandaré desde set/2024 — muito provavelmente foi transferido.
- Dois marégrafos vivos, um de cada lado do porto: **Recife (id 330, UFPE, desde mai/2026)**, ~40 km ao norte, e **Tamandaré (id 399, CEPENE/UFPE)**, 44 km ao sul. 720/720 h completas em 30 dias, dado com ~20 min, mesma API pública do SiMCosta (CORS `*`, sem login).
- Medido × previsão do app para Suape em 30 dias (15/09–15/10/2026): correlação 0,996 (Recife) e 0,992 (Tamandaré); amplitude medida/prevista 1,03 e 1,00. A maré chega **11 min antes** nas duas (melhor ajuste, passos de 1 min). Com essa correção, diferença típica de 4,7 cm (Recife), 4,2 cm (Tamandaré) e **4,1 cm na média das duas**; Recife − Tamandaré no NR: 0,0 cm em média (RMS 3,2 cm).
- Leitura crítica: em Suape a maré astronômica domina e a previsão já acerta; o medido serve para confirmar e para flagrar o fora do normal (ressaca, maré meteorológica). Em Rio Grande é o contrário.

Implementação (Etapa 2, opção A aprovada pelo Comandante):
- `tide-live.js` 3.5.0: `ESTACOES[porto].fontes` (1 ou mais marégrafos, offset por fonte). Suape = média minuto a minuto de Recife (10,311 m) e Tamandaré (10,305 m), cortada no último minuto que ambos já mandaram. Fonte com dado > 30 min sai da média e a faixa avisa "Só Tamandaré no ar (Recife sem dado)". Fontes buscadas em paralelo.
- Correção de **porto secundário** (`adiantamentoMin: 11`): `t_porto = t_leitura + 11 min`. Sem ela, perto da meia-maré (~0,5 m/h) surgiria uma maré meteorológica falsa de ~9 cm.
- Faixa "Ao vivo · nível medido · Recife + Tamandaré", linha "Média de Recife e Tamandaré · horário corrigido para Suape", crédito "SiMCosta/FURG, UFPE e CEPENE", ±4 cm.
- `tools/mare/simcosta-offset.mjs` 1.1.0: várias fontes, aplica o adiantamento, procura a melhor defasagem (−30 a +30 min) e mede a diferença entre as fontes. Uso: `node tools/mare/simcosta-offset.mjs suape 30`.
- Manual de bordo: item "Nível medido (Rio Grande e Suape)" e novidade da v3.5.0; README regenerado. `docs/PROJETO.md` 1.2.0 (§6.4 reescrito). Versão 3.5.0 em `VERSION.json`, `index.html`, `sw.js` (cache novo) e `manual.js`.

Verificação: `tide-live-check.cjs` com 9 cenários (3 novos de Suape): média das duas fontes com nível = previsão(t + 11 min) + 12 cm (erro ≤ 1 cm) e "+12 cm acima da previsão"; Recife fora → segue só com Tamandaré e avisa; as duas fora → "indisponível" com a previsão intacta; Rio Grande sem mudança. Passou 2 vezes seguidas. Teste contra a **API real**: Suape "0,74 m · −6 cm abaixo da previsão", Rio Grande "0,16 m · −9 cm", linha verde sobre a curva, sem erros de JavaScript. Ferramenta de offset rodada na API real (recupera 10,311 e 10,305 m). Regressões: schedule.test, browser, pwa, equalizer e manual passaram; README conferido com `--check`.

Bugs encontrados e corrigidos:
- **Maré meteorológica inventada com a maré correndo:** o nível era a mediana dos últimos 10 min (que representa ~5 min atrás) comparada à previsão do último minuto. Em Suape, vazando a ~0,5 m/h, o teste mostrou +16 cm em vez de +12. Agora a maré meteorológica é a mediana dos resíduos (medido − previsto) minuto a minuto e o nível = previsão + essa mediana. Afetava também Rio Grande, mas lá a maré astronômica quase não se move e o erro passava de 1 cm.

Observação: a ferramenta de offset mostrou em Rio Grande uma maré meteorológica de até **+108 cm** na última semana; o offset de 30 dias (12,381 m) segue a menos de 1 cm do atual (12,374 m), sem necessidade de recalibrar.

Limitações: Suape não tem marégrafo próprio; Recife e Tamandaré ficam ~40 km de cada lado e fenômenos muito locais da baía não aparecem. Nível absoluto estimado (±4 cm) até a amarração oficial dos radares. Próximos portos com marégrafo SiMCosta no ar: Pecém, Paranaguá, Niterói (Rio), Salvador e São José do Ribamar (Itaqui). Os testes `browser`, `pwa` e `equalizer` estão fixos no Edge (`channel: 'msedge'`) e aqui rodaram com o Chromium do servidor de testes por cópia temporária; `tools/saam/test.mjs` não rodou (pacote `xlsx` não instalado neste ambiente; SAAM não foi tocado).

# SPRINT 22 — Rio Grande com nível do mar medido ao vivo — v3.4.0
Autor: Jossian Brito  
Data/hora: 2026-10-12T18:30:00-03:00

Validação da fonte:
- SiMCosta/FURG tem API pública e documentada (`/q/docs/`, Swagger 1.0.0), não divulgada na área de download. Sem login, CORS liberado, 1 leitura/min.
- Estação útil: marégrafo radar de **São José do Norte (id 332)**, ativo (dado com ~4 min). Rio Grande 2 (303) parado desde 16/09/2026; Rio Grande 1 e ENRG-2 desativados.
- Medido × previsão do app em 7 dias: correlação 0,39 (0,54 com a melhor defasagem), amplitude real 44% da prevista. Em Rio Grande a maré astronômica explica pouco; o dado medido vale mais.

Implementação:
- `tide-live.js` (novo): faixa verde "Ao vivo · nível medido · São José do Norte" no card de Maré quando o porto é Rio Grande e o dia é hoje — nível agora (mediana de 10 min, no NR estimado ±7 cm), tendência (reta de mínimos quadrados de 30 min), **maré meteorológica** (medido − previsto; laranja a partir de ±15 cm), idade do dado e crédito SiMCosta/FURG. Linha verde com as últimas 6 h sobre a curva prevista; a caixa "Agora" passa a "Previsto agora".
- Busca: 6 h na 1ª carga (~52 KB), depois incremental a cada 5 min (~1 KB), só com a página visível. Dado > 30 min ou falha → aviso e volta só à previsão.
- Zero do radar → NR: offset 12,374 m pela média de 706 h (12/09–12/10/2026); semanas entre 12,30 e 12,44 m. Nova ferramenta `tools/mare/simcosta-offset.mjs` recalcula a partir da API.
- `tides.js` 3.4.0: ganchos `window.TugTides` e chamada a `TugTideLive`; escala do gráfico inclui o medido. Manual de bordo com o item "Nível medido (Rio Grande)"; `docs/PROJETO.md` 1.1.0 (§6.4).

Verificação: `tide-live-check.cjs` (novo) com a API simulada — nível exibido = previsão + 12 cm (erro ≤ 1 cm), texto "+12 cm acima da previsão", 1ª busca de 6 h e a 2ª incremental (575 s), some em outro dia e em outro porto, "Sem dado novo" com 45 min de atraso, aviso na falha da API com a previsão intacta; sem erros de JavaScript. API real conferida do PC: 6 h = 51.735 bytes, 10 min = 725 bytes, janela vazia = `[]`, CORS `*`. Ferramenta de offset testada com API simulada (recupera 12,374 m). Regressões: schedule, tabs, tide, crew, saam, grade, browser, pwa, equalizer e manual passaram.

Bugs encontrados e corrigidos:
- A ferramenta de calibração reaproveita `tide-live.js` no Node, que não tem `document`; o módulo agora sai antes de registrar eventos de página.

Limitações: só Rio Grande nesta etapa (Etapa 2: Pecém, Paranaguá, Rio de Janeiro, Itaqui, Suape). Nível absoluto estimado (±7 cm) até a amarração oficial do radar.

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
