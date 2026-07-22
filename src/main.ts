// ----------------------------------------------------------------------------
// Tipos — o conteúdo em si vive em data/episodes.json e data/articles.json,
// carregado em tempo de execução (veja loadEpisodes/loadArticles abaixo).
// ----------------------------------------------------------------------------

interface Episode {
  id: string;
  number: number;
  title: string;
  description: string;
  date: string; // formato AAAA-MM-DD
  duration: string; // formato "MM:SS" ou "HH:MM:SS"
  audioSrc: string; // caminho para o arquivo .mp3, ex: "audio/episodio-01.mp3"
  image?: string; // opcional: caminho da imagem de capa, ex: "images/episodios/ep-01.jpg"
  transcript?: string[]; // opcional: transcrição completa, um parágrafo por item
}

interface Article {
  id: string;
  category: string; // ex: "Fisiologia vegetal", "Agricultura espacial"
  title: string;
  subtitle?: string;
  excerpt: string; // resumo curto (usado só na página de detalhe)
  date: string; // formato AAAA-MM-DD
  readingTime: string; // ex: "6 min"
  body: string[]; // um parágrafo por item do array
  image?: string; // opcional: caminho da imagem de capa, ex: "images/artigos/meu-artigo.jpg"
}

interface Loaded<T> {
  items: T[];
  failed: boolean;
}

// Textos do site (nav, rodapé, títulos, etc.) — ver data/site.json.
// Formato livre (chave -> string ou objeto aninhado); consumido via
// applySiteText() a partir dos atributos data-text="secao.chave" no HTML.
type SiteText = Record<string, unknown>;

// ----------------------------------------------------------------------------
// Utilitários
// ----------------------------------------------------------------------------

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function getParam(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

async function loadJSON<T>(path: string): Promise<Loaded<T>> {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const items = (await res.json()) as T[];
    return { items, failed: false };
  } catch (err) {
    console.error(`Falha ao carregar ${path}`, err);
    return { items: [], failed: true };
  }
}

const loadEpisodes = () => loadJSON<Episode>("data/episodes.json");
const loadArticles = () => loadJSON<Article>("data/articles.json");

// ----------------------------------------------------------------------------
// Textos do site: preenche qualquer elemento marcado com data-text="a.b.c"
// a partir de data/site.json. data-text-attr="atributo" define um atributo
// em vez de textContent (usado na tag <meta description>).
// ----------------------------------------------------------------------------

function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

async function loadSiteText(): Promise<SiteText | null> {
  try {
    const res = await fetch("data/site.json");
    if (!res.ok) throw new Error(`data/site.json: HTTP ${res.status}`);
    return (await res.json()) as SiteText;
  } catch (err) {
    console.error("Falha ao carregar data/site.json", err);
    return null;
  }
}

function applySiteText(site: SiteText | null): void {
  if (!site) return;
  document.querySelectorAll<HTMLElement>("[data-text]").forEach((el) => {
    const path = el.getAttribute("data-text");
    if (!path) return;
    const value = getByPath(site, path);
    if (typeof value !== "string") return;
    const attr = el.getAttribute("data-text-attr");
    if (attr) el.setAttribute(attr, value);
    else el.textContent = value;
  });
}

// ----------------------------------------------------------------------------
// Podcast: linha de episódio (número + título + meta), usada na lista
// completa e nos destaques da Home — sempre da mesma forma.
// ----------------------------------------------------------------------------

function buildEpisodeRow(episode: Episode, showDescription: boolean): HTMLAnchorElement {
  const row = document.createElement("a");
  row.className = "episode-row";
  row.href = `/episodio?id=${episode.id}`;

  row.appendChild(el("span", "episode-row-number", `Ep. ${pad(episode.number)}`));
  const main = el("div", "episode-row-main");
  main.appendChild(el("div", "episode-row-title", episode.title));
  if (showDescription) {
    main.appendChild(el("p", "episode-row-desc", episode.description));
  }
  row.appendChild(main);
  row.appendChild(
    el("div", "episode-row-meta", `${episode.duration} · ${formatDate(episode.date)}`)
  );

  return row;
}

