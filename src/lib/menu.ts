// Menu de navegação (cabeçalho, menu do celular e coluna "Navegação" do
// rodapé), editado no painel /admin em "Site → Menu" e guardado em
// data/site.json → menu: [{ rotulo, rotuloEn, link, visivel }], na ordem em
// que aparece. Esconder um item só o tira do menu: a página continua no ar.
//
// link: caminho do site ("/podcast", sem /en — nas páginas em inglês vira
// "/en/podcast") ou endereço externo completo ("https://...").
// Sem "menu" no site.json, vale o menu original (MENU_PADRAO).
import { z } from "astro/zod";
import { validar } from "./dados";
import { caminhoNoIdioma, t, type Lang } from "./i18n";
import sitePt from "../../data/site.json";

const esquema = z
  .array(
    z.object({
      rotulo: z.string().trim().min(1, "falta o nome do item"),
      rotuloEn: z.string().optional(),
      link: z.string().regex(/^(\/|https?:\/\/)/, 'link deve começar com "/" (página do site) ou "https://"'),
      visivel: z.boolean().default(true),
    })
  )
  .optional();

const MENU_PADRAO = [
  { link: "/noticias", chave: "nav.articles" },
  { link: "/estudos", chave: "nav.estudos" },
  { link: "/podcast", chave: "nav.podcast" },
  { link: "/sobre", chave: "nav.about" },
  { link: "/contato", chave: "nav.contact" },
].map(({ link, chave }) => ({ link, rotulo: t("pt", chave), rotuloEn: t("en", chave), visivel: true }));

const menu = validar("data/site.json (menu)", esquema, (sitePt as { menu?: unknown }).menu) ?? MENU_PADRAO;

export interface ItemMenu {
  href: string;
  texto: string;
  externo: boolean;
  /** Caminho sem /en, para marcar a seção atual (aria-current). */
  secao?: string;
}

export function itensDoMenu(lang: Lang): ItemMenu[] {
  return menu
    .filter((item) => item.visivel)
    .map((item) => {
      const externo = !item.link.startsWith("/");
      return {
        href: externo ? item.link : caminhoNoIdioma(item.link, lang),
        texto: lang === "en" && item.rotuloEn?.trim() ? item.rotuloEn.trim() : item.rotulo.trim(),
        externo,
        secao: externo ? undefined : item.link.replace(/\/+$/, "") || "/",
      };
    });
}
