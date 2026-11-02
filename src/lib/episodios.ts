// Episódios do podcast, lidos de data/episodes.json (editado pelo painel
// /admin). O áudio é sempre em português; título, descrição e transcrição
// podem ter versão em inglês (titleEn, descriptionEn, transcriptEn). Só o
// episódio com titleEn ganha página em /en/episodios/<id>/.
import { z } from "astro/zod";
import dados from "../../data/episodes.json";
import { dataIso, validar } from "./dados";
import { caminhoNoIdioma, type Lang } from "./i18n";

const esquema = z.array(
  z.object({
    id: z.string().min(1),
    // O painel grava Number("") = null se o campo ficar vazio.
    number: z.number().nullable().transform((n) => n ?? 0),
    // Vazios num episódio recém-criado no painel; o build não falha por isso.
    title: z.string(),
    description: z.string().optional(),
    date: dataIso,
    time: z.string().optional(),
    duration: z.string(),
    audioSrc: z.string(),
    transcript: z.array(z.string()).optional(),
    image: z.string().optional(),
    featured: z.boolean().optional(),
    titleEn: z.string().optional(),
    descriptionEn: z.string().optional(),
    transcriptEn: z.array(z.string()).optional(),
  })
);

export type Episodio = z.infer<typeof esquema>[number];

/** Na ordem do arquivo (a do painel), como o site antigo. */
export const episodios: Episodio[] = validar("data/episodes.json", esquema, dados);

export function temTraducao(e: Episodio): boolean {
  return Boolean(e.titleEn?.trim());
}

/** Textos do episódio no idioma pedido. Em EN, sem tradução, `soPortugues`
 * é true e os textos são os em português (para as listas, com selo). Numa
 * página EN, a descrição e a transcrição só aparecem se traduzidas. */
export function episodioNoIdioma(e: Episodio, lang: Lang) {
  const traduzido = lang === "en" && temTraducao(e);
  return {
    title: traduzido ? e.titleEn! : e.title,
    description: traduzido ? e.descriptionEn : e.description,
    transcript: (traduzido ? e.transcriptEn : e.transcript) ?? [],
    href: urlEpisodio(e.id, traduzido ? "en" : "pt"),
    soPortugues: lang === "en" && !traduzido,
  };
}

export function urlEpisodio(id: string, lang: Lang = "pt"): string {
  return caminhoNoIdioma(`/episodios/${id}/`, lang);
}
