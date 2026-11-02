// ============================================================================
// noticias-md.js — conversão entre a notícia do painel (o mesmo objeto que
// ficava em data/articles.json) e os arquivos Markdown do site:
//   src/content/noticias/pt/<id>.md  — toda notícia
//   src/content/noticias/en/<id>.md  — só a que tem tradução (titleEn/bodyEn)
//
// Usado pelo painel (admin.js, no navegador) e pelo script de migração
// (scripts/migracao/json-para-md.mjs, no Node), para que os dois escrevam
// exatamente o mesmo formato: salvar sem mudar nada gera o mesmo arquivo,
// byte a byte.
//
// O corpo (HTML) vai sem alteração para depois do front matter. Os campos
// editoriais que o painel não mostra (description, orcid, fonte, erratas…)
// e qualquer campo acrescentado à mão no front matter são lidos para
// noticia._md.pt / noticia._md.en e regravados como estavam.
// ============================================================================

import { load, CORE_SCHEMA } from "./vendor/js-yaml.mjs";

export const PASTA_NOTICIAS = "src/content/noticias";

export function caminhoNoticia(lang, id) {
  return `${PASTA_NOTICIAS}/${lang}/${id}.md`;
}

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
        if (item === null || typeof item !== "object") {
          linhas.push(`  - ${typeof item === "string" ? str(item) : item}`);
          continue;
        }
        const pares = Object.entries(item);
        pares.forEach(([k, val], i) => linhas.push(`${i === 0 ? "  - " : "    "}${k}: ${str(val)}`));
      }
    } else if (v === null) {
      linhas.push(`${chave}: ""`);
    } else {
      linhas.push(`${chave}:`);
      for (const [k, val] of Object.entries(v)) linhas.push(`  ${k}: ${str(val)}`);
    }
  }
  return linhas;
}

const CAMPOS_EDITORIAIS = [
  "title", "description", "date", "updated", "author", "orcid", "lattes", "fonte",
  "tipo_estudo", "revisor_tecnico", "tags", "lang", "boletim", "erratas",
];
const CAMPOS_DO_SITE = [
  "id", "ordem", "time", "category", "subtitle", "readingTime", "image", "imageCaption",
  "imageVertical", "authorAvatar", "featured", "references",
];

