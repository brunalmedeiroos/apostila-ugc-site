// Teste de tela no navegador (Chromium). Uso: node testes/e2e.mjs [pasta-de-capturas]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { servir, fixtures } from './servidor-mock.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const capturas = process.argv[2];
if (capturas) mkdirSync(capturas, { recursive: true });
const falhas = [];
const PRIMEIRO_ITEM = fixtures.conteudo[0].checklist[0].texto;
const ok = (nome, cond, extra = '') => { console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${cond ? '' : '  ' + extra}`); if (!cond) falhas.push(nome); };

// Agenda relativa a "agora": dias 1-3 abertos, resto no futuro (meia-noite de Fortaleza).
const DIA = 86400000;
const meiaNoiteFortaleza = (t) => { const d = new Date(t - 3 * 3600000); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + 3 * 3600000).toISOString(); };
const agenda = fixtures.agenda.map((a) => ({ ...a, libera_em: a.numero === 15 ? null : meiaNoiteFortaleza(Date.now() + (a.numero - 3) * DIA) }));
const abertos = new Set(agenda.filter((a) => a.libera_em && new Date(a.libera_em) <= new Date()).map((a) => a.numero));

const server = await servir();
const browser = await chromium.launch();

async function novaPagina({ logada = true, progressoInicial = [], falhaGravar = false, admin = false, documentoDia1 = null, enviarDia1 = null, videoDia1 = null, ranking = null, participantes = [], minhaFicha = null, apelidoEmUso = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  const pagina = await ctx.newPage();
  const progresso = [...progressoInicial];
  const pedidos = [];
  const salvos = [];
  await pagina.route('https://fonts.g*/**', (r) => r.abort());
  await pagina.route('https://*.supabase.co/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); pedidos.push(`${req.method()} ${u.pathname}`);
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
    if (u.pathname.startsWith('/rest/v1/rpc/')) {
      const nome = u.pathname.split('/').pop(); const corpo = req.postData() ? JSON.parse(req.postData()) : {};
      if (nome === 'is_admin') return json(admin);
      if (nome === 'minha_ficha') return minhaFicha === 'sem-suporte' ? json({ code: 'PGRST202', message: 'função não existe' }, 404) : json(minhaFicha);
      if (nome === 'salvar_minha_ficha') {
        if (apelidoEmUso) return json({ message: 'esse apelido já está em uso. Escolha outro, ou avise a Bruna se ele é seu' }, 400);
        salvos.push({ nome, corpo }); return route.fulfill({ status: 204, body: '' });
      }
      if (!admin) return json({ message: 'sem acesso', code: '42501' }, 403);
      if (nome === 'admin_dias') return json(agenda.map((a) => { const c = fixtures.conteudo.find((x) => x.numero === a.numero); return { ...a, ...c, documento: c.documento ?? null, video_id: (a.numero === 1 ? videoDia1 : null) }; }));
      if (nome === 'admin_participantes') return json(participantes);
      if (nome === 'admin_ranking') return json({ visivel: Boolean(ranking?.visivel), atualizado_em: ranking ? '2026-10-26T17:30:00+00:00' : null, linhas: ranking?.linhas ?? [] });
      salvos.push({ nome, corpo }); return route.fulfill({ status: 204, body: '' });
    }
    if (!u.pathname.startsWith('/rest/v1/')) return json({});
    const tabela = u.pathname.split('/').pop();
    if (req.method() === 'GET') {
      if (tabela === 'config') return json({ ...fixtures.config, ranking_visivel: Boolean(ranking?.visivel), ranking_atualizado_em: ranking ? '2026-10-26T17:30:00+00:00' : null });
      if (tabela === 'ranking') return json(ranking?.visivel ? ranking.linhas.map((l, i) => ({ ...l, ordem: i + 1 })) : []);
      if (tabela === 'dias_agenda') return json(agenda);
      if (tabela === 'dias_conteudo') return json(fixtures.conteudo.filter((c) => abertos.has(c.numero)).map((c) => (c.numero === 1 ? { ...c, ...(documentoDia1 ? { documento: documentoDia1 } : {}), ...(enviarDia1 ? { enviar: enviarDia1 } : {}), ...(videoDia1 ? { video_id: videoDia1 } : {}) } : c)));
      if (tabela === 'progresso') return json(progresso);
    }
    if (req.method() === 'POST' && tabela === 'progresso') {
      if (falhaGravar) return json({ message: 'boom' }, 500);
      const l = JSON.parse(req.postData()); const linha = Array.isArray(l) ? l[0] : l;
      const i = progresso.findIndex((p) => p.dia === linha.dia && p.item === linha.item);
      i >= 0 ? (progresso[i] = linha) : progresso.push(linha);
      return route.fulfill({ status: 201, body: '' });
    }
    return json({}, 404);
  });
  if (logada) {
    await ctx.addInitScript(() => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem('sb-qrlaklogimoedmobqpfo-auth-token', JSON.stringify({
        access_token: 'aaa.bbb.ccc', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: exp,
        user: { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'ana@teste.com', app_metadata: {}, user_metadata: {} } }));
    });
  }
  const erros = []; pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) erros.push(m.text()); });
  return { pagina, progresso, pedidos, erros, salvos };
}
const url = (h = '') => `http://localhost:8099/index.html${h}`;
const foto = async (p, nome) => capturas && p.screenshot({ path: `${capturas}/${nome}.png`, fullPage: true });

// ---- 1. Login (sem sessão) ----
{
  const { pagina, pedidos, erros } = await novaPagina({ logada: false });
  await pagina.goto(url()); await pagina.waitForSelector('.login');
  ok('login: mostra botão do Google', await pagina.getByRole('button', { name: 'Entrar com Google' }).isVisible());
  ok('login: mostra aviso de privacidade', (await pagina.textContent('.privacidade')).includes('Usamos só o seu e-mail'));
  ok('login: não pede senha nem campo de e-mail', (await pagina.locator('input').count()) === 0);
  ok('login: não consulta nenhuma tabela sem sessão', !pedidos.some((p) => p.includes('/rest/v1/')), pedidos.join(','));
  ok('login: sem erros no console', erros.length === 0, erros.join(' | '));
  await foto(pagina, '1-login');
  await pagina.context().close();
}

// ---- 1b. Login que falhou: mostra o motivo ----
{
  const { pagina } = await novaPagina({ logada: false });
  await pagina.goto(url('?error=server_error&error_description=Unable+to+exchange+external+code'));
  await pagina.waitForSelector('.login');
  ok('login com erro: mostra o motivo vindo do Supabase', (await pagina.textContent('.erro-login')).includes('Unable to exchange external code'));
  ok('login com erro: limpa o erro da barra de endereço', !pagina.url().includes('error'));
  await foto(pagina, '1b-login-erro');
  await pagina.context().close();
}
{
  const { pagina } = await novaPagina({ logada: false });
  await pagina.goto(url('#error=access_denied&error_description=Access+denied')); await pagina.waitForSelector('.login');
  ok('login com erro no #: também mostra o motivo', (await pagina.textContent('.erro-login')).includes('Access denied'));
  await pagina.context().close();
}

// ---- 2. Lista ----
{
  const { pagina, erros } = await novaPagina({ progressoInicial: [
    ...fixtures.conteudo[0].checklist.filter((i) => !i.opcional).map((i) => i.id).map((item) => ({ dia: 1, item, marcado: true })) ] });
  await pagina.goto(url()); await pagina.waitForSelector('.lista-dias');
  const itens = pagina.locator('.dia-item');
  ok('lista: 15 dias', (await itens.count()) === 15);
  ok('lista: dia 1 concluído (story é opcional)', (await itens.nth(0).textContent()).includes('Concluído'));
  ok('lista: dia 2 aberto e clicável', (await itens.nth(1).evaluate((e) => e.tagName)) === 'A');
  ok('lista: dia 4 bloqueado com "abre dia dd/mm"', /abre dia \d\d\/\d\d/.test(await itens.nth(3).textContent()) && (await itens.nth(3).getAttribute('aria-disabled')) === 'true');
  ok('lista: dia sem data mostra "em breve"', (await itens.nth(14).textContent()).includes('em breve'));
  ok('lista: anel 1/15', (await pagina.getAttribute('.anel', 'aria-label')) === '1 de 15 dias concluídos');
  const soltos = await pagina.evaluate(() => { const r = []; const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (t === 'null' || t === 'undefined' || t === 'false') r.push(t); } return r; });
  ok('lista: nenhum texto solto "null", "undefined" ou "false" na tela', soltos.length === 0, JSON.stringify(soltos));
  ok('lista: sem erros no console', erros.length === 0, erros.join(' | '));
  await foto(pagina, '2-lista');
  await pagina.context().close();
}

