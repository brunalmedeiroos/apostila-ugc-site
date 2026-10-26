// As peças da página de um dia. Usadas pela tela das meninas (app.js) e pela
// prévia do admin (admin.js), para as duas serem sempre idênticas.
import { h } from './dom.js';
import { linkSeguro, ehIdYoutube, urlEmbedYoutube } from './regras.js';
import { renderizarDocumento } from './documento.js';

// Texto livre da Bruna (aprender, tarefa, enviar): mesma formatação do documento.
const texto = (valor) => h('div', { class: 'documento' }, renderizarDocumento(valor ?? ''));

export function secao(titulo, ...conteudo) {
  return h('section', { class: 'card secao' }, h('h2', {}, titulo), ...conteudo);
}

export function secaoEstude(c) {
  const links = (c.estude ?? []).map((e) => {
    const url = e.url ? linkSeguro(e.url) : null;
    return h('li', {}, url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, e.titulo) : h('span', { class: 'sem-link' }, `${e.titulo} (link em breve)`));
  });
  const video = ehIdYoutube(c.video_id)
    ? h('div', { class: 'video' },
      h('p', { class: 'prefere' }, 'Prefere ouvir? Assista ao vídeo do dia.'),
      h('div', { class: 'video-moldura' }, h('iframe', {
        src: urlEmbedYoutube(c.video_id), title: 'Vídeo do dia', loading: 'lazy', allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin', allow: 'encrypted-media; picture-in-picture; fullscreen',
        sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox' })))
    : null;
  return secao('Estude',
    c.estude_minutos ? h('p', { class: 'tempo' }, `Cerca de ${c.estude_minutos} min`) : null,
    video,
    c.documento ? h('div', { class: 'documento' }, renderizarDocumento(c.documento)) : null,
    links.length ? h('ul', { class: 'links-estudo' }, links) : null);
}

export function secaoEnviar(c, dia, config) {
  const url = config?.link_grupo ? linkSeguro(config.link_grupo) : null;
  return secao('O que enviar no grupo',
    texto(c.enviar),
    url
      ? h('a', { class: 'btn btn-primario', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir o grupo')
      : h('span', { class: 'btn', 'aria-disabled': 'true' }, 'Link do grupo em breve'));
}

export function secaoChecklist(c, marcados, aoMarcar) {
  const itens = (c.checklist ?? []).map((i) => {
    const caixa = h('input', { type: 'checkbox' });
    caixa.checked = marcados.has(`${c.numero}:${i.id}`);
    caixa.addEventListener('change', () => aoMarcar(c.numero, i.id, caixa));
    return h('li', {}, h('label', { class: 'check' }, caixa, h('span', {}, i.texto, i.opcional ? h('span', { class: 'opcional' }, 'opcional') : null)));
  });
  return secao('Checklist final', h('ul', { class: 'checklist' }, itens),
    h('p', { class: 'nota' }, 'Isso é só para você se organizar. Não é prova.'));
}

export const cabecaDoDia = (n, titulo, total, etapa) =>
  h('header', { class: 'cabeca-dia' },
    h('span', { class: 'dia-num' }, [`Dia ${String(n).padStart(2, '0')} de ${total}`, etapa].filter(Boolean).join(' · ')),
    h('h1', {}, titulo));

// As seções do dia, na ordem. `c` é o conteúdo; `dia` tem titulo e libera_em.
export function corpoDoDia(c, dia, config, marcados, aoMarcar) {
  const tarefa = secao('Tarefa do dia', texto(c.tarefa ?? 'Em breve.'));
  return c.em_breve
    ? [tarefa, secao('Conteúdo em breve', h('p', {}, 'O resto deste dia ainda não está pronto. Volte aqui em breve.'))]
    : [secao('O que você vai aprender hoje', texto(c.aprender)), secaoEstude(c), tarefa, secaoEnviar(c, dia, config), secaoChecklist(c, marcados, aoMarcar)];
}
