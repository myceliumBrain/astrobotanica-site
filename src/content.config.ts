// Notícias: um Markdown por notícia e idioma (src/content/noticias/{pt,en}/).
// O build falha se algum arquivo fugir deste formato.
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD");
const dataOpcional = z.union([z.literal(""), data]);

const noticias = defineCollection({
  // id da entrada = "pt/noticia-1", "en/noticia-1"
  loader: glob({ pattern: "{pt,en}/*.md", base: "./src/content/noticias" }),
  schema: z.object({
    // Campos editoriais (vazios até serem preenchidos à mão)
    title: z.string().min(1),
    description: z.string(),
    date: data,
    updated: dataOpcional,
    author: z.string(),
    orcid: z.string(),
    lattes: z.string(),
    fonte: z.object({ citacao: z.string(), doi: z.string(), url: z.string() }),
    tipo_estudo: z.string(),
    revisor_tecnico: z.string(),
    tags: z.array(z.string()),
    lang: z.enum(["pt", "en"]),
    boletim: z.object({ volume: z.string(), numero: z.string() }),
    erratas: z.array(z.unknown()),

    // Campos do site atual
    id: z.string().regex(/^noticia-\d+$/),
    ordem: z.number().int().positive(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    category: z.string().optional(),
    subtitle: z.string().optional(),
    readingTime: z.string().optional(),
    image: z.string().optional(),
    imageCaption: z.string().optional(),
    imageVertical: z.string().optional(),
    authorAvatar: z.string().optional(),
    featured: z.boolean().optional(),
    references: z.array(z.object({ text: z.string(), url: z.string().optional() })).optional(),
  }),
});

export const collections = { noticias };
