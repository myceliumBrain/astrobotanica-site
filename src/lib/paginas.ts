import { getCollection, type CollectionEntry } from "astro:content";

export type Pagina = CollectionEntry<"paginas">;

/** Página institucional em src/content/paginas/<lang>/<slug>.md, ou
 * undefined se ainda não existe (sem o aviso que getEntry dá nesse caso:
 * a ausência da versão EN é esperada e decide hreflang e página provisória). */
export async function paginaInstitucional(lang: string, slug: string): Promise<Pagina | undefined> {
  return (await getCollection("paginas")).find((p) => p.id === `${lang}/${slug}`);
}

// Páginas criadas pelo painel (um item novo no menu, ex.: "/projetos"):
// todo .md de src/content/paginas cujo slug não tem um arquivo próprio em
// src/pages vira /<slug> (e /en/<slug>) por src/pages/[pagina].astro.
const ROTAS_PROPRIAS = new Set(
  Object.keys(import.meta.glob("../pages/*.astro")).map((arquivo) => arquivo.replace(/^.*\/|\.astro$/g, ""))
);

/** Slugs das páginas sem arquivo próprio em src/pages, em ordem alfabética. */
export async function slugsDePaginasNovas(): Promise<string[]> {
  const slugs = (await getCollection("paginas")).map((p) => p.id.split("/")[1]);
  return [...new Set(slugs)].filter((slug) => !ROTAS_PROPRIAS.has(slug) && !slug.startsWith("[")).sort();
}
