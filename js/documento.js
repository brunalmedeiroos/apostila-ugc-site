// Documento do dia: um "markdown" simples. Gera uma ÁRVORE de dados (nunca HTML),
// então nada que for digitado vira código. Links só http(s).
//
//   ## Título       ### Subtítulo      - item      1. item      > destaque      ---
//   **negrito**   *itálico*   [texto](https://link)
import { linkSeguro } from './regras.js';

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/;

export function parseInline(texto) {
  const saida = [];
  let resto = texto;
  while (resto) {
    const m = INLINE.exec(resto);
    if (!m) { saida.push({ t: 'texto', v: resto }); break; }
    if (m.index > 0) saida.push({ t: 'texto', v: resto.slice(0, m.index) });
    if (m[1] !== undefined) saida.push({ t: 'b', f: parseInline(m[1]) });
    else if (m[2] !== undefined) saida.push({ t: 'i', f: parseInline(m[2]) });
    else {
      const href = linkSeguro(m[4]);
      saida.push(href ? { t: 'a', href, f: parseInline(m[3]) } : { t: 'texto', v: m[0] });
    }
    resto = resto.slice(m.index + m[0].length);
  }
  return saida;
}

export function parseDocumento(texto) {
  const linhas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocos = [];
  let par = [];
  let lista = null;
  const fechaPar = () => { if (par.length) blocos.push({ tipo: 'p', f: parseInline(par.join(' ')) }); par = []; };
  const fechaLista = () => { if (lista) blocos.push(lista); lista = null; };

  for (const bruta of linhas) {
    const l = bruta.trimEnd();
    let m;
    if (!l.trim()) { fechaPar(); fechaLista(); continue; }
    if ((m = /^(#{1,3})\s+(.+)$/.exec(l))) {
      fechaPar(); fechaLista();
      blocos.push({ tipo: 'h', nivel: m[1].length === 1 ? 3 : m[1].length === 2 ? 3 : 4, f: parseInline(m[2]) });
    } else if (/^(-{3,}|\*{3,})$/.test(l.trim())) {
      fechaPar(); fechaLista(); blocos.push({ tipo: 'hr' });
    } else if ((m = /^\s*[-*]\s+(.+)$/.exec(l))) {
      fechaPar();
      if (!lista || lista.tipo !== 'ul') { fechaLista(); lista = { tipo: 'ul', itens: [] }; }
      lista.itens.push(parseInline(m[1]));
    } else if ((m = /^\s*\d+[.)]\s+(.+)$/.exec(l))) {
      fechaPar();
      if (!lista || lista.tipo !== 'ol') { fechaLista(); lista = { tipo: 'ol', itens: [] }; }
      lista.itens.push(parseInline(m[1]));
    } else if ((m = /^>\s?(.*)$/.exec(l))) {
      fechaPar(); fechaLista(); blocos.push({ tipo: 'q', f: parseInline(m[1]) });
    } else {
      fechaLista(); par.push(l.trim());
    }
  }
  fechaPar(); fechaLista();
  return blocos;
}

// Converte a árvore em elementos do navegador (só createElement/textContent).
export function renderizarDocumento(texto, doc = document) {
  const el = (tag, filhos = []) => { const e = doc.createElement(tag); e.append(...filhos); return e; };
  const inline = (nos) => nos.map((n) => {
    if (n.t === 'texto') return doc.createTextNode(n.v);
    if (n.t === 'a') { const a = el('a', inline(n.f)); a.href = n.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
    return el(n.t === 'b' ? 'strong' : 'em', inline(n.f));
  });
  return parseDocumento(texto).map((b) => {
    if (b.tipo === 'p') return el('p', inline(b.f));
    if (b.tipo === 'h') return el(`h${b.nivel}`, inline(b.f));
    if (b.tipo === 'q') return el('blockquote', inline(b.f));
    if (b.tipo === 'hr') return doc.createElement('hr');
    return el(b.tipo, b.itens.map((it) => el('li', inline(it))));
  });
}
