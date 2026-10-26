import { diaMes, estaAberto, concluido, linkSeguro, textoPrazoStory } from './regras.js';

const cfg = window.APOSTILA_CONFIG;
const TOTAL = cfg.totalDias;
const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

const raiz = document.getElementById('principal');
const avisoEl = document.getElementById('aviso');

const estado = { sessao: null, config: null, agenda: [], conteudo: new Map(), marcados: new Map() };

// ---------- helpers de tela (sempre textContent: nada do banco vira HTML) ----------
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f);
  return el;
}
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...filhos);
  return el;
}
const iconeCheck = () =>
  svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    svg('path', { d: 'M5 12.5l4.5 4.5L19 7.5' }));
const iconeCadeado = () =>
  svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    svg('rect', { x: '5', y: '11', width: '14', height: '9', rx: '2' }), svg('path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }));

function mostrar(...nos) {
  raiz.replaceChildren(...nos);
  window.scrollTo(0, 0);
}
let timerAviso;
function avisar(texto, erro = false) {
  avisoEl.textContent = texto;
  avisoEl.className = erro ? 'aviso erro' : 'aviso';
  avisoEl.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => (avisoEl.hidden = true), 4500);
}

// ---------- login ----------
function telaLogin() {
  const botao = h('button', { class: 'btn btn-primario btn-bloco', type: 'button' }, 'Entrar com Google');
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) {
      botao.disabled = false;
      avisar('Não consegui abrir o login. Tente de novo.', true);
    }
  });
  mostrar(
    h('section', { class: 'login' },
      h('p', { class: 'marca' }, 'Bru Medeiros'),
      h('h1', {}, cfg.nomeDesafio),
      h('div', { class: 'card' },
        h('p', {}, 'Entre com a sua conta Google. Sem senha e sem e-mail para esperar.'),
        botao,
        h('p', { class: 'privacidade' }, 'Usamos só o seu e-mail, e só para o seu acesso. O Google também envia nome e foto, mas não usamos nem mostramos. ', h('a', { href: 'privacidade.html' }, 'Política de privacidade')),
      ),
    ),
  );
}

// ---------- dados ----------
async function carregarTudo() {
  const [cfgR, agR, coR, prR] = await Promise.all([
    db.from('config').select('*').eq('id', 1).maybeSingle(),
    db.from('dias_agenda').select('*').order('numero'),
    db.from('dias_conteudo').select('*'), // o servidor só devolve os dias já abertos
    db.from('progresso').select('dia,item,marcado'),
  ]);
  const erro = [cfgR, agR, coR, prR].find((r) => r.error)?.error;
  if (erro) throw erro;
  estado.config = cfgR.data ?? {};
  estado.agenda = agR.data;
  estado.conteudo = new Map(coR.data.map((c) => [c.numero, c]));
  estado.marcados = new Map(prR.data.filter((p) => p.marcado).map((p) => [`${p.dia}:${p.item}`, true]));
}

const diaAgenda = (n) => estado.agenda.find((d) => d.numero === n);
const diaConcluido = (n) => concluido(estado.conteudo.get(n), estado.marcados);

