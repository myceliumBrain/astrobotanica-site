// Menu de navegação (cabeçalho, menu do celular e rodapé), editado no painel
// /admin em "Site → Menu" e guardado em data/site.json → menu:
// [{ rotulo, rotuloEn, link, visivel, grupo }], na ordem em que aparece.
// Esconder um item só o tira do menu: a página continua no ar.
//
// grupo:
//   "conteudo"      → lista que abre ao clicar em "Conteúdo" no cabeçalho
//   "institucional" → lista que abre ao clicar em "Institucional" no
//                     cabeçalho; no rodapé, a coluna "Institucional"
//   "destaque"      → botão com borda no canto direito, ao lado das bandeiras
//   (sem grupo)     → link solto no cabeçalho
// Os grupos aparecem no cabeçalho na ordem do primeiro item de cada um.
//
// link: caminho do site ("/podcast", sem /en — nas páginas em inglês vira
// "/en/podcast") ou endereço externo completo ("https://...").
// Sem "menu" no site.json, vale o menu original (MENU_PADRAO).
import { z } from "astro/zod";
import { validar } from "./dados";
import { caminhoNoIdioma, t, type Lang } from "./i18n";
import sitePt from "../../data/site.json";

export const GRUPOS = ["conteudo", "institucional", "destaque"] as const;
export type Grupo = (typeof GRUPOS)[number];

const esquema = z
  .array(
    z.object({
      rotulo: z.string().trim().min(1, "falta o nome do item"),
      rotuloEn: z.string().optional(),
      link: z.string().regex(/^(\/|https?:\/\/)/, 'link deve começar com "/" (página do site) ou "https://"'),
      visivel: z.boolean().default(true),
      grupo: z.enum(GRUPOS).optional(),
    })
  )
  .optional();

const MENU_PADRAO = (
  [
    ["/noticias", "nav.articles", "conteudo"],
    ["/estudos", "nav.estudos", "conteudo"],
    ["/podcast", "nav.podcast", "conteudo"],
    ["/sobre", "nav.about", "institucional"],
    ["/expediente", "footer.expediente", "institucional"],
    ["/politica-editorial", "footer.editorialPolicy", "institucional"],
    ["/normas-para-colaboradores", "footer.contributorGuidelines", "institucional"],
    ["/privacidade", "footer.privacy", "institucional"],
    ["/politica-de-ia", "footer.aiPolicy", "institucional"],
    ["/contato", "nav.contact", "destaque"],
  ] as const
).map(([link, chave, grupo]) => ({ link, rotulo: t("pt", chave), rotuloEn: t("en", chave), visivel: true, grupo }));

const menu = validar("data/site.json (menu)", esquema, (sitePt as { menu?: unknown }).menu) ?? MENU_PADRAO;

export interface ItemMenu {
  href: string;
  texto: string;
  externo: boolean;
  /** Caminho sem /en, para marcar a seção atual (aria-current). */
  secao?: string;
  grupo?: Grupo;
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
        grupo: item.grupo,
      };
    });
}

export type BlocoDoMenu =
  | { tipo: "link"; item: ItemMenu }
  | { tipo: "grupo"; grupo: Grupo; texto: string; itens: ItemMenu[] };

const ROTULO_DO_GRUPO: Record<Exclude<Grupo, "destaque">, string> = {
  conteudo: "nav.content",
  institucional: "nav.institutional",
};

/** Cabeçalho: links soltos e listas de grupo, na ordem do menu; à parte, os
 * itens de destaque (canto direito). */
export function menuDoCabecalho(lang: Lang): { blocos: BlocoDoMenu[]; destaque: ItemMenu[] } {
  const blocos: BlocoDoMenu[] = [];
  const destaque: ItemMenu[] = [];
  for (const item of itensDoMenu(lang)) {
    if (item.grupo === "destaque") destaque.push(item);
    else if (!item.grupo) blocos.push({ tipo: "link", item });
    else {
      const bloco = blocos.find((b) => b.tipo === "grupo" && b.grupo === item.grupo);
      if (bloco && bloco.tipo === "grupo") bloco.itens.push(item);
      else blocos.push({ tipo: "grupo", grupo: item.grupo, texto: t(lang, ROTULO_DO_GRUPO[item.grupo]), itens: [item] });
    }
  }
  return { blocos, destaque };
}
