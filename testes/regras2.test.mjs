import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idYoutube, urlEmbedYoutube, progressoGeral, agruparPorEtapa, nomeDaEtapa } from '../js/regras.js';

const ID = 'dQw4w9WgXcQ';
test('YouTube: reconhece os jeitos de copiar o link', () => {
  for (const u of [`https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=10s`,
    `https://m.youtube.com/watch?v=${ID}`, `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`, ID, `  ${ID}  `]) assert.equal(idYoutube(u), ID, u);
});
test('SEGURANÇA YouTube: endereços falsos, esquemas perigosos e códigos errados viram null', () => {
  for (const u of [`https://youtube.com.golpe.com/watch?v=${ID}`, `https://golpe.com/watch?v=${ID}`, `https://notyoutube.com/watch?v=${ID}`, `https://youtu.be.golpe.com/${ID}`,
    `javascript:alert(1)//youtu.be/${ID}`, `data:text/html,${ID}`, 'https://www.youtube.com/watch?v=curto', `https://www.youtube.com/watch?v=${ID}x`,
    'https://www.youtube.com/', 'https://www.youtube.com/channel/UC1234567890', '', null, undefined, '<script>', `${ID}"onload="x`]) assert.equal(idYoutube(u), null, String(u));
});
test('YouTube: a URL de incorporação usa o domínio de privacidade aprimorada', () => {
  assert.equal(urlEmbedYoutube(ID), `https://www.youtube-nocookie.com/embed/${ID}`);
});

const c1 = { numero: 1, em_breve: false, checklist: [{ id: 'a' }, { id: 'b' }, { id: 'c', opcional: true }] };
const c2 = { numero: 2, em_breve: false, checklist: [{ id: 'x' }] };
const cBreve = { numero: 3, em_breve: true, checklist: [] };

test('progresso: conta só itens obrigatórios dos dias prontos', () => {
  const marcados = new Map([['1:a', true], ['1:b', true], ['1:c', true]]);
  assert.deepEqual(progressoGeral([c1, c2, cBreve], marcados), { total: 3, feitos: 2, dias: 1, pct: 67 });
});
test('progresso: nada marcado, nada pronto e lista vazia não quebram', () => {
  assert.deepEqual(progressoGeral([c1], new Map()), { total: 2, feitos: 0, dias: 0, pct: 0 });
  assert.deepEqual(progressoGeral([cBreve, undefined], new Map()), { total: 0, feitos: 0, dias: 0, pct: 0 });
  assert.deepEqual(progressoGeral([], new Map()), { total: 0, feitos: 0, dias: 0, pct: 0 });
});
test('progresso: marcar item opcional sozinho não conta', () => {
  assert.equal(progressoGeral([c1], new Map([['1:c', true]])).feitos, 0);
});
test('etapas: agrupa os dias, ignora dia que não existe e põe o resto em "Outros"', () => {
  const agenda = [1, 2, 3, 4].map((numero) => ({ numero, titulo: `D${numero}` }));
  const g = agruparPorEtapa(agenda, [{ nome: 'A', dias: [1, 2, 99] }, { nome: 'Vazia', dias: [77] }]);
  assert.deepEqual(g.map((x) => [x.nome, x.dias.map((d) => d.numero)]), [['A', [1, 2]], ['Outros', [3, 4]]]);
  assert.deepEqual(agruparPorEtapa(agenda, undefined).map((x) => x.nome), ['Outros']);
});
test('etapas: nome da etapa de um dia', () => {
  const e = [{ nome: 'A', dias: [1, 2] }, { nome: 'B', dias: [3] }];
  assert.equal(nomeDaEtapa(3, e), 'B');
  assert.equal(nomeDaEtapa(9, e), '');
  assert.equal(nomeDaEtapa(1, undefined), '');
});
