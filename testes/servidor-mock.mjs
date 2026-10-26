// Sobe o site estático + simula o Supabase (REST) para testar a tela no navegador.
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
const require = createRequire(import.meta.url);
export const raiz = new URL('..', import.meta.url).pathname;
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
export function servir(porta = 8099) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^\/+/, '') || 'index.html';
      const f = join(raiz, p);
      if (!f.startsWith(raiz) || !existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': tipos[extname(f)] ?? 'application/octet-stream' });
      res.end(readFileSync(f));
    }).listen(porta, () => ok(s));
  });
}
// O conteúdo dos dias é privado: não fica neste repositório público. Os testes leem
// do repositório privado, que deve estar ao lado (ou aponte com CONTEUDO_DIR).
const conteudoDir = process.env.CONTEUDO_DIR ?? join(raiz, '..', 'apostila-ugc-conteudo');
const { montarLinhas } = await import(join(conteudoDir, 'seed', 'seed.js'));
export const fixtures = montarLinhas(join(conteudoDir, 'conteudo'));
fixtures.config.link_grupo = 'https://chat.whatsapp.com/exemplo';
