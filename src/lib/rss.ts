// Feeds de notícias: /rss.xml (PT, mesmo canal, itens, guid, pubDate,
// category, description e enclosure do feed gerado por
// scripts/generate_seo.py, mais o texto completo em <content:encoded> e o
// length do enclosure) e /en/rss.xml (só as notícias traduzidas, com links e
// guid das páginas /en/artigo/<id>/).
import { corpoHtml, noticiasDoIdioma, resumo, type Noticia } from "./noticias";
import {
  BASE_URL,
  NOME_MARCA,
  agoraRfc822,
  dataPublicacao,
  respostaXml,
  tamanhoArquivo,
  tipoImagem,
  urlAbsoluta,
  xmlEscape,
} from "./feeds";
import { caminhoNoIdioma, type Lang } from "./i18n";
import sitePt from "../../data/site.json";
import siteEn from "../../data/site.en.json";

const MAX_ITENS = 30;

const CANAL = {
  pt: { titulo: "Notícias", descricao: sitePt.brand?.footerTagline ?? "", idioma: "pt-br" },
  en: { titulo: "News", descricao: siteEn.brand?.footerTagline ?? "", idioma: "en" },
};

// O corpo usa caminhos relativos (src="images/..."), resolvidos no site pelo
// <base href="/">. Leitores de feed não têm essa base, então no feed os
// caminhos viram absolutos. O texto em si não muda.
function comUrlsAbsolutas(html: string): string {
  return html.replace(/\b(src|href|poster)="(?![a-z][a-z0-9+.-]*:|\/\/|#)([^"]*)"/gi, (_, attr, url) => `${attr}="${urlAbsoluta(url)}"`);
}

// "]]>" dentro do texto fecharia o CDATA antes da hora.
function cdata(texto: string): string {
  return `<![CDATA[${texto.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function item(n: Noticia, lang: Lang): string {
  const d = n.data;
  const url = `${BASE_URL}${caminhoNoIdioma(`/artigo/${d.id}/`, lang)}`;
  const enclosure = d.image
    ? `\n      <enclosure url="${xmlEscape(urlAbsoluta(d.image))}" type="${tipoImagem(d.image)}" length="${tamanhoArquivo(d.image)}" />`
    : "";
  return `    <item>
      <title>${xmlEscape(d.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${dataPublicacao(d.date, d.time)}</pubDate>
      <category>${xmlEscape(d.category ?? "")}</category>
      <description>${xmlEscape(resumo(n))}</description>${enclosure}
      <content:encoded>${cdata(comUrlsAbsolutas(corpoHtml(n)))}</content:encoded>
    </item>`;
}

export async function feedNoticias(lang: Lang): Promise<Response> {
  const canal = CANAL[lang];
  const noticias = (await noticiasDoIdioma(lang)).slice(0, MAX_ITENS);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(NOME_MARCA)} — ${canal.titulo}</title>
    <link>${BASE_URL}${caminhoNoIdioma("/noticias", lang)}</link>
    <description>${xmlEscape(canal.descricao)}</description>
    <language>${canal.idioma}</language>
    <lastBuildDate>${agoraRfc822()}</lastBuildDate>
    <atom:link href="${BASE_URL}${caminhoNoIdioma("/rss.xml", lang)}" rel="self" type="application/rss+xml" />
${noticias.map((n) => item(n, lang)).join("\n")}
  </channel>
</rss>
`;
  return respostaXml(xml);
}
