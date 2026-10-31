// Dados estruturados (JSON-LD, schema.org) e imagem padrão do Open Graph.
// A Organization vai em todas as páginas (Base.astro); as páginas de item
// acrescentam o seu nó (NewsArticle etc.) ao mesmo @graph.
import { valor } from "./i18n";
import { doiNormalizado, urlLattes, urlOrcid } from "./citacao";
import type { Noticia } from "./noticias";
import { BASE_URL } from "./feeds";
import sitePt from "../../data/site.json";

export const NOME_SITE = "Astrobotânica";
export const ID_ORGANIZACAO = `${BASE_URL}/#organizacao`;

/** Imagem dos previews quando a página não tem uma própria (gerada em src/pages/og-image.jpg.ts). */
export const OG_IMAGEM_PADRAO = `${BASE_URL}/og-image.jpg`;

// Links das redes cadastrados no painel que são só o domínio
// ("www.youtube.com") não identificam um perfil: ficam fora do sameAs.
function perfisDasRedes(): string[] {
  const redes = valor<{ label: string; url: string }[]>("pt", "socialLinks") ?? [];
  return redes
    .map((r) => (r.url ?? "").trim())
    .filter(Boolean)
    .map((url) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`))
    .filter((url) => {
      try {
        return new URL(url).pathname.replace(/\/+$/, "") !== "";
      } catch {
        return false;
      }
    });
}

export function organizacao(): Record<string, unknown> {
  const perfis = perfisDasRedes();
  const email = sitePt.contato?.email;
  return {
    "@type": "Organization",
    "@id": ID_ORGANIZACAO,
    name: NOME_SITE,
    url: `${BASE_URL}/`,
    description: sitePt.brand?.footerTagline,
    ...(email ? { email } : {}),
    ...(perfis.length ? { sameAs: perfis } : {}),
  };
}

/** "2026-07-24" + "18:09" → "2026-07-24T18:09:00-03:00" (horário de Brasília). */
export function dataIso(data: string, hora?: string): string {
  return hora ? `${data}T${hora}:00-03:00` : data;
}

function autor(n: Noticia["data"]): Record<string, unknown> {
  if (!n.author) return { "@id": ID_ORGANIZACAO };
  const perfis = [n.orcid ? urlOrcid(n.orcid).url : "", n.lattes ? urlLattes(n.lattes) : ""].filter(Boolean);
  return {
    "@type": "Person",
    name: n.author,
    ...(perfis.length ? { url: perfis[0], sameAs: perfis } : {}),
  };
}

// Fonte citada: o campo editorial "fonte" (quando preenchido) e as
// referências que a notícia já lista.
function citacoes(n: Noticia["data"]): Record<string, unknown>[] {
  const lista: Record<string, unknown>[] = [];
  if (n.fonte.citacao || n.fonte.url || n.fonte.doi) {
    const doi = n.fonte.doi ? doiNormalizado(n.fonte.doi) : undefined;
    lista.push({
      "@type": "ScholarlyArticle",
      ...(n.fonte.citacao ? { name: n.fonte.citacao } : {}),
      ...(n.fonte.url || doi ? { url: n.fonte.url || doi!.url } : {}),
      ...(doi ? { identifier: { "@type": "PropertyValue", propertyID: "DOI", value: doi.doi } } : {}),
    });
  }
  for (const ref of n.references ?? []) {
    if (!ref.text && !ref.url) continue;
    lista.push({ "@type": "CreativeWork", ...(ref.text ? { name: ref.text } : {}), ...(ref.url ? { url: ref.url } : {}) });
  }
  return lista;
}

interface OpcoesNoticia {
  url: string;
  descricao: string;
  imagem?: string;
  /** URL da versão em português, nas páginas em inglês. */
  urlOriginal?: string;
}

export function noticiaJsonLd(noticia: Noticia, o: OpcoesNoticia): Record<string, unknown> {
  const n = noticia.data;
  const publicado = dataIso(n.date, n.time);
  const refs = citacoes(n);
  return {
    "@type": "NewsArticle",
    "@id": `${o.url}#noticia`,
    headline: n.title,
    description: o.descricao,
    ...(o.imagem ? { image: [o.imagem] } : {}),
    datePublished: publicado,
    dateModified: n.updated || publicado,
    author: [autor(n)],
    publisher: { "@id": ID_ORGANIZACAO },
    mainEntityOfPage: { "@type": "WebPage", "@id": o.url },
    url: o.url,
    inLanguage: n.lang === "en" ? "en" : "pt-BR",
    ...(n.category ? { articleSection: n.category } : {}),
    ...(n.tags.length ? { keywords: n.tags.join(", ") } : {}),
    isAccessibleForFree: true,
    license: "https://creativecommons.org/licenses/by/4.0/",
    ...(refs.length ? { citation: refs } : {}),
    ...(o.urlOriginal ? { translationOfWork: { "@id": `${o.urlOriginal}#noticia` } } : {}),
  };
}

/** JSON para dentro de <script type="application/ld+json">, sem permitir fechar a tag. */
export function jsonLdSeguro(grafo: Record<string, unknown>[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": grafo }).replace(/</g, "\\u003c");
}
