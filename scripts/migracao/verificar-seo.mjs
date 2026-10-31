// Confere os metadados de SEO de todas as páginas HTML de uma pasta de saída:
// - title e description presentes e únicos (entre as páginas indexáveis);
// - URL canônica apontando para a própria página;
// - Open Graph (og:title, og:description, og:image, que precisa existir);
// - hreflang recíproco, só entre páginas indexáveis e sem misturar página
//   provisória com página de texto (tradução real);
// - JSON-LD: JSON válido, @context schema.org, Organization em toda página,
//   NewsArticle nas notícias com os campos que o Google pede (headline,
//   image, datePublished, dateModified, author, publisher) e a fonte citada;
//   tipos e propriedades conferidos contra uma lista do schema.org.
// Páginas de redirecionamento (noticia.html etc.) e noindex ficam fora da
// unicidade, mas também precisam de title. Caminhos bloqueados no robots.txt
// (/admin/) ficam de fora.
//
// Uso: node scripts/migracao/verificar-seo.mjs [pasta] [--exemplo /artigo/noticia-3/]
// pasta padrão: _site. --exemplo imprime o JSON-LD de uma página.
// Sai com código 1 se algo falhar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE_URL = "https://astrobotanica.com.br";

const args = process.argv.slice(2);
const iExemplo = args.indexOf("--exemplo");
const exemplo = iExemplo >= 0 ? args.splice(iExemplo, 2)[1] : undefined;
const pasta = path.resolve(RAIZ, args[0] ?? "_site");

// Propriedades aceitas por tipo (subconjunto do schema.org usado pelo site).
const COMUNS = ["@id", "@type", "name", "url", "description", "sameAs", "identifier", "image"];
const PROPRIEDADES = {
  Organization: [...COMUNS, "email", "logo"],
  Person: [...COMUNS],
  WebPage: [...COMUNS],
  PropertyValue: ["@type", "propertyID", "value"],
  CreativeWork: [...COMUNS, "author", "datePublished"],
  ScholarlyArticle: [...COMUNS, "author", "datePublished"],
  DefinedTerm: [...COMUNS, "inDefinedTermSet"],
  NewsArticle: [
    ...COMUNS,
    "headline",
    "datePublished",
    "dateModified",
    "author",
    "publisher",
    "mainEntityOfPage",
    "inLanguage",
    "articleSection",
    "keywords",
    "isAccessibleForFree",
    "license",
    "citation",
    "translationOfWork",
  ],
};

const falhas = [];
const falha = (pagina, msg) => falhas.push(`${pagina}: ${msg}`);
const avisos = [];
const aviso = (pagina, msg) => avisos.push(`${pagina}: ${msg}`);

// Caminhos bloqueados no robots.txt (o painel /admin/) não são páginas públicas.
const robots = fs.readFileSync(path.join(pasta, "robots.txt"), "utf8");
const bloqueados = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);

const decodificar = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const meta = (html, atributo, nome) =>
  html.match(new RegExp(`<meta ${atributo}="${nome}" content="([^"]*)"`))?.[1] ?? html.match(new RegExp(`<meta content="([^"]*)" ${atributo}="${nome}"`))?.[1];

/** Caminho público de um arquivo da pasta (como o Pages responde). */
function urlDoArquivo(rel) {
  const r = rel.split(path.sep).join("/");
  if (r === "index.html") return "/";
  if (r.endsWith("/index.html")) return `/${r.slice(0, -"index.html".length)}`;
  return `/${r.replace(/\.html$/, "")}`;
}

function existeNaPasta(url) {
  if (!url.startsWith(BASE_URL)) return true; // externo: não dá para conferir aqui
  const rel = decodeURIComponent(url.slice(BASE_URL.length)).replace(/^\/+/, "");
  const alvo = path.join(pasta, rel);
  return [alvo, `${alvo}.html`, path.join(alvo, "index.html")].some((p) => fs.statSync(p, { throwIfNoEntry: false })?.isFile());
}