// Valores dos campos editoriais quando o arquivo ainda não existe (notícia
// nova) ou o campo não estava nele. Vazios: são preenchidos à mão, nunca
// inventados.
function editoriaisPadrao() {
  return {
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
}

// Campos que existem nas duas versões mas que a versão EN traduz.
function textos(n, lang) {
  if (lang === "pt") {
    return {
      title: n.title,
      category: n.category,
      subtitle: n.subtitle,
      readingTime: n.readingTime,
      imageCaption: n.imageCaption,
      body: n.body,
    };
  }
  return {
    title: n.titleEn,
    category: n.categoryEn,
    subtitle: n.subtitleEn,
    readingTime: n.readingTimeEn,
    imageCaption: n.imageCaptionEn,
    body: n.bodyEn,
  };
}

export function temTraducao(n) {
  return Boolean(n.titleEn || n.bodyEn);
}

/** Texto do arquivo .md de uma notícia num idioma. `ordem` é a posição na
 * lista (1 = primeira). */
export function noticiaParaMarkdown(n, lang, ordem) {
  const t = textos(n, lang);
  const guardado = n._md?.[lang] ?? {};
  const padrao = editoriaisPadrao();
  const editoriais = {};
  for (const k of CAMPOS_EDITORIAIS) editoriais[k] = k in guardado ? guardado[k] : padrao[k];
  Object.assign(editoriais, { title: t.title, date: n.date, author: n.author ?? "", lang });
  const doSite = {
    id: n.id,
    ordem,
    time: n.time,
    category: t.category,
    subtitle: t.subtitle,
    readingTime: t.readingTime,
    image: n.image,
    imageCaption: t.imageCaption,
    imageVertical: n.imageVertical,
    authorAvatar: n.authorAvatar,
    featured: n.featured,
    references: n.references,
  };
  // Campos acrescentados à mão que o painel não conhece: vão no fim, como
  // estavam.
  const extras = {};
  for (const [k, v] of Object.entries(guardado)) {
    if (!CAMPOS_EDITORIAIS.includes(k) && !CAMPOS_DO_SITE.includes(k)) extras[k] = v;
  }
  const linhas = [
    "---",
    ...yaml(editoriais),
    "# --- campos do site atual, preservados como estão ---",
    ...yaml(doSite),
    ...yaml(extras),
    "---",
  ];
  // Uma quebra de linha depois do "---" final e outra no fim do arquivo; o
  // corpo em si fica intacto entre elas.
  return `${linhas.join("\n")}\n${t.body ?? ""}\n`;
}

/** Todos os arquivos de uma lista de notícias, como { caminho: texto }. */
export function noticiasParaArquivos(noticias) {
  const arquivos = {};
  noticias.forEach((n, i) => {
    arquivos[caminhoNoticia("pt", n.id)] = noticiaParaMarkdown(n, "pt", i + 1);
    if (temTraducao(n)) arquivos[caminhoNoticia("en", n.id)] = noticiaParaMarkdown(n, "en", i + 1);
  });
  return arquivos;
}

/** Separa front matter (objeto) e corpo de um arquivo .md. */
export function lerMarkdown(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(texto);
  if (!m) throw new Error("arquivo sem front matter (--- … ---)");
  const dados = load(m[1], { schema: CORE_SCHEMA }) ?? {};
  if (typeof dados !== "object" || Array.isArray(dados)) throw new Error("front matter inválido");
  return { dados, corpo: m[2].replace(/\r?\n$/, "") };
}

const comoTexto = (v) => (v === undefined || v === null ? undefined : String(v));

/** Monta a notícia do painel a partir do .md PT e, se houver, do .md EN. */
export function markdownParaNoticia(textoPt, textoEn) {
  const pt = lerMarkdown(textoPt);
  const d = pt.dados;
  const n = { id: comoTexto(d.id) };
  const copiar = (destino, valor) => {
    if (valor !== undefined && valor !== null) n[destino] = valor;
  };
  copiar("category", comoTexto(d.category));
  copiar("title", comoTexto(d.title));
  copiar("subtitle", comoTexto(d.subtitle));
  copiar("author", d.author ? String(d.author) : undefined);
  copiar("authorAvatar", comoTexto(d.authorAvatar));
  copiar("date", comoTexto(d.date));
  copiar("time", comoTexto(d.time));
  copiar("readingTime", comoTexto(d.readingTime));
  copiar("image", comoTexto(d.image));
  copiar("imageCaption", comoTexto(d.imageCaption));
  copiar("imageVertical", comoTexto(d.imageVertical));
  if (d.featured === true) n.featured = true;
  copiar("references", Array.isArray(d.references) ? d.references : undefined);
  n.body = pt.corpo;
  n._md = { pt: d };
  if (textoEn !== undefined) {
    const en = lerMarkdown(textoEn);
    const e = en.dados;
    copiar("titleEn", comoTexto(e.title) || undefined);
    copiar("categoryEn", comoTexto(e.category));
    copiar("subtitleEn", comoTexto(e.subtitle));
    copiar("readingTimeEn", comoTexto(e.readingTime));
    copiar("imageCaptionEn", comoTexto(e.imageCaption));
    if (en.corpo) n.bodyEn = en.corpo;
    n._md.en = e;
  }
  n._ordem = Number(d.ordem) || Number.MAX_SAFE_INTEGER;
  return n;
}

/** Notícias em ordem a partir dos arquivos { caminho: texto }. */
export function arquivosParaNoticias(arquivos) {
  const noticias = [];
  for (const [caminho, texto] of Object.entries(arquivos)) {
    const m = new RegExp(`^${PASTA_NOTICIAS}/pt/([^/]+)\\.md$`).exec(caminho);
    if (!m) continue;
    try {
      noticias.push(markdownParaNoticia(texto, arquivos[caminhoNoticia("en", m[1])]));
    } catch (err) {
      throw new Error(`${caminho}: ${err.message}`);
    }
  }
  noticias.sort((a, b) => a._ordem - b._ordem || a.id.localeCompare(b.id, "pt", { numeric: true }));
  noticias.forEach((n) => delete n._ordem);
  return noticias;
}

/** Problemas que fariam o build do site falhar. Lista vazia = pode salvar. */
export function problemasDasNoticias(noticias) {
  const problemas = [];
  const ids = new Set();
  noticias.forEach((n) => {
    const nome = n.title ? `"${n.title}"` : n.id || "(sem identificador)";
    if (!/^noticia-\d+$/.test(n.id || "")) problemas.push(`${nome}: identificador "${n.id}" fora do padrão noticia-<número>`);
    else if (ids.has(n.id)) problemas.push(`${nome}: identificador "${n.id}" repetido`);
    ids.add(n.id);
    if (!n.title?.trim()) problemas.push(`${n.id}: falta o título`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date || "")) problemas.push(`${nome}: data inválida`);
    if (n.time && !/^\d{2}:\d{2}$/.test(n.time)) problemas.push(`${nome}: hora fora do formato HH:MM`);
    if (temTraducao(n) && !n.titleEn?.trim()) problemas.push(`${nome}: tem texto em inglês mas falta o título (EN)`);
  });
  return problemas;
}

/** Diferença entre os arquivos lidos do GitHub e os que devem existir:
 * { gravar: { caminho: texto }, apagar: [caminho] }. Só entram os arquivos
 * que mudaram de fato. */
export function mudancasDeArquivos(originais, novos) {
  const gravar = {};
  for (const [caminho, texto] of Object.entries(novos)) {
    if (originais[caminho] !== texto) gravar[caminho] = texto;
  }
  const apagar = Object.keys(originais).filter((caminho) => !(caminho in novos));
  return { gravar, apagar };
}
