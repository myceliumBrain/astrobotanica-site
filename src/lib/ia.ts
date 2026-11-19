// Declaração de uso de inteligência artificial em notícias, episódios e
// verbetes (campo `ia`, preenchido no painel /admin). Sem o campo, o uso é
// "não informado" e nada aparece no site — é o caso do conteúdo publicado
// antes desta declaração existir.
import { z } from "astro/zod";
import type { Lang } from "./i18n";

export const USOS_DE_IA = [
  "pesquisa",
  "correcao",
  "elaboracao",
  "traducao",
  "resumo",
  "transcricao",
  "audio",
  "imagens",
  "roteiro",
  "dados",
] as const;

export const ELABORACOES = ["autor", "auxilio", "ia"] as const;

export const esquemaIa = z.object({
  usou: z.boolean(),
  ferramenta: z.string().optional(),
  versao: z.string().optional(),
  elaboracao: z.enum(ELABORACOES).optional(),
  usos: z.array(z.enum(USOS_DE_IA)).optional(),
  outroUso: z.string().optional(),
  revisado: z.boolean().optional(),
  revisor: z.string().optional(),
  observacoes: z.string().optional(),
  // A foto de capa foi gerada por I.A. (as imagens do texto são marcadas
  // uma a uma, com data-ia no próprio <img>).
  capa: z.boolean().optional(),
});

export type UsoDeIa = z.infer<typeof esquemaIa>;

export const URL_POLITICA_IA = "/politica-de-ia";

const TEXTOS = {
  pt: {
    titulo: "Uso de inteligência artificial",
    naoUsou: "Não foi utilizado I.A. para a produção desse conteúdo.",
    ferramenta: "Ferramenta",
    elaboracao: "Elaboração",
    usos: "Uso da I.A.",
    revisao: "Revisão humana",
    revisadoPor: "revisado e checado por {{nome}}",
    revisado: "revisado e checado por uma pessoa",
    naoRevisado: "não revisado por uma pessoa",
    observacoes: "Observações",
    politica: "Como o Astrobotânica usa I.A.",
    imagem: "Imagem gerada por I.A.",
    selo: { nao: "Sem I.A.", autor: "Com apoio de I.A.", auxilio: "Escrito com auxílio de I.A.", ia: "Gerado por I.A.", sim: "Com uso de I.A." },
    elaboracoes: {
      autor: "inteiramente pelo autor",
      auxilio: "pelo autor, com auxílio da I.A.",
      ia: "inteiramente pela I.A.",
    },
    opcoes: {
      pesquisa: "pesquisa de referências",
      correcao: "correção ortográfica",
      elaboracao: "elaboração do texto",
      traducao: "tradução",
      resumo: "resumo de artigos científicos",
      transcricao: "transcrição de áudio",
      audio: "voz sintética, edição de áudio ou trilha",
      imagens: "geração de imagens ou ilustrações",
      roteiro: "roteiro",
      dados: "análise de dados ou gráficos",
    },
  },
  en: {
    titulo: "Use of artificial intelligence",
    naoUsou: "No A.I. was used to produce this content.",
    ferramenta: "Tool",
    elaboracao: "Writing",
    usos: "How A.I. was used",
    revisao: "Human review",
    revisadoPor: "reviewed and fact-checked by {{nome}}",
    revisado: "reviewed and fact-checked by a person",
    naoRevisado: "not reviewed by a person",
    observacoes: "Notes",
    politica: "How Astrobotânica uses A.I.",
    imagem: "A.I.-generated image",
    selo: { nao: "No A.I.", autor: "A.I.-assisted", auxilio: "Written with A.I. assistance", ia: "A.I.-generated", sim: "Uses A.I." },
    elaboracoes: {
      autor: "entirely by the author",
      auxilio: "by the author, with A.I. assistance",
      ia: "entirely by A.I.",
    },
    opcoes: {
      pesquisa: "reference search",
      correcao: "spelling and grammar check",
      elaboracao: "drafting the text",
      traducao: "translation",
      resumo: "summarizing scientific papers",
      transcricao: "audio transcription",
      audio: "synthetic voice, audio editing or soundtrack",
      imagens: "image or illustration generation",
      roteiro: "script",
      dados: "data analysis or charts",
    },
  },
} as const;

export function textosIa(lang: Lang) {
  return TEXTOS[lang];
}

/** Selo curto (topo da página e cartões), ou undefined se não informado. */
export function seloIa(ia: UsoDeIa | undefined, lang: Lang): { texto: string; usou: boolean } | undefined {
  if (!ia) return undefined;
  const s = TEXTOS[lang].selo;
  if (!ia.usou) return { texto: s.nao, usou: false };
  return { texto: ia.elaboracao ? s[ia.elaboracao] : s.sim, usou: true };
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Linhas do quadro "Uso de inteligência artificial" no fim do conteúdo. */
export function linhasIa(ia: UsoDeIa, lang: Lang): { rotulo: string; valor: string }[] {
  const t = TEXTOS[lang];
  const linhas: { rotulo: string; valor: string }[] = [];
  const ferramenta = [ia.ferramenta?.trim(), ia.versao?.trim()].filter(Boolean).join(" — ");
  if (ferramenta) linhas.push({ rotulo: t.ferramenta, valor: ferramenta });
  if (ia.elaboracao) linhas.push({ rotulo: t.elaboracao, valor: maiuscula(t.elaboracoes[ia.elaboracao]) });
  const usos = [...(ia.usos ?? []).map((u) => t.opcoes[u]), ia.outroUso?.trim()].filter(Boolean) as string[];
  if (usos.length) {
    linhas.push({ rotulo: t.usos, valor: maiuscula(usos.join("; ")) });
  }
  if (ia.revisado !== undefined) {
    const valor = ia.revisado ? (ia.revisor?.trim() ? t.revisadoPor.replace("{{nome}}", ia.revisor.trim()) : t.revisado) : t.naoRevisado;
    linhas.push({ rotulo: t.revisao, valor: maiuscula(valor) });
  }
  if (ia.observacoes?.trim()) linhas.push({ rotulo: t.observacoes, valor: ia.observacoes.trim() });
  return linhas;
}

/** Imagens do texto marcadas no painel como geradas por I.A. (data-ia no
 * <img>) ganham um aviso logo depois delas. */
export function avisarImagensIa(html: string, lang: Lang): string {
  const aviso = `<span class="selo-ia-imagem">${TEXTOS[lang].imagem}</span>`;
  return html.replace(/<img\b[^>]*\bdata-ia(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?[^>]*>/gi, (img) => `${img}${aviso}`);
}
