// Imagens das notícias (capa e pôster vertical) em WebP reduzido, geradas por
// src/pages/artigo/[id]/capa-[largura].webp.ts e vertical-[largura].webp.ts.
// Os originais continuam nos mesmos endereços em images/noticias/.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { noticiasDoIdioma, type Noticia } from "./noticias";

const LARGURAS = [640, 960, 1400];
const QUALIDADE = 78;

export type Variante = "capa" | "vertical";
const CAMPO = { capa: "image", vertical: "imageVertical" } as const;

/** Larguras geradas para uma imagem: as da lista menores que o original, mais
 * o próprio original (limitado à maior da lista). Vazio se o arquivo não
 * estiver no repositório. */
async function larguras(imagem: string): Promise<number[]> {
  const arquivo = path.join(process.cwd(), imagem);
  if (!fs.existsSync(arquivo)) return [];
  const original = Math.min((await sharp(arquivo).metadata()).width ?? 0, LARGURAS.at(-1)!);
  return [...LARGURAS.filter((l) => l < original), original];
}

/** srcset das versões reduzidas da imagem de uma notícia (as versões são da notícia PT, mesmo id). */
export async function srcsetImagem(id: string, imagem: string | undefined, variante: Variante): Promise<string | undefined> {
  if (!imagem) return undefined;
  const ls = await larguras(imagem);
  return ls.length ? ls.map((l) => `/artigo/${id}/${variante}-${l}.webp ${l}w`).join(", ") : undefined;
}

export async function rotasDeImagem(variante: Variante) {
  const rotas = [];
  for (const noticia of await noticiasDoIdioma("pt")) {
    const imagem = noticia.data[CAMPO[variante]];
    if (!imagem) continue;
    for (const largura of await larguras(imagem)) {
      rotas.push({ params: { id: noticia.data.id, largura: String(largura) }, props: { noticia, largura } });
    }
  }
  return rotas;
}

export async function respostaWebp(variante: Variante, { noticia, largura }: { noticia: Noticia; largura: number }) {
  const imagem = await sharp(path.join(process.cwd(), noticia.data[CAMPO[variante]]!))
    .resize({ width: largura })
    .webp({ quality: QUALIDADE })
    .toBuffer();
  return new Response(new Uint8Array(imagem), { headers: { "Content-Type": "image/webp" } });
}
