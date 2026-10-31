// @ts-check
import { defineConfig } from "astro/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

// Arquivos estáticos que continuam na raiz do repositório (o painel /admin
// grava em images/ e audio/, e as URLs /css/style.css, /images/... precisam
// continuar as mesmas). Em vez de mover para public/, são servidos no
// `astro dev` e copiados para a saída no build. O CNAME fica em public/
// (cópia do CNAME da raiz, que não é tocado).
const ARQUIVOS_DA_RAIZ = ["css", "images", "audio", "robots.txt"];

const TIPOS = {
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
          const rel = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, "");
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
      },
    },
  };
}

export default defineConfig({
  site: "https://astrobotanica.com.br",
  // "preserve": sobre.astro → sobre.html, artigo/[id]/index.astro →
  // artigo/<id>/index.html — mesma disposição do site atual, então o Pages
  // responde /sobre e /sobre.html como hoje.
  build: { format: "preserve" },
  // dist/ guarda o main.js do site antigo; a saída do Astro vai para _site/.
  outDir: "_site",
  trailingSlash: "ignore",
  integrations: [arquivosDaRaiz()],
});
