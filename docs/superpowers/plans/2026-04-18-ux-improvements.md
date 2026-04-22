# UX Improvements — TugLife FM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar now playing em tempo real, equalizer animado no badge "Ao vivo" e barra de navegação fixa no rodapé com SVG icons.

**Architecture:** Todas as mudanças ficam no arquivo único `index.html`. Nenhuma dependência externa nova além do proxy CORS `allorigins.win`. Sem build step — o arquivo é servido diretamente pelo Netlify.

**Tech Stack:** HTML5, CSS3 (animations, position fixed), JavaScript ES6 (fetch, IntersectionObserver, setInterval), Icecast metadata API via proxy CORS.

---

## Mapa de arquivos

| Arquivo | Mudanças |
|---------|----------|
| `index.html` | CSS: remover `.live-dot`, adicionar `.equalizer`/`.eq-bar`, adicionar `.bottom-nav`/`.nav-btn`, padding-bottom no `.app-shell` |
| `index.html` | HTML: substituir `<span class="live-dot">` por `<div class="equalizer">`, remover `.quick-actions`, adicionar `<nav class="bottom-nav">` antes de `</body>` |
| `index.html` | JS: adicionar `lastNowPlaying`, `fetchNowPlaying()`, polling 15s, `IntersectionObserver` para nav ativa, atualizar `updateLiveUI` |

---

## Task 1: Equalizer animado — CSS + HTML

**Files:**
- Modify: `index.html` (CSS block + badge HTML)

- [ ] **Step 1: Substituir `.live-dot` CSS pelo equalizer**

Localizar e **remover** o bloco CSS do `.live-dot` e o `@keyframes pulse` (linhas ~113–128):

```css
/* REMOVER este bloco inteiro: */
.live-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #ff7675;
}

.badge-live.is-on .live-dot {
    animation: pulse 1.4s infinite;
}

@keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0.8); }
    70%  { box-shadow  : 0 0 0 10px rgba(255, 118, 117, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0); }
}
```

- [ ] **Step 2: Adicionar CSS do equalizer no lugar**

Logo após o bloco `.badge-live.is-on { ... }`, adicionar:

```css
.equalizer {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
    flex-shrink: 0;
}

.eq-bar {
    width: 3px;
    background: #ff7675;
    border-radius: 1px;
    height: 3px;
}

.badge-live.is-on .eq-bar:nth-child(1) { animation: eq1 0.8s ease-in-out infinite alternate; }
.badge-live.is-on .eq-bar:nth-child(2) { animation: eq2 0.6s ease-in-out infinite alternate; }
.badge-live.is-on .eq-bar:nth-child(3) { animation: eq3 0.9s ease-in-out infinite alternate; }
.badge-live.is-on .eq-bar:nth-child(4) { animation: eq4 0.7s ease-in-out infinite alternate; }

@keyframes eq1 { from { height: 3px; } to { height: 12px; } }
@keyframes eq2 { from { height: 6px; } to { height: 10px; } }
@keyframes eq3 { from { height: 2px; } to { height: 14px; } }
@keyframes eq4 { from { height: 5px; } to { height:  8px; } }
```

- [ ] **Step 3: Substituir o HTML do `.live-dot` pelo equalizer**

Localizar:
```html
<div id="badge-live" class="badge-live">
    <span class="live-dot"></span>
    <span>Ao vivo</span>
</div>
```

Substituir por:
```html
<div id="badge-live" class="badge-live">
    <div class="equalizer">
        <span class="eq-bar"></span>
        <span class="eq-bar"></span>
        <span class="eq-bar"></span>
        <span class="eq-bar"></span>
    </div>
    <span>Ao vivo</span>
</div>
```

- [ ] **Step 4: Verificar no browser**

