const { test } = require('node:test');
const assert = require('node:assert/strict');
const { schedule, getState } = require('./schedule.js');
test('grade completa, ordenada e com início à meia-noite', () => {
  assert.deepEqual(schedule.map(day => day.length), [13,15,12,11,12,12,13]);
  for (const day of schedule) {
    assert.equal(day[0].h, '00:00');
    for (let i=1;i<day.length;i++) assert.ok(day[i].h > day[i-1].h);
  }
});
test('Brasília: virada de domingo para segunda em UTC', () => {
  assert.equal(getState(new Date('2026-09-28T02:59:59Z')).current.t, 'Clube do Rei DOM');
  const state = getState(new Date('2026-09-28T03:00:00Z'));
  assert.equal(state.day, 1);
  assert.equal(state.current.t, 'Love Night - Madrugada Romântica');
  assert.equal(state.next.t, 'Âncora da Fé');
});
test('sábado: troca exata às 07:30 e fechamento semanal', () => {
  assert.equal(getState(new Date('2026-10-03T10:29:59Z')).current.t, 'Estação Sertaneja');
  assert.equal(getState(new Date('2026-10-03T10:30:00Z')).current.t, 'Mais Brasil Fins de Semana');
  assert.equal(getState(new Date('2026-10-04T02:59:59Z')).next.t, 'Insônia');
});
