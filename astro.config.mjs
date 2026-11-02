// @ts-check
import { defineConfig } from "astro/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

// Arquivos estáticos que continuam na raiz do repositório (o painel /admin
// grava em images/ e audio/, e as URLs /css/style.css, /images/..., /admin/
// precisam continuar as mesmas). Em vez de mover para public/, são servidos no
// `astro dev` e copiados para a saída no build. O CNAME fica em public/
// (cópia do CNAME da raiz, que não é tocado).
const ARQUIVOS_DA_RAIZ = ["css", "images", "audio", "admin", "robots.txt"];

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
};

/** @returns {import("astro").AstroIntegration} */
function arquivosDaRaiz() {
  return {
    name: "arquivos-da-raiz",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((req, res, next) => {
          let rel = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, "");
          if (rel.endsWith("/")) rel += "index.html";
          if (!ARQUIVOS_DA_RAIZ.some((item) => rel === item || rel.startsWith(`${item}/`))) return next();
          const arquivo = path.join(RAIZ, rel);
          if (!arquivo.startsWith(RAIZ + path.sep) || !fs.statSync(arquivo, { throwIfNoEntry: false })?.isFile()) {
            return next();
          }
          res.setHeader("Content-Type", TIPOS[path.extname(arquivo).toLowerCase()] ?? "application/octet-stream");
          fs.createReadStream(arquivo).pipe(res);
        });
      },
      "astro:build:done": ({ dir }) => {
        const saida = fileURLToPath(dir);
        for (const item of ARQUIVOS_DA_RAIZ) {
          fs.cpSync(path.join(RAIZ, item), path.join(saida, item), { recursive: true });
        }
        versionarPainel(path.join(saida, "admin"));
      },
    },
  };
}

// O Pages guarda os arquivos em cache por 10 minutos: logo depois de uma
// publicação, o navegador ainda pode abrir o painel antigo, que salva no
// formato antigo sem avisar. Na saída do build, o painel ganha uma versão
// (hash do conteúdo de admin/, que só muda quando o próprio painel muda):
// - admin/versao.json e <meta name="versao-painel"> com a versão;
// - admin.css, admin.js e os import "./..." com ?v=<versão>, para um painel
//   novo nunca misturar arquivos antigos do cache.
// Antes de salvar, o painel compara a sua versão com a de versao.json.
function versionarPainel(pasta) {
  const arquivos = fs
    .readdirSync(pasta, { recursive: true })
    .map(String)
    .filter((rel) => fs.statSync(path.join(pasta, rel)).isFile())
    .sort();
  const hash = crypto.createHash("sha256");
  for (const rel of arquivos) hash.update(rel).update(fs.readFileSync(path.join(pasta, rel)));
  const versao = hash.digest("hex").slice(0, 12);

  const comVersao = (url) => `${url}?v=${versao}`;
  for (const rel of arquivos.filter((r) => /\.(m?js)$/.test(r))) {
    const arquivo = path.join(pasta, rel);
    const js = fs.readFileSync(arquivo, "utf8");
    fs.writeFileSync(arquivo, js.replace(/(from\s+["'])(\.{1,2}\/[^"'?]+)(["'])/g, (_, a, url, b) => a + comVersao(url) + b));
  }
  const indice = path.join(pasta, "index.html");
  const html = fs
    .readFileSync(indice, "utf8")
    .replace('href="admin.css"', `href="${comVersao("admin.css")}"`)
    .replace('src="admin.js"', `src="${comVersao("admin.js")}"`)
    .replace("</title>", `</title>\n<meta name="versao-painel" content="${versao}" />`);
  if (!html.includes(comVersao("admin.js")) || !html.includes(comVersao("admin.css"))) {
    throw new Error("admin/index.html: não encontrei admin.css/admin.js para versionar");
  }
  fs.writeFileSync(indice, html);
  fs.writeFileSync(path.join(pasta, "versao.json"), JSON.stringify({ versao }) + "\n");
}

export default defineConfig({
  site: "https://astrobotanica.com.br",
  // Sem troca automática de aspas, travessões e reticências: o texto das
  // páginas sai exatamente como foi escrito no Markdown.
  markdown: { smartypants: false },
  // "preserve": sobre.astro → sobre.html, artigo/[id]/index.astro →
  // artigo/<id>/index.html — mesma disposição do site atual, então o Pages
  // responde /sobre e /sobre.html como hoje.
  build: { format: "preserve" },
  // dist/ guarda o main.js do site antigo; a saída do Astro vai para _site/.
  outDir: "_site",
  trailingSlash: "ignore",
  integrations: [arquivosDaRaiz()],
});
