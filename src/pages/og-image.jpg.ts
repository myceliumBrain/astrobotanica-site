// /og-image.jpg — imagem padrão dos previews (Open Graph/Twitter) para páginas
// sem imagem própria: um cartão 1200×630 com o nome e o slogan do site, nas
// cores de css/style.css. Provisório até existir uma arte oficial; para
// trocar, basta substituir este endpoint por um arquivo de mesmo nome.
import sharp from "sharp";
import { t } from "../lib/i18n";

const LARGURA = 1200;
const ALTURA = 630;
const FUNDO = "#395a43"; // --accent-800
const TEXTO = "#ffffff";
const TEXTO_SUAVE = "#e6f1e9"; // --accent-100
const DETALHE = "#7fad8b"; // --accent

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// SVG não quebra linha sozinho.
function quebrar(texto: string, max: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    if (atual && (atual + " " + palavra).length > max) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = atual ? `${atual} ${palavra}` : palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function GET() {
  const slogan = quebrar(t("pt", "brand.footerTagline"), 46);
  const fonte = "'Barlow Condensed', 'DejaVu Sans Condensed', 'Liberation Sans Narrow', 'Arial Narrow', sans-serif";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
  <rect width="100%" height="100%" fill="${FUNDO}"/>
  <rect x="80" y="250" width="96" height="8" fill="${DETALHE}"/>
  <text x="80" y="220" font-family="${fonte}" font-size="92" font-weight="700" fill="${TEXTO}" letter-spacing="2">ASTROBOTÂNICA</text>
  ${slogan
    .map((linha, i) => `<text x="80" y="${330 + i * 54}" font-family="${fonte}" font-size="42" fill="${TEXTO_SUAVE}">${escapar(linha)}</text>`)
    .join("\n  ")}
  <text x="80" y="560" font-family="${fonte}" font-size="30" fill="${DETALHE}" letter-spacing="1">astrobotanica.com.br</text>
</svg>`;
  const imagem = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  return new Response(new Uint8Array(imagem), { headers: { "Content-Type": "image/jpeg" } });
}
