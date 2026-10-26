// Regras puras (sem tela), para poder testar no Node.
const FUSO = 'America/Fortaleza';
const formatoDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });

// "02/11" no horário de Fortaleza.
export const diaMes = (iso) => formatoDiaMes.format(new Date(iso));

// Só para a tela. Quem realmente bloqueia o conteúdo é o servidor.
export const estaAberto = (liberaEm, agora = new Date()) => Boolean(liberaEm) && new Date(liberaEm) <= agora;

// Dia concluído = todos os itens obrigatórios do checklist marcados.
export function concluido(conteudo, marcados) {
  if (!conteudo || conteudo.em_breve) return false;
  const obrigatorios = (conteudo.checklist ?? []).filter((i) => !i.opcional);
  return obrigatorios.length > 0 && obrigatorios.every((i) => marcados.has(`${conteudo.numero}:${i.id}`));
}

// Só deixa passar links http(s). Evita "javascript:" vindo de um erro no conteúdo.
export function linkSeguro(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

// ---- admin ----
const formatoData = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

// "2026-11-12" (dia em Fortaleza) a partir do instante guardado no banco; '' se não tem data.
export const dataFortaleza = (iso) => (iso ? formatoData.format(new Date(iso)) : '');

// Meia-noite de Fortaleza no dia escolhido, para gravar no banco; null se vazio.
export const paraLiberaEm = (aaaaMmDd) => {
  if (!aaaaMmDd) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(aaaaMmDd) || Number.isNaN(new Date(`${aaaaMmDd}T00:00:00-03:00`).getTime())) throw new Error('Data inválida.');
  return `${aaaaMmDd}T00:00:00-03:00`;
};

// Identificador estável de um item novo do checklist (o texto pode mudar depois, o id não).
export function novoIdChecklist(texto, aleatorio = Math.random) {
  const base = String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'item';
  return `${base}_${aleatorio().toString(36).slice(2, 6).padEnd(4, '0')}`;
}

// ---- vídeo do dia (YouTube) ----
const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const SITES_YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

// Devolve só o código de 11 caracteres do vídeo, ou null. Aceita o link copiado do
// YouTube (youtu.be, watch?v=, shorts, embed, live) ou o próprio código.
// Só reconhece os endereços oficiais: "youtube.com.golpe.com" não passa.
export function idYoutube(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  if (ID_YOUTUBE.test(t)) return t;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  let id = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') id = u.pathname.split('/')[1];
  else if (SITES_YOUTUBE.has(host)) {
    const [, tipo, resto] = u.pathname.split('/');
    id = tipo === 'watch' ? u.searchParams.get('v') : ['embed', 'shorts', 'live', 'v'].includes(tipo) ? resto : null;
  }
  return id && ID_YOUTUBE.test(id) ? id : null;
}

export const ehIdYoutube = (id) => ID_YOUTUBE.test(String(id ?? ''));

export const urlEmbedYoutube = (id) => `https://www.youtube-nocookie.com/embed/${id}`;

// ---- progresso e etapas (menu) ----
// Itens obrigatórios do checklist dos dias que já abriram. É o que conta nos "X de Y marcados".
export function progressoGeral(conteudos, marcados) {
  let total = 0;
  let feitos = 0;
  let dias = 0;
  for (const c of conteudos) {
    if (!c || c.em_breve) continue;
    const obrigatorios = (c.checklist ?? []).filter((i) => !i.opcional);
    if (!obrigatorios.length) continue;
    const certos = obrigatorios.filter((i) => marcados.has(`${c.numero}:${i.id}`)).length;
    total += obrigatorios.length;
    feitos += certos;
    if (certos === obrigatorios.length) dias += 1;
  }
  return { total, feitos, dias, pct: total ? Math.round((feitos / total) * 100) : 0 };
}

// Agrupa os dias nas etapas do menu. Dia que não está em nenhuma etapa vai para "Outros".
export function agruparPorEtapa(agenda, etapas) {
  const usados = new Set();
  const grupos = (etapas ?? []).map((e) => {
    const dias = e.dias.map((n) => agenda.find((d) => d.numero === n)).filter(Boolean);
    dias.forEach((d) => usados.add(d.numero));
    return { nome: e.nome, dias };
  }).filter((g) => g.dias.length);
  const sobras = agenda.filter((d) => !usados.has(d.numero));
  if (sobras.length) grupos.push({ nome: 'Outros', dias: sobras });
  return grupos;
}

export const nomeDaEtapa = (n, etapas) => (etapas ?? []).find((e) => e.dias.includes(n))?.nome ?? '';
