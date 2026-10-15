# TugLife FM · App da rádio (puro)

App mobile da webrádio TugLife FM.

**Só rádio** — sem impressão 3D, câmera, Moonraker ou PrintShare.

- Site: https://radiotuglifefm.netlify.app/
- Stream: BRLogic Icecast
- Repo: https://github.com/Jbvix/radiotuglifefm
- **Documentação técnica:** [docs/PROJETO.md](docs/PROJETO.md) — diretórios, módulos, backend, fluxos, deploy e testes

<!-- manual:inicio -->
## Manual de bordo (v3.9.0)

_Gerado de `manual.js` por `tools/manual/gerar-readme.mjs` — edite lá, não aqui._

No app: botão **?** no topo. No celular, a barra de abas embaixo leva a cada seção.

**Novidades**

- v3.9.0: Programação SAAM no Rio de Janeiro: manobras da Praticagem RJ com rebocadores SAAM, por área (Guanabara, Sepetiba, Forno, Açu), sem PIN.
- v3.8.0: Aviso de nova versão: toque em Atualizar e pronto, sem fechar o app. Nível medido da Maré numa linha só; toque no ⓘ para os detalhes.
- v3.7.0: Aba Rádio numa tela só: faixa atual no player e o resto em "Mais da TugLife".
- v3.6.0: Nível do mar medido ao vivo também em Pecém, Rio de Janeiro, Paranaguá e Salvador.
- v3.5.0: Suape com nível do mar medido ao vivo: média dos marégrafos de Recife e Tamandaré.
- v3.4.0: Rio Grande com nível do mar medido ao vivo (SiMCosta/FURG) e maré meteorológica.
- v3.3.0: Grade da semana recolhida na aba Rádio: o essencial cabe numa tela só.
- v3.2.0: Botão ? com este manual e tour guiado na primeira abertura.
- v3.1.0: App em abas no celular, selo de alerta em Manobras e mapa só ao abrir Portos.

### Rádio

Ouvir a TugLife FM e acompanhar a programação.

- **Ouvir ao vivo** — Toque no botão grande da aba Rádio. Nas outras abas, use a faixa ao vivo logo acima da barra de abas.
- **No ar agora e próximo** — Mostra o programa da grade neste momento, quanto falta para acabar e o que vem em seguida.
- **Grade semanal** — Toque em "Grade da semana" para abrir. Escolha o dia; "Hoje" volta para o dia atual. Funciona mesmo sem internet.
- **Faixa atual** — Nome da música que está tocando (♪), logo abaixo do programa no ar. Atualiza sozinho.
- **Tripulação a bordo** — Quantos ouvintes estão conectados agora e o pico do dia.

### Maré

Previsão de maré de 13 portos, calibrada com a DHN 2026.

- **Porto e dia** — Escolha um dos 13 portos. As setas mudam o dia; "Hoje" volta para a data atual.
- **Agora e tendência** — Altura estimada neste instante e se a maré está enchendo ou vazando.
- **Curva de 24 horas** — A linha laranja marca o agora; os pontos marcam preamares e baixa-mares.
- **Nível medido (6 portos)** — Linha verde "Medido": nível real do mar, atualizado a cada 5 min, e a maré meteorológica — quanto o vento põe a água acima ou abaixo da previsão (laranja a partir de 15 cm). Toque na linha ou no ⓘ para ver estações, idade do dado e crédito. Em Rio Grande, Suape, Pecém, Rio de Janeiro, Paranaguá e Salvador. Suape usa a média de Recife e Tamandaré, com horário corrigido; se um sair do ar, segue com o outro. Linha verde no gráfico = medido.
- **Selo de calibração** — Mostra o erro típico contra a Tábua DHN 2026. Informativo: não substitui a DHN na navegação.

### Manobras

Programação SAAM em Suape (tripulação, com PIN) e no Rio de Janeiro (Praticagem RJ, aberta).

- **Acesso por PIN** — Digite o PIN da tripulação. Ele fica lembrado no aparelho; "Bloquear neste aparelho" apaga.
- **Lista de manobras** — Agrupada por dia: hora, navio, tipo, situação, berço, calado e rebocadores.
- **Três alertas sonoros** — Confirmada: ding-dong subindo. Cancelada: dois tons descendo. Antecipada: bipes rápidos e repetidos.
- **Ativar alertas** — Libera o som e a notificação com a tela apagada. Use os botões de teste para ouvir cada som.
- **Selo laranja** — Na barra de abas, conta os alertas que chegaram enquanto você estava em outra aba.
- **SAAM · Rio de Janeiro** — Logo abaixo de Suape, sem PIN: as manobras que a Praticagem RJ programou com rebocadores SAAM (coluna EMP.RB = SAA). Atualiza a cada 2 min enquanto o card está à vista; o 🟢 mostra há quanto tempo o site foi lido.
- **Filtro por área (Rio)** — Toque em Todas, Baía de Guanabara, Baía de Sepetiba, Porto do Forno ou Porto do Açu; o número é a quantidade de manobras SAAM. A escolha fica lembrada. Com uma área escolhida, aparece a situação da barra (aberta ou fechada).
- **Cada manobra (Rio)** — Hora do prático a bordo (horário de Brasília), navio, Entrada/Saída/Mudança, berço e bordo (BB/BE), calado, comprimento e agência. Quando a praticagem já escalou, aparecem os rebocadores com a tração estática em toneladas e as fainas (ATR, DES, PON, NAV); ⚠️ indica rebocador também escalado em outra manobra.

### Portos

Painel do Marujo: tráfego e clima por porto.

- **Mapa marítimo** — Navios em tempo real (AIS) no porto escolhido.
- **Clima** — Vento em nós e previsão sobre o mesmo porto.
- **Trocar de porto** — Deslize a fileira de portos e toque no desejado.

### App

Instalação, compartilhamento e ajustes.

- **Instalar na tela inicial** — Na aba Rádio, abra "Mais da TugLife" e toque em Instalar app. Abre como aplicativo, em tela cheia, e recebe as notificações de manobra.
- **Compartilhar e QR Code** — Em "Mais da TugLife" (aba Rádio): envie o link da rádio ou mostre o QR Code para outro tripulante. Lá também ficam a TugLife Store, o Deezer e a Alexa.
- **Tema claro e escuro** — Botão da lua no topo. O claro ajuda sob sol forte no convés.
- **Como atualizar** — Quando sair versão nova, aparece a faixa "Nova versão disponível": toque em Atualizar e o app recarrega já atualizado. Com a rádio tocando, o áudio para por alguns segundos. Não precisa desinstalar.
- **Sem internet** — Grade, maré e este manual continuam disponíveis; a rádio precisa de conexão.

<!-- manual:fim -->

## Local

```bash
python3 server.py
# http://localhost:8787/
```

## Projetos separados

| Projeto | Pasta |
|---------|--------|
| App rádio (este) | `projetos/radio/radiotuglifefm` |
| Locutor Charlie Bravo | `projetos/radio/tuglife-locutor-control` + `radio-ai-commander` |
| Impressão 3D | `projetos/impressao-3d/printshare` |
