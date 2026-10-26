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

// ---- ranking colado pela Bruna ----
const SEPARADORES = /^[\s\-–—:|·.,;]+|[\s\-–—:|·.,;]+$/g;

function lerPontos(texto) {
  const t = String(texto).trim().replace(/\s*(pts?|pontos?)\.?$/i, '').replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));   // 1.250 = mil duzentos e cinquenta
  if (/^-?\d{1,6}$/.test(t)) return Number(t);
  return null;
}

// Aceita o que costuma sair de uma tabela copiada: "Ana 40", "Ana - 40", "Ana: 40 pts",
// "1. Ana 40", "1º Ana 40" e colunas separadas por TAB ("1 [tab] Ana [tab] 40").
// Devolve as linhas lidas e as que não deu para entender (para a Bruna corrigir).
export function lerRanking(texto) {
  const linhas = [];
  const ignoradas = [];
  for (const bruta of String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trim();
    if (!linha) continue;
    let nome = null;
    let pontos = null;

    if (linha.includes('\t')) {
      const cols = linha.split('\t').map((c) => c.trim()).filter(Boolean);
      const iNome = cols.findIndex((c) => /\p{L}/u.test(c) && lerPontos(c) === null);
      if (iNome >= 0) {
        nome = cols[iNome];
        const depois = cols.slice(iNome + 1).map(lerPontos).find((x) => x !== null);
        pontos = depois ?? null;
      }
    } else {
      const semPosicao = linha.replace(/^#?\d{1,3}\s*[.)º°ª]\s*/, '').replace(/^#\d{1,3}\s+/, '');
      // um "-" colado no número é sinal de negativo; "Ana - 35" (com espaço) é só separador
      const m = /^(.*?)(?:[\s–—:|]|-(?!\d))*(-?\d[\d.]*)\s*(?:pts?|pontos?)?\.?\s*$/i.exec(semPosicao);
      if (m) { nome = m[1]; pontos = lerPontos(m[2]); }
    }

    nome = nome === null ? null : nome.replace(SEPARADORES, '').replace(/\s+/g, ' ').trim();
    if (!nome || !/\p{L}/u.test(nome)) { if (/\p{L}/u.test(linha)) ignoradas.push({ linha, motivo: 'não achei o número de pontos' }); continue; }
    if (pontos === null) { ignoradas.push({ linha, motivo: 'não achei o número de pontos' }); continue; }
    if (nome.length > 60) { ignoradas.push({ linha, motivo: 'apelido com mais de 60 letras' }); continue; }
    linhas.push({ apelido: nome, pontos });
  }
  return { linhas, ignoradas };
}

// Mais pontos primeiro; quem empata na pontuação divide a posição (1, 2, 2, 4) e mantém a ordem colada.
export function posicoesRanking(linhas) {
  const ordenadas = linhas.map((l, i) => ({ ...l, i })).sort((a, b) => b.pontos - a.pontos || a.i - b.i);
  const saida = [];
  ordenadas.forEach((l, k) => {
    const empate = k > 0 && l.pontos === ordenadas[k - 1].pontos;
    saida.push({ apelido: l.apelido, pontos: l.pontos, i: l.i, posicao: empate ? saida[k - 1].posicao : k + 1, empate });
  });
  return saida;
}

// "26/10 às 14:30", sempre no horário de Fortaleza.
const formatoHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function dataHoraFortaleza(iso) {
  const p = Object.fromEntries(formatoHora.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} às ${p.hour}:${p.minute}`;
}
