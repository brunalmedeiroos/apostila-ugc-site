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

async function novaPagina({ logada = true, progressoInicial = [], falhaGravar = false, admin = false, documentoDia1 = null, enviarDia1 = null } = {}) {
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
      if (!admin) return json({ message: 'sem acesso', code: '42501' }, 403);
      if (nome === 'admin_dias') return json(agenda.map((a) => { const c = fixtures.conteudo.find((x) => x.numero === a.numero); return { ...a, ...c, documento: c.documento ?? null }; }));
      salvos.push({ nome, corpo }); return route.fulfill({ status: 204, body: '' });
    }
    if (!u.pathname.startsWith('/rest/v1/')) return json({});
    const tabela = u.pathname.split('/').pop();
    if (req.method() === 'GET') {
      if (tabela === 'config') return json(fixtures.config);
      if (tabela === 'dias_agenda') return json(agenda);
      if (tabela === 'dias_conteudo') return json(fixtures.conteudo.filter((c) => abertos.has(c.numero)).map((c) => (c.numero === 1 ? { ...c, ...(documentoDia1 ? { documento: documentoDia1 } : {}), ...(enviarDia1 ? { enviar: enviarDia1 } : {}) } : c)));
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

await browser.close(); server.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo passou.');
process.exit(falhas.length ? 1 : 0);
