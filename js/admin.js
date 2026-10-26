// Área só da Bruna. A proteção de verdade está no servidor (funções admin_* do Supabase):
// mesmo que alguém abra esta tela, o banco recusa tudo que não for da admin.
import { h } from './dom.js';
import { diaMes, estaAberto, dataFortaleza, paraLiberaEm, novoIdChecklist, idYoutube, lerRanking, posicoesRanking, dataHoraFortaleza } from './regras.js';
import { renderizarDocumento } from './documento.js';
import { cabecaDoDia, corpoDoDia } from './dia-view.js';
import { cartaoRanking } from './ranking-view.js';

const PAINEL = 'https://brunamedeiros.com/login';

export async function abrirAdmin({ db, mostrar, avisar, rota }) {
  const { data: souAdmin, error } = await db.rpc('is_admin');
  if (error || !souAdmin) {
    return mostrar(h('section', { class: 'card fechado' }, h('h1', {}, 'Área restrita'),
      h('p', {}, 'Esta página é só da Bruna.'), h('a', { class: 'btn', href: '#/' }, 'Voltar para a apostila')));
  }
  mostrar(h('p', { class: 'carregando' }, 'Carregando…'));
  const { data: dias, error: e1 } = await db.rpc('admin_dias');
  const { data: config } = await db.from('config').select('*').eq('id', 1).maybeSingle();
  if (e1) return mostrar(h('section', { class: 'card fechado' }, h('h1', {}, 'Algo deu errado'), h('p', {}, e1.message)));

  if (rota === '#/admin/ranking') return telaRanking({ db, mostrar, avisar });
  const m = rota.match(/^#\/admin\/dia\/(\d+)$/);
  if (m) {
    const dia = dias.find((d) => d.numero === Number(m[1]));
    if (dia) return telaDia({ db, mostrar, avisar, dia, config: config ?? {} });
  }
  return telaLista({ db, mostrar, avisar, dias, config: config ?? {} });
}

// ---------- lista ----------
function telaLista({ db, mostrar, avisar, dias, config }) {
  const link = h('input', { type: 'url', id: 'cfg-link', value: config.link_grupo ?? '', placeholder: 'https://chat.whatsapp.com/…' });
  const insta = h('input', { type: 'text', id: 'cfg-insta', value: config.instagram ?? '' });
  const salvar = h('button', { class: 'btn btn-primario', type: 'button' }, 'Salvar grupo');
  salvar.addEventListener('click', async () => {
    salvar.disabled = true;
    const { error } = await db.rpc('admin_salvar_config', { p_link: link.value, p_instagram: insta.value });
    salvar.disabled = false;
    avisar(error ? `Não salvou: ${error.message}` : 'Grupo salvo.', Boolean(error));
  });

  const linhas = dias.map((d) => {
    const abre = !d.libera_em ? 'sem data' : estaAberto(d.libera_em) ? 'aberto' : `abre dia ${diaMes(d.libera_em)}`;
    return h('a', { class: 'dia-item', href: `#/admin/dia/${d.numero}` },
      h('span', { class: 'dia-texto' }, h('span', { class: 'dia-num' }, `Dia ${d.numero}`), h('span', { class: 'dia-titulo' }, d.titulo)),
      h('span', { class: 'dia-lado' }, d.em_breve ? 'em breve' : 'pronto', h('br'), abre));
  });

  mostrar(
    h('div', { class: 'topo' }, h('a', { class: 'btn-texto', href: '#/' }, '← Apostila'),
      h('a', { class: 'btn-texto', href: PAINEL, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir o Painel')),
    h('h1', { class: 'titulo-admin' }, 'Admin do desafio'),
    h('section', { class: 'card secao' }, h('h2', {}, 'Grupo'),
      h('label', { class: 'campo', for: 'cfg-link' }, h('span', {}, 'Link do grupo'), link),
      h('label', { class: 'campo', for: 'cfg-insta' }, h('span', {}, '@ do Instagram'), insta), salvar),
    h('a', { class: 'card ranking-link', href: '#/admin/ranking' }, h('span', { class: 'dia-titulo' }, 'Ranking'), h('span', { class: 'dia-lado' }, 'Editar e publicar')),
    h('nav', { class: 'card lista-dias', 'aria-label': 'Dias' }, linhas));
}

// ---------- um dia ----------
function telaDia({ db, mostrar, avisar, dia, config }) {
  let sujo = false;
  const marca = () => { sujo = true; };
  const campo = (rotulo, el, dica) => h('label', { class: 'campo' }, h('span', {}, rotulo), el, dica ? h('small', {}, dica) : null);
  const texto = (valor, linhas = 3) => h('textarea', { rows: linhas, value: valor ?? '', oninput: marca });

  const titulo = h('input', { type: 'text', value: dia.titulo ?? '', maxlength: 200, oninput: marca });
  const abreEm = h('input', { type: 'date', value: dataFortaleza(dia.libera_em), oninput: marca });
  const pronto = h('input', { type: 'checkbox', onchange: marca });
  pronto.checked = !dia.em_breve;
  const aprender = texto(dia.aprender);
  const minutos = h('input', { type: 'number', min: 0, max: 600, value: dia.estude_minutos ?? '', oninput: marca });
  const tarefa = texto(dia.tarefa);
  const enviar = texto(dia.enviar);
  const documento = texto(dia.documento, 14);
  const video = h('input', { type: 'url', placeholder: 'https://youtu.be/…  (opcional)', value: dia.video_id ? `https://youtu.be/${dia.video_id}` : '', oninput: () => { marca(); atualizaVideo(); } });
  const videoStatus = h('small', {});
  const atualizaVideo = () => {
    videoStatus.textContent = !video.value.trim() ? '' : idYoutube(video.value) ? 'Vídeo reconhecido.' : 'Não reconheci esse link do YouTube.';
  };
  atualizaVideo();

  // lista de estudo
  const estudeBox = h('div', { class: 'linhas' });
  const addEstude = (e = {}) => {
    const t = h('input', { type: 'text', placeholder: 'Título', value: e.titulo ?? '', oninput: marca });
    const u = h('input', { type: 'url', placeholder: 'https://…  (opcional)', value: e.url ?? '', oninput: marca });
    const x = h('button', { class: 'btn-texto', type: 'button', 'aria-label': 'Remover item' }, 'Remover');
    const linha = h('div', { class: 'linha' }, t, u, x);
    x.addEventListener('click', () => { linha.remove(); marca(); });
    linha._ler = () => ({ titulo: t.value.trim(), url: u.value.trim() });
    estudeBox.append(linha);
  };
  (dia.estude ?? []).forEach(addEstude);

  // checklist (o id de um item existente nunca muda)
  const checkBox = h('div', { class: 'linhas' });
  const addCheck = (i = {}) => {
    const t = h('input', { type: 'text', placeholder: 'Ex.: Assisti ao vídeo', value: i.texto ?? '', oninput: marca });
    const o = h('input', { type: 'checkbox', onchange: marca }); o.checked = Boolean(i.opcional);
    const x = h('button', { class: 'btn-texto', type: 'button' }, 'Remover');
    const linha = h('div', { class: 'linha linha-check' }, t, h('label', { class: 'mini' }, o, ' opcional'), x);
    x.addEventListener('click', () => { linha.remove(); marca(); });
    linha._ler = () => ({ id: i.id, texto: t.value.trim(), opcional: o.checked });
    checkBox.append(linha);
  };
  (dia.checklist ?? []).forEach(addCheck);

  // prévia do documento
  const previa = h('div', { class: 'documento previa' });
  const atualizaPrevia = () => previa.replaceChildren(...renderizarDocumento(documento.value));
  documento.addEventListener('input', atualizaPrevia);
  atualizaPrevia();

  // Lê o formulário. Devolve { p } pronto para salvar, ou { erro } com o que falta.
  const coletar = () => {
    const estude = [...estudeBox.children].map((l) => l._ler()).filter((e) => e.titulo || e.url);
    if (estude.some((e) => !e.titulo)) return { erro: 'Todo item de estudo precisa de um título.' };
    const checklist = [...checkBox.children].map((l) => l._ler()).filter((c) => c.texto)
      .map((c) => ({ id: c.id ?? novoIdChecklist(c.texto), texto: c.texto, ...(c.opcional ? { opcional: true } : {}) }));
    if (!titulo.value.trim()) return { erro: 'O dia precisa de um título.' };
    const videoId = video.value.trim() ? idYoutube(video.value) : null;
    if (video.value.trim() && !videoId) return { erro: 'Não reconheci o link do vídeo. Use o link do YouTube.' };
    let libera_em;
    try { libera_em = paraLiberaEm(abreEm.value); } catch (e) { return { erro: e.message }; }
    return { p: {
      numero: dia.numero, titulo: titulo.value.trim(), libera_em, em_breve: !pronto.checked,
      aprender: aprender.value, estude, estude_minutos: minutos.value === '' ? null : Number(minutos.value),
      tarefa: tarefa.value, enviar: enviar.value, checklist, documento: documento.value, video_id: videoId } };
  };

  const botao = h('button', { class: 'btn btn-primario', type: 'button' }, 'Salvar dia');
  botao.addEventListener('click', async () => {
    const r = coletar();
    if (r.erro) return avisar(r.erro, true);
    botao.disabled = true;
    const { error } = await db.rpc('admin_salvar_dia', { p: r.p });
    botao.disabled = false;
    if (error) return avisar(`Não salvou: ${error.message}`, true);
    sujo = false;
    avisar('Dia salvo.');
    location.hash = '#/admin';
  });

  // Prévia: o dia inteiro como a menina vê. Não salva nada, e as marcações não ficam gravadas.
  const previaDia = h('div', { class: 'previa-dia', hidden: true });
  const botaoPrevia = h('button', { class: 'btn', type: 'button' }, 'Ver como as meninas veem');
  botaoPrevia.addEventListener('click', () => {
    const r = coletar();
    if (r.erro) return avisar(r.erro, true);
    const c = { ...r.p };
    previaDia.replaceChildren(
      h('p', { class: 'nota aviso-previa' }, 'Prévia. Nada disso foi salvo, e as marcações do checklist não ficam gravadas.'),
      cabecaDoDia(dia.numero, r.p.titulo, window.APOSTILA_CONFIG.totalDias),
      ...corpoDoDia(c, { titulo: r.p.titulo, libera_em: r.p.libera_em }, config, new Map(), () => {}));
    previaDia.hidden = false;
    previaDia.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const voltar = h('a', { class: 'btn-texto voltar', href: '#/admin' }, '← Todos os dias');
  voltar.addEventListener('click', (ev) => { if (sujo && !confirm('Você tem alterações sem salvar. Sair mesmo assim?')) ev.preventDefault(); });

  mostrar(voltar, h('h1', { class: 'titulo-admin' }, `Dia ${dia.numero}`),
    h('section', { class: 'card secao' }, h('h2', {}, 'Básico'),
      campo('Título', titulo),
      campo('Abre em', abreEm, 'Abre às 00:00 de Fortaleza. Deixe vazio para o dia ficar fechado.'),
      h('label', { class: 'check' }, pronto, h('span', {}, 'Este dia está pronto (desmarcado, as meninas veem "conteúdo em breve")'))),
    h('section', { class: 'card secao' }, h('h2', {}, '1. O que você vai aprender hoje'), campo('Texto', aprender, 'Aceita **negrito**, listas com - e links. Linha em branco separa parágrafos.')),
    h('section', { class: 'card secao' }, h('h2', {}, '2. Estude'),
      campo('Tempo estimado (minutos)', minutos),
      h('label', { class: 'campo' }, h('span', {}, 'Vídeo do dia (YouTube)'), video, videoStatus,
        h('small', {}, 'Suba o vídeo no YouTube como "não listado" e cole o link aqui. As meninas veem um player, só no dia certo.')),
      campo('Documento do dia', documento),
      h('details', { class: 'ajuda' }, h('summary', {}, 'Como formatar'),
        h('p', {}, '## Título · ### Subtítulo · - item de lista · 1. lista numerada · > destaque · --- linha · **negrito** · *itálico* · [texto](https://link)')),
      h('details', { class: 'ajuda', open: true }, h('summary', {}, 'Prévia do documento'), previa),
      h('p', { class: 'rotulo' }, 'Links para estudar'), estudeBox,
      h('button', { class: 'btn-texto', type: 'button', onclick: () => { addEstude(); marca(); } }, '+ Adicionar link')),
    h('section', { class: 'card secao' }, h('h2', {}, '3. Tarefa do dia'), campo('Texto', tarefa, 'Aceita **negrito**, listas com - e links. Linha em branco separa parágrafos.')),
    h('section', { class: 'card secao' }, h('h2', {}, '4. O que enviar no grupo'), campo('Texto', enviar, 'Aceita **negrito**, listas com - e links. Linha em branco separa parágrafos.'),
      h('p', { class: 'nota' }, 'Escreva aqui os pontos e o que vale ponto. Nada é acrescentado sozinho.')),
    h('section', { class: 'card secao' }, h('h2', {}, '5. Checklist final'), checkBox,
      h('button', { class: 'btn-texto', type: 'button', onclick: () => { addCheck(); marca(); } }, '+ Adicionar item'),
      h('p', { class: 'nota' }, 'Itens já existentes mantêm o progresso das meninas mesmo se você mudar o texto.')),
    h('div', { class: 'acoes' }, botaoPrevia, botao), previaDia);
}

// ---------- ranking ----------
async function telaRanking({ db, mostrar, avisar }) {
  const { data, error } = await db.rpc('admin_ranking');
  if (error) return mostrar(h('section', { class: 'card fechado' }, h('h1', {}, 'Algo deu errado'), h('p', {}, error.message)));

  let linhas = (data.linhas ?? []).map((l) => ({ apelido: l.apelido, pontos: l.pontos }));
  const area = h('textarea', { rows: 8, placeholder: 'Cole aqui o ranking, uma pessoa por linha:\nAna 40\nBia - 35\n1. Caro 30 pts' });
  const avisos = h('div', { class: 'nota' });
  const tabela = h('div', { class: 'linhas' });
  const previa = h('div', { class: 'previa-dia' });
  const visivel = h('input', { type: 'checkbox' });
  visivel.checked = Boolean(data.visivel);
  const posicoes = [];

  const atualizar = () => {
    posicoesRanking(linhas).forEach((p) => { if (posicoes[p.i]) posicoes[p.i].textContent = `${p.posicao}º`; });
    previa.replaceChildren(cartaoRanking(linhas.filter((l) => l.apelido.trim() && Number.isInteger(l.pontos)), data.atualizado_em));
  };
  const desenhar = () => {
    posicoes.length = 0;
    tabela.replaceChildren(...linhas.map((l, i) => {
      const pos = h('span', { class: 'rank-pos' });
      posicoes[i] = pos;
      const nome = h('input', { type: 'text', value: l.apelido, maxlength: 60, 'aria-label': 'Apelido', oninput: (e) => { l.apelido = e.target.value; atualizar(); } });
      const pts = h('input', { type: 'number', value: l.pontos, 'aria-label': 'Pontos', oninput: (e) => { l.pontos = e.target.value === '' ? NaN : Number(e.target.value); atualizar(); } });
      const x = h('button', { class: 'btn-texto', type: 'button' }, 'Remover');
      x.addEventListener('click', () => { linhas.splice(i, 1); desenhar(); });
      return h('div', { class: 'linha linha-rank' }, pos, nome, pts, x);
    }));
    atualizar();
  };
  desenhar();

  const ler = h('button', { class: 'btn', type: 'button' }, 'Ler a lista colada');
  ler.addEventListener('click', () => {
    const r = lerRanking(area.value);
    if (!r.linhas.length) { avisos.textContent = 'Não achei nenhuma linha com apelido e pontos. Use o formato: Ana 40'; return; }
    if (linhas.length && !confirm(`Isto troca as ${linhas.length} linhas que estão na tela pelas ${r.linhas.length} coladas. Continuar?`)) return;
    linhas = r.linhas;
    avisos.replaceChildren(h('p', {}, `Li ${r.linhas.length} linhas.`),
      ...(r.ignoradas.length ? [h('p', {}, `Não consegui ler ${r.ignoradas.length}:`), h('ul', {}, r.ignoradas.map((i) => h('li', {}, `"${i.linha}" (${i.motivo})`)))] : []));
    desenhar();
  });

  const publicar = h('button', { class: 'btn btn-primario', type: 'button' }, 'Publicar ranking');
  publicar.addEventListener('click', async () => {
    const ruim = linhas.findIndex((l) => !l.apelido.trim() || l.apelido.trim().length > 60 || !Number.isInteger(l.pontos));
    if (ruim >= 0) return avisar(`A linha ${ruim + 1} precisa de apelido (até 60 letras) e pontos inteiros.`, true);
    publicar.disabled = true;
    const { error: e } = await db.rpc('admin_publicar_ranking', { p: linhas.map((l) => ({ apelido: l.apelido.trim(), pontos: l.pontos })), p_visivel: visivel.checked });
    publicar.disabled = false;
    if (e) return avisar(`Não publicou: ${e.message}`, true);
    avisar(visivel.checked ? 'Ranking publicado. As meninas já veem.' : 'Ranking salvo, mas escondido das meninas.');
  });

  mostrar(
    h('a', { class: 'btn-texto voltar', href: '#/admin' }, '← Admin'),
    h('h1', { class: 'titulo-admin' }, 'Ranking'),
    h('section', { class: 'card secao' }, h('h2', {}, '1. Cole o ranking'),
      h('p', { class: 'nota' }, 'Copie do Painel (ou de onde você conta os pontos) e cole aqui. Pode ter posição na frente, "pts" no fim, ou colunas copiadas de uma tabela.'),
      area, ler, avisos),
    h('section', { class: 'card secao' }, h('h2', {}, '2. Confira e corrija'), tabela,
      h('button', { class: 'btn-texto', type: 'button', onclick: () => { linhas.push({ apelido: '', pontos: 0 }); desenhar(); } }, '+ Adicionar linha'),
      h('p', { class: 'nota' }, 'Quem tem os mesmos pontos divide a posição. A ordem em que você colou desempata o que aparece primeiro.')),
    h('section', { class: 'card secao' }, h('h2', {}, '3. Publicar'),
      h('label', { class: 'check' }, visivel, h('span', {}, 'Mostrar o ranking para as meninas')),
      h('p', { class: 'nota' }, data.atualizado_em ? `Última publicação: ${dataHoraFortaleza(data.atualizado_em)} (horário de Fortaleza).` : 'Ainda não foi publicado.'),
      h('div', { class: 'acoes' }, publicar)),
    h('h2', { class: 'titulo-admin' }, 'Como as meninas veem'), previa);
}
