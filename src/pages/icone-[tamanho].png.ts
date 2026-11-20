// /icone-32.png e /icone-180.png — ícone do site (aba do navegador e tela
// inicial do celular) nos tamanhos certos, gerados a partir da imagem que o
// painel guarda em data/site.json → brand.icon (Rodapé e marca → Marca).
// Sem ícone escolhido, nada é gerado e o site usa o padrão de public/
// (favicon.svg, favicon-32.png, apple-touch-icon.png). Ver iconeDoSite em
// src/lib/icone.ts.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { iconeDoSite } from "../lib/icone";

export function getStaticPaths() {
  if (!iconeDoSite()) return [];
  return [{ params: { tamanho: "32" } }, { params: { tamanho: "180" } }];
}

export async function GET({ params }: { params: { tamanho: string } }) {
  const icone = iconeDoSite()!;
  const n = Number(params.tamanho);
  const arquivo = path.join(process.cwd(), icone);
  if (!fs.existsSync(arquivo)) throw new Error(`ícone do site não encontrado: ${icone} (data/site.json → brand.icon)`);
  let imagem = sharp(fs.readFileSync(arquivo), { density: 300 }).resize(n, n, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  // O iPhone pinta de preto o fundo transparente do ícone da tela inicial.
  if (n === 180) imagem = imagem.flatten({ background: "#ffffff" });
  const png = await imagem.png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}
