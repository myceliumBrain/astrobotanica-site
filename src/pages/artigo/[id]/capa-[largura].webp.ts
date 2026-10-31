// /artigo/<id>/capa-<largura>.webp — capa da notícia reduzida (ver src/lib/capa.ts).
import type { Noticia } from "../../../lib/noticias";
import { respostaWebp, rotasDeImagem } from "../../../lib/capa";

export const getStaticPaths = () => rotasDeImagem("capa");
export const GET = ({ props }: { props: { noticia: Noticia; largura: number } }) => respostaWebp("capa", props);
