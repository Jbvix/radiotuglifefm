// v2.2.0 · Jossian Brito · SPRINTS 05–07. Date recorded in VERSION.json.
document.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('radio-stream');
  const button = document.getElementById('mini-play');
  const status = document.getElementById('mini-status');
  button.addEventListener('click', () => document.getElementById('btn-play').click());
  const show = (message, playing = false) => {
    status.textContent = message;
    button.textContent = playing ? 'Ⅱ' : '▶';
    button.setAttribute('aria-label', playing ? 'Pausar rádio' : 'Ouvir rádio');
  };
  audio.addEventListener('playing', () => show('Você está ouvindo', true));
  audio.addEventListener('pause', () => show('Pausado'));
  audio.addEventListener('waiting', () => show('Conectando…', !audio.paused));
  audio.addEventListener('loadstart', () => show('Conectando…'));
  audio.addEventListener('error', () => show('Sem conexão · tente novamente'));
  const progress = document.createElement('progress');
  progress.max = 100;
  progress.setAttribute('aria-label', 'Progresso do programa conforme a grade');
  const duration = document.createElement('p');
  duration.className = 'program-duration';
  document.getElementById('program-current').after(duration, progress);
  const formatMinutes = n => n >= 60 ? `${Math.floor(n/60)}h${n%60 ? ` ${n%60}min` : ''}` : `${n}min`;
  function update() {
    const {current, next, nextDay, day} = RadioSchedule.getState();
    const toMinutes = h => {const [hours, minutes] = h.split(':').map(Number); return hours * 60 + minutes;};
    const now = new Date().toLocaleTimeString('en-GB', {timeZone:RadioSchedule.timeZone, hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
    const start = toMinutes(current.h), end = nextDay !== day ? 1440 : toMinutes(next.h);
    progress.value = Math.min(100, Math.max(0, (toMinutes(now)-start)/(end-start)*100));
    duration.textContent = `${current.h} — ${next.h} · ${formatMinutes(end-start)} de programa`;
    document.getElementById('mini-title').textContent = current.t;
  }
  update(); setInterval(update, 1000);
});
