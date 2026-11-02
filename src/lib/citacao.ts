// Referência no formato ABNT (NBR 6023:2018) para uma notícia publicada no
// site, montada só com dados do front matter:
//
//   SOBRENOME, Prenome. Título. Astrobotânica, [S. l.], v. 1, n. 2,
//   25 out. 2026. Disponível em: https://... Acesso em: 1 nov. 2026.
//
// "Acesso em" depende de quando o leitor cita: sai com um marcador no HTML
// e é preenchido com a data do dia por JS (ver PaginaNoticia.astro).
import type { Lang } from "./i18n";

export const NOME_DO_SITE = "Astrobotânica";
// Local de publicação: desconhecido → "[S. l.]" (sine loco), como pede a norma.
export const LOCAL_PUBLICACAO = "[S. l.]";

const MESES: Record<Lang, string[]> = {
  pt: ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."],
  en: ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."],
};

const SUFIXOS = new Set(["filho", "filha", "júnior", "junior", "jr.", "neto", "neta", "sobrinho", "sobrinha"]);
const ARTIGOS = new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas", "the", "an"]);

export function dataAbnt(iso: string, lang: Lang): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return `${dia} ${MESES[lang][mes - 1]} ${ano}`;
}

// "Maria da Silva Souza Filho" → "SOUZA FILHO, Maria da Silva"
function autorAbnt(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].toLocaleUpperCase("pt-BR");
  const comSufixo = partes.length >= 3 && SUFIXOS.has(partes[partes.length - 1].toLocaleLowerCase("pt-BR"));
  const nSobrenome = comSufixo ? 2 : 1;
  const sobrenome = partes.slice(-nSobrenome).join(" ").toLocaleUpperCase("pt-BR");
  return `${sobrenome}, ${partes.slice(0, -nSobrenome).join(" ")}`;
}

// Sem autor, a entrada é pelo título: primeira palavra (e a seguinte, se a
// primeira for artigo) em maiúsculas.
function tituloComoEntrada(titulo: string): string {
  const palavras = titulo.split(" ");
  const n = palavras.length > 1 && ARTIGOS.has(palavras[0].toLocaleLowerCase("pt-BR")) ? 2 : 1;
  return [...palavras.slice(0, n).map((p) => p.toLocaleUpperCase("pt-BR")), ...palavras.slice(n)].join(" ");
}

export interface DadosCitacao {
  autor: string; // vários autores separados por ";"
  titulo: string;
  data: string; // AAAA-MM-DD
  url: string;
  volume?: string;
  numero?: string;
}

export interface Citacao {
  /** Até o nome do site (vai em negrito). */
  antes: string;
  site: string;
  /** Do local até "Disponível em: <url>." */
  depois: string;
  /** Rótulo de "Acesso em:" (a data é preenchida no navegador). */
  acessoRotulo: string;
}

export function citacaoAbnt(d: DadosCitacao, lang: Lang): Citacao {
  const autores = d.autor
    .split(";")
    .map((a) => a.trim())
    .filter(Boolean);
  // Título que já termina em "?"/"!" não ganha ponto; um "." final não duplica.
  const titulo = d.titulo.trim().replace(/\.$/, "");
  const fimTitulo = /[?!]$/.test(titulo) ? " " : ". ";
  const antes = autores.length
    ? `${autores.map(autorAbnt).join("; ")}. ${titulo}${fimTitulo}`
    : `${tituloComoEntrada(titulo)}${fimTitulo}`;
  const partes = [LOCAL_PUBLICACAO];
  if (d.volume) partes.push(`v. ${d.volume}`);
  if (d.numero) partes.push(`n. ${d.numero}`);
  partes.push(dataAbnt(d.data, lang));
  const disponivel = lang === "en" ? "Available at:" : "Disponível em:";
  return {
    antes,
    site: NOME_DO_SITE,
    depois: `, ${partes.join(", ")}. ${disponivel} ${d.url}.`,
    acessoRotulo: lang === "en" ? "Accessed:" : "Acesso em:",
  };
}

// ORCID e Lattes podem vir como identificador ou como URL completa.
export function urlOrcid(valor: string): { url: string; id: string } {
  const id = valor.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "").replace(/\/$/, "");
  return { url: `https://orcid.org/${id}`, id };
}

export function urlLattes(valor: string): string {
  const v = valor.trim();
  return /^https?:\/\//i.test(v) ? v : `http://lattes.cnpq.br/${v}`;
}

export function doiNormalizado(valor: string): { url: string; doi: string } {
  const doi = valor
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  return { url: `https://doi.org/${doi}`, doi };
}