function validarNo(no, pagina, caminho = "") {
  if (Array.isArray(no)) return no.forEach((x, i) => validarNo(x, pagina, `${caminho}[${i}]`));
  if (!no || typeof no !== "object") return;
  const tipo = no["@type"];
  if (tipo) {
    const aceitas = PROPRIEDADES[tipo];
    if (!aceitas) falha(pagina, `JSON-LD ${caminho}: tipo desconhecido "${tipo}"`);
    else for (const k of Object.keys(no)) if (!aceitas.includes(k)) falha(pagina, `JSON-LD ${caminho}: propriedade "${k}" não prevista em ${tipo}`);
  }
  for (const [k, v] of Object.entries(no)) if (v && typeof v === "object") validarNo(v, pagina, `${caminho}.${k}`);
}

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z))?$/;

function validarNoticia(n, pagina, urlPagina) {
  for (const campo of ["headline", "image", "datePublished", "dateModified", "author", "publisher", "description"]) {
    if (n[campo] === undefined || n[campo] === "" || (Array.isArray(n[campo]) && !n[campo].length)) falha(pagina, `NewsArticle sem ${campo}`);
  }
  // O Google não exige mais o limite de 110, mas títulos longos são cortados.
  if (n.headline && n.headline.length > 110) aviso(pagina, `NewsArticle: headline com ${n.headline.length} caracteres (pode ser cortada nos resultados)`);
  for (const campo of ["datePublished", "dateModified"]) {
    if (n[campo] && (!ISO.test(n[campo]) || Number.isNaN(Date.parse(n[campo])))) falha(pagina, `NewsArticle: ${campo} fora do formato ISO 8601 (${n[campo]})`);
  }
  for (const a of n.author ?? []) if (!a.name && !a["@id"]) falha(pagina, "NewsArticle: autor sem name nem @id");
  for (const img of n.image ?? []) if (!existeNaPasta(img)) falha(pagina, `NewsArticle: imagem não existe (${img})`);
  if (!n.citation?.length) falha(pagina, "NewsArticle sem citation (fonte citada)");
  if (n.mainEntityOfPage?.["@id"] !== urlPagina) falha(pagina, "NewsArticle: mainEntityOfPage diferente da URL da página");
}

// ---------------------------------------------------------------------------

const paginas = [];
for (const rel of fs.readdirSync(pasta, { recursive: true })) {
  if (!rel.endsWith(".html")) continue;
  const html = fs.readFileSync(path.join(pasta, rel), "utf8");
  const url = urlDoArquivo(rel);
  if (bloqueados.some((b) => url.startsWith(b))) continue;
  const noindex = /<meta name="robots" content="noindex"/.test(html);
  const redirecionamento = html.includes('id="redirecionamentos"');
  paginas.push({
    url,
    html,
    noindex,
    redirecionamento,
    provisoria: /Página provisória|Provisional page/.test(html),
    title: decodificar(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""),
    description: decodificar(meta(html, "name", "description") ?? ""),
    canonical: html.match(/<link rel="canonical" href="([^"]+)"/)?.[1],
    hreflang: Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])),
    og: {
      title: meta(html, "property", "og:title"),
      description: meta(html, "property", "og:description"),
      image: meta(html, "property", "og:image"),
      url: meta(html, "property", "og:url"),
    },
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
  });
}
const porUrl = new Map(paginas.map((p) => [BASE_URL + p.url, p]));

