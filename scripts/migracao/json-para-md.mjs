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

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DESTINO = path.join(RAIZ, "src/content/noticias");

// Strings sempre entre aspas duplas no formato JSON — é YAML válido e evita
// qualquer reinterpretação (datas virando Date, "sim"/"no" virando booleano,
// ":" ou "#" quebrando o valor).
const str = (v) => JSON.stringify(v ?? "");

function yaml(campos) {
  const linhas = [];
  for (const [chave, v] of Object.entries(campos)) {
    if (v === undefined) continue;
    if (typeof v === "string") linhas.push(`${chave}: ${str(v)}`);
    else if (typeof v === "number" || typeof v === "boolean") linhas.push(`${chave}: ${v}`);
    else if (Array.isArray(v)) {
      if (v.length === 0) {
        linhas.push(`${chave}: []`);
        continue;
      }
      linhas.push(`${chave}:`);
      for (const item of v) {
        const pares = Object.entries(item);
        pares.forEach(([k, val], i) => linhas.push(`${i === 0 ? "  - " : "    "}${k}: ${str(val)}`));
      }
    } else {
      linhas.push(`${chave}:`);
      for (const [k, val] of Object.entries(v)) linhas.push(`  ${k}: ${str(val)}`);
    }
  }
  return linhas;
}

function frontMatter(editoriais, doSite) {
  return [
    "---",
    ...yaml(editoriais),
    "# --- campos do site atual, preservados como estão ---",
    ...yaml(doSite),
    "---",
  ].join("\n");
}

// Campos pedidos para o front matter (na ordem pedida). Os que não existem
// no site atual ficam vazios.
function camposEditoriais(n, lang, traduzido) {
  return {
    title: traduzido.title,
    description: "",
    date: n.date,
    updated: "",
    author: n.author ?? "",
    orcid: "",
    lattes: "",
    fonte: { citacao: "", doi: "", url: "" },
    tipo_estudo: "",
    revisor_tecnico: "",
    tags: [],
    lang,
    boletim: { volume: "", numero: "" },
    erratas: [],
  };
}

// Campos que já existem hoje e não podem se perder (só presentes se
// existirem no JSON).
function camposDoSite(n, ordem, traduzido) {
  return {
    id: n.id,
    ordem,
    time: n.time,
    category: traduzido.category,
    subtitle: traduzido.subtitle,
    readingTime: traduzido.readingTime,
    image: n.image,
    imageCaption: traduzido.imageCaption,
    imageVertical: n.imageVertical,
    authorAvatar: n.authorAvatar,
    featured: n.featured,
    references: n.references,
  };
}

function escrever(arquivo, editoriais, doSite, corpo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  // Uma quebra de linha depois do "---" final e outra no fim do arquivo;
  // o corpo em si fica intacto entre elas.
  fs.writeFileSync(arquivo, `${frontMatter(editoriais, doSite)}\n${corpo}\n`, "utf8");
}

const noticias = JSON.parse(fs.readFileSync(path.join(RAIZ, "data/articles.json"), "utf8"));

for (const lang of ["pt", "en"]) {
  const pasta = path.join(DESTINO, lang);
  if (!fs.existsSync(pasta)) continue;
  for (const f of fs.readdirSync(pasta)) if (/^noticia-.*\.md$/.test(f)) fs.rmSync(path.join(pasta, f));
}

let pt = 0;
let en = 0;
noticias.forEach((n, i) => {
  const ordem = i + 1;
  const original = {
    title: n.title,
    category: n.category,
    subtitle: n.subtitle,
    readingTime: n.readingTime,
    imageCaption: n.imageCaption,
  };
  escrever(
    path.join(DESTINO, "pt", `${n.id}.md`),
    camposEditoriais(n, "pt", original),
    camposDoSite(n, ordem, original),
    n.body ?? ""
  );
  pt++;

  if (n.titleEn || n.bodyEn) {
    const traduzido = {
      title: n.titleEn,
      category: n.categoryEn,
      subtitle: n.subtitleEn,
      readingTime: n.readingTimeEn,
      imageCaption: n.imageCaptionEn,
    };
    escrever(
      path.join(DESTINO, "en", `${n.id}.md`),
      camposEditoriais(n, "en", traduzido),
      camposDoSite(n, ordem, traduzido),
      n.bodyEn ?? ""
    );
    en++;
  }
});

console.log(`${noticias.length} notícia(s) no JSON → ${pt} arquivo(s) em pt/, ${en} em en/`);
