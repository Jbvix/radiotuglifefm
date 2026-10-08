# SPRINT 14 — Tripulação a bordo — v2.6.0
Autor: Jossian Brito  
Data/hora: 2026-10-08T15:55:00-03:00

Implementação: novo módulo `listeners.js` mostra "👥 N a bordo" (ouvintes em tempo real via Supabase Realtime Presence, projeto `tuglife-fm`, canal `tuglife-fm-ouvintes`) e "📈 Pico hoje" (pico por hora gravado em `audiencia_horaria` pela função `registrar_pico`, que só aceita subir o pico e aplica teto de 1000). O módulo apenas observa os eventos `playing`/`pause`/`error` do `<audio id="radio-stream">`; nenhum código do player foi alterado. Uma sonda procura campo de ouvintes na API de status BRLOGIC: se existir, o selo mostra o total oficial ("ouvintes"); senão, mostra o contador do app ("a bordo").

Verificação: teste Playwright com Supabase simulado — sem a biblioteca o selo fica oculto e o app segue sem erros; com ela, conta 2 → 3 após play → 2 após pause, grava registrar_pico:3 e exibe pico 7; sem overflow a 360 px. schedule.test.cjs passou. git diff --check passou. Banco testado com transação revertida (3, 2, 5000 → 3, 3, 1000).

Limitações: o contador do app não inclui quem ouve pelo app Android BRLOGIC ou pelo site webradiosite. A função registrar_pico é pública; um pico falso é possível (até 1000) — aceitável para estatística interna.

Lição aprendida: integrar recursos como sensores externos (eventos do áudio) evita regressões no motor principal. Cache do service worker atualizado para v2.6.0.
