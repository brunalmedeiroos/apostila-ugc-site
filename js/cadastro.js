// Formulário "meu cadastro": a menina preenche só o que quer mostrar para a Bruna.
import { h } from './dom.js';

export function formularioCadastro({ db, avisar, ficha, rotulo, aoSalvar }) {
  const nome = h('input', { type: 'text', value: ficha?.nome ?? '', maxlength: 120, autocomplete: 'name' });
  const apelido = h('input', { type: 'text', value: ficha?.apelido ?? '', maxlength: 60 });
  const insta = h('input', { type: 'text', value: ficha?.instagram ?? '', maxlength: 60, placeholder: '@seuusuario' });
  const botao = h('button', { class: 'btn btn-primario btn-bloco', type: 'button' }, rotulo);
  const campo = (titulo, el, dica) => h('label', { class: 'campo' }, h('span', {}, titulo), el, dica ? h('small', {}, dica) : null);

  botao.addEventListener('click', async () => {
    if (!nome.value.trim()) return avisar('Escreva como você quer ser chamada.', true);
    botao.disabled = true;
    const { error } = await db.rpc('salvar_minha_ficha', { p_nome: nome.value, p_apelido: apelido.value, p_instagram: insta.value });
    botao.disabled = false;
    if (error) return avisar(error.message, true);
    avisar('Cadastro salvo.');
    aoSalvar({ nome: nome.value.trim(), apelido: apelido.value.trim() || null, instagram: insta.value.trim() || null });
  });

  return h('div', { class: 'cadastro-form' },
    campo('Como você quer ser chamada?', nome),
    campo('Apelido para o ranking (opcional)', apelido, 'Só aparece no ranking se você escrever um. Deixe vazio para não aparecer.'),
    campo('Seu Instagram (opcional)', insta),
    botao,
    h('p', { class: 'privacidade' }, 'Só a Bruna vê o seu nome e o seu Instagram. O apelido aparece para as outras participantes, no ranking.'));
}
