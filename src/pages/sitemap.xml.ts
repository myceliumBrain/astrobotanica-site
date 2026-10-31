// /sitemap.xml — as URLs do sitemap antigo (scripts/generate_sitemap.py),
// mais as páginas institucionais, os episódios e as versões em inglês, com
// <xhtml:link> de alternância entre os pares PT/EN.
import { noticiasDoIdioma } from "../lib/noticias";
import { episodios, urlEpisodio } from "../lib/episodios";
import { caminhoNoIdioma } from "../lib/i18n";
import { BASE_URL, respostaXml, xmlEscape } from "../lib/feeds";

// Páginas sem data própria: lastmod = dia do build, como antes.
const PAGINAS: [string, string][] = [
  ["/", "weekly"],
  ["/noticias", "daily"],
  ["/estudos", "weekly"],
  ["/podcast", "weekly"],
  ["/sobre", "monthly"],
  ["/contato", "yearly"],
  ["/expediente", "monthly"],
  ["/politica-editorial", "yearly"],
  ["/normas-para-colaboradores", "yearly"],
  ["/privacidade", "yearly"],
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
  if (e.par) {
    for (const [hreflang, lang] of [["pt-BR", "pt"], ["en", "en"], ["x-default", "pt"]] as const) {
      linhas.push(`    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${xmlEscape(BASE_URL + caminhoNoIdioma(e.par, lang))}" />`);
    }
  }
  if (e.lastmod) linhas.push(`    <lastmod>${e.lastmod}</lastmod>`);
  linhas.push(`    <changefreq>${e.changefreq}</changefreq>`);
  return `  <url>\n${linhas.join("\n")}\n  </url>`;
}

export async function GET() {
  const hoje = new Date().toISOString().slice(0, 10);
  const entradas: Entrada[] = [];

  for (const [caminho, changefreq] of PAGINAS) {
    entradas.push({ caminho, lastmod: hoje, changefreq, par: caminho });
  }

  const traduzidas = new Set((await noticiasDoIdioma("en")).map((n) => n.data.id));
  for (const n of await noticiasDoIdioma("pt")) {
    const caminho = `/artigo/${n.data.id}/`;
    const lastmod = n.data.updated || n.data.date;
    entradas.push({ caminho, lastmod, changefreq: "monthly", par: traduzidas.has(n.data.id) ? caminho : undefined });
  }

  for (const e of episodios) {
    entradas.push({ caminho: urlEpisodio(e.id), lastmod: e.date, changefreq: "monthly" });
  }

  // Versões em inglês, depois das em português.
  for (const [caminho, changefreq] of PAGINAS) {
    entradas.push({ caminho: caminhoNoIdioma(caminho, "en"), lastmod: hoje, changefreq, par: caminho });
  }
  for (const n of await noticiasDoIdioma("en")) {
    const caminho = `/artigo/${n.data.id}/`;
    entradas.push({ caminho: caminhoNoIdioma(caminho, "en"), lastmod: n.data.updated || n.data.date, changefreq: "monthly", par: caminho });
  }

  // Verbetes de estudo entram aqui quando as páginas /estudos/<cat>/<slug>/ existirem (hoje não há nenhum publicado).

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    entradas.map(url).join("\n") +
    "\n</urlset>\n";
  return respostaXml(xml);
}
