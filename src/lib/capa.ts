// Capa das notícias em tamanhos reduzidos, gerados por
// src/pages/artigo/[id]/capa-[largura].webp.ts.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const LARGURAS = [640, 960, 1400];

/** Larguras geradas para uma capa: as da lista menores que o original, mais
 * o próprio original (limitado à maior da lista). Vazio se o arquivo não
 * estiver no repositório. */
export async function largurasCapa(imagem: string): Promise<number[]> {
  const arquivo = path.join(process.cwd(), imagem);
  if (!fs.existsSync(arquivo)) return [];
  const original = Math.min((await sharp(arquivo).metadata()).width ?? 0, LARGURAS.at(-1)!);
  return [...LARGURAS.filter((l) => l < original), original];
}

export async function srcsetCapa(id: string, imagem: string): Promise<string | undefined> {
  const larguras = await largurasCapa(imagem);
  return larguras.length ? larguras.map((l) => `/artigo/${id}/capa-${l}.webp ${l}w`).join(", ") : undefined;
}
