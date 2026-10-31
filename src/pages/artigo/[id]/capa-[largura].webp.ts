// /artigo/<id>/capa-<largura>.webp — capa da notícia reduzida para a página
// (o original em images/noticias/ continua no mesmo endereço). A página usa
// srcset para o navegador escolher a largura.
import path from "node:path";
import sharp from "sharp";
import { noticiasDoIdioma, type Noticia } from "../../../lib/noticias";
import { largurasCapa } from "../../../lib/capa";

const QUALIDADE = 78;

export async function getStaticPaths() {
  const rotas = [];
  for (const noticia of await noticiasDoIdioma("pt")) {
    if (!noticia.data.image) continue;
    for (const largura of await largurasCapa(noticia.data.image)) {
      rotas.push({ params: { id: noticia.data.id, largura: String(largura) }, props: { noticia, largura } });
    }
  }
  return rotas;
}

export async function GET({ props }: { props: { noticia: Noticia; largura: number } }) {
  const imagem = await sharp(path.join(process.cwd(), props.noticia.data.image!))
    .resize({ width: props.largura })
    .webp({ quality: QUALIDADE })
    .toBuffer();
  return new Response(new Uint8Array(imagem), { headers: { "Content-Type": "image/webp" } });
}
