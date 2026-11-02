// /sitemap.xml — as URLs do sitemap antigo (scripts/generate_sitemap.py),
// mais as páginas institucionais, os episódios e as versões em inglês, com
// <xhtml:link> de alternância entre os pares PT/EN.
import { noticiasDoIdioma } from "../lib/noticias";
import { paginaInstitucional, slugsDePaginasNovas } from "../lib/paginas";
import { temTraducao as verbeteTraduzido, urlVerbete, verbetesPublicados } from "../lib/estudos";
import { episodios, temTraducao as episodioTraduzido, urlEpisodio } from "../lib/episodios";
import { caminhoNoIdioma } from "../lib/i18n";
import { BASE_URL, respostaXml, xmlEscape } from "../lib/feeds";

// Páginas sem data própria: lastmod = dia do build, como antes.
// Seções: textos de data/site.json e site.en.json, existem nos dois idiomas.
const SECOES: [string, string][] = [
  ["/", "weekly"],
  ["/noticias", "daily"],
  ["/estudos/", "weekly"], // pasta: /estudos redireciona para /estudos/
  ["/podcast", "weekly"],
  ["/contato", "yearly"],
];
// Institucionais: src/content/paginas/<lang>/<slug>.md. A versão sem
// Markdown é provisória (noindex) e fica fora do sitemap.
const INSTITUCIONAIS: [string, string][] = [
  ["sobre", "monthly"],
  ["expediente", "monthly"],
  ["politica-editorial", "yearly"],
  ["normas-para-colaboradores", "yearly"],
  ["privacidade", "yearly"],
];

interface Entrada {
  caminho: string;
  lastmod?: string;
  changefreq: string;
  /** Caminho sem /en quando a página existe nos dois idiomas. */
  par?: string;
}

function url(e: Entrada): string {
  const linhas = [`    <loc>${xmlEscape(BASE_URL + e.caminho)}</loc>`];
  if (e.lastmod) linhas.push(`    <lastmod>${e.lastmod}</lastmod>`);
  linhas.push(`    <changefreq>${e.changefreq}</changefreq>`);
  // O schema do sitemap exige elementos de outro namespace depois de
  // loc/lastmod/changefreq/priority.
  if (e.par) {
    for (const [hreflang, lang] of [["pt-BR", "pt"], ["en", "en"], ["x-default", "pt"]] as const) {
      linhas.push(`    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${xmlEscape(BASE_URL + caminhoNoIdioma(e.par, lang))}" />`);
    }
  }
  return `  <url>\n${linhas.join("\n")}\n  </url>`;
}

export async function GET() {
  const hoje = new Date().toISOString().slice(0, 10);
  const entradas: Entrada[] = [];

  // Mais as páginas criadas pelo painel a partir do menu.
  const novas: [string, string][] = (await slugsDePaginasNovas()).map((slug) => [slug, "monthly"]);
  const institucionais = await Promise.all(
    [...INSTITUCIONAIS, ...novas].map(async ([slug, changefreq]) => {
      const pt = await paginaInstitucional("pt", slug);
      const en = await paginaInstitucional("en", slug);
      return { caminho: `/${slug}`, changefreq, pt, en };
    })
  );
  const lastmodPagina = (p: { data: { updated: string } } | undefined) => p?.data.updated || hoje;

  for (const [caminho, changefreq] of SECOES) {
    entradas.push({ caminho, lastmod: hoje, changefreq, par: caminho });
  }
  for (const p of institucionais) {
    if (p.pt) {
      entradas.push({ caminho: p.caminho, lastmod: lastmodPagina(p.pt), changefreq: p.changefreq, par: p.pt && p.en ? p.caminho : undefined });
    }
  }

  const traduzidas = new Set((await noticiasDoIdioma("en")).map((n) => n.data.id));
  for (const n of await noticiasDoIdioma("pt")) {
    const caminho = `/artigo/${n.data.id}/`;
    const lastmod = n.data.updated || n.data.date;
    entradas.push({ caminho, lastmod, changefreq: "monthly", par: traduzidas.has(n.data.id) ? caminho : undefined });
  }

  for (const e of episodios) {
    const caminho = urlEpisodio(e.id);
    entradas.push({ caminho, lastmod: e.date, changefreq: "monthly", par: episodioTraduzido(e) ? caminho : undefined });
  }

  // Versões em inglês, depois das em português.
  for (const [caminho, changefreq] of SECOES) {
    entradas.push({ caminho: caminhoNoIdioma(caminho, "en"), lastmod: hoje, changefreq, par: caminho });
  }
  for (const p of institucionais) {
    if (p.en) {
      entradas.push({ caminho: caminhoNoIdioma(p.caminho, "en"), lastmod: lastmodPagina(p.en), changefreq: p.changefreq, par: p.pt ? p.caminho : undefined });
    }
  }
  for (const n of await noticiasDoIdioma("en")) {
    const caminho = `/artigo/${n.data.id}/`;
    entradas.push({ caminho: caminhoNoIdioma(caminho, "en"), lastmod: n.data.updated || n.data.date, changefreq: "monthly", par: caminho });
  }

  for (const e of episodios.filter(episodioTraduzido)) {
    entradas.push({ caminho: urlEpisodio(e.id, "en"), lastmod: e.date, changefreq: "monthly", par: urlEpisodio(e.id) });
  }

  // Verbetes publicados, como generate_sitemap.py, e os traduzidos em EN.
  for (const v of verbetesPublicados) {
    const caminho = urlVerbete(v);
    entradas.push({ caminho, lastmod: v.dataAtualizacao || undefined, changefreq: "monthly", par: verbeteTraduzido(v) ? caminho : undefined });
  }
  for (const v of verbetesPublicados.filter(verbeteTraduzido)) {
    entradas.push({ caminho: urlVerbete(v, "en"), lastmod: v.dataAtualizacao || undefined, changefreq: "monthly", par: urlVerbete(v) });
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    entradas.map(url).join("\n") +
    "\n</urlset>\n";
  return respostaXml(xml);
}