function renderEpisodeRows(
  container: HTMLElement,
  episodes: Episode[],
  emptyMessage: string,
  showDescription: boolean
): void {
  container.innerHTML = "";
  if (episodes.length === 0) {
    container.appendChild(el("p", "empty-state", emptyMessage));
    return;
  }
  for (const episode of episodes) {
    container.appendChild(buildEpisodeRow(episode, showDescription));
  }
}

// ----------------------------------------------------------------------------
// Podcast: lista de episódios
// ----------------------------------------------------------------------------

function renderEpisodeList(episodes: Loaded<Episode>): void {
  const list = document.getElementById("episode-list");
  if (!list) return;

  if (episodes.failed) {
    list.appendChild(el("p", "empty-state", "Não foi possível carregar os episódios agora."));
    return;
  }
  renderEpisodeRows(list, episodes.items, "Nenhum episódio publicado ainda. Volte em breve.", true);
}

// ----------------------------------------------------------------------------
// Episódio: detalhe (episodio.html?id=...)
// ----------------------------------------------------------------------------

function renderEpisodeDetail(episodes: Loaded<Episode>): void {
  const root = document.getElementById("episodio-content");
  if (!root) return;

  if (episodes.failed) {
    root.appendChild(el("p", "empty-state", "Não foi possível carregar o episódio agora."));
    return;
  }

  const id = getParam("id");
  const episode = (id ? episodes.items.find((e) => e.id === id) : undefined) ?? episodes.items[0];

  if (!episode) {
    root.appendChild(el("p", "empty-state", "Episódio não encontrado."));
    return;
  }

  if (episode.image) {
    const cover = el("div", "episode-cover");
    const img = document.createElement("img");
    img.src = episode.image;
    img.alt = "";
    cover.appendChild(img);
    root.appendChild(cover);
  }

  root.appendChild(el("span", "tag tag-accent", `Episódio ${episode.number}`));
  root.appendChild(el("h1", "", episode.title));
  root.appendChild(
    el("p", "episode-detail-meta", `${formatDate(episode.date)} · ${episode.duration}`)
  );

  const player = el("div", "player-panel");
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  const source = document.createElement("source");
  source.src = episode.audioSrc;
  source.type = "audio/mpeg";
  audio.appendChild(source);
  audio.appendChild(document.createTextNode("Seu navegador não suporta áudio incorporado."));
  player.appendChild(audio);
  root.appendChild(player);

  const body = el("div", "episode-body");
  body.appendChild(el("p", "", episode.description));
  root.appendChild(body);

  if (episode.transcript && episode.transcript.length > 0) {
    root.appendChild(el("h2", "transcript-heading", "Transcrição completa"));
    const transcript = el("div", "episode-body");
    for (const paragraph of episode.transcript) {
      transcript.appendChild(el("p", "", paragraph));
    }
    root.appendChild(transcript);
  }

  const related = document.getElementById("episodio-related");
  if (related) {
    const others = episodes.items.filter((e) => e.id !== episode.id);
    if (others.length === 0) {
      related.appendChild(
        el("p", "empty-state", "Ainda não há outros episódios publicados.")
      );
    } else {
      for (const ep of others) {
        const row = document.createElement("a");
        row.className = "episode-row";
        row.href = `/episodio?id=${ep.id}`;
        row.appendChild(el("span", "episode-row-number", `Ep. ${pad(ep.number)}`));
        row.appendChild(el("div", "episode-row-main episode-row-title", ep.title));
        row.appendChild(el("div", "episode-row-meta", ep.duration));
        related.appendChild(row);
      }
    }
  }

  document.title = `${episode.title} — Astrobotânica`;
}

// ----------------------------------------------------------------------------
// Artigos: cartão em grade (pôster + título), usado na lista de artigos,
// nos destaques da Home e em "continue lendo" — sempre da mesma forma.
// ----------------------------------------------------------------------------

