#!/usr/bin/env node
// Converte data/articles.json em um arquivo Markdown por notícia e idioma:
//   src/content/noticias/pt/<id>.md  — todas as notícias
//   src/content/noticias/en/<id>.md  — só as que têm tradução (titleEn/bodyEn)
//
// Só muda o formato: o corpo (HTML) vai byte a byte para depois do front
// matter, e cada campo existente é copiado sem alteração. Campos editoriais
// novos (description, orcid, fonte, tipo_estudo...) saem vazios — são
// preenchidos à mão depois, nunca inventados aqui.
//
// Idempotente: pode rodar de novo (ex.: antes da virada, com o JSON mais
// recente da main) — apaga e recria só os .md de noticia-*.
//
// Uso: node scripts/migracao/json-para-md.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { noticiasParaArquivos } from "../../admin/noticias-md.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DESTINO = path.join(RAIZ, "src/content/noticias");

// O formato dos arquivos é o mesmo que o painel /admin grava: os dois usam
// admin/noticias-md.js.
function escrever(arquivo, texto) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, texto, "utf8");
}

const noticias = JSON.parse(fs.readFileSync(path.join(RAIZ, "data/articles.json"), "utf8"));

for (const lang of ["pt", "en"]) {
  const pasta = path.join(DESTINO, lang);
  if (!fs.existsSync(pasta)) continue;
  for (const f of fs.readdirSync(pasta)) if (/^noticia-.*\.md$/.test(f)) fs.rmSync(path.join(pasta, f));
}

let pt = 0;
let en = 0;
for (const [caminho, texto] of Object.entries(noticiasParaArquivos(noticias))) {
  escrever(path.join(RAIZ, caminho), texto);
  if (caminho.includes("/pt/")) pt++;
  else en++;
}

console.log(`${noticias.length} notícia(s) no JSON → ${pt} arquivo(s) em pt/, ${en} em en/`);
