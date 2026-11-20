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
  /** Categoria usada no filtro. Em EN, uma notícia sem tradução entra na
   * categoria traduzida (ex.: "Space Agriculture") se outra notícia já
   * traduziu a mesma categoria; senão fica com o nome em português. */
  categoria: string;
}

/** Notícias na ordem do site. Em EN: a tradução quando existe; senão a versão PT. */
export async function noticiasDaLista(lang: Lang): Promise<ItemNoticia[]> {
  const pt = await noticiasDoIdioma("pt");
  const traducoes = lang === "en" ? new Map((await noticiasDoIdioma("en")).map((n) => [n.data.id, n])) : new Map();
  // Categoria PT → EN, a partir das notícias já traduzidas.
  const categoriaEn = new Map<string, string>();
  for (const n of pt) {
    const en = traducoes.get(n.data.id)?.data.category?.trim();
    const ptCat = n.data.category?.trim();
    if (en && ptCat && !categoriaEn.has(ptCat)) categoriaEn.set(ptCat, en);
  }
  return pt.map((n) => {
    const traducao = traducoes.get(n.data.id);
    const ptCat = (n.data.category ?? "").trim();
    return {
      categoria: traducao ? (traducao.data.category ?? "").trim() : lang === "en" ? categoriaEn.get(ptCat) ?? ptCat : ptCat,
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

/** Categoria como identificador ("Agricultura Espacial" → "agricultura-espacial"),
 * usado no filtro por categoria (data-categoria e ?categoria= no endereço). */
export function slugCategoria(categoria: string | undefined): string {
  return (categoria ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Categorias das notícias de uma lista, sem repetir, em ordem alfabética:
 * vêm das próprias notícias, então uma categoria nova criada no painel
 * entra no filtro sozinha. */
export function categoriasDaLista(itens: ItemNoticia[]): { nome: string; slug: string }[] {
  const porSlug = new Map<string, string>();
  for (const item of itens) {
    const nome = item.categoria;
    const slug = slugCategoria(nome);
    if (slug && !porSlug.has(slug)) porSlug.set(slug, nome);
  }
  return [...porSlug].map(([slug, nome]) => ({ nome, slug })).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}