for (const p of paginas) {
  if (!p.title) falha(p.url, "sem <title>");
  if (p.redirecionamento) continue;

  if (!p.description) falha(p.url, "sem meta description");
  for (const k of ["title", "description", "image"]) if (!p.og[k]) falha(p.url, `sem og:${k}`);
  if (p.og.image && !existeNaPasta(p.og.image)) falha(p.url, `og:image não existe (${p.og.image})`);

  if (!p.noindex) {
    if (p.canonical !== BASE_URL + p.url) falha(p.url, `canonical ${p.canonical ?? "ausente"} não aponta para a própria página`);
    if (p.og.url !== p.canonical) falha(p.url, "og:url diferente da canonical");
  } else if (Object.keys(p.hreflang).length) {
    falha(p.url, "página noindex com hreflang");
  }

  // hreflang: recíproco, para páginas indexáveis, sem misturar provisória e texto
  for (const [lang, alvo] of Object.entries(p.hreflang)) {
    const outra = porUrl.get(alvo);
    if (!outra) {
      falha(p.url, `hreflang ${lang} aponta para página inexistente (${alvo})`);
      continue;
    }
    if (outra.noindex) falha(p.url, `hreflang ${lang} aponta para página noindex (${alvo})`);
    if (outra.provisoria !== p.provisoria) falha(p.url, `hreflang ${lang} liga página provisória a página com texto (${alvo})`);
    const volta = Object.values(outra.hreflang);
    if (!volta.includes(BASE_URL + p.url)) falha(p.url, `hreflang ${lang} sem retorno em ${alvo}`);
  }

  // JSON-LD
  if (p.jsonLd.length !== 1) falha(p.url, `${p.jsonLd.length} blocos JSON-LD (esperado 1)`);
  for (const bloco of p.jsonLd) {
    let dados;
    try {
      dados = JSON.parse(bloco);
    } catch (e) {
      falha(p.url, `JSON-LD inválido: ${e.message}`);
      continue;
    }
    if (dados["@context"] !== "https://schema.org") falha(p.url, "JSON-LD sem @context https://schema.org");
    const grafo = dados["@graph"] ?? [dados];
    validarNo(grafo, p.url);
    const org = grafo.find((n) => n["@type"] === "Organization");
    if (!org?.name || !org?.url) falha(p.url, "JSON-LD sem Organization com name e url");
    const ids = new Set(grafo.map((n) => n["@id"]).filter(Boolean));
    const noticia = grafo.find((n) => n["@type"] === "NewsArticle");
    if (/^\/(en\/)?artigo\//.test(p.url)) {
      if (!noticia) falha(p.url, "notícia sem NewsArticle");
      else {
        validarNoticia(noticia, p.url, BASE_URL + p.url);
        if (noticia.publisher?.["@id"] && !ids.has(noticia.publisher["@id"])) falha(p.url, "NewsArticle: publisher aponta para @id que não está no @graph");
      }
    }
  }
}

// Unicidade entre as páginas indexáveis
const indexaveis = paginas.filter((p) => !p.noindex && !p.redirecionamento);
for (const campo of ["title", "description", "canonical"]) {
  const vistos = new Map();
  for (const p of indexaveis) {
    const v = p[campo];
    if (!v) continue;
    if (vistos.has(v)) falha(p.url, `${campo} repetido com ${vistos.get(v)}: "${v.slice(0, 80)}"`);
    else vistos.set(v, p.url);
  }
}

if (exemplo) {
  const p = paginas.find((x) => x.url === exemplo);
  if (!p) console.log(`--exemplo: página ${exemplo} não encontrada`);
  else {
    console.log(`\n=== ${exemplo}`);
    console.log(`title: ${p.title}\ndescription: ${p.description}\ncanonical: ${p.canonical}`);
    console.log(`hreflang: ${JSON.stringify(p.hreflang)}\nog: ${JSON.stringify(p.og)}`);
    for (const b of p.jsonLd) console.log(JSON.stringify(JSON.parse(b), null, 2));
  }
}

const contagem = (f) => paginas.filter(f).length;
console.log(
  `\n${paginas.length} páginas HTML: ${indexaveis.length} indexáveis, ${contagem((p) => p.noindex && !p.redirecionamento)} noindex, ` +
    `${contagem((p) => p.redirecionamento)} de redirecionamento; ${contagem((p) => Object.keys(p.hreflang).length)} com hreflang; ` +
    `${contagem((p) => p.jsonLd.some((b) => b.includes('"NewsArticle"')))} com NewsArticle.`
);
for (const a of avisos) console.log(`AVISO  ${a}`);
for (const f of falhas) console.log(`FALHA  ${f}`);
console.log(falhas.length ? `${falhas.length} falha(s)` : "SEO: tudo OK");
process.exit(falhas.length ? 1 : 0);
