// Textos fixos do site, aplicados no build. A fonte continua sendo
// data/site.json (pt, editado pelo painel /admin) e data/site.en.json (en,
// editado à mão). TEXTOS_NOVOS cobre só chaves que ainda não existem nesses
// arquivos (rodapé institucional, páginas provisórias); se a chave passar a
// existir no JSON, o valor do JSON vale.
import sitePt from "../../data/site.json";
import siteEn from "../../data/site.en.json";

export type Lang = "pt" | "en";
export const LANGS: Lang[] = ["pt", "en"];

type Dicionario = Record<string, unknown>;

const TEXTOS_NOVOS: Record<Lang, Dicionario> = {
  pt: {
    footer: {
      institutionalHeading: "Institucional",
      expediente: "Expediente",
      editorialPolicy: "Política Editorial",
      contributorGuidelines: "Normas para Colaboradores",
      privacy: "Privacidade",
      licensePrefix: "Conteúdo licenciado sob",
    },
    provisorio: {
      aviso: "Página provisória — conteúdo em preparação.",
    },
  },
  en: {
    footer: {
      institutionalHeading: "Institutional",
      expediente: "Masthead",
      editorialPolicy: "Editorial Policy",
      contributorGuidelines: "Contributor Guidelines",
      privacy: "Privacy",
      licensePrefix: "Content licensed under",
    },
    provisorio: {
      aviso: "Provisional page — content in preparation.",
    },
  },
};

function mesclar(base: Dicionario, porCima: Dicionario): Dicionario {
  const out: Dicionario = { ...base };
  for (const [k, v] of Object.entries(porCima)) {
    const atual = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && atual && typeof atual === "object" && !Array.isArray(atual)
        ? mesclar(atual as Dicionario, v as Dicionario)
        : v;
  }
  return out;
}

// en cai para pt chave a chave (como o fallbackLng do i18next fazia).
const DICIONARIOS: Record<Lang, Dicionario> = (() => {
  const pt = mesclar(TEXTOS_NOVOS.pt, sitePt as Dicionario);
  const en = mesclar(pt, mesclar(TEXTOS_NOVOS.en, siteEn as Dicionario));
  return { pt, en };
})();

function porCaminho(obj: unknown, caminho: string): unknown {
  return caminho
    .split(".")
    .reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Dicionario)[k] : undefined), obj);
}

export function t(lang: Lang, chave: string, vars?: Record<string, string | number>): string {
  const valor = porCaminho(DICIONARIOS[lang], chave);
  if (typeof valor !== "string") return "";
  if (!vars) return valor;
  return valor.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ""));
}

export function valor<T>(lang: Lang, chave: string): T | undefined {
  return porCaminho(DICIONARIOS[lang], chave) as T | undefined;
}

// "/sobre" → "/en/sobre" e vice-versa. Mesmos caminhos nos dois idiomas.
export function caminhoNoIdioma(caminho: string, lang: Lang): string {
  const semPrefixo = caminho.replace(/^\/en(?=\/|$)/, "") || "/";
  if (lang === "pt") return semPrefixo;
  return semPrefixo === "/" ? "/en/" : `/en${semPrefixo}`;
}
