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

// O story vale até 23h59 do dia em que o dia abriu (horário de Fortaleza).
export const textoPrazoStory = (liberaEm) => `até 23h59 de ${diaMes(liberaEm)} (horário de Fortaleza)`;

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
