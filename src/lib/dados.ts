// Validação dos JSON editados pelo painel /admin (episódios, verbetes,
// categorias): um campo com tipo errado faz o build falhar com o nome do
// arquivo e do campo, em vez de gerar uma página quebrada.
import { z } from "astro/zod";

export const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD");

export function validar<T extends z.ZodTypeAny>(arquivo: string, esquema: T, dados: unknown): z.infer<T> {
  const r = esquema.safeParse(dados);
  if (r.success) return r.data;
  const erros = r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`${arquivo} fora do formato esperado:\n${erros}`);
}
