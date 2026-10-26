import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDocumento, parseInline } from '../js/documento.js';

test('títulos, parágrafos e listas', () => {
  const b = parseDocumento('## Oi\n\nLinha um\nlinha dois\n\n- a\n- b\n\n1. x\n2. y\n\n> destaque\n\n---');
  assert.deepEqual(b.map((x) => x.tipo), ['h', 'p', 'ul', 'ol', 'q', 'hr']);
  assert.deepEqual(b[1].f.map((x) => x.t), ['texto', 'br', 'texto']);
  assert.equal(b[1].f[2].v, 'linha dois');
  assert.equal(b[2].itens.length, 2);
});
test('negrito, itálico e link', () => {
  const n = parseInline('um **forte** e *leve* e [site](https://exemplo.com/a)');
  assert.deepEqual(n.map((x) => x.t), ['texto', 'b', 'texto', 'i', 'texto', 'a']);
  assert.equal(n[5].href, 'https://exemplo.com/a');
});
test('SEGURANÇA: link javascript: vira texto, nunca link', () => {
  const n = parseInline('[clique](javascript:alert(1))');
  assert.ok(n.every((x) => x.t !== 'a'));
  assert.ok(n.map((x) => x.v ?? '').join('').includes('javascript:'));
});
test('SEGURANÇA: data: e vbscript: também viram texto', () => {
  for (const u of ['data:text/html,x', 'vbscript:x', 'file:///etc/passwd', '//evil.com']) {
    assert.ok(parseInline(`[a](${u})`).every((x) => x.t !== 'a'), u);
  }
});
test('SEGURANÇA: HTML digitado continua sendo só texto', () => {
  const b = parseDocumento('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  assert.deepEqual(b.map((x) => x.tipo), ['p', 'p']);
  assert.equal(b[0].f[0].v, '<script>alert(1)</script>');
});
test('texto vazio ou nulo não quebra', () => {
  assert.deepEqual(parseDocumento(''), []);
  assert.deepEqual(parseDocumento(null), []);
});
test('marcação aberta sem fechar fica como texto', () => {
  assert.equal(parseInline('**sem fechar').map((x) => x.v ?? '').join(''), '**sem fechar');
});

test('texto estilo conversa: parágrafo, lista com negrito e quebra simples', () => {
  const b = parseDocumento('Para concluir:\n- **A marca:** nome\n- **Uma ideia:** frase\n\n**Vale até 20 pontos!** Sem gravar.\nSegunda linha');
  assert.deepEqual(b.map((x) => x.tipo), ['p', 'ul', 'p']);
  assert.equal(b[1].itens.length, 2);
  assert.equal(b[1].itens[0][0].t, 'b');
  assert.deepEqual(b[2].f.map((x) => x.t), ['b', 'texto', 'br', 'texto']);
});