// ---- 3. Dia 1 completo + checklist salva ----
{
  const { pagina, progresso, erros } = await novaPagina();
  await pagina.goto(url('#/dia/1')); await pagina.waitForSelector('.cabeca-dia');
  const titulos = await pagina.locator('section.secao h2').allTextContents();
  ok('dia 1: 5 seções na ordem certa', JSON.stringify(titulos) === JSON.stringify(['O que você vai aprender hoje', 'Estude', 'Tarefa do dia', 'O que enviar no grupo', 'Checklist final']), titulos.join(' > '));
  ok('dia 1: tempo estimado', (await pagina.textContent('.tempo')).includes('20 min'));
  ok('dia 1: 4 itens de estudo, carrossel sem link', (await pagina.locator('.links-estudo li').count()) === 4 && (await pagina.textContent('.sem-link')).includes('link em breve'));
  ok('dia 1: links externos com noopener', (await pagina.locator('.links-estudo a[rel="noopener noreferrer"]').count()) === 3);
  ok('dia 1: botão abre o grupo da config', (await pagina.getAttribute('a:has-text("Abrir o grupo")', 'href')) === 'https://chat.whatsapp.com/exemplo');
  ok('dia 1: nenhum bloco de pontos é acrescentado sozinho', (await pagina.locator('.pontos, .prazo').count()) === 0 && !(await pagina.textContent('main')).includes('+1 ponto'));
  ok('dia 1: "Anterior" não existe, "Próximo" abre o dia 2', (await pagina.locator('.navegacao .ant').count()) === 0 && (await pagina.getAttribute('.navegacao .prox', 'href')) === '#/dia/2');
  ok('dia 1: checklist com 5 itens, 1 opcional', (await pagina.locator('.check').count()) === 5 && (await pagina.locator('.opcional').count()) === 1);
  await pagina.getByLabel(PRIMEIRO_ITEM).check();
  await pagina.waitForTimeout(150);
  ok('checklist: marcar grava no progresso', progresso.some((p) => p.dia === 1 && p.item === fixtures.conteudo[0].checklist[0].id && p.marcado === true), JSON.stringify(progresso));
  ok('dia 1: sem erros no console', erros.length === 0, erros.join(' | '));
  await foto(pagina, '3-dia1');
  await pagina.reload(); await pagina.waitForSelector('.cabeca-dia');
  ok('checklist: continua marcado depois de recarregar', await pagina.getByLabel(PRIMEIRO_ITEM).isChecked());
  await pagina.context().close();
}