Abrir `index.html` no browser. Verificar:
- Badge "Ao vivo" mostra 4 barras estáticas pequenas (estado pausado)
- Ao clicar "Ouça Agora" e o áudio iniciar, as 4 barras animam com alturas variadas
- Ao pausar, as barras param

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: replace live dot with animated equalizer bars"
```

---

## Task 2: Bottom nav — CSS + HTML

**Files:**
- Modify: `index.html` (CSS block + HTML body)

- [ ] **Step 1: Adicionar padding-bottom ao `.app-shell`**

Localizar:
```css
.app-shell {
    width: 100%;
    max-width: 520px; /* mobile-first, mas com limite pra desktop */
    min-height: 100vh;
    padding: 16px 12px 24px;
}
```

Substituir por:
```css
.app-shell {
    width: 100%;
    max-width: 520px;
    min-height: 100vh;
    padding: 16px 12px 80px;
}
```

- [ ] **Step 2: Adicionar CSS da bottom nav antes de `</style>`**

```css
.bottom-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 520px;
    background: rgba(5, 8, 20, 0.97);
    border-top: 1px solid rgba(31, 152, 167, 0.3);
    display: flex;
    z-index: 100;
    backdrop-filter: blur(8px);
}

.nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 4px 10px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: color 0.15s;
}

.nav-btn.active {
    color: var(--accent);
}
```

- [ ] **Step 3: Remover a div `.quick-actions` do HTML**

Localizar e remover o bloco inteiro:
```html
        <div class="quick-actions">
            <!-- "Ouça Agora [Ver Programação] [Abrir Mapa]" como navegação -->
            <button class="btn-secondary" id="btn-scroll-programacao">
                <span class="label">Ver Programação</span>
            </button>
            <button class="btn-secondary" id="btn-scroll-mapa">
                <span class="label">Abrir Mapa</span>
            </button>
            <button class="btn-secondary" id="btn-scroll-top">
                <span class="label">Topo</span>
            </button>
        </div>
```

- [ ] **Step 4: Adicionar `<nav class="bottom-nav">` antes de `</body>`**

Localizar `</body>` e inserir antes:
```html
<nav class="bottom-nav" id="bottom-nav">
    <button class="nav-btn active" data-target="card-player">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="14" r="4"/>
            <path d="M8.5 8.5 L12 5 L15.5 8.5"/>
            <line x1="3" y1="14" x2="5" y2="14"/>
            <line x1="19" y1="14" x2="21" y2="14"/>
        </svg>
        <span>Player</span>
    </button>
    <button class="nav-btn" data-target="card-programacao">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>Programação</span>
    </button>
    <button class="nav-btn" data-target="card-mapa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
        </svg>
        <span>Mapa</span>
    </button>
</nav>
```

- [ ] **Step 5: Verificar no browser**

Abrir `index.html`. Verificar:
- Barra aparece fixa no rodapé em todas as seções
- Ícones SVG renderizam corretamente
- Botão "Player" começa ativo (cor accent)
- Conteúdo não fica escondido atrás da barra

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add fixed bottom navigation bar with SVG icons"
```

---

## Task 3: Bottom nav — JS (scroll + IntersectionObserver)

**Files:**
- Modify: `index.html` (bloco `<script>`, dentro do `DOMContentLoaded`)

- [ ] **Step 1: Remover referências JS dos botões removidos**

Dentro do IIFE (após `document.addEventListener('DOMContentLoaded', ...)`), localizar e **remover** as linhas:

```javascript
const btnScrollProg     = document.getElementById('btn-scroll-programacao');
const btnScrollMapa     = document.getElementById('btn-scroll-mapa');
const btnScrollTop      = document.getElementById('btn-scroll-top');
```

E remover os blocos:
```javascript
if (btnScrollProg) {
    btnScrollProg.addEventListener('click', function() {
        smoothScrollTo(cardProgramacao);
    });
}

if (btnScrollMapa) {
    btnScrollMapa.addEventListener('click', function() {
        smoothScrollTo(cardMapa);
    });
}

if (btnScrollTop) {
    btnScrollTop.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
```

A função `smoothScrollTo` pode ser mantida pois será reutilizada.

- [ ] **Step 2: Adicionar JS da bottom nav ao final do IIFE, antes do `})()`**

```javascript
// ================================================
// 5) Bottom nav: scroll + IntersectionObserver
// ================================================
const navBtns = document.querySelectorAll('.nav-btn[data-target]');

navBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
        var targetEl = document.getElementById(btn.getAttribute('data-target'));
        if (targetEl) smoothScrollTo(targetEl);
    });
});

var sectionIds = ['card-player', 'card-programacao', 'card-mapa'];
var sectionObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            navBtns.forEach(function(btn) {
                btn.classList.toggle('active', btn.getAttribute('data-target') === entry.target.id);
            });
        }
    });
}, { threshold: 0.4 });

sectionIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
});
```

