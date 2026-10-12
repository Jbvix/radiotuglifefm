# TugLife FM · App da rádio (puro)

App mobile da webrádio TugLife FM.

**Só rádio** — sem impressão 3D, câmera, Moonraker ou PrintShare.

- Site: https://radiotuglifefm.netlify.app/
- Stream: BRLogic Icecast
- Repo: https://github.com/Jbvix/radiotuglifefm

## Como usar (celular) — v3.1.0

Barra de abas embaixo:

| Aba | O que tem |
|-----|-----------|
| **Rádio** | Player, faixa atual, programa no ar e grade semanal |
| **Maré** | Tábua de maré de 13 portos (calibrada com a DHN 2026) |
| **Manobras** | Programação SAAM · Suape (PIN da tripulação). Selo laranja = alerta novo |
| **Portos** | Painel do Marujo: mapa marítimo e clima por porto |

Fora da aba Rádio, a faixa "ao vivo" acima da barra mantém o play à mão. Tocar na notificação de manobra abre direto a aba Manobras. No computador, todos os cards aparecem lado a lado.

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
