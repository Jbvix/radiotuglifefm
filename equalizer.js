/* ============================================================
   TugLife FM — Motor Web Audio + equalizador de barras + disco
   ------------------------------------------------------------
   Arquivo   : equalizer.js
   Versão    : 3.11.0 (SPRINT 30)
   Data/Hora : 2026-10-15T20:30:00-03:00
   Autor     : Jossian Brito
   ------------------------------------------------------------
   HISTÓRICO DE MODIFICAÇÕES
   v3.11.0 [MOD] Espectro circular (32 raios espelhados em volta do logo)
                 virou equalizador de 20 barras em linha, à direita do
                 logo: barra 0 = graves (50 Hz) … barra 19 = agudos (16 kHz).
           [NOVO] Disco: o logo (#radio-disc) gira no sentido horário só
                 enquanto o áudio toca (classe .is-spinning; o giro em si
                 é CSS, ver refresh.css). Para em pause/ended/waiting/error.
   SPRINT 08     Motor Web Audio (window.RadioAudio), confere CORS antes.
   ------------------------------------------------------------
   COMO CADA BARRA ESCOLHE SUA FAIXA DE FREQUÊNCIA (escala logarítmica)
       f(k) = 50 · (16000/50)^(k/N)      k = 0…N, N = 20 barras
       barra i cobre f(i) … f(i+1)
   Exemplos: f(0)=50 Hz, f(10)≈894 Hz, f(20)=16 kHz. O ouvido percebe
   frequência em oitavas (dobrar = "subir um degrau"), por isso cada
   barra cobre a mesma RAZÃO de frequências (×1,34), não a mesma largura
   em Hz — como a escala Beaufort, que cresce por degraus de percepção.
   Frequência → índice no vetor do analisador (FFT):
       bin = f / (taxa/2) · nBins       (taxa/2 = Nyquist)
   Nível da barra = média dos bins da faixa / 255 → scaleY(0,035…1).
   ============================================================ */
(() => {
  let context, analyser, source, data, pending;
  let unavailable = false;
  async function prepare(audio) {
    if (pending) return pending;
    if (unavailable) return null;
    pending = (async () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error('Web Audio unavailable');
        context ||= new AudioContext();
        await context.resume();
        if (!source) {
          // Verify readable CORS before routing the media element through Web Audio.
          const response = await fetch(audio.currentSrc || audio.querySelector('source').src,
            {mode:'cors', signal:AbortSignal.timeout(5000)});
          if (!response.ok) throw new Error('Stream unavailable');
          await response.body?.cancel();
          analyser = context.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.78;
          data = new Uint8Array(analyser.frequencyBinCount);
          source = context.createMediaElementSource(audio);
          source.connect(context.destination);
          source.connect(analyser);
        }
        return {context, analyser, data};
      } catch {
        unavailable = true;
        if (!source) audio.removeAttribute('crossorigin');
        return null;
      }
    })();
    try {return await pending;} finally {pending = null;}
  }
  window.RadioAudio = {prepare, get analyser(){return analyser;}, get data(){return data;}};
  document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('radio-stream');
    const container = document.getElementById('spectrum-bars');
    const label = document.getElementById('spectrum-status');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const disc = document.getElementById('radio-disc');
    // v3.11.0: 20 barras em linha (antes: 32 raios em círculo)
    const BARS = 20, F_MIN = 50, F_MAX = 16000;
    // Perfil de repouso (standby/pausa): um "morro" estático com pico na
    // barra 5 (~200 Hz, onde a música costuma ter mais energia), para o
    // equalizador ser reconhecível mesmo sem som:
    //   repouso(i) = 0,08 + 0,30 · max(0, 1 − |i − 5| / 12)
    //   i=5 → 0,38 (pico) · i=0 → 0,26 · i=17+ → 0,08 (piso)
    const REST = i => +(0.08 + 0.30 * Math.max(0, 1 - Math.abs(i - 5) / 12)).toFixed(3);
    const bars = Array.from({length:BARS}, () => {
      const bar = document.createElement('span'); container.append(bar); return bar;
    });
    // v3.11.0: o disco gira enquanto houver som (independe do analisador:
    // sem CORS o equalizador fica parado, mas o disco gira igual).
    const spin = on => disc?.classList.toggle('is-spinning', on);
    let frame = 0, active = false;
    function stop(message) {
      cancelAnimationFrame(frame); frame = 0;
      bars.forEach((bar, i) => bar.style.transform = `scaleY(${REST(i)})`);   // v3.11.0: perfil de repouso
      label.textContent = message;
    }
    function draw() {
      if (!active || audio.paused || document.hidden || reduced.matches || !analyser) return;
      analyser.getByteFrequencyData(data);
      const nyquist = context.sampleRate / 2;
      const bin = f => f / nyquist * data.length;   // frequência (Hz) → índice da FFT
      bars.forEach((bar, i) => {
        const low = Math.max(1, Math.floor(bin(F_MIN * (F_MAX / F_MIN) ** (i / BARS))));
        const high = Math.min(data.length, Math.max(low + 1, Math.ceil(bin(F_MIN * (F_MAX / F_MIN) ** ((i + 1) / BARS)))));
        let sum = 0;
        for (let k = low; k < high; k++) sum += data[k];
        const value = high > low ? sum / (high - low) / 255 : 0;
        bar.style.transform = `scaleY(${Math.max(.035, value)})`;
      });
      frame = requestAnimationFrame(draw);
    }
    function start() {
      stop('Aguardando reprodução');
      if (!active || audio.paused) return;
      if (unavailable || !analyser) return stop('Visualização indisponível');
      if (reduced.matches) return stop('Movimento reduzido ativado');
      if (document.hidden) return;
      label.textContent = 'Frequências do áudio · ao vivo';
      draw();
    }
    audio.addEventListener('playing', () => {active = true;spin(true);start();});
    for (const event of ['pause','ended','emptied','error','waiting']) audio.addEventListener(event, () => {
      active = false; spin(false); stop(event === 'error' ? 'Visualização indisponível' : event === 'waiting' ? 'Aguardando áudio…' : 'Aguardando reprodução');
    });
    reduced.addEventListener('change', start);
    // Some embedded browsers update the preference before delivering its event.
    let lastReduced = reduced.matches;
    setInterval(() => {
      if (lastReduced !== reduced.matches) {lastReduced = reduced.matches; start();}
    }, 500);
    document.addEventListener('visibilitychange', start);
    stop('Aguardando reprodução');
  });
})();
