// Listas das páginas de seção (início, notícias, podcast), na mesma ordem e
// com a mesma seleção que dist/main.js fazia no navegador.
import { noticiasDoIdioma, type Noticia } from "./noticias";
import type { Lang } from "./i18n";

export interface ItemNoticia {
  noticia: Noticia;
  href: string;
  /** Lista EN: notícia ainda sem tradução, mostrada em PT com selo e link para a página PT. */
  soPortugues: boolean;
  /** Destaque marcado no painel (vale o da versão PT). */
  destaque: boolean;
}

/** Notícias na ordem do site. Em EN: a tradução quando existe; senão a versão PT. */
export async function noticiasDaLista(lang: Lang): Promise<ItemNoticia[]> {
  const pt = await noticiasDoIdioma("pt");
  const traducoes = lang === "en" ? new Map((await noticiasDoIdioma("en")).map((n) => [n.data.id, n])) : new Map();
  return pt.map((n) => {
    const traducao = traducoes.get(n.data.id);
    return {
      noticia: traducao ?? n,
      href: traducao ? `/en/artigo/${n.data.id}/` : `/artigo/${n.data.id}/`,
      soPortugues: lang === "en" && !traducao,
      destaque: Boolean(n.data.featured),
    };
  });
}

// Mesma regra de selectHomeItems: primeiro todos os destacados (até max),
// completando com os demais na ordem; o resultado mantém a ordem original.
export function selecionarDestaques<T>(itens: T[], max: number, destacado: (item: T) => boolean): T[] {
  const destacados = itens.filter(destacado);
  const resto = itens.filter((i) => !destacado(i));
  const escolhidos = new Set([...destacados.slice(0, max), ...resto.slice(0, Math.max(0, max - destacados.length))]);
  return itens.filter((i) => escolhidos.has(i));
}

export const pad = (n: number) => n.toString().padStart(2, "0");
