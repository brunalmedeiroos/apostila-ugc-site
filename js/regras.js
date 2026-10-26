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
