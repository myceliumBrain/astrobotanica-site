// Episódios do podcast, lidos de data/episodes.json (ainda editado pelo
// painel /admin). Só existem em português: o áudio é em português.
import dados from "../../data/episodes.json";

export interface Episodio {
  id: string;
  number: number;
  title: string;
  description?: string;
  date: string;
  time?: string;
  duration: string;
  audioSrc: string;
  transcript?: string[];
  image?: string;
  featured?: boolean;
}

/** Na ordem do arquivo (a do painel), como o site antigo. */
export const episodios: Episodio[] = dados as Episodio[];

export function urlEpisodio(id: string): string {
  return `/episodios/${id}/`;
}
