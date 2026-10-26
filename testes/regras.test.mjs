import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataFortaleza, paraLiberaEm, novoIdChecklist } from '../js/regras.js';

test('data de Fortaleza a partir do instante do banco (00:00 Fortaleza = 03:00 UTC)', () => {
  assert.equal(dataFortaleza('2026-11-12T03:00:00+00:00'), '2026-11-12');
  assert.equal(dataFortaleza('2026-11-12T02:59:00+00:00'), '2026-11-11');
  assert.equal(dataFortaleza(null), '');
});
test('data escolhida vira meia-noite de Fortaleza e volta igual', () => {
  const iso = paraLiberaEm('2026-12-31');
  assert.equal(iso, '2026-12-31T00:00:00-03:00');
  assert.equal(dataFortaleza(iso), '2026-12-31');
  assert.equal(paraLiberaEm(''), null);
});
test('data inválida é recusada', () => {
  assert.throws(() => paraLiberaEm('31/12/2026'), /inválida/);
  assert.throws(() => paraLiberaEm('2026-13-45'), /inválida/);
});
test('id do checklist: sem acento, sem símbolos, com sufixo', () => {
  const id = novoIdChecklist('Assisti ao vídeo!', () => 0.123456789);
  assert.match(id, /^assisti_ao_video_[a-z0-9]{4}$/);
  assert.match(novoIdChecklist('???', () => 0.5), /^item_[a-z0-9]{4}$/);
  assert.notEqual(novoIdChecklist('a'), novoIdChecklist('a'));
});
