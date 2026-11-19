// Páginas institucionais: listadas na página /institucional (caixas
// clicáveis, item "Institucional" do menu) e na coluna "Institucional" do
// rodapé, nesta ordem.
import { caminhoNoIdioma, t, type Lang } from "./i18n";

const PAGINAS = [
  { slug: "sobre", chave: "nav.about" },
  { slug: "expediente", chave: "footer.expediente" },
  { slug: "politica-editorial", chave: "footer.editorialPolicy" },
  { slug: "normas-para-colaboradores", chave: "footer.contributorGuidelines" },
  { slug: "privacidade", chave: "footer.privacy" },
  { slug: "politica-de-ia", chave: "footer.aiPolicy" },
];

export const SECAO_INSTITUCIONAL = "/institucional";

export function paginasInstitucionais(lang: Lang) {
  return PAGINAS.map(({ slug, chave }) => ({
    slug,
    href: caminhoNoIdioma(`/${slug}`, lang),
    texto: t(lang, chave),
    descricao: t(lang, `institucional.descricoes.${slug}`),
  }));
}

export function ehPaginaInstitucional(slug: string): boolean {
  return PAGINAS.some((p) => p.slug === slug);
}