// ---------- lista de dias ----------
function anel(feitos) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return svg('svg', { class: 'anel', viewBox: '0 0 100 100', role: 'img', 'aria-label': `${feitos} de ${TOTAL} dias concluídos` },
    svg('circle', { class: 'trilho', cx: '50', cy: '50', r }),
    svg('circle', { class: 'barra', cx: '50', cy: '50', r, 'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - feitos / TOTAL) }),
    svg('text', { x: '50', y: '50' }, `${feitos}/${TOTAL}`));
}

function telaLista() {
  const feitos = estado.agenda.filter((d) => diaConcluido(d.numero)).length;
  const itens = estado.agenda.map((d) => {
    const aberto = estaAberto(d.libera_em);
    const ok = diaConcluido(d.numero);
    const icone = ok ? iconeCheck() : aberto ? String(d.numero) : iconeCadeado();
    const lado = ok ? 'Concluído' : aberto ? '' : d.libera_em ? `abre dia ${diaMes(d.libera_em)}` : 'em breve';
    const corpo = [
      h('span', { class: 'dia-icone' }, icone),
      h('span', { class: 'dia-texto' }, h('span', { class: 'dia-num' }, `Dia ${d.numero}`), h('span', { class: 'dia-titulo' }, d.titulo)),
      h('span', { class: 'dia-lado' }, lado),
    ];
    return aberto
      ? h('a', { class: `dia-item${ok ? ' concluido' : ''}`, href: `#/dia/${d.numero}` }, corpo)
      : h('div', { class: 'dia-item', 'aria-disabled': 'true' }, corpo);
  });
  mostrar(
    h('div', { class: 'topo' }, h('p', { class: 'marca' }, 'Bru Medeiros'), botaoSair()),
    h('section', { class: 'card resumo' }, anel(feitos),
      h('div', {}, h('h1', {}, cfg.nomeDesafio), h('p', {}, feitos === 0 ? 'Vamos começar juntas?' : `${feitos} de ${TOTAL} dias concluídos.`))),
    h('nav', { class: 'card lista-dias', 'aria-label': 'Dias do desafio' }, itens),
  );
}

function botaoSair() {
  return h('button', { class: 'btn-texto', type: 'button', onclick: async () => { await db.auth.signOut(); } }, 'Sair');
}

// ---------- página do dia ----------
function secao(titulo, ...conteudo) {
  return h('section', { class: 'card secao' }, h('h2', {}, titulo), ...conteudo);
}

function secaoEstude(c) {
  const links = (c.estude ?? []).map((e) => {
    const url = e.url ? linkSeguro(e.url) : null;
    return h('li', {}, url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, e.titulo) : h('span', { class: 'sem-link' }, `${e.titulo} (link em breve)`));
  });
  return secao('Estude',
    c.estude_minutos ? h('p', { class: 'tempo' }, `Cerca de ${c.estude_minutos} min`) : null,
    h('ul', { class: 'links-estudo' }, links));
}

