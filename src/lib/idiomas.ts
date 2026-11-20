// Idiomas do seletor (cabeçalho e menu do celular). A bandeira de cada um é
// escolhida no painel (Site → Menu → Idiomas) e guardada em data/site.json →
// idiomas.<lang>.bandeira, como caminho a partir da raiz do repositório
// ("images/idiomas/..."). Sem imagem, vale a bandeira em emoji de sempre.
import { t, type Lang } from "./i18n";

export interface Idioma {
  lang: Lang;
  hreflang: string;
  nome: string;
  emoji: string;
  /** Caminho da imagem a partir da raiz ("/images/..."), ou "" (usa o emoji). */
  bandeira: string;
}

const BASE: Omit<Idioma, "bandeira">[] = [
  { lang: "pt", hreflang: "pt-BR", nome: "Português", emoji: "🇧🇷" },
  { lang: "en", hreflang: "en", nome: "English", emoji: "🇺🇸" },
];

function bandeiraDe(lang: Lang): string {
  const caminho = t("pt", `idiomas.${lang}.bandeira`).trim().replace(/^\/+/, "");
  return /^images\/[\w./-]+\.(png|svg|jpe?g|webp)$/i.test(caminho) && !caminho.includes("..") ? `/${caminho}` : "";
}

export function idiomasDoSite(): Idioma[] {
  return BASE.map((i) => ({ ...i, bandeira: bandeiraDe(i.lang) }));
}
