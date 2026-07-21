// ============================================================================
// data.ts
// ----------------------------------------------------------------------------
// Fonte de conteúdo do site. Para adicionar um novo episódio ou roteiro,
// adicione um novo objeto ao array correspondente (EPISODES ou ARTICLES).
// Depois de editar este arquivo, recompile com: npx tsc
// (isso regenera dist/data.js e dist/main.js automaticamente)
// ============================================================================

export interface Episode {
  id: string;
  number: number;
  title: string;
  description: string;
  date: string; // formato AAAA-MM-DD
  duration: string; // formato "MM:SS" ou "HH:MM:SS"
  audioSrc: string; // caminho para o arquivo .mp3, ex: "audio/episodio-01.mp3"
  articleId?: string; // opcional: id de um roteiro relacionado em ARTICLES
}

export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  date: string; // formato AAAA-MM-DD
  readingTime: string; // ex: "6 min"
  body: string[]; // um parágrafo por item do array
  episodeId?: string; // opcional: id de um episódio relacionado em EPISODES
}

// ----------------------------------------------------------------------------
// EPISÓDIOS
// Adicione o arquivo .mp3 correspondente na pasta /audio antes de publicar.
// ----------------------------------------------------------------------------
export const EPISODES: Episode[] = [
  {
    id: "ep-01",
    number: 1,
    title: "Um Jardim e uma Biblioteca",
    description:
      "Episódio piloto. O que é astrobotânica, por que uma planta não cabe num pen-drive, e uma carta para quem estiver ouvindo isso fora da Terra.",
    date: "2026-07-20",
    duration: "—",
    audioSrc: "audio/episodio-01.mp3",
    articleId: "roteiro-01",
  },
];

// ----------------------------------------------------------------------------
// ROTEIROS
// Cada parágrafo do roteiro fica como um item separado no array `body`.
// ----------------------------------------------------------------------------
export const ARTICLES: Article[] = [
  {
    id: "roteiro-01",
    title: "Um Jardim e uma Biblioteca",
    subtitle: "Roteiro do episódio piloto",
    date: "2026-07-20",
    readingTime: "5 min",
    episodeId: "ep-01",
    body: [
      "A mais de dois mil anos, um estadista romano chamado Marco Túlio Cícero disse: “se você tem um jardim e uma biblioteca, você tem tudo o que precisa”. Atualmente, essa frase me acompanha, e no futuro, ecoará pela Lua, Marte e, depois, para além de onde nós imaginamos.",
      "Sabe, livros podem ser compactados — apesar de que eu gosto bastante de abrir um livro físico — mas a informação de milhares de livros pode ser comprimida e colocada em um pequeno pen-drive. Ao contrário disso, plantas, que são a base da nossa alimentação, não têm a mesma capacidade de compactação.",
      "Ok, esse é um podcast de astrobotânica, e o que afinal é isso? Por que isso importa? Será que esse registro ficará salvo pra ser ouvido fora da Terra? Se sim, oi extraterrestre :) Meu nome é Pedro e atualmente sou pesquisador de astrobotânica.",
      "É dia 20 de julho de 2026, depois de Cristo. Caso esse nome já tenha se perdido, esse foi um cara legal que surgiu na Terra e que a galera gostava tanto que contamos cada volta da Terra em volta do nosso astro, chamado de Sol, a partir da morte dele.",
      "Certo, mas mesmo se você ainda estiver perdido, nós estimamos que estamos cerca de 13,8 bilhões de anos depois do Big Bang, que talvez foi quando o tempo iniciou. A partir de agora a minha ignorância toma conta — não sei mais como te localizar, amigo.",
      "Sem mais devagações, vamos ao tema de hoje: o que é a tal da astrobotânica? Astro vem de espaço, galáxia, universo. Botânica tem a ver com as plantas, aquelas que têm folhas, caules, raízes e que nós temos contato desde que somos bebês. Dentro disso, esse campo de estudo visa buscar plantas no espaço, assim como também entender como fazer com que as plantas que evoluíram na Terra saiam dela.",
      "Nisso, é claro, temos grandes implicações. Na primeira afirmação, onde eu disse que nós buscamos plantas no espaço, mora uma pergunta e tanto: existe vida vegetal em qualquer outro lugar do universo? Ninguém sabe. Mas, como uma das coisas que caracteriza a gente é a curiosidade, nós vamos buscar isso até encontrarmos — e se não encontrarmos, certamente terá coisas tão magníficas quanto no caminho.",
      "Por outro lado, a astrobotânica também se preocupa em levar as plantas da Terra para fora dela, tirando-as da fina camada de atmosfera na qual elas se desenvolveram ao longo dos últimos 500 milhões de anos — ou, se quisermos contar a história desde as primeiras algas, dos últimos 3 bilhões de anos.",
      "Ao longo dos episódios, serei seu acompanhante nessa jornada. No fim, esse podcast é a história de como a nossa espécie saiu para explorar o universo e percebeu que tinha que levar um reino consigo. Esse reino era a base da nutrição, sensação de conforto, lembrança de casa. Esse era o reino das plantas, e esse é o podcast Astrobotânica.",
    ],
  },
];
