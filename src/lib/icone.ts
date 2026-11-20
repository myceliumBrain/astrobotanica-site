// Ícone do site escolhido no painel (Rodapé e marca → Marca), guardado em
// data/site.json → brand.icon como caminho a partir da raiz do repositório
// (ex.: "images/marca/icone-20261120-101500.png"). Um só para os dois
// idiomas. Vazio = ícone padrão de public/.
import { t } from "./i18n";

export function iconeDoSite(): string {
  const icone = t("pt", "brand.icon").trim().replace(/^\/+/, "");
  return /^images\/[\w./-]+\.(png|svg|jpe?g|webp)$/i.test(icone) && !icone.includes("..") ? icone : "";
}

/** Links do ícone no <head>. `?v=` muda a cada troca (o nome do arquivo
 * muda), para o navegador não ficar com o ícone antigo em cache. */
export function linksDoIcone(): { rel: string; href: string; type?: string; sizes?: string }[] {
  const icone = iconeDoSite();
  if (!icone) {
    return [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ];
  }
  const v = encodeURIComponent(icone.split("/").pop()!);
  const links: { rel: string; href: string; type?: string; sizes?: string }[] = [];
  if (/\.svg$/i.test(icone)) links.push({ rel: "icon", href: `/${icone}`, type: "image/svg+xml" });
  links.push({ rel: "icon", href: `/icone-32.png?v=${v}`, type: "image/png", sizes: "32x32" });
  links.push({ rel: "apple-touch-icon", href: `/icone-180.png?v=${v}` });
  return links;
}
