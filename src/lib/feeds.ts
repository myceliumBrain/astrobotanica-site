// Utilidades comuns aos arquivos de máquina (rss.xml, podcast.xml,
// sitemap.xml), no mesmo formato que os scripts Python antigos geravam
// (scripts/generate_seo.py, generate_podcast_feed.py, generate_sitemap.py).
import fs from "node:fs";
import path from "node:path";
import sitePt from "../../data/site.json";

export const BASE_URL = "https://astrobotanica.com.br";

// Igual a generate_seo.py: brand.name com a primeira letra maiúscula
// ("astrobotanica" → "Astrobotanica").
const nomeCru = sitePt.brand?.name || "Astrobotânica";
export const NOME_MARCA = nomeCru.charAt(0).toUpperCase() + nomeCru.slice(1);

// xml.sax.saxutils.escape: só &, < e >.
export function xmlEscape(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function urlAbsoluta(caminho: string): string {
  return `${BASE_URL}/${caminho.replace(/^\/+/, "")}`;
}

const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dois = (n: number) => String(n).padStart(2, "0");

/** Data no formato RFC 822 de email.utils.format_datetime(), com o fuso dado em minutos. */
function rfc822(utc: Date, fusoMin: number): string {
  const d = new Date(utc.getTime() + fusoMin * 60_000);
  const sinal = fusoMin < 0 ? "-" : "+";
  const abs = Math.abs(fusoMin);
  return (
    `${DIAS[d.getUTCDay()]}, ${dois(d.getUTCDate())} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}:${dois(d.getUTCSeconds())} ` +
    `${sinal}${dois(Math.floor(abs / 60))}${dois(abs % 60)}`
  );
}

/** date "AAAA-MM-DD" + time "HH:MM" (horário de Brasília, -03:00); sem time, meia-noite UTC — como os scripts antigos. */
export function dataPublicacao(data: string, hora?: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  if (hora) {
    const [h, m] = hora.split(":").map(Number);
    return rfc822(new Date(Date.UTC(ano, mes - 1, dia, h + 3, m)), -180);
  }
  return rfc822(new Date(Date.UTC(ano, mes - 1, dia)), 0);
}

export function agoraRfc822(): string {
  const agora = new Date();
  agora.setUTCMilliseconds(0);
  return rfc822(agora, 0);
}

export function tipoImagem(caminho: string): string {
  const ext = caminho.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

// Tamanho em bytes de um arquivo do repositório (o build roda na raiz do
// projeto), para o atributo length do <enclosure>.
export function tamanhoArquivo(caminho: string): number {
  return fs.statSync(path.join(process.cwd(), caminho), { throwIfNoEntry: false })?.size ?? 0;
}

export function respostaXml(xml: string): Response {
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
