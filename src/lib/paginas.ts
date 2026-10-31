import { getCollection, type CollectionEntry } from "astro:content";

export type Pagina = CollectionEntry<"paginas">;

/** Página institucional em src/content/paginas/<lang>/<slug>.md, ou
 * undefined se ainda não existe (sem o aviso que getEntry dá nesse caso:
 * a ausência da versão EN é esperada e decide hreflang e página provisória). */
export async function paginaInstitucional(lang: string, slug: string): Promise<Pagina | undefined> {
  return (await getCollection("paginas")).find((p) => p.id === `${lang}/${slug}`);
}
