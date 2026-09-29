document.addEventListener('DOMContentLoaded', () => {
  const {days, schedule, timeZone, getState} = RadioSchedule;
  let selected = null;
  let lastKey = '';
  const tabs = document.getElementById('schedule-days');
  days.forEach((day, index) => {
    const button = document.createElement('button');
    button.textContent = day.slice(0, 3);
    button.setAttribute('aria-label', day);
    button.title = day;
    button.addEventListener('click', () => {selected = index; render(true);});
    tabs.append(button);
  });
  document.getElementById('schedule-today').addEventListener('click', () => {selected = null; render(true);});
  function render(force = false) {
    const now = new Date();
    const state = getState(now);
    document.getElementById('digital-clock').textContent = now.toLocaleTimeString('pt-BR', {timeZone});
    document.getElementById('digital-date').textContent = now.toLocaleDateString('pt-BR', {timeZone, weekday:'long', day:'2-digit', month:'long'});
    const day = selected ?? state.day;
    const key = `${day}:${state.day}:${state.index}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    document.getElementById('program-current').textContent = state.current.t;
    document.getElementById('program-next').textContent = `${state.nextDay !== state.day ? days[state.nextDay] + ' · ' : ''}${state.next.h} · ${state.next.t}`;
    [...tabs.children].forEach((button, index) => button.setAttribute('aria-pressed', String(day === index)));
    document.getElementById('schedule-heading').textContent = `Programação · ${days[day]}`;
    const list = document.getElementById('schedule-list');
    list.replaceChildren();
    schedule[day].forEach((item, index) => {
      const current = day === state.day && index === state.index;
      const li = document.createElement('li');
      li.className = 'schedule-item' + (current ? ' is-current' : '');
      if (current) li.setAttribute('aria-current', 'true');
      const time = document.createElement('span');
      time.className = 'schedule-time';
      time.textContent = `${item.h} – ${schedule[day][index+1]?.h ?? '00:00'}`;
      const name = document.createElement('span');
      name.className = 'schedule-name';
      name.textContent = item.t + (current ? ' · No ar agora' : '');
      li.append(time, name); list.append(li);
    });
  }
  render();
  const focusCurrent = () => {const list = document.getElementById('schedule-list');const item = list.querySelector('.is-current');if(item) list.scrollTop = item.offsetTop - list.offsetTop;};
  requestAnimationFrame(focusCurrent);
  document.getElementById('schedule-today').addEventListener('click', focusCurrent);
  setInterval(render, 1000);
});
