// Verbetes de estudo (data/estudos.json, editado pelo painel /admin) e suas
// categorias (data/categorias_estudo.json). Só os publicados ganham página.
// Versão em inglês: tituloEn, definicaoCurtaEn e conteudoEn no verbete;
// nomeEn e descricaoEn na categoria. Só o verbete com tituloEn ganha página
// em /en/estudos/<categoria>/<verbete>/ (mesmos slugs nos dois idiomas).
import { z } from "astro/zod";
import estudos from "../../data/estudos.json";
import categorias from "../../data/categorias_estudo.json";
import { semHtml } from "./noticias";
import { dataIso, validar } from "./dados";
import { caminhoNoIdioma, type Lang } from "./i18n";

const esquemaCategorias = z.array(
  z.object({
    id: z.string().min(1),
    // Vazios numa categoria recém-criada no painel.
    nome: z.string(),
    slug: z.string(),
    descricao: z.string().optional(),
    nomeEn: z.string().optional(),
    descricaoEn: z.string().optional(),
  })
);

const esquemaVerbetes = z.array(
  z.object({
    id: z.string().min(1),
    // Vazios num rascunho do painel; sem eles o verbete não é publicado.
    slug: z.string(),
    titulo: z.string(),
    categoriaId: z.string(),
    definicaoCurta: z.string().optional(),
    conteudo: z.string().optional(),
    imagemCapa: z.string().optional(),
    termosRelacionadosIds: z.array(z.string()).optional(),
    fontes: z.array(z.object({ text: z.string(), url: z.string().optional() })).optional(),
    dataAtualizacao: z.union([z.literal(""), dataIso]).optional(),
    publicado: z.boolean().optional(),
    tituloEn: z.string().optional(),
    definicaoCurtaEn: z.string().optional(),
    conteudoEn: z.string().optional(),
  })
);

export type Categoria = z.infer<typeof esquemaCategorias>[number];
export type Verbete = z.infer<typeof esquemaVerbetes>[number];

export const categoriasEstudo: Categoria[] = validar("data/categorias_estudo.json", esquemaCategorias, categorias);

/** Publicados, com título, slug e categoria com slug (os outros não têm URL). */
export const verbetesPublicados: Verbete[] = validar("data/estudos.json", esquemaVerbetes, estudos).filter(
  (v) => v.publicado && v.titulo.trim() && v.slug.trim() && categoriasEstudo.some((c) => c.id === v.categoriaId && c.slug.trim())
);

export function categoriaDe(v: Verbete): Categoria {
  return categoriasEstudo.find((c) => c.id === v.categoriaId)!;
}

/** Nome da categoria no idioma; sem nomeEn, o nome em português. */
export function nomeCategoria(c: Categoria, lang: Lang): string {
  return (lang === "en" && c.nomeEn?.trim()) || c.nome;
}

export function temTraducao(v: Verbete): boolean {
  return Boolean(v.tituloEn?.trim());
}

/** Textos do verbete no idioma pedido. Em EN, sem tradução, `soPortugues`
 * é true e os textos são os em português (para as listas, com selo). Numa
 * página EN, definição e corpo só aparecem se traduzidos. */
export function verbeteNoIdioma(v: Verbete, lang: Lang) {
  const traduzido = lang === "en" && temTraducao(v);
  return {
    titulo: traduzido ? v.tituloEn! : v.titulo,
    definicaoCurta: traduzido ? v.definicaoCurtaEn : v.definicaoCurta,
    conteudo: (traduzido ? v.conteudoEn : v.conteudo) ?? "",
    href: urlVerbete(v, traduzido ? "en" : "pt"),
    soPortugues: lang === "en" && !traduzido,
  };
}

export function urlVerbete(v: Verbete, lang: Lang = "pt"): string {
  return caminhoNoIdioma(`/estudos/${categoriaDe(v).slug}/${v.slug}/`, lang);
}

// Igual a excerpt_for em scripts/generate_estudos_seo.py.
const RESUMO_MAX = 220;
export function resumoVerbete(v: Verbete, lang: Lang = "pt"): string {
  const { definicaoCurta, conteudo } = verbeteNoIdioma(v, lang);
  const texto = definicaoCurta || semHtml(conteudo);
  if (texto.length <= RESUMO_MAX) return texto;
  return texto.slice(0, RESUMO_MAX).replace(/\s+\S*$/, "") + "…";
}
