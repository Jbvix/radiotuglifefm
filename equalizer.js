// SPRINT 08 · Jossian Brito · Version and timestamp in VERSION.json.
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
    const bars = Array.from({length:32}, () => {
      const bar = document.createElement('span'); container.append(bar); return bar;
    });
    let frame = 0, active = false;
    function stop(message) {
      cancelAnimationFrame(frame); frame = 0;
      bars.forEach(bar => bar.style.transform = 'scaleY(0.035)');
      label.textContent = message;
    }
    function draw() {
      if (!active || audio.paused || document.hidden || reduced.matches || !analyser) return;
      analyser.getByteFrequencyData(data);
      const nyquist = context.sampleRate / 2;
      bars.forEach((bar, i) => {
        const low = Math.max(1, Math.floor(50 * (16000 / 50) ** (i / bars.length) / nyquist * data.length));
        const high = Math.min(data.length, Math.max(low + 1, Math.ceil(50 * (16000 / 50) ** ((i+1) / bars.length) / nyquist * data.length)));
        let sum = 0;
        for (let bin=low; bin<high; bin++) sum += data[bin];
        const value = high > low ? sum / (high-low) / 255 : 0;
        bar.style.transform = `scaleY(${Math.max(.035,value)})`;
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
    audio.addEventListener('playing', () => {active = true;start();});
    for (const event of ['pause','ended','emptied','error','waiting']) audio.addEventListener(event, () => {
      active = false; stop(event === 'error' ? 'Visualização indisponível' : event === 'waiting' ? 'Aguardando áudio…' : 'Aguardando reprodução');
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
