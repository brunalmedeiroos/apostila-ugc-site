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
  if (rota === '#/admin/participantes') return telaParticipantes({ db, mostrar, avisar });
  const mp = rota.match(/^#\/admin\/pontos(?:\/(\d+))?$/);
  if (mp) return telaPontos({ db, mostrar, avisar, dia: Math.min(15, Math.max(1, Number(mp[1] ?? 1))) });
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
    h('a', { class: 'card ranking-link', href: '#/admin/pontos' }, h('span', { class: 'dia-titulo' }, 'Pontos'), h('span', { class: 'dia-lado' }, 'Lançar por dia')),
    h('a', { class: 'card ranking-link', href: '#/admin/participantes' }, h('span', { class: 'dia-titulo' }, 'Participantes'), h('span', { class: 'dia-lado' }, 'Fichas e progresso')),
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

  const calcular = h('button', { class: 'btn btn-primario', type: 'button' }, 'Calcular a partir dos pontos');
  calcular.addEventListener('click', async () => {
    calcular.disabled = true;
    const { data: r, error: e } = await db.rpc('admin_ranking_calculado');
    calcular.disabled = false;
    if (e) return avisar(`Não calculou: ${e.message}`, true);
    if (!r.linhas.length) { avisos.textContent = 'Ainda não há ninguém com apelido para entrar no ranking.'; return; }
    if (linhas.length && !confirm(`Isto troca as ${linhas.length} linhas que estão na tela pelas ${r.linhas.length} calculadas. Continuar?`)) return;
    linhas = r.linhas.map((l) => ({ apelido: l.apelido, pontos: l.pontos }));
    avisos.replaceChildren(h('p', {}, `Calculei ${linhas.length} linhas com os pontos lançados.`),
      ...(r.sem_apelido ? [h('p', {}, `${r.sem_apelido} participante(s) sem apelido ficaram de fora. Dê um apelido a elas em Participantes para entrarem.`)] : []));
    desenhar();
  });
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
    h('section', { class: 'card secao' }, h('h2', {}, '1. Monte a lista'),
      h('p', { class: 'nota' }, 'O jeito mais fácil: calcule a partir dos pontos lançados em Pontos. Quem não tem apelido fica de fora.'),
      calcular,
      h('p', { class: 'nota' }, 'Ou cole um ranking de outro lugar (uma pessoa por linha: Ana 40, Bia - 35, 1. Caro 30 pts):'),
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

// ---------- participantes ----------
const SITUACOES = [['ativa', 'Ativa'], ['pausada', 'Pausada'], ['saiu', 'Saiu']];

async function telaParticipantes({ db, mostrar, avisar }) {
  const [lista, dias] = await Promise.all([db.rpc('admin_participantes'), db.rpc('admin_dias')]);
  if (lista.error) return mostrar(h('section', { class: 'card fechado' }, h('h1', {}, 'Algo deu errado'), h('p', {}, lista.error.message)));
  const prontos = (dias.data ?? []).filter((d) => !d.em_breve).length;
  const pessoas = lista.data;
  const semFicha = pessoas.filter((x) => !x.id).length;
  const recarregar = () => telaParticipantes({ db, mostrar, avisar });

  // Formulário de uma ficha. `x` = linha da lista (ou {} para uma pessoa nova que ainda não entrou).
  const formulario = (x) => {
    const nome = h('input', { type: 'text', value: x.nome ?? (x.email ? x.email.split('@')[0] : ''), maxlength: 120 });
    const apelido = h('input', { type: 'text', value: x.apelido ?? '', maxlength: 60 });
    const insta = h('input', { type: 'text', value: x.instagram ?? '', maxlength: 60, placeholder: '@usuario' });
    const situacao = h('select', {}, SITUACOES.map(([v, t]) => h('option', { value: v }, t)));
    situacao.value = x.status ?? 'ativa';
    const obs = h('textarea', { rows: 3, value: x.observacoes ?? '', maxlength: 2000 });
    const salvar = h('button', { class: 'btn btn-primario', type: 'button' }, x.id ? 'Salvar ficha' : 'Criar ficha');
    salvar.addEventListener('click', async () => {
      if (!nome.value.trim()) return avisar('A ficha precisa de um nome.', true);
      salvar.disabled = true;
      const { error } = await db.rpc('admin_salvar_participante', { p: {
        id: x.id ?? null, user_id: x.user_id ?? null, nome: nome.value, apelido: apelido.value, instagram: insta.value,
        status: situacao.value, observacoes: obs.value } });
      salvar.disabled = false;
      if (error) return avisar(`Não salvou: ${error.message}`, true);
      avisar('Ficha salva.');
      recarregar();
    });
    const apagar = x.id ? h('button', { class: 'btn-texto', type: 'button' }, 'Apagar ficha') : null;
    apagar?.addEventListener('click', async () => {
      if (!confirm(`Apagar a ficha de ${x.nome}? Ela continua podendo entrar na apostila.`)) return;
      const { error } = await db.rpc('admin_apagar_participante', { p_id: x.id });
      if (error) return avisar(`Não apagou: ${error.message}`, true);
      avisar('Ficha apagada.');
      recarregar();
    });
    const campo = (rotulo, el, dica) => h('label', { class: 'campo' }, h('span', {}, rotulo), el, dica ? h('small', {}, dica) : null);

    // Ficha cadastrada à mão (sem login): dá para ligar a um login que já entrou.
    let ligar = null;
    if (x.id && !x.user_id) {
      const logins = pessoas.filter((o) => o.user_id);
      const escolha = h('select', {}, h('option', { value: '' }, 'Escolha o login…'),
        logins.map((o) => h('option', { value: o.user_id }, `${o.email}${o.nome ? ` (${o.nome})` : ' (sem ficha)'}`)));
      const botaoLigar = h('button', { class: 'btn', type: 'button' }, 'Ligar a este login');
      botaoLigar.addEventListener('click', async () => {
        if (!escolha.value) return avisar('Escolha o login primeiro.', true);
        if (!confirm('Ligar esta ficha a esse login? Se ela já preencheu o próprio cadastro, as duas viram uma só: vale o que você escreveu aqui, e o que estiver vazio vem do que ela escreveu.')) return;
        const { error } = await db.rpc('admin_ligar_ficha', { p_ficha_id: x.id, p_user_id: escolha.value });
        if (error) return avisar(`Não ligou: ${error.message}`, true);
        avisar('Ficha ligada ao login.');
        recarregar();
      });
      ligar = h('div', { class: 'ficha-ligar' }, campo('Esta pessoa já entrou na apostila?', escolha, 'Escolha o e-mail dela para juntar a ficha ao login.'), botaoLigar);
    }
    return h('div', { class: 'ficha-form' },
      x.email ? h('p', { class: 'nota' }, `E-mail: ${x.email}`) : h('p', { class: 'nota' }, 'Ainda não entrou na apostila.'),
      x.entrou_em ? h('p', { class: 'nota' }, `Entrou em ${dataHoraFortaleza(x.entrou_em)}${x.ultimo_acesso ? `. Último acesso: ${dataHoraFortaleza(x.ultimo_acesso)}` : ''}.`) : null,
      campo('Nome', nome), campo('Apelido (o que aparece no ranking)', apelido, 'Deixe vazio para ela não aparecer no ranking.'),
      campo('Instagram', insta), campo('Situação', situacao), campo('Observações (só você vê)', obs),
      h('div', { class: 'acoes' }, salvar, apagar),
      ligar);
  };

  const linha = (x) => {
    const titulo = x.nome ?? x.email?.split('@')[0] ?? 'Sem nome';
    const andamento = x.user_id ? `${x.dias_concluidos}/${prontos} dias` : 'não entrou';
    return h('details', { class: 'ficha' },
      h('summary', {},
        h('span', { class: 'dia-texto' },
          h('span', { class: 'dia-titulo' }, titulo),
          h('span', { class: 'dia-num' }, [!x.id ? 'sem ficha' : x.apelido ? `apelido: ${x.apelido}` : 'sem apelido', x.status !== 'ativa' ? x.status : null].filter(Boolean).join(' · '))),
        h('span', { class: 'dia-lado' }, andamento)),
      formulario(x));
  };

  const nova = h('details', { class: 'ficha' }, h('summary', {}, h('span', { class: 'dia-titulo' }, '+ Cadastrar quem ainda não entrou')), formulario({}));

  mostrar(
    h('a', { class: 'btn-texto voltar', href: '#/admin' }, '← Admin'),
    h('h1', { class: 'titulo-admin' }, 'Participantes'),
    h('p', { class: 'nota' }, `${pessoas.filter((x) => x.user_id).length} entraram na apostila${semFicha ? `, ${semFicha} ainda sem ficha` : ''}. "Dias" conta quem concluiu todos os itens obrigatórios do checklist. Hoje há ${prontos} ${prontos === 1 ? 'dia pronto' : 'dias prontos'}.`),
    h('div', { class: 'card lista-fichas' }, pessoas.length ? pessoas.map(linha) : h('p', {}, 'Ninguém entrou ainda.')),
    h('div', { class: 'card lista-fichas' }, nova));
}

// ---------- pontos ----------
async function telaPontos({ db, mostrar, avisar, dia }) {
  const [pd, dd] = await Promise.all([db.rpc('admin_pontuacao_dia', { p_dia: dia }), db.rpc('admin_dias')]);
  if (pd.error) return mostrar(h('section', { class: 'card fechado' }, h('h1', {}, 'Algo deu errado'), h('p', {}, pd.error.message)));
  const { itens, participantes } = pd.data;
  const recarregar = () => telaPontos({ db, mostrar, avisar, dia });

  const seletorDia = h('select', { 'aria-label': 'Dia', onchange: (e) => { location.hash = `#/admin/pontos/${e.target.value}`; } },
    (dd.data ?? []).map((d) => h('option', { value: d.numero }, `Dia ${d.numero}: ${d.titulo}`)));
  seletorDia.value = String(dia);

  // 1. itens que valem ponto neste dia
  const linhasItens = h('div', { class: 'linhas' });
  const totalItens = h('p', { class: 'nota' });
  const somaTotal = () => {
    const t = [...linhasItens.children].reduce((a, l) => a + (Number(l._ler().pontos) || 0), 0);
    totalItens.textContent = `Total do dia: ${t} pontos.`;
  };
  const addItem = (i = {}) => {
    const texto = h('input', { type: 'text', value: i.texto ?? '', maxlength: 200, placeholder: 'Ex.: A marca escolhida', oninput: somaTotal, 'aria-label': 'O que vale ponto' });
    const pontos = h('input', { type: 'number', min: 0, max: 1000, value: i.pontos ?? '', oninput: somaTotal, 'aria-label': 'Pontos' });
    const x = h('button', { class: 'btn-texto', type: 'button' }, 'Remover');
    const linha = h('div', { class: 'linha linha-item' }, texto, pontos, x);
    x.addEventListener('click', () => { linha.remove(); somaTotal(); });
    linha._ler = () => ({ id: i.id, texto: texto.value.trim(), pontos: pontos.value });
    linhasItens.append(linha);
  };
  itens.forEach(addItem);
  somaTotal();
  const salvarItens = h('button', { class: 'btn btn-primario', type: 'button' }, 'Salvar itens do dia');
  salvarItens.addEventListener('click', async () => {
    const lista = [...linhasItens.children].map((l) => l._ler()).filter((i) => i.texto || i.pontos !== '');
    if (lista.some((i) => !i.texto || !/^\d+$/.test(String(i.pontos)))) return avisar('Todo item precisa de um texto e de pontos (número inteiro, zero ou mais).', true);
    salvarItens.disabled = true;
    const { error } = await db.rpc('admin_salvar_pontuacao_dia', { p_dia: dia, p_itens: lista.map((i) => ({ id: i.id ?? novoIdChecklist(i.texto), texto: i.texto, pontos: Number(i.pontos) })) });
    salvarItens.disabled = false;
    if (error) return avisar(`Não salvou: ${error.message}`, true);
    avisar('Itens salvos. O que já foi dado não muda.');
    recarregar();
  });

  // 2. quem cumpriu
  const quem = !itens.length
    ? h('p', { class: 'nota' }, 'Defina e salve os itens do dia acima para poder marcar quem cumpriu.')
    : participantes.length
      ? h('div', { class: 'lancar' }, participantes.map((p) => {
          const total = h('span', { class: 'total-dia' }, `${p.total_dia} pts`);
          const caixas = itens.map((i) => {
            const c = h('input', { type: 'checkbox', 'data-item': i.id });
            c.checked = p.feitos.includes(i.id);
            c.addEventListener('change', async () => {
              const marcados = [...c.closest('.pessoa-pontos').querySelectorAll('input[type=checkbox]')].filter((x) => x.checked).map((x) => x.dataset.item);
              c.disabled = true;
              const { data, error } = await db.rpc('admin_lancar_pontos_dia', { p_dia: dia, p_participante: p.id, p_itens: marcados });
              c.disabled = false;
              if (error) { c.checked = !c.checked; return avisar(`Não salvou: ${error.message}`, true); }
              total.textContent = `${data} pts`;
            });
            return h('label', { class: 'check mini-check' }, c, h('span', {}, `${i.texto} (${i.pontos})`));
          });
          return h('div', { class: 'pessoa-pontos' },
            h('div', { class: 'pessoa-topo' }, h('strong', {}, p.apelido ?? p.nome), p.apelido && p.apelido !== p.nome ? h('span', { class: 'nota' }, p.nome) : null, total), caixas);
        }))
      : h('p', { class: 'nota' }, 'Ainda não há participantes. Cadastre em Participantes.');

  // 3. ponto extra ou desconto
  const opcoes = () => participantes.map((p) => h('option', { value: p.id }, p.apelido ?? p.nome));
  const selExtra = h('select', { 'aria-label': 'Participante' }, opcoes());
  const motivo = h('input', { type: 'text', maxlength: 200, placeholder: 'Motivo (ex.: ajudou no grupo)' });
  const ptsExtra = h('input', { type: 'number', placeholder: 'Pontos (use - para descontar)' });
  const lancar = h('button', { class: 'btn', type: 'button' }, 'Lançar');
  lancar.addEventListener('click', async () => {
    if (!selExtra.value) return avisar('Escolha a participante.', true);
    if (!motivo.value.trim()) return avisar('Escreva o motivo.', true);
    const n = Number(ptsExtra.value);
    if (!Number.isInteger(n) || n === 0) return avisar('Os pontos precisam ser um número inteiro diferente de zero.', true);
    lancar.disabled = true;
    const { error } = await db.rpc('admin_lancar_extra', { p_participante: selExtra.value, p_motivo: motivo.value, p_pontos: n, p_obs: null });
    lancar.disabled = false;
    if (error) return avisar(`Não lançou: ${error.message}`, true);
    avisar('Lançado.'); motivo.value = ''; ptsExtra.value = ''; mostraHistorico();
  });

  // 4. histórico
  const selHist = h('select', { 'aria-label': 'Ver histórico de' }, h('option', { value: '' }, 'Escolha…'), opcoes());
  const hist = h('div', { class: 'historico' });
  async function mostraHistorico() {
    const id = selHist.value || selExtra.value;
    if (selHist.value !== id) selHist.value = id;
    if (!id) return hist.replaceChildren();
    const { data, error } = await db.rpc('admin_historico_pontos', { p_participante: id });
    if (error) return avisar(error.message, true);
    const soma = data.filter((x) => x.valido).reduce((a, x) => a + x.pontos, 0);
    hist.replaceChildren(h('p', { class: 'nota' }, `Total válido: ${soma} pontos.`),
      data.length ? h('ul', { class: 'hist-lista' }, data.map((x) => {
        const anular = x.valido ? h('button', { class: 'btn-texto', type: 'button' }, 'Anular') : null;
        anular?.addEventListener('click', async () => {
          if (!confirm(`Anular "${x.motivo}" (${x.pontos} pontos)? Fica no histórico como anulado.`)) return;
          const { error: e } = await db.rpc('admin_anular_ponto', { p_id: x.id });
          if (e) return avisar(e.message, true);
          avisar('Anulado.'); mostraHistorico();
        });
        return h('li', { class: x.valido ? '' : 'anulado' },
          h('span', { class: 'hist-texto' }, `${x.dia ? `Dia ${x.dia}: ` : ''}${x.motivo}`, x.valido ? null : ' (anulado)'),
          h('span', { class: 'hist-pts' }, `${x.pontos > 0 ? '+' : ''}${x.pontos}`), anular);
      })) : h('p', { class: 'nota' }, 'Nenhum lançamento ainda.'));
  }
  selHist.addEventListener('change', mostraHistorico);

  mostrar(
    h('a', { class: 'btn-texto voltar', href: '#/admin' }, '← Admin'),
    h('h1', { class: 'titulo-admin' }, 'Pontos'),
    h('label', { class: 'campo' }, h('span', {}, 'Dia'), seletorDia),
    h('section', { class: 'card secao' }, h('h2', {}, `1. O que vale ponto no Dia ${dia}`),
      linhasItens, h('button', { class: 'btn-texto', type: 'button', onclick: () => { addItem(); somaTotal(); } }, '+ Adicionar item'),
      totalItens, h('div', { class: 'acoes' }, salvarItens)),
    h('section', { class: 'card secao' }, h('h2', {}, '2. Quem cumpriu'), quem,
      itens.length ? h('p', { class: 'nota' }, 'Cada marcação salva na hora. Desmarcar anula e fica no histórico.') : null),
    h('section', { class: 'card secao' }, h('h2', {}, '3. Ponto extra ou desconto'),
      participantes.length ? [h('label', { class: 'campo' }, h('span', {}, 'Participante'), selExtra), h('label', { class: 'campo' }, h('span', {}, 'Motivo'), motivo),
        h('label', { class: 'campo' }, h('span', {}, 'Pontos'), ptsExtra), h('div', { class: 'acoes' }, lancar)] : h('p', { class: 'nota' }, 'Sem participantes ainda.')),
    h('section', { class: 'card secao' }, h('h2', {}, '4. Histórico de uma participante'),
      h('label', { class: 'campo' }, h('span', {}, 'Participante'), selHist), hist));
}
