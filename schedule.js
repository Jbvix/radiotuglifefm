/* TugLife FM v2.1.0 — Autor: Jossian Brito. Fuso: America/Sao_Paulo. */
(function (root) {
  'use strict';
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const raw = [
`00:00|Insônia
03:00|Âncora da Fé
06:00|Top Hits Gospel
08:00|TugKids
09:00|Algazarra
10:00|TugSurf
11:00|Classicos MPB
13:00|Encontro de Gigantes - Djavan e Belchior
16:00|Classic Music
18:00|Poder Pentecostal e Hinos de Testemunho (Gospel Hits)
20:00|Love Songs Are Back Again
22:00|Love Memory
23:00|Clube do Rei DOM`,
`00:00|Love Night - Madrugada Romântica
02:00|Âncora da Fé
06:00|Acorda Marujo ! Adrenalina
09:00|Sequência Máxima
11:00|Non Stop Music
12:00|Na Roda do Samba
14:00|Super Tarde
16:00|A Vibe do Reggae
17:00|Back in Time
18:00|TugLife Retrô
19:00|Fita K7
20:00|Top Hits 90s
21:00|O Melhor do Soul
22:00|Hits Eletrônicos
23:00|Roberto Carlos : A Hora do Rei`,
`00:00|Love Night
02:00|Insônia
06:00|Acorda Marujo ! Adrenalina
09:00|Sequência Máxima
11:00|Non Stop Music
12:00|Mix Gospel
14:00|Super Tarde
16:00|Fita K7
17:00|O Melhor do Soul
19:00|Hora do Marinheiro
21:00|Semeando a Palavra
23:00|Love Songs Are Back Again`,
`00:00|Âncora da Fé
06:00|Acorda Marujo ! Adrenalina
09:00|Sequência Máxima
11:00|Non Stop Music
12:00|Na Roda do Samba
14:00|Super Tarde
16:00|Galpão Farrapo
17:00|Os Melhores Remixes
18:00|A Batalha dos Titãs (Rock & Grunge Anos 80/90)
20:00|Clube do Brega - Especial Amado Batista
22:00|Love Night`,
`00:00|Insônia
02:00|Âncora da Fé
06:00|Convés Brasil _Semana
09:00|Sequência Máxima
11:00|Non Stop Music
12:00|Na Roda do Samba
14:00|Super Tarde
16:00|Axé e Pagode
17:00|Top Hits 90s
19:00|Garagem do Rock
20:00|Back in Time
23:00|Roberto Carlos : A Hora do Rei`,
`00:00|Love Night
02:00|Insônia
04:00|Nas ondas do louvor
06:00|Acorda Marujo ! Adrenalina
09:00|Sequência Máxima
11:00|Non Stop Music
12:00|Na Roda do Samba
14:00|Super Tarde
16:00|Fim de Tarde
17:00|Groove & Disco Fever (Anos 70 & 80)
19:00|Love Night
21:00|Love Songs Are Back Again`,
`00:00|Love Night - Madrugada Romântica
04:00|Louvor e Adoração (Gospel)
06:00|Estação Sertaneja
07:30|Mais Brasil Fins de Semana
08:00|Flash Back Top Hits
09:00|Bora Viajar
12:00|Café com Samba
13:00|Revirando o baú
15:00|Encontro de Gigantes Legiao Urbana e Titãs
18:00|Sequência Gospel
19:00|Encontro de Gigantes SW & MJ
21:00|Clube do Brega Seleção
22:00|Love Night`
  ];
  const schedule = raw.map(day => day.split('\n').map(line => {
    const [h, t] = line.split('|'); return {h, t};
  }));
  const timeZone = 'America/Sao_Paulo';
  const formatter = new Intl.DateTimeFormat('en-US', {timeZone, weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  function getState(date = new Date()) {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
    const time = `${parts.hour}:${parts.minute}`;
    const index = schedule[day].findLastIndex(item => item.h <= time);
    const nextDay = index === schedule[day].length - 1 ? (day + 1) % 7 : day;
    return {day, index, current:schedule[day][index], next:schedule[nextDay][nextDay === day ? index + 1 : 0], nextDay};
  }
  const api = {days, schedule, timeZone, getState};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RadioSchedule = api;
})(globalThis);
