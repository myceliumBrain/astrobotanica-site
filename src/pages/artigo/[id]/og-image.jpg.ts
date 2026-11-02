// /artigo/<id>/og-image.jpg — imagem dos previews em redes sociais, no mesmo
// caminho e com os mesmos parâmetros de scripts/generate_seo.py: a capa
// reduzida a no máximo 1200px de largura, JPEG qualidade 82. (WhatsApp e
// afins desistem do preview se a imagem for pesada demais.)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { noticiasDoIdioma, type Noticia } from "../../../lib/noticias";

const LARGURA_MAX = 1200;
const QUALIDADE = 82;

export async function getStaticPaths() {
  return (await noticiasDoIdioma("pt"))
    .filter((n) => n.data.image && fs.existsSync(path.join(process.cwd(), n.data.image)))
    .map((noticia) => ({ params: { id: noticia.data.id }, props: { noticia } }));
}

export async function GET({ props }: { props: { noticia: Noticia } }) {
  const imagem = await sharp(path.join(process.cwd(), props.noticia.data.image!))
    .flatten({ background: "#ffffff" })
    .resize({ width: LARGURA_MAX, withoutEnlargement: true })
    .jpeg({ quality: QUALIDADE, optimiseCoding: true })
    .toBuffer();
  return new Response(new Uint8Array(imagem), { headers: { "Content-Type": "image/jpeg" } });
}
