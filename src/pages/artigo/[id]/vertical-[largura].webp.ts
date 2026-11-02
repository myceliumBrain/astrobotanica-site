// /artigo/<id>/vertical-<largura>.webp — pôster vertical da notícia reduzido (ver src/lib/capa.ts).
import type { Noticia } from "../../../lib/noticias";
import { respostaWebp, rotasDeImagem } from "../../../lib/capa";

export const getStaticPaths = () => rotasDeImagem("vertical");
export const GET = ({ props }: { props: { noticia: Noticia; largura: number } }) => respostaWebp("vertical", props);
