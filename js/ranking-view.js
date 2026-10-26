// O cartão do ranking. Usado pela tela das meninas e pela prévia do admin.
import { h } from './dom.js';
import { posicoesRanking, dataHoraFortaleza } from './regras.js';

export function cartaoRanking(linhas, atualizadoEm) {
  const itens = posicoesRanking(linhas).map((l) =>
    h('li', { class: 'rank-item' },
      h('span', { class: 'rank-pos' }, `${l.posicao}º`),
      h('span', { class: 'rank-nome' }, l.apelido),
      h('span', { class: 'rank-pontos' }, `${l.pontos} pts`)));
  return h('section', { class: 'card' },
    atualizadoEm ? h('p', { class: 'nota rank-quando' }, `Atualizado em ${dataHoraFortaleza(atualizadoEm)} (horário de Fortaleza)`) : null,
    itens.length ? h('ol', { class: 'rank-lista' }, itens) : h('p', {}, 'Ainda não tem ninguém no ranking.'));
}
