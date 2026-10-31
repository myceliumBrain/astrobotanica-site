// /podcast.xml — igual ao gerado por scripts/generate_podcast_feed.py, salvo
// o <link> de cada item, que passa a ser a página estática /episodios/<id>/.
// O <guid> continua /episodio?id=<id> para os apps não duplicarem episódios.
import fs from "node:fs";
import path from "node:path";
import { episodios, urlEpisodio, type Episodio } from "../lib/episodios";
import { BASE_URL, NOME_MARCA, agoraRfc822, dataPublicacao, respostaXml, urlAbsoluta, xmlEscape } from "../lib/feeds";
import sitePt from "../../data/site.json";

// Taxonomia fixa do Apple Podcasts.
const ITUNES_CATEGORIA = "Science";
const ITUNES_SUBCATEGORIA = "Natural Sciences";

// "6:32 min" → "6:32" (itunes:duration aceita HH:MM:SS, MM:SS ou segundos).
function duracaoItunes(duracao: string): string {
  return duracao.match(/\d{1,2}(:\d{2}){1,2}/)?.[0] ?? duracao;
}

// Tamanho do MP3 no repositório (o build roda na raiz do projeto).
function tamanhoAudio(audioSrc: string): number {
  return fs.statSync(path.join(process.cwd(), audioSrc), { throwIfNoEntry: false })?.size ?? 0;
}

function item(e: Episodio): string {
  const guid = `${BASE_URL}/episodio?id=${e.id}`;
  const link = `${BASE_URL}${urlEpisodio(e.id)}`;
  const imagem = e.image ? `\n      <itunes:image href="${xmlEscape(urlAbsoluta(e.image))}" />` : "";
  return `    <item>
      <title>${xmlEscape(e.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(guid)}</guid>
      <pubDate>${dataPublicacao(e.date, e.time)}</pubDate>
      <description>${xmlEscape(e.description ?? "")}</description>
      <enclosure url="${xmlEscape(urlAbsoluta(e.audioSrc))}" type="audio/mpeg" length="${tamanhoAudio(e.audioSrc)}" />
      <itunes:duration>${xmlEscape(duracaoItunes(e.duration))}</itunes:duration>
      <itunes:episode>${e.number}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>${imagem}
    </item>`;
}

export function GET() {
  const recentes = [...episodios].sort((a, b) => b.date.localeCompare(a.date));
  const titulo = sitePt.podcast?.title || "Astrobotânica";
  const descricao = sitePt.podcast?.intro || sitePt.podcast?.metaDescription || "";
  const email = sitePt.contato?.email || "";
  // Sem capa própria do podcast, usa a do episódio mais recente que tiver uma.
  const capa = recentes.find((e) => e.image)?.image;
  const capaTags = capa
    ? `
    <itunes:image href="${xmlEscape(urlAbsoluta(capa))}" />
    <image>
      <url>${xmlEscape(urlAbsoluta(capa))}</url>
      <title>${xmlEscape(titulo)}</title>
      <link>${BASE_URL}/podcast</link>
    </image>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(titulo)}</title>
    <link>${BASE_URL}/podcast</link>
    <description>${xmlEscape(descricao)}</description>
    <language>pt-br</language>
    <lastBuildDate>${agoraRfc822()}</lastBuildDate>
    <atom:link href="${BASE_URL}/podcast.xml" rel="self" type="application/rss+xml" />
    <itunes:author>${xmlEscape(NOME_MARCA)}</itunes:author>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${xmlEscape(NOME_MARCA)}</itunes:name>
      <itunes:email>${xmlEscape(email)}</itunes:email>
    </itunes:owner>
    <itunes:category text="${ITUNES_CATEGORIA}">
      <itunes:category text="${ITUNES_SUBCATEGORIA}" />
    </itunes:category>${capaTags}
${recentes.map(item).join("\n")}
  </channel>
</rss>
`;
  return respostaXml(xml);
}
