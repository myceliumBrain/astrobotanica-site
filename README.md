# Astrobotânica — site do podcast

Site estático (HTML + CSS + TypeScript) com duas seções de conteúdo:
**Episódios** (players de `.mp3`) e **Roteiros** (artigos/transcrições, com
leitor em tela cheia).

## Estrutura

```
astrobotanica-site/
├── index.html          → estrutura da página
├── css/style.css        → todo o visual (paleta, tipografia, layout)
├── src/
│   ├── data.ts           → CONTEÚDO: episódios e roteiros (edite aqui)
│   └── main.ts            → lógica: renderiza listas e o leitor de roteiro
├── dist/                 → JavaScript compilado (gerado a partir de src/)
├── audio/                → coloque os arquivos .mp3 aqui
└── tsconfig.json
```

## Como adicionar um novo episódio

1. Coloque o arquivo `.mp3` na pasta `audio/` (ex: `audio/episodio-02.mp3`).
2. Abra `src/data.ts` e adicione um novo objeto no array `EPISODES`:

```ts
{
  id: "ep-02",
  number: 2,
  title: "Título do episódio",
  description: "Uma ou duas frases resumindo o episódio.",
  date: "2026-08-10",
  duration: "28:40",
  audioSrc: "audio/episodio-02.mp3",
  articleId: "roteiro-02", // opcional, se houver roteiro publicado
},
```

3. Recompile (veja abaixo).

## Como adicionar um novo roteiro

Abra `src/data.ts` e adicione um objeto no array `ARTICLES`, com um item do
array `body` para cada parágrafo:

```ts
{
  id: "roteiro-02",
  title: "Título do roteiro",
  subtitle: "Subtítulo opcional",
  date: "2026-08-10",
  readingTime: "6 min",
  episodeId: "ep-02", // opcional
  body: [
    "Primeiro parágrafo...",
    "Segundo parágrafo...",
  ],
},
```

## Como recompilar depois de editar `data.ts` ou `main.ts`

O navegador só lê os arquivos `.js` dentro de `dist/`, então é preciso
recompilar o TypeScript toda vez que `src/` mudar:

```bash
npx tsc
```

(na primeira vez, se o TypeScript não estiver instalado, o `npx` baixa
automaticamente — é preciso estar conectado à internet nesse passo).

## Como visualizar localmente

Qualquer servidor estático simples funciona, por exemplo:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000` no navegador.

## Publicar

Como é um site 100% estático, pode subir a pasta inteira (menos `src/` e
`tsconfig.json`, que são só para desenvolvimento) para qualquer serviço de
hospedagem estática: GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.
Se for GitHub Pages, o fluxo `myceliumbrain`/`pontosdefuga` que você já usa
serve perfeitamente para isso.

## Personalização rápida

- **Cores**: todas as variáveis estão no topo de `css/style.css`, no bloco
  `:root`.
- **Tipografia**: trocada via Google Fonts no `<head>` do `index.html`
  (atualmente Fraunces + Inter + IBM Plex Mono).
- **Nome do podcast / tagline**: procure por "Astrobotânica" no
  `index.html` e `dist/main.js`/`src` não precisa mexer, é só texto no HTML.
