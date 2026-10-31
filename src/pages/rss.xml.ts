// /rss.xml — mesmo canal, itens, guid, pubDate, category, description e
// enclosure do feed gerado por scripts/generate_seo.py, mais o texto
// completo de cada notícia em <content:encoded> e o length do enclosure
// (exigido pelo RSS 2.0, faltava no feed antigo).
import { corpoHtml, noticiasDoIdioma, resumo, type Noticia } from "../lib/noticias";
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
} from "../lib/feeds";
import sitePt from "../../data/site.json";

const MAX_ITENS = 30;

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

function item(n: Noticia): string {
  const d = n.data;
  const url = `${BASE_URL}/artigo/${d.id}/`;
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

export async function GET() {
  const noticias = (await noticiasDoIdioma("pt")).slice(0, MAX_ITENS);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(NOME_MARCA)} — Notícias</title>
    <link>${BASE_URL}/noticias</link>
    <description>${xmlEscape(sitePt.brand?.footerTagline ?? "")}</description>
    <language>pt-br</language>
    <lastBuildDate>${agoraRfc822()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${noticias.map(item).join("\n")}
  </channel>
</rss>
`;
  return respostaXml(xml);
}
