// Verbetes de estudo (data/estudos.json, editado pelo painel /admin) e suas
// categorias (data/categorias_estudo.json). Só os publicados ganham página.
import estudos from "../../data/estudos.json";
import categorias from "../../data/categorias_estudo.json";
import { semHtml } from "./noticias";

export interface Categoria {
  id: string;
  nome: string;
  slug: string;
  descricao?: string;
}

export interface Verbete {
  id: string;
  slug: string;
  titulo: string;
  categoriaId: string;
  definicaoCurta?: string;
  conteudo?: string;
  imagemCapa?: string;
  termosRelacionadosIds?: string[];
  fontes?: { text: string; url?: string }[];
  dataAtualizacao?: string;
  publicado?: boolean;
}

export const categoriasEstudo = categorias as Categoria[];

/** Publicados e com categoria existente (os outros não têm URL). */
export const verbetesPublicados: Verbete[] = (estudos as Verbete[]).filter(
  (v) => v.publicado && categoriasEstudo.some((c) => c.id === v.categoriaId)
);

export function categoriaDe(v: Verbete): Categoria {
  return categoriasEstudo.find((c) => c.id === v.categoriaId)!;
}

export function urlVerbete(v: Verbete): string {
  return `/estudos/${categoriaDe(v).slug}/${v.slug}/`;
}

// Igual a excerpt_for em scripts/generate_estudos_seo.py.
const RESUMO_MAX = 220;
export function resumoVerbete(v: Verbete): string {
  const texto = v.definicaoCurta || semHtml(v.conteudo ?? "");
  if (texto.length <= RESUMO_MAX) return texto;
  return texto.slice(0, RESUMO_MAX).replace(/\s+\S*$/, "") + "…";
}
