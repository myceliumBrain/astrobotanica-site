#!/usr/bin/env node
// Garante que a migração de data/articles.json para Markdown não alterou
// nenhum conteúdo: relê cada .md com um parser YAML independente e compara
// cada campo e o corpo, byte a byte, com o JSON. Também confere que os
// campos editoriais novos estão vazios (nada inventado) e que toda imagem
// referenciada existe. Sai com código 1 se houver qualquer diferença.
//
// Uso: node scripts/migracao/verificar-conteudo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PASTA = path.join(RAIZ, "src/content/noticias");
const noticias = JSON.parse(fs.readFileSync(path.join(RAIZ, "data/articles.json"), "utf8"));

const erros = [];
const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function ler(arquivo) {
  const texto = fs.readFileSync(arquivo, "utf8");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)\n$/);
  if (!m) throw new Error(`${arquivo}: formato inesperado`);
  return { dados: parse(m[1]), corpo: m[2] };
}

const VAZIOS = {
  description: "",
  updated: "",
  orcid: "",
  lattes: "",
  fonte: { citacao: "", doi: "", url: "" },
  tipo_estudo: "",
  revisor_tecnico: "",
  tags: [],
  boletim: { volume: "", numero: "" },
  erratas: [],
};

function conferir(rotulo, arquivo, esperado, corpoEsperado) {
  if (!fs.existsSync(arquivo)) {
    erros.push(`${rotulo}: arquivo ausente`);
    return;
  }
  const { dados, corpo } = ler(arquivo);
  if (corpo !== corpoEsperado) erros.push(`${rotulo}: corpo diferente do JSON`);
  for (const [k, v] of Object.entries(esperado)) {
    if (!iguais(dados[k], v)) erros.push(`${rotulo}: campo "${k}" diferente (${JSON.stringify(dados[k])} ≠ ${JSON.stringify(v)})`);
  }
  for (const [k, v] of Object.entries(VAZIOS)) {
    if (!iguais(dados[k], v)) erros.push(`${rotulo}: campo novo "${k}" deveria estar vazio`);
  }
  const imagens = [dados.image, dados.imageVertical, dados.authorAvatar, ...[...corpo.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1])];
  for (const img of imagens.filter(Boolean)) {
    if (!/^https?:/.test(img) && !fs.existsSync(path.join(RAIZ, img.replace(/^\//, "")))) erros.push(`${rotulo}: imagem inexistente ${img}`);
  }
}

let totalEn = 0;
noticias.forEach((n, i) => {
  const comum = {
    date: n.date,
    author: n.author ?? "",
    id: n.id,
    ordem: i + 1,
    time: n.time,
    image: n.image,
    imageVertical: n.imageVertical,
    authorAvatar: n.authorAvatar,
    featured: n.featured,
    references: n.references,
  };
  conferir(
    `pt/${n.id}`,
    path.join(PASTA, "pt", `${n.id}.md`),
    { ...comum, lang: "pt", title: n.title, category: n.category, subtitle: n.subtitle, readingTime: n.readingTime, imageCaption: n.imageCaption },
    n.body ?? ""
  );
  const arquivoEn = path.join(PASTA, "en", `${n.id}.md`);
  if (n.titleEn || n.bodyEn) {
    totalEn++;
    conferir(
      `en/${n.id}`,
      arquivoEn,
      { ...comum, lang: "en", title: n.titleEn ?? "", category: n.categoryEn, subtitle: n.subtitleEn, readingTime: n.readingTimeEn, imageCaption: n.imageCaptionEn },
      n.bodyEn ?? ""
    );
  } else if (fs.existsSync(arquivoEn)) {
    erros.push(`en/${n.id}: existe arquivo EN, mas a notícia não tem tradução`);
  }
});

const contar = (lang) => (fs.existsSync(path.join(PASTA, lang)) ? fs.readdirSync(path.join(PASTA, lang)).filter((f) => f.endsWith(".md")).length : 0);
const [arqPt, arqEn] = [contar("pt"), contar("en")];
if (arqPt !== noticias.length) erros.push(`pt/: ${arqPt} arquivo(s) para ${noticias.length} notícia(s)`);
if (arqEn !== totalEn) erros.push(`en/: ${arqEn} arquivo(s) para ${totalEn} tradução(ões)`);

console.log(`JSON: ${noticias.length} notícia(s), ${totalEn} com tradução | Markdown: ${arqPt} em pt/, ${arqEn} em en/`);
if (erros.length) {
  console.error(`\n${erros.length} diferença(s):\n- ${erros.join("\n- ")}`);
  process.exit(1);
}
console.log("OK: todos os campos e corpos idênticos ao JSON; campos novos vazios; todas as imagens existem.");