// ---- 4. Dia "em breve", último aberto ----
{
  const { pagina } = await novaPagina();
  await pagina.goto(url('#/dia/3')); await pagina.waitForSelector('.cabeca-dia');
  ok('dia 3: mostra tarefa e aviso "em breve", sem checklist', (await pagina.textContent('main')).includes(fixtures.conteudo[2].tarefa) && (await pagina.textContent('main')).includes('Conteúdo em breve') && (await pagina.locator('.check').count()) === 0);
  const prox = pagina.locator('.navegacao .prox');
  ok('dia 3: "Próximo" desabilitado, mostra quando abre o dia 4', (await prox.getAttribute('aria-disabled')) === 'true' && /Abre dia \d\d\/\d\d/.test(await prox.textContent()));
  ok('dia 3: "Anterior" leva ao dia 2', (await pagina.getAttribute('.navegacao .ant', 'href')) === '#/dia/2');
  await foto(pagina, '4-dia3-embreve');
  await pagina.context().close();
}

// ---- 5. Dia fechado pela URL ----
{
  const { pagina } = await novaPagina();
  await pagina.goto(url('#/dia/6')); await pagina.waitForSelector('.fechado');
  ok('dia 6 pela URL: mostra fechado, sem conteúdo', (await pagina.textContent('.fechado h1')).includes('ainda está fechado') && (await pagina.locator('.check').count()) === 0);
  await foto(pagina, '5-dia-fechado');
  await pagina.goto(url('#/dia/15')); await pagina.waitForSelector('.fechado');
  ok('dia sem data pela URL: "abre em breve"', (await pagina.textContent('.fechado')).includes('abre em breve'));
  await pagina.context().close();
}

// ---- 6. Falha ao salvar desfaz a marcação ----
{
  const { pagina } = await novaPagina({ falhaGravar: true });
  await pagina.goto(url('#/dia/1')); await pagina.waitForSelector('.cabeca-dia');
  await pagina.getByLabel(PRIMEIRO_ITEM).check();
  await pagina.waitForSelector('.aviso.erro:not([hidden])');
  ok('erro ao salvar: avisa e desmarca', !(await pagina.getByLabel(PRIMEIRO_ITEM).isChecked()));
  await pagina.context().close();
}


// ---- 7. Documento do dia: formatação certa e nada de código ----
{
  const doc = '## Meu título\n\n- um\n- **dois**\n\n[site bom](https://exemplo.com/x)\n\n[site mau](javascript:alert(1))\n\n<script>window.__xss = 1</script>\n\n<img src=x onerror="window.__xss = 2">';
  const { pagina, erros } = await novaPagina({ documentoDia1: doc });
  await pagina.goto(url('#/dia/1')); await pagina.waitForSelector('.documento');
  ok('documento: título e lista aparecem', (await pagina.textContent('.documento h3')) === 'Meu título' && (await pagina.locator('.documento li').count()) === 2 && (await pagina.locator('.documento li strong').count()) === 1);
  ok('documento: link bom abre em outra aba com noopener', (await pagina.getAttribute('.documento a[href="https://exemplo.com/x"]', 'rel')) === 'noopener noreferrer');
  ok('documento: link javascript: NÃO vira link', (await pagina.locator('.documento a[href^="javascript"]').count()) === 0);
  ok('documento: <script> e <img onerror> aparecem como texto e não executam', (await pagina.evaluate(() => window.__xss)) === undefined && (await pagina.locator('section:has(h2:text("Estude")) .documento').textContent()).includes('<script>') && (await pagina.locator('.documento img, .documento script').count()) === 0);
  ok('documento: sem erros no console', erros.length === 0, erros.join(' | '));
  await foto(pagina, '7-documento');
  await pagina.context().close();
}

// ---- 7b. Textos livres (enviar/tarefa/aprender) também são formatados ----
{
  const enviar = 'Para concluir sua missão:\n- **A marca:** nome ou @\n- **Sua ideia:** uma frase\n\n**Vale até 20 pontos!** Não precisa gravar.\nSegunda linha <b>x</b>';
  const { pagina, erros } = await novaPagina({ enviarDia1: enviar });
  await pagina.goto(url('#/dia/1')); await pagina.waitForSelector('.documento');
  const secaoEnviar = pagina.locator('section:has(h2:text("O que enviar no grupo")) .documento');
  ok('texto livre: a lista vira lista de verdade (2 itens)', (await secaoEnviar.locator('li').count()) === 2);
  ok('texto livre: **negrito** destacado, sem asteriscos na tela', (await secaoEnviar.locator('strong').count()) === 3 && !(await secaoEnviar.textContent()).includes('**'));
  ok('texto livre: parágrafo novo e quebra de linha simples', (await secaoEnviar.locator('p').count()) === 2 && (await secaoEnviar.locator('p br').count()) === 1);
  ok('texto livre: HTML digitado continua sendo só texto', (await secaoEnviar.locator('b').count()) === 0 && (await secaoEnviar.textContent()).includes('<b>x</b>'));
  ok('texto livre: sem erros no console', erros.length === 0, erros.join(' | '));
  await foto(pagina, '7b-texto-livre');
  await pagina.context().close();
}

