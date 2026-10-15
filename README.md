# TugLife FM · App da rádio (puro)

App mobile da webrádio TugLife FM.

**Só rádio** — sem impressão 3D, câmera, Moonraker ou PrintShare.

- Site: https://radiotuglifefm.netlify.app/
- Stream: BRLogic Icecast
- Repo: https://github.com/Jbvix/radiotuglifefm
- **Documentação técnica:** [docs/PROJETO.md](docs/PROJETO.md) — diretórios, módulos, backend, fluxos, deploy e testes

<!-- manual:inicio -->
## Manual de bordo (v3.6.0)

_Gerado de `manual.js` por `tools/manual/gerar-readme.mjs` — edite lá, não aqui._

No app: botão **?** no topo. No celular, a barra de abas embaixo leva a cada seção.

**Novidades**

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
- **Faixa atual** — Nome da música que está tocando, atualizado sozinho.
- **Tripulação a bordo** — Quantos ouvintes estão conectados agora e o pico do dia.

### Maré

Previsão de maré de 13 portos, calibrada com a DHN 2026.

- **Porto e dia** — Escolha um dos 13 portos. As setas mudam o dia; "Hoje" volta para a data atual.
- **Agora e tendência** — Altura estimada neste instante e se a maré está enchendo ou vazando.
- **Curva de 24 horas** — A linha laranja marca o agora; os pontos marcam preamares e baixa-mares.
- **Nível medido (6 portos)** — Faixa verde "Ao vivo": nível real do mar, atualizado a cada 5 min, e a maré meteorológica — quanto o vento põe a água acima ou abaixo da previsão (laranja a partir de 15 cm). Em Rio Grande, Suape, Pecém, Rio de Janeiro, Paranaguá e Salvador. Suape usa a média de Recife e Tamandaré, com horário corrigido; se um sair do ar, segue com o outro. Linha verde no gráfico = medido.
- **Selo de calibração** — Mostra o erro típico contra a Tábua DHN 2026. Informativo: não substitui a DHN na navegação.

### Manobras

Programação SAAM em Suape, exclusiva da tripulação.

- **Acesso por PIN** — Digite o PIN da tripulação. Ele fica lembrado no aparelho; "Bloquear neste aparelho" apaga.
- **Lista de manobras** — Agrupada por dia: hora, navio, tipo, situação, berço, calado e rebocadores.
- **Três alertas sonoros** — Confirmada: ding-dong subindo. Cancelada: dois tons descendo. Antecipada: bipes rápidos e repetidos.
- **Ativar alertas** — Libera o som e a notificação com a tela apagada. Use os botões de teste para ouvir cada som.
- **Selo laranja** — Na barra de abas, conta os alertas que chegaram enquanto você estava em outra aba.

### Portos

Painel do Marujo: tráfego e clima por porto.

- **Mapa marítimo** — Navios em tempo real (AIS) no porto escolhido.
- **Clima** — Vento em nós e previsão sobre o mesmo porto.
- **Trocar de porto** — Deslize a fileira de portos e toque no desejado.

### App

Instalação, compartilhamento e ajustes.

- **Instalar na tela inicial** — Abre como aplicativo, em tela cheia, e recebe as notificações de manobra.
- **Compartilhar e QR Code** — Envie o link da rádio ou mostre o QR Code para outro tripulante.
- **Tema claro e escuro** — Botão da lua no topo. O claro ajuda sob sol forte no convés.
- **Como atualizar** — Feche e reabra o app duas vezes. Não precisa desinstalar.
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