- [ ] **Step 3: Verificar no browser**

Abrir `index.html`. Verificar:
- Tocar "Programação" faz scroll suave até o card de programação e destaca o botão
- Tocar "Mapa" faz scroll suave até o card de mapa e destaca o botão
- Tocar "Player" volta ao topo e destaca o botão Player
- Ao rolar a página manualmente, o botão ativo muda conforme a seção visível

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: wire bottom nav scroll and IntersectionObserver active state"
```

---

## Task 4: Now Playing em tempo real

**Files:**
- Modify: `index.html` (bloco `<script>`, dentro do IIFE)

- [ ] **Step 1: Adicionar variável `lastNowPlaying` no topo do IIFE**

Logo após as declarações de variáveis (`const btnPlay = ...`), adicionar:

```javascript
var lastNowPlaying = '';
```

- [ ] **Step 2: Atualizar `updateLiveUI` para usar `lastNowPlaying`**

Localizar a função `updateLiveUI` e substituir por:

```javascript
function updateLiveUI(isPlaying) {
    if (!badgeLive || !nowPlayingText || !btnPlay) return;

    if (isPlaying) {
        badgeLive.classList.add('is-on');
        nowPlayingText.textContent = lastNowPlaying
            ? 'Ao vivo \u2022 ' + lastNowPlaying
            : 'TugLife FM em transmissão. Ajuste o volume do seu dispositivo.';
        btnPlay.innerHTML = '<span>Pausar</span><span>\u23F8</span>';
    } else {
        badgeLive.classList.remove('is-on');
        nowPlayingText.textContent = lastNowPlaying
            ? 'Toque para ouvir \u2014 agora: ' + lastNowPlaying
            : 'Toque para iniciar a transmissão da TugLife FM.';
        btnPlay.innerHTML = '<span>Ouça Agora</span><span>\u25B6</span><span>\u263E</span>';
    }
}
```

- [ ] **Step 3: Adicionar a função `fetchNowPlaying` antes de `renderTodaySchedule()`**

```javascript
// ================================================
// 6) Now Playing: metadata Icecast via proxy CORS
// ================================================
function fetchNowPlaying() {
    var endpoint = 'https://servidor27.brlogic.com:7098/status-json.xsl';
    var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(endpoint);

    fetch(proxyUrl)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var parsed = JSON.parse(data.contents);
            var source = parsed.icestats && parsed.icestats.source;
            var title = (source && source.title) ? source.title.trim() : '';
            if (title && title !== lastNowPlaying) {
                lastNowPlaying = title;
                var isPlaying = audio && !audio.paused;
                updateLiveUI(isPlaying);
            }
        })
        .catch(function() {
            // fallback silencioso: mantém texto anterior
        });
}
```

- [ ] **Step 4: Chamar `fetchNowPlaying` ao inicializar e a cada 15 segundos**

Logo após `renderTodaySchedule()` e `setInterval(renderTodaySchedule, 60 * 1000)`, adicionar:

```javascript
fetchNowPlaying();
setInterval(fetchNowPlaying, 15 * 1000);
```

- [ ] **Step 5: Verificar no browser**

Abrir `index.html`. Abrir DevTools → Network. Verificar:
- Ao carregar a página, aparece uma requisição para `api.allorigins.win`
- O `#now-playing-text` exibe `"Toque para ouvir — agora: [título da música]"` sem precisar dar play
- Ao clicar play, o texto muda para `"Ao vivo • [título]"`
- Ao pausar, volta para `"Toque para ouvir — agora: [título]"`
- Se a API falhar (desligar internet e recarregar), o texto de fallback aparece normalmente

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add real-time now playing via Icecast metadata API"
```

---

## Checklist final de verificação

- [ ] Badge equalizer anima ao tocar, para ao pausar
- [ ] Bottom nav fixa no rodapé, não sobrepõe conteúdo
- [ ] Ícones SVG renderizam em Chrome, Firefox e Safari mobile
- [ ] Botão ativo da nav reflete seção visível ao rolar
- [ ] Now playing carrega sem play
- [ ] Now playing atualiza a cada 15s
- [ ] Falha na API não gera erro visível nem quebra player
- [ ] Botões antigos (Ver Programação / Abrir Mapa / Topo) não existem mais
