import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idYoutube, urlEmbedYoutube, lerRanking, posicoesRanking } from '../js/regras.js';

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

test('ranking: vários jeitos de colar', () => {
  const { linhas, ignoradas } = lerRanking('Ana 40\nBia - 35\nCaro: 30 pts\n1. Dani 28\n2º Eli 20 pontos\n#3 Fê 10\nGabi\t18\n4\tHeloísa\t15\t3\n');
  assert.deepEqual(linhas.map((l) => [l.apelido, l.pontos]), [['Ana', 40], ['Bia', 35], ['Caro', 30], ['Dani', 28], ['Eli', 20], ['Fê', 10], ['Gabi', 18], ['Heloísa', 15]]);
  assert.equal(ignoradas.length, 0);
});
test('ranking: milhar com ponto, negativos e apelidos com números', () => {
  const { linhas } = lerRanking('Lu 1.250\nMa -5\nAna 2 30');
  assert.deepEqual(linhas.map((l) => [l.apelido, l.pontos]), [['Lu', 1250], ['Ma', -5], ['Ana 2', 30]]);
});
test('ranking: cabeçalho e linhas sem número são separados, não inventados', () => {
  const { linhas, ignoradas } = lerRanking('Posição\tNome\tPontos\n1\tAna\t40\nSó um nome\n12,5 pontos de nada\n');
  assert.deepEqual(linhas.map((l) => l.apelido), ['Ana']);
  assert.ok(ignoradas.some((i) => i.linha === 'Só um nome'));
});
test('ranking: apelido grande demais é recusado', () => {
  const { linhas, ignoradas } = lerRanking(`${'a'.repeat(61)} 10`);
  assert.equal(linhas.length, 0);
  assert.equal(ignoradas[0].motivo, 'apelido com mais de 60 letras');
});
test('ranking: HTML digitado é só texto', () => {
  const { linhas } = lerRanking('<b>Ana</b> 10');
  assert.equal(linhas[0].apelido, '<b>Ana</b>');
});
test('posições: empate divide a posição e mantém a ordem colada', () => {
  const p = posicoesRanking([{ apelido: 'Lu', pontos: 40 }, { apelido: 'Bia', pontos: 40 }, { apelido: 'Ana', pontos: 20 }, { apelido: 'Zé', pontos: 35 }]);
  assert.deepEqual(p.map((x) => [x.apelido, x.posicao]), [['Lu', 1], ['Bia', 1], ['Zé', 3], ['Ana', 4]]);
  assert.deepEqual(posicoesRanking([]), []);
});
