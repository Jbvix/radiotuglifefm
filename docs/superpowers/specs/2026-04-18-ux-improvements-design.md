# TugLife FM — UX Improvements Design
**Data:** 2026-04-18  
**Autor:** Jossian Brito (Charlie Bravo)  
**Status:** Aprovado para implementação

---

## Contexto

O app TugLife FM é um player mobile-first (`index.html`) hospedado em `tuglifedash.netlify.app`. O stream vem de `https://servidor27.brlogic.com:7098/live` (BrLogic / Icecast). As duas maiores dores identificadas pelo usuário:

- **A** — Usuário não sabe o que está tocando em tempo real
- **B** — Navegação entre seções (Player / Programação / Mapa) é confusa

---

## Escopo

### 1. Now Playing em tempo real

**Fonte:** Endpoint Icecast padrão da BrLogic:
```
https://servidor27.brlogic.com:7098/status-json.xsl
```
Campo usado: `icestats.source.title` (formato: `"Artista - Título"`).

**CORS:** A BrLogic bloqueia fetch direto do browser. Solução: proxy público `allorigins`:
```
https://api.allorigins.win/get?url=https://servidor27.brlogic.com:7098/status-json.xsl
```

**Polling:** `setInterval` a cada **15 segundos**.

**Exibição no `#now-playing-text`:**
- Áudio pausado: `"Toque para ouvir — agora: [título]"`
- Áudio tocando: `"Ao vivo • [Artista — Título]"`
- Falha na API: mantém texto anterior (fallback silencioso, sem erro visível)

**Nenhum elemento HTML novo** — apenas lógica JS adicionada à função `updateLiveUI`.

---

### 2. Equalizer animado no badge "Ao vivo"

Substitui o ponto pulsante (`.live-dot`) por 4 barras verticais animadas em **CSS puro**.

- Estado **tocando:** barras animadas com `@keyframes` de alturas variadas (`▂▄▆▃`)
- Estado **pausado:** barras estáticas, altura mínima, cor `--text-muted`

Implementado via classe CSS `.is-on` já existente no badge — zero JS adicional.

---

### 3. Barra de navegação fixa (bottom nav)

Barra fixa no rodapé (`position: fixed; bottom: 0`), 3 botões com SVG inline + label.

**Ícones SVG (stroke-based, 20×20, `currentColor`):**

| Botão | Ícone | Destino |
|-------|-------|---------|
| Player | Rádio/antena | `#card-player` |
| Programação | Calendário | `#card-programacao` |
| Mapa | Pin/localização | `#card-mapa` |

**Comportamento:**
- Scroll suave até a seção ao tocar
- Botão ativo: cor `--accent` (`#1f98a7`)
- Botão inativo: cor `--text-muted`
- Atualização do botão ativo via `IntersectionObserver` (detecta qual seção está visível)

**Remoções:**
- Botões `#btn-scroll-programacao`, `#btn-scroll-mapa` e `#btn-scroll-top` dentro do card player são removidos
- A div `.quick-actions` é removida

**Ajuste de layout:**
- `padding-bottom: 64px` adicionado ao `.app-shell` para o conteúdo não ficar atrás da barra

---

## Arquitetura de mudanças

| Arquivo | Tipo de mudança |
|---------|----------------|
| `index.html` | CSS: equalizer `@keyframes`, bottom nav styles, padding-bottom |
| `index.html` | HTML: substituir `.quick-actions` por `<nav class="bottom-nav">` |
| `index.html` | JS: função `fetchNowPlaying()`, polling, `IntersectionObserver` para nav ativa |

Todas as mudanças são **no mesmo arquivo `index.html`** — sem dependências externas novas além do proxy allorigins.

---

## Critérios de sucesso

- [ ] Nome da música/artista aparece em `#now-playing-text` sem tocar o play
- [ ] Texto atualiza automaticamente a cada 15s enquanto o app está aberto
- [ ] Falha na API não quebra o player nem gera erro visível
- [ ] Equalizer anima enquanto `audio.play` está ativo, para quando pausado
- [ ] Bottom nav fixa em todas as seções, sem sobrepor conteúdo
- [ ] Botão ativo da nav reflete a seção visível na tela
- [ ] Botões antigos (Ver Programação / Abrir Mapa / Topo) removidos

---

## Fora do escopo

- Arte da faixa (cover art via Last.fm) — Abordagem B, não contemplada aqui
- Grade completa da semana integrada ao painel GOC
- Pedidos de música / chat (widgets BrLogic)