// ---- 8. Admin ----
{
  const { pagina, salvos, erros } = await novaPagina({ admin: true });
  await pagina.goto(url('#/admin')); await pagina.waitForSelector('.titulo-admin');
  ok('admin: lista os 15 dias', (await pagina.locator('.lista-dias .dia-item').count()) === 15);
  ok('admin: botão para o Painel abre o login do Painel', (await pagina.getAttribute('a:has-text("Abrir o Painel")', 'href')) === 'https://brunamedeiros.com/login');
  await foto(pagina, '8a-admin-lista');
  await pagina.locator('#cfg-link').fill('https://chat.whatsapp.com/novo');
  await pagina.getByRole('button', { name: 'Salvar grupo' }).click(); await pagina.waitForTimeout(150);
  ok('admin: salvar grupo chama a função certa', salvos.some((x) => x.nome === 'admin_salvar_config' && x.corpo.p_link === 'https://chat.whatsapp.com/novo'), JSON.stringify(salvos));

  await pagina.locator('.lista-dias .dia-item').nth(0).click(); await pagina.waitForSelector('text=Checklist final');
  ok('admin: dia 1 abre com os dados atuais', (await pagina.locator('input[type=text]').first().inputValue()) === fixtures.agenda[0].titulo);
  ok('admin: checklist do dia 1 tem os itens existentes', (await pagina.locator('.linha-check').count()) === fixtures.conteudo[0].checklist.length);
  await pagina.locator('input[type=text]').first().fill('Título novo');
  await pagina.locator('input[type=date]').fill('2026-11-20');
  await pagina.locator('textarea').nth(1).fill('## Oi\n\n- **a**');   // documento
  ok('admin: prévia do documento atualiza ao digitar', (await pagina.textContent('.previa h3')) === 'Oi' && (await pagina.locator('.previa li strong').count()) === 1);
  await pagina.getByRole('button', { name: '+ Adicionar item' }).click();
  await pagina.locator('.linha-check input[type=text]').last().fill('Fiz a tarefa extra');
  await pagina.getByRole('button', { name: 'Ver como as meninas veem' }).click();
  await pagina.waitForSelector('.previa-dia:not([hidden]) .cabeca-dia');
  const titulosPrevia = await pagina.locator('.previa-dia h2').allTextContents();
  ok('admin: prévia mostra o dia inteiro, 5 seções na ordem que as meninas veem', JSON.stringify(titulosPrevia) === JSON.stringify(['O que você vai aprender hoje', 'Estude', 'Tarefa do dia', 'O que enviar no grupo', 'Checklist final']), titulosPrevia.join(' > '));
  ok('admin: prévia mostra título, documento formatado e item novo do checklist', (await pagina.textContent('.previa-dia .cabeca-dia h1')) === 'Título novo' && (await pagina.locator('.previa-dia .documento h3').textContent()) === 'Oi' && (await pagina.locator('.previa-dia .check').count()) === fixtures.conteudo[0].checklist.length + 1);
  ok('admin: prévia também não acrescenta pontos sozinha', (await pagina.locator('.previa-dia .pontos, .previa-dia .prazo').count()) === 0);
  ok('admin: prévia não salva nada', !salvos.some((x) => x.nome === 'admin_salvar_dia'));
  await foto(pagina, '8c-admin-previa');
  await pagina.getByRole('button', { name: 'Salvar dia' }).click(); await pagina.waitForTimeout(250);
  const dia = salvos.find((x) => x.nome === 'admin_salvar_dia')?.corpo.p;
  ok('admin: salvar envia título, data de Fortaleza e documento', dia?.numero === 1 && dia.titulo === 'Título novo' && dia.libera_em === '2026-11-20T00:00:00-03:00' && dia.documento.startsWith('## Oi'), JSON.stringify(dia));
  ok('admin: itens antigos do checklist mantêm o id', fixtures.conteudo[0].checklist.every((i, k) => dia.checklist[k].id === i.id), JSON.stringify(dia?.checklist));
  ok('admin: item novo ganha id próprio', /^fiz_a_tarefa_extra_[a-z0-9]{4}$/.test(dia.checklist.at(-1).id), dia.checklist.at(-1).id);
  ok('admin: dia continua "pronto" se a caixa estava marcada', dia.em_breve === false);
  ok('admin: depois de salvar volta para a lista', await pagina.locator('.titulo-admin:has-text("Admin do desafio")').isVisible());
  ok('admin: sem erros no console', erros.length === 0, erros.join(' | '));
  await pagina.locator('.lista-dias .dia-item').nth(1).click(); await pagina.waitForSelector('text=Checklist final');
  await pagina.locator('input[type=text]').first().fill('');
  await pagina.getByRole('button', { name: 'Salvar dia' }).click(); await pagina.waitForTimeout(150);
  ok('admin: título vazio é recusado antes de enviar', salvos.filter((x) => x.nome === 'admin_salvar_dia').length === 1 && (await pagina.textContent('.aviso')).includes('título'));
  await foto(pagina, '8b-admin-dia');
  await pagina.context().close();
}
{
  const { pagina, salvos, pedidos } = await novaPagina({ admin: false });
  await pagina.goto(url('#/admin')); await pagina.waitForSelector('.fechado');
  ok('admin: participante comum vê "Área restrita"', (await pagina.textContent('.fechado')).includes('Área restrita'));
  ok('admin: participante nem tenta carregar os dados do admin', !pedidos.some((p) => p.includes('admin_dias')) && salvos.length === 0);
  await pagina.context().close();
}
{
  const { pagina } = await novaPagina({ logada: false });
  await pagina.goto(url('#/admin')); await pagina.waitForSelector('.login');
  ok('admin: sem login mostra a tela de login', await pagina.getByRole('button', { name: 'Entrar com Google' }).isVisible());
  await pagina.context().close();
}

