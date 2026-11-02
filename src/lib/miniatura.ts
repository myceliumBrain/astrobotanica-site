// Fotos de integrantes em miniatura quadrada (WebP), geradas por
// src/pages/miniaturas/integrantes/[nome].webp.ts. O original continua no
// mesmo endereço em images/integrantes/.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PASTA = "images/integrantes";
// 2× o maior tamanho em que a foto aparece (6rem na página Sobre).
const LADO = 192;
const QUALIDADE = 80;

const nomeDe = (arquivo: string) => path.basename(arquivo, path.extname(arquivo));

/** Endereço da miniatura de uma foto de images/integrantes/, ou o próprio
 * caminho original se a foto estiver em outro lugar ou não existir. */
export function miniatura(imagem: string): string {
  const arquivo = path.join(process.cwd(), imagem);
  if (path.dirname(imagem) !== PASTA || !fs.existsSync(arquivo)) return `/${imagem}`;
  return `/miniaturas/integrantes/${nomeDe(imagem)}.webp`;
}

export function rotasDeMiniatura() {
  return fs
    .readdirSync(path.join(process.cwd(), PASTA))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => ({ params: { nome: nomeDe(f) }, props: { arquivo: path.join(PASTA, f) } }));
}

export async function respostaMiniatura({ arquivo }: { arquivo: string }) {
  const imagem = await sharp(path.join(process.cwd(), arquivo))
    .rotate()
    .resize(LADO, LADO, { fit: "cover" })
    .webp({ quality: QUALIDADE })
    .toBuffer();
  return new Response(new Uint8Array(imagem), { headers: { "Content-Type": "image/webp" } });
}
