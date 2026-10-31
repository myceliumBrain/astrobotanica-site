import { getCollection, type CollectionEntry } from "astro:content";
import type { Lang } from "./i18n";

export type Noticia = CollectionEntry<"noticias">;

// Na ordem do site (campo "ordem" = posição no antigo data/articles.json),
// não por data — o painel permite reordenar.
export async function noticiasDoIdioma(lang: Lang): Promise<Noticia[]> {
  const todas = await getCollection("noticias", (n: Noticia) => n.data.lang === lang);
  return todas.sort((a: Noticia, b: Noticia) => a.data.ordem - b.data.ordem);
}

export async function idsTraduzidos(): Promise<Set<string>> {
  return new Set((await noticiasDoIdioma("en")).map((n) => n.data.id));
}

// O corpo é o HTML original, guardado como está depois do front matter.
// Renderizado cru (set:html), sem passar pelo processador de Markdown.
export function corpoHtml(n: Noticia): string {
  return (n.body ?? "").replace(/\n$/, "");
}

// Mesmo resumo usado por scripts/generate_seo.py (meta description, RSS):
// subtítulo ou início do corpo sem tags, cortado em 220 caracteres.
const RESUMO_MAX = 220;

function semHtml(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function resumo(n: Noticia): string {
  if (n.data.description) return n.data.description;
  const texto = n.data.subtitle || semHtml(corpoHtml(n));
  if (texto.length <= RESUMO_MAX) return texto;
  return texto.slice(0, RESUMO_MAX).replace(/\s+\S*$/, "") + "…";
}

export function formatarData(iso: string, lang: Lang): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, dia)));
}