// ---- 9. Vídeo do dia ----
{
  const { pagina, erros } = await novaPagina({ videoDia1: 'dQw4w9WgXcQ' });
  await pagina.goto(url('#/dia/1')); await pagina.waitForSelector('.video iframe', { state: 'attached' });
  const f = pagina.locator('.video iframe');
  ok('vídeo: player do YouTube em modo de privacidade, com o código certo', (await f.getAttribute('src')) === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  ok('vídeo: player isolado (sandbox) e com texto "Prefere ouvir?"', (await f.getAttribute('sandbox')).includes('allow-scripts') && !(await f.getAttribute('sandbox')).includes('allow-top-navigation') && (await pagina.textContent('.prefere')).includes('Prefere ouvir'));
  ok('vídeo: fica dentro da seção "Estude"', (await pagina.locator('section:has(h2:text("Estude")) .video').count()) === 1);
  await foto(pagina, '9-video');
  await pagina.context().close();
}
{
  const { pagina } = await novaPagina({});
  await pagina.goto(url('#/dia/1')); await pagina.waitForSelector('.cabeca-dia');
  ok('vídeo: sem vídeo cadastrado, nenhum player aparece', (await pagina.locator('iframe').count()) === 0);
  await pagina.context().close();
}
{
  // código de vídeo malformado vindo do banco nunca vira iframe
  const { pagina } = await novaPagina({ videoDia1: '"><script>x</script>' });
  await pagina.goto(url('#/dia/1')); await pagina.waitForSelector('.cabeca-dia');
  ok('vídeo: código inválido vindo do banco é ignorado', (await pagina.locator('iframe').count()) === 0);
  await pagina.context().close();
}

// ---- 10. Ranking para as meninas ----
const RANK = [{ apelido: 'Lu', pontos: 40 }, { apelido: 'Bia', pontos: 40 }, { apelido: 'Ana', pontos: 20 }, { apelido: '<b>Zé</b>', pontos: 35 }];
{
  const { pagina } = await novaPagina({ ranking: { visivel: false, linhas: RANK } });
  await pagina.goto(url()); await pagina.waitForSelector('.lista-dias');
  ok('ranking oculto: nenhum atalho na lista', (await pagina.locator('.ranking-link').count()) === 0);
  await pagina.goto(url('#/ranking')); await pagina.waitForSelector('.fechado');
  ok('ranking oculto: abrir pela URL mostra "ainda não abriu" e nenhuma linha', (await pagina.textContent('.fechado')).includes('ainda não abriu') && (await pagina.locator('.rank-item').count()) === 0);
  await pagina.context().close();
}
{
  const { pagina, erros } = await novaPagina({ ranking: { visivel: true, linhas: RANK } });
  await pagina.goto(url()); await pagina.waitForSelector('.ranking-link');
  await pagina.locator('.ranking-link').click(); await pagina.waitForSelector('.rank-item');
  const itens = await pagina.locator('.rank-item').allTextContents();
  ok('ranking visível: ordem por pontos, empate divide a posição', JSON.stringify(itens) === JSON.stringify(['1ºLu40 pts', '1ºBia40 pts', '3º<b>Zé</b>35 pts', '4ºAna20 pts']), JSON.stringify(itens));
  ok('ranking visível: HTML no apelido aparece como texto', (await pagina.locator('.rank-lista b').count()) === 0);
  ok('ranking visível: mostra quando foi atualizado em Fortaleza', (await pagina.textContent('.rank-quando')).includes('26/10 às 14:30'));
  ok('ranking visível: sem erros no console', erros.length === 0, erros.join(' | '));
  await foto(pagina, '10-ranking');
  await pagina.context().close();
}

// ---- 11. Admin: vídeo e ranking ----
{
  const { pagina, salvos } = await novaPagina({ admin: true, videoDia1: 'dQw4w9WgXcQ' });
  await pagina.goto(url('#/admin/dia/1')); await pagina.waitForSelector('text=Checklist final');
  ok('admin vídeo: mostra o vídeo atual como link', (await pagina.locator('input[type=url]').first().inputValue()) === 'https://youtu.be/dQw4w9WgXcQ');
  await pagina.locator('input[placeholder^="https://youtu.be"]').fill('https://www.youtube.com/watch?v=abcDEF12345&t=5');
  ok('admin vídeo: avisa que reconheceu o link', (await pagina.textContent('label:has-text("Vídeo do dia") small')).includes('reconhecido'));
  await pagina.getByRole('button', { name: 'Salvar dia' }).click(); await pagina.waitForTimeout(250);
  ok('admin vídeo: salva só o código do vídeo', salvos.find((x) => x.nome === 'admin_salvar_dia')?.corpo.p.video_id === 'abcDEF12345', JSON.stringify(salvos));
  await pagina.goto(url('#/admin/dia/1')); await pagina.waitForSelector('text=Checklist final');
  await pagina.locator('input[placeholder^="https://youtu.be"]').fill('https://youtube.com.golpe.com/watch?v=abcDEF12345');
  ok('admin vídeo: link falso avisa que não reconheceu', (await pagina.textContent('label:has-text("Vídeo do dia") small')).includes('Não reconheci'));
  const antes = salvos.length;
  await pagina.getByRole('button', { name: 'Salvar dia' }).click(); await pagina.waitForTimeout(200);
  ok('admin vídeo: link falso NÃO é enviado ao servidor', salvos.length === antes);
  await pagina.context().close();
}
{
  const { pagina, salvos } = await novaPagina({ admin: true, ranking: { visivel: false, linhas: [{ apelido: 'Velha', pontos: 1 }] } });
  await pagina.goto(url('#/admin')); await pagina.waitForSelector('.ranking-link');
  await pagina.locator('.ranking-link:has-text("Ranking")').click(); await pagina.waitForSelector('text=Cole o ranking');
  ok('admin ranking: abre com a lista já publicada', (await pagina.locator('.linha-rank').count()) === 1);
  pagina.on('dialog', (d) => d.accept());
  await pagina.locator('textarea').fill('Lu 40\nBia - 40\n1. Ana 20 pts\nlinha sem número');
  await pagina.getByRole('button', { name: 'Ler a lista colada' }).click();
  await pagina.waitForFunction(() => document.querySelectorAll('.linha-rank').length === 3);
  ok('admin ranking: leu 3 linhas e avisou da que não entendeu', (await pagina.textContent('.nota:has-text("Li 3")')).includes('linha sem número'));
  const posicoes = await pagina.locator('.linha-rank .rank-pos').allTextContents();
  ok('admin ranking: mostra as posições com empate', JSON.stringify(posicoes) === JSON.stringify(['1º', '1º', '3º']), JSON.stringify(posicoes));
  await pagina.locator('.linha-rank input[type=number]').nth(2).fill('50');
  await pagina.waitForFunction(() => document.querySelector('.linha-rank .rank-pos:last-of-type') && [...document.querySelectorAll('.linha-rank .rank-pos')].at(-1).textContent === '1º');
  ok('admin ranking: editar os pontos recalcula a posição na hora', true);
  ok('admin ranking: a prévia mostra como as meninas veem', (await pagina.locator('.previa-dia .rank-item').count()) === 3);
  await pagina.locator('.check input').check();
  await pagina.getByRole('button', { name: 'Publicar ranking' }).click(); await pagina.waitForTimeout(250);
  const pub = salvos.find((x) => x.nome === 'admin_publicar_ranking')?.corpo;
  ok('admin ranking: publica a lista na ordem colada e a visibilidade', JSON.stringify(pub?.p) === JSON.stringify([{ apelido: 'Lu', pontos: 40 }, { apelido: 'Bia', pontos: 40 }, { apelido: 'Ana', pontos: 50 }]) && pub.p_visivel === true, JSON.stringify(pub));
  await foto(pagina, '11-admin-ranking');
  await pagina.locator('.linha-rank input[type=text]').first().fill('');
  const n = salvos.length;
  await pagina.getByRole('button', { name: 'Publicar ranking' }).click(); await pagina.waitForTimeout(200);
  ok('admin ranking: apelido vazio não é enviado', salvos.length === n && (await pagina.textContent('.aviso')).includes('linha 1'));
  await pagina.context().close();
}

// ---- 12. Admin: participantes ----
const PESSOAS = [
  { id: null, user_id: 'u1', email: 'caro@teste.com', entrou_em: '2026-10-26T12:00:00+00:00', ultimo_acesso: null, nome: null, apelido: null, instagram: null, status: 'ativa', observacoes: null, dias_concluidos: 0 },
  { id: 'f2', user_id: 'u2', email: 'bia@teste.com', entrou_em: '2026-10-25T12:00:00+00:00', ultimo_acesso: '2026-10-26T15:30:00+00:00', nome: 'Beatriz', apelido: 'Bia', instagram: '@bia', status: 'ativa', observacoes: 'vem do Painel', dias_concluidos: 1 },
  { id: 'f3', user_id: null, email: null, entrou_em: null, ultimo_acesso: null, nome: 'Lu', apelido: null, instagram: null, status: 'pausada', observacoes: null, dias_concluidos: 0 },
];
{
  const { pagina, salvos, erros } = await novaPagina({ admin: true, participantes: PESSOAS });
  await pagina.goto(url('#/admin')); await pagina.waitForSelector('.ranking-link');
  await pagina.locator('.ranking-link:has-text("Participantes")').click(); await pagina.waitForSelector('text=entraram na apostila');
  const fichas = pagina.locator('.lista-fichas').first().locator('.ficha');
  ok('participantes: lista as 3 pessoas', (await fichas.count()) === 3);
  const resumos = await fichas.locator('summary').allTextContents();
  ok('participantes: login sem ficha aparece como "sem ficha" e mostra o nome pelo e-mail', resumos[0].includes('caro') && resumos[0].includes('sem ficha'), resumos[0]);
  ok('participantes: mostra o progresso (1 de 1 dia pronto) e quem ainda não entrou', resumos[1].includes('1/1 dias') && resumos[2].includes('não entrou') && resumos[2].includes('pausada'), JSON.stringify(resumos));
  ok('participantes: resumo conta quem entrou e quem está sem ficha', (await pagina.textContent('p.nota')).includes('2 entraram na apostila, 1 ainda sem ficha'));

  await fichas.nth(0).locator('summary').click();
  ok('participantes: o nome vem sugerido do e-mail', (await fichas.nth(0).locator('input[type=text]').first().inputValue()) === 'caro');
  await fichas.nth(0).locator('input[type=text]').first().fill('Carolina');
  await fichas.nth(0).locator('input[type=text]').nth(1).fill('Caro');
  await fichas.nth(0).getByRole('button', { name: 'Criar ficha' }).click(); await pagina.waitForTimeout(250);
  const criar = salvos.find((x) => x.nome === 'admin_salvar_participante')?.corpo.p;
  ok('participantes: criar ficha liga ao login certo', criar?.user_id === 'u1' && criar.id === null && criar.nome === 'Carolina' && criar.apelido === 'Caro', JSON.stringify(criar));

  await pagina.waitForSelector('.lista-fichas .ficha');
  await pagina.locator('.lista-fichas').first().locator('.ficha').nth(1).locator('summary').click();
  const f2 = pagina.locator('.lista-fichas').first().locator('.ficha').nth(1);
  await f2.locator('select').selectOption('saiu');
  await f2.locator('input[type=text]').nth(1).fill('Bi');
  await f2.getByRole('button', { name: 'Salvar ficha' }).click(); await pagina.waitForTimeout(250);
  const edit = salvos.filter((x) => x.nome === 'admin_salvar_participante').at(-1).corpo.p;
  ok('participantes: editar envia o id da ficha, a situação e o novo apelido', edit.id === 'f2' && edit.status === 'saiu' && edit.apelido === 'Bi' && edit.observacoes === 'vem do Painel', JSON.stringify(edit));

  const antes = salvos.length;
  await pagina.locator('.lista-fichas').first().locator('.ficha').nth(2).locator('summary').click();
  const f3 = pagina.locator('.lista-fichas').first().locator('.ficha').nth(2);
  await f3.locator('input[type=text]').first().fill('');
  await f3.getByRole('button', { name: 'Salvar ficha' }).click(); await pagina.waitForTimeout(200);
  ok('participantes: ficha sem nome não é enviada', salvos.length === antes && (await pagina.textContent('.aviso')).includes('nome'));

  pagina.on('dialog', (d) => d.accept());
  await f3.getByRole('button', { name: 'Apagar ficha' }).click(); await pagina.waitForTimeout(250);
  ok('participantes: apagar ficha chama a função com o id', salvos.some((x) => x.nome === 'admin_apagar_participante' && x.corpo.p_id === 'f3'));

  await pagina.locator('.lista-fichas').nth(1).locator('summary').click();
  await pagina.locator('.lista-fichas').nth(1).locator('input[type=text]').first().fill('Nova Pessoa');
  await pagina.locator('.lista-fichas').nth(1).getByRole('button', { name: 'Criar ficha' }).click(); await pagina.waitForTimeout(250);
  const nova = salvos.filter((x) => x.nome === 'admin_salvar_participante').at(-1).corpo.p;
  ok('participantes: cadastrar quem ainda não entrou (sem login)', nova.nome === 'Nova Pessoa' && nova.user_id === null && nova.id === null, JSON.stringify(nova));
  ok('participantes: sem erros no console', erros.length === 0, erros.join(' | '));
  await foto(pagina, '12-participantes');
  await pagina.context().close();
}
{
  const { pagina, pedidos } = await novaPagina({ admin: false, participantes: PESSOAS });
  await pagina.goto(url('#/admin/participantes')); await pagina.waitForSelector('.fechado');
  ok('participantes: quem não é admin vê "Área restrita" e nada é pedido', (await pagina.textContent('.fechado')).includes('Área restrita') && !pedidos.some((p) => p.includes('admin_participantes')));
  await pagina.context().close();
}

// ---- 13. Meu cadastro (a menina preenche a própria ficha) ----
{
  const { pagina, salvos, erros } = await novaPagina({ minhaFicha: null });
  await pagina.goto(url()); await pagina.waitForSelector('.lista-dias');
  ok('cadastro: sem ficha, aparece o cartão "Complete seu cadastro" no topo', await pagina.locator('.cartao-cadastro').isVisible() && (await pagina.locator('.cartao-cadastro input').count()) === 3);
  ok('cadastro: avisa que só a Bruna vê nome e Instagram e que o apelido é público', (await pagina.textContent('.cartao-cadastro .privacidade')).includes('Só a Bruna vê') && (await pagina.textContent('.cartao-cadastro .privacidade')).includes('ranking'));
  await foto(pagina, '13a-cadastro-cartao');
  await pagina.getByRole('button', { name: 'Salvar meu cadastro' }).click(); await pagina.waitForTimeout(150);
  ok('cadastro: sem nome, nada é enviado', salvos.length === 0 && (await pagina.textContent('.aviso')).includes('como você quer ser chamada'));
  const campos = pagina.locator('.cartao-cadastro input');
  await campos.nth(0).fill('Beatriz'); await campos.nth(1).fill('Bia'); await campos.nth(2).fill('@bia');
  await pagina.getByRole('button', { name: 'Salvar meu cadastro' }).click(); await pagina.waitForTimeout(250);
  const enviado = salvos.find((x) => x.nome === 'salvar_minha_ficha')?.corpo;
  ok('cadastro: envia só nome, apelido e Instagram', JSON.stringify(enviado) === JSON.stringify({ p_nome: 'Beatriz', p_apelido: 'Bia', p_instagram: '@bia' }), JSON.stringify(enviado));
  ok('cadastro: depois de salvar o cartão some', (await pagina.locator('.cartao-cadastro').count()) === 0);
  ok('cadastro: sem erros no console', erros.length === 0, erros.join(' | '));
  await pagina.context().close();
}
{
  const { pagina, salvos } = await novaPagina({ minhaFicha: { nome: 'Beatriz', apelido: 'Bia', instagram: '@bia' } });
  await pagina.goto(url()); await pagina.waitForSelector('.lista-dias');
  ok('cadastro: com ficha pronta, o cartão não aparece', (await pagina.locator('.cartao-cadastro').count()) === 0);
  await pagina.getByRole('link', { name: 'Meu cadastro' }).click(); await pagina.waitForSelector('.cadastro-form');
  ok('cadastro: "Meu cadastro" abre com os dados atuais', (await pagina.locator('.cadastro-form input').first().inputValue()) === 'Beatriz' && (await pagina.locator('.cadastro-form input').nth(1).inputValue()) === 'Bia');
  await pagina.locator('.cadastro-form input').nth(1).fill('');
  await pagina.getByRole('button', { name: 'Salvar', exact: true }).click(); await pagina.waitForTimeout(250);
  ok('cadastro: apelido vazio é enviado como vazio (sai do ranking) e volta para a lista', salvos.at(-1).corpo.p_apelido === '' && (await pagina.locator('.lista-dias').isVisible()));
  await pagina.context().close();
}
{
  const { pagina, salvos } = await novaPagina({ minhaFicha: null, apelidoEmUso: true });
  await pagina.goto(url()); await pagina.waitForSelector('.cartao-cadastro');
  await pagina.locator('.cartao-cadastro input').nth(0).fill('Ana'); await pagina.locator('.cartao-cadastro input').nth(1).fill('Bia');
  await pagina.getByRole('button', { name: 'Salvar meu cadastro' }).click(); await pagina.waitForTimeout(250);
  ok('cadastro: apelido já usado mostra a mensagem amigável e mantém o cartão', (await pagina.textContent('.aviso')).includes('já está em uso') && (await pagina.locator('.cartao-cadastro').isVisible()));
  await pagina.context().close();
}
{
  // o site precisa continuar funcionando se o SQL do cadastro ainda não foi rodado
  const { pagina, erros } = await novaPagina({ minhaFicha: 'sem-suporte' });
  await pagina.goto(url()); await pagina.waitForSelector('.lista-dias');
  ok('cadastro: sem o SQL rodado, a lista abre normal, sem cartão e sem link', (await pagina.locator('.lista-dias .dia-item').count()) === 15 && (await pagina.locator('.cartao-cadastro, a:has-text("Meu cadastro")').count()) === 0);
  await pagina.goto(url('#/cadastro')); await pagina.waitForSelector('.lista-dias');
  ok('cadastro: sem o SQL rodado, abrir #/cadastro volta para a lista', true);
  await pagina.context().close();
}

// ---- 14. Admin: ligar ficha antiga a um login ----
{
  const { pagina, salvos } = await novaPagina({ admin: true, participantes: PESSOAS });
  await pagina.goto(url('#/admin/participantes')); await pagina.waitForSelector('text=entraram na apostila');
  const fichas = pagina.locator('.lista-fichas').first().locator('.ficha');
  await fichas.nth(1).locator('summary').click();
  ok('ligar: ficha que já tem login NÃO mostra o botão de ligar', (await fichas.nth(1).locator('.ficha-ligar').count()) === 0);
  await fichas.nth(2).locator('summary').click();
  const ligar = fichas.nth(2).locator('.ficha-ligar');
  ok('ligar: ficha sem login mostra a lista de logins que já entraram', (await ligar.locator('option').count()) === 3 && (await ligar.locator('option').nth(1).textContent()).includes('caro@teste.com'), await ligar.textContent());
  await ligar.getByRole('button', { name: 'Ligar a este login' }).click(); await pagina.waitForTimeout(150);
  ok('ligar: sem escolher um login, nada acontece', !salvos.some((x) => x.nome === 'admin_ligar_ficha'));
  await ligar.locator('select').selectOption('u1');
  pagina.on('dialog', (d) => d.accept());
  await ligar.getByRole('button', { name: 'Ligar a este login' }).click(); await pagina.waitForTimeout(250);
  const lig = salvos.find((x) => x.nome === 'admin_ligar_ficha')?.corpo;
  ok('ligar: chama a função com a ficha e o login certos', lig?.p_ficha_id === 'f3' && lig?.p_user_id === 'u1', JSON.stringify(lig));
  await pagina.context().close();
}

await browser.close(); server.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo passou.');
process.exit(falhas.length ? 1 : 0);
