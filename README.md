# Astrobotânica — site do podcast

Site estático (HTML + CSS + TypeScript), multi-página, com duas trilhas de
conteúdo que se cruzam: **Podcast** (episódios com player de `.mp3`) e
**Roteiros** (o texto completo de cada episódio).

## Estrutura

```
site/
├── index.html          → Home
├── podcast.html         → lista de episódios
├── episodio.html         → detalhe de um episódio (?id=ep-01)
├── roteiros.html         → lista de roteiros
├── roteiro.html           → detalhe de um roteiro (?id=roteiro-01)
├── sobre.html
├── contato.html
├── css/style.css        → todo o visual (paleta, tipografia, layout)
├── src/
│   ├── data.ts           → CONTEÚDO: episódios e roteiros (edite aqui)
│   └── main.ts            → lógica: preenche cada página a partir de data.ts
├── dist/                 → JavaScript compilado (gerado a partir de src/)
├── audio/                → arquivos .mp3 dos episódios
└── tsconfig.json
```

Todas as páginas carregam o mesmo `dist/main.js`; cada função de renderização
procura o elemento da sua página (`#episode-list`, `#episodio-content`,
`#article-list`, `#roteiro-content`, `#home-latest-episode`,
`#home-featured-article`) e não faz nada se ele não existir — por isso não é
preciso um script diferente por página.

Nav e rodapé são markup HTML repetido em cada página (sem servidor, sem
includes) — ao editar um, replique a mudança nas outras páginas.

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

3. Recompile (veja abaixo). A página `podcast.html` e a Home passam a listar
   o novo episódio automaticamente — não é preciso criar um HTML novo, a
   página `episodio.html?id=ep-02` já funciona.

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

## Antes de publicar

- **Contato**: `contato.html` tem um email-placeholder (`seu-email@substituir.com`)
  marcado com `<!-- TODO -->` no HTML — troque pelo seu email real.
- **Assinatura do podcast**: os botões de Spotify/Apple Podcasts/RSS em
  `podcast.html` e no rodapé estão como "em breve" até existirem links reais.
  Depois de publicar em algum desses serviços, troque o texto pelo link real
  e remova o estilo de botão desabilitado (`aria-disabled="true"`).

## Publicar

Como é um site 100% estático, pode subir a pasta inteira (menos `src/` e
`tsconfig.json`, que são só para desenvolvimento) para qualquer serviço de
hospedagem estática: GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.

## Personalização rápida

- **Cores/tipografia**: todas as variáveis estão no topo de `css/style.css`,
  no bloco `:root` (paleta azul, Barlow/Barlow Condensed/IBM Plex Mono).
- **Nome do podcast / tagline**: procure por "Astrobotânica" em cada `.html`.