function buildArticleCard(article: Article): HTMLAnchorElement {
  const card = document.createElement("a");
  card.className = "article-card";
  card.href = `/artigo?id=${article.id}`;

  const image = el("div", "article-card-image");
  if (article.image) {
    const img = document.createElement("img");
    img.src = article.image;
    img.alt = "";
    img.loading = "lazy";
    image.appendChild(img);
  }
  card.appendChild(image);

  card.appendChild(el("div", "article-card-kicker", article.category));
  card.appendChild(el("div", "article-card-title", article.title));
  card.appendChild(
    el("div", "article-card-meta", `${formatDate(article.date)} · ${article.readingTime}`)
  );

  return card;
}

function renderArticleGrid(
  container: HTMLElement,
  articles: Article[],
  emptyMessage: string
): void {
  container.innerHTML = "";
  container.classList.add("article-grid");
  if (articles.length === 0) {
    container.appendChild(el("p", "empty-state", emptyMessage));
    return;
  }
  for (const article of articles) {
    container.appendChild(buildArticleCard(article));
  }
}

// ----------------------------------------------------------------------------
// Artigos: lista
// ----------------------------------------------------------------------------

function renderArticleList(articles: Loaded<Article>): void {
  const list = document.getElementById("article-list");
  if (!list) return;

  if (articles.failed) {
    list.appendChild(el("p", "empty-state", "Não foi possível carregar os artigos agora."));
    return;
  }
  renderArticleGrid(list, articles.items, "Nenhum artigo publicado ainda. Volte em breve.");
}

// ----------------------------------------------------------------------------
// Artigo: detalhe (artigo.html?id=...)
// ----------------------------------------------------------------------------

function renderArticleDetail(articles: Loaded<Article>): void {
  const root = document.getElementById("artigo-content");
  if (!root) return;

  if (articles.failed) {
    root.appendChild(el("p", "empty-state", "Não foi possível carregar o artigo agora."));
    return;
  }

  const id = getParam("id");
  const article = (id ? articles.items.find((a) => a.id === id) : undefined) ?? articles.items[0];

  if (!article) {
    root.appendChild(el("p", "empty-state", "Artigo não encontrado."));
    return;
  }

  root.appendChild(el("span", "tag tag-accent", article.category));
  root.appendChild(el("h1", "", article.title));
  if (article.subtitle) {
    root.appendChild(el("p", "article-subtitle", article.subtitle));
  }

  const meta = el("div", "card-meta");
  meta.appendChild(el("span", "", formatDate(article.date)));
  meta.appendChild(el("span", "", "·"));
  meta.appendChild(el("span", "", article.readingTime));
  root.appendChild(meta);

  const body = el("div", "article-body");
  for (const paragraph of article.body) {
    body.appendChild(el("p", "", paragraph));
  }
  root.appendChild(body);

  const related = document.getElementById("artigo-related");
  if (related) {
    const others = articles.items.filter((a) => a.id !== article.id);
    renderArticleGrid(related, others, "Ainda não há outros artigos publicados.");
  }

  document.title = `${article.title} — Astrobotânica`;
}

// ----------------------------------------------------------------------------
// Home: destaques
// ----------------------------------------------------------------------------

function renderHomeHighlights(episodes: Loaded<Episode>, articles: Loaded<Article>): void {
  const epRoot = document.getElementById("home-episodes");
  if (epRoot) {
    if (episodes.failed) {
      epRoot.appendChild(el("p", "empty-state", "Não foi possível carregar os episódios agora."));
    } else {
      renderEpisodeRows(epRoot, episodes.items.slice(0, 3), "Nenhum episódio publicado ainda.", false);
    }
  }

  const artRoot = document.getElementById("home-featured-article");
  if (artRoot) {
    if (articles.failed) {
      artRoot.appendChild(el("p", "empty-state", "Não foi possível carregar os artigos agora."));
    } else {
      renderArticleGrid(artRoot, articles.items.slice(0, 3), "Nenhum artigo publicado ainda.");
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const [episodes, articles, site] = await Promise.all([loadEpisodes(), loadArticles(), loadSiteText()]);
  applySiteText(site);
  renderEpisodeList(episodes);
  renderEpisodeDetail(episodes);
  renderArticleList(articles);
  renderArticleDetail(articles);
  renderHomeHighlights(episodes, articles);
});