function secaoEnviar(c, dia) {
  const url = estado.config?.link_grupo ? linkSeguro(estado.config.link_grupo) : null;
  const insta = estado.config?.instagram || '@brunalmedeiroos';
  return secao('O que enviar no grupo',
    h('p', {}, c.enviar),
    url
      ? h('a', { class: 'btn btn-primario', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir o grupo')
      : h('span', { class: 'btn', 'aria-disabled': 'true' }, 'Link do grupo em breve'),
    h('div', { class: 'pontos' },
      h('p', {}, 'Enviar no grupo a prova do dia vale ', h('strong', {}, '1 ponto'), '.'),
      h('p', {}, `Postar um story marcando ${insta} vale `, h('strong', {}, '+1 ponto de bônus'), '.'),
      h('p', { class: 'prazo' }, `Prazo do story: ${textoPrazoStory(dia.libera_em)}.`)));
}

function secaoChecklist(c) {
  const itens = (c.checklist ?? []).map((i) => {
    const chave = `${c.numero}:${i.id}`;
    const caixa = h('input', { type: 'checkbox' });
    caixa.checked = estado.marcados.has(chave);
    caixa.addEventListener('change', () => marcar(c.numero, i.id, caixa));
    return h('li', {}, h('label', { class: 'check' }, caixa, h('span', {}, i.texto, i.opcional ? h('span', { class: 'opcional' }, 'opcional') : null)));
  });
  return secao('Checklist final', h('ul', { class: 'checklist' }, itens),
    h('p', { class: 'nota' }, 'Isso é só para você se organizar. Não é prova.'));
}

async function marcar(dia, item, caixa) {
  const chave = `${dia}:${item}`;
  const valor = caixa.checked;
  valor ? estado.marcados.set(chave, true) : estado.marcados.delete(chave);
  const { error } = await db.from('progresso').upsert(
    { user_id: estado.sessao.user.id, dia, item, marcado: valor },
    { onConflict: 'user_id,dia,item' });
  if (error) {
    caixa.checked = !valor;
    valor ? estado.marcados.delete(chave) : estado.marcados.set(chave, true);
    avisar('Não consegui salvar. Confira a internet e tente de novo.', true);
  }
}

function telaDia(n) {
  const dia = diaAgenda(n);
  if (!dia) return telaLista();
  const voltar = h('a', { class: 'btn-texto voltar', href: '#/' }, '← Todos os dias');
  const c = estado.conteudo.get(n);

  if (!estaAberto(dia.libera_em) || !c) {
    return mostrar(voltar, h('section', { class: 'card fechado' },
      h('span', { class: 'dia-icone' }, iconeCadeado()),
      h('h1', {}, `Dia ${n} ainda está fechado`),
      h('p', {}, dia.libera_em ? `Ele abre dia ${diaMes(dia.libera_em)}.` : 'Ele abre em breve.'),
      h('a', { class: 'btn', href: '#/' }, 'Ver os outros dias')));
  }

  const anterior = n > 1 ? h('a', { class: 'btn ant', href: `#/dia/${n - 1}` }, '← Anterior') : h('span');
  const proxDia = diaAgenda(n + 1);
  const proxAberto = proxDia && estaAberto(proxDia.libera_em);
  const proximo = !proxDia ? h('span')
    : proxAberto ? h('a', { class: 'btn btn-primario prox', href: `#/dia/${n + 1}` }, 'Próximo →')
    : h('span', { class: 'btn prox', 'aria-disabled': 'true' }, proxDia.libera_em ? `Abre dia ${diaMes(proxDia.libera_em)}` : 'Em breve');

  const cabeca = h('header', { class: 'cabeca-dia' }, h('span', { class: 'dia-num' }, `Dia ${n} de ${TOTAL}`), h('h1', {}, dia.titulo));
  const tarefa = secao('Tarefa do dia', h('p', {}, c.tarefa ?? 'Em breve.'));

  const corpo = c.em_breve
    ? [tarefa, secao('Conteúdo em breve', h('p', {}, 'O resto deste dia ainda não está pronto. Volte aqui em breve.'))]
    : [secao('O que você vai aprender hoje', h('p', {}, c.aprender)), secaoEstude(c), tarefa, secaoEnviar(c, dia), secaoChecklist(c)];

  mostrar(voltar, cabeca, ...corpo, h('nav', { class: 'navegacao', 'aria-label': 'Navegar entre os dias' }, anterior, proximo));
  raiz.focus({ preventScroll: true });
}

// ---------- roteamento ----------
function rotear() {
  if (!estado.sessao) return telaLogin();
  const m = location.hash.match(/^#\/dia\/(\d+)$/);
  return m ? telaDia(Number(m[1])) : telaLista();
}

async function iniciar(sessao) {
  estado.sessao = sessao;
  if (!sessao) return telaLogin();
  mostrar(h('p', { class: 'carregando' }, 'Carregando…'));
  try {
    await carregarTudo();
    rotear();
  } catch (e) {
    console.error(e);
    mostrar(h('section', { class: 'card fechado' }, h('h1', {}, 'Algo deu errado'),
      h('p', {}, 'Não consegui carregar a apostila. Confira a internet e tente de novo.'),
      h('button', { class: 'btn', type: 'button', onclick: () => iniciar(estado.sessao) }, 'Tentar de novo')));
  }
}

window.addEventListener('hashchange', rotear);

let ultimoUsuario;
db.auth.onAuthStateChange((evento, sessao) => {
  // Tira o ?code=... da barra de endereço depois do login.
  if (evento === 'SIGNED_IN' && location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  const usuario = sessao?.user?.id ?? null;
  if (evento === 'TOKEN_REFRESHED' || (evento === 'SIGNED_IN' && usuario === ultimoUsuario)) return;
  ultimoUsuario = usuario;
  iniciar(sessao);
});
