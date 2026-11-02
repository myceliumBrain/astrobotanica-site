// /miniaturas/integrantes/<nome>.webp — foto de integrante reduzida (ver src/lib/miniatura.ts).
import { respostaMiniatura, rotasDeMiniatura } from "../../../lib/miniatura";

export const getStaticPaths = () => rotasDeMiniatura();
export const GET = ({ props }: { props: { arquivo: string } }) => respostaMiniatura(props);
