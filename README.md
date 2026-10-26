# Apostila UGC: site

Telas do desafio de 15 dias (login com Google e apostila). HTML, CSS e JavaScript puros, com supabase-js.

**O conteúdo dos dias, o banco, o seed e o guia completo de manutenção ficam no repositório privado `apostila-ugc-conteudo`.** Este repositório é público (exigência do GitHub Pages gratuito), por isso não tem nenhum texto dos dias.

- `js/config.js`: URL e chave **pública** do Supabase. Nunca coloque aqui a chave secreta.
- `js/regras.js`: datas, fuso de Fortaleza e regra de "dia concluído".
- `js/app.js`: telas.
- `css/app.css`: visual (cores e fontes do portfólio).
- Publicação: GitHub Pages, branch `main`, pasta raiz.
- Testes de tela: `node testes/e2e.mjs` (precisa do Playwright e do repositório privado baixado ao lado, em `../apostila-ugc-conteudo`, ou `CONTEUDO_DIR=/caminho`).
