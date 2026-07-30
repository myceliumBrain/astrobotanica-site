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
  featured?: boolean; // marcado no admin: fixa o episódio na Home (ver selectHomeItems)
}

interface Article {
  id: string;
  category: string; // ex: "Fisiologia vegetal", "Agricultura espacial"
  title: string;
  subtitle?: string;
  author?: string; // opcional: mostrado no topo, ao lado da data — mesmo em qualquer idioma (nome próprio, não se traduz)
  authorAvatar?: string; // opcional: foto do autor, ex: "images/equipe/pedro.jpg"
  date: string; // formato AAAA-MM-DD
  readingTime: string; // ex: "6 min"
  body: string; // HTML gerado pelo editor do painel (negrito, parágrafos, imagens)
  image?: string; // opcional: caminho da imagem de capa (horizontal), ex: "images/noticias/minha-noticia.jpg"
  imageCaption?: string; // opcional: legenda exibida abaixo da imagem de capa
  imageVertical?: string; // opcional: caminho da imagem vertical usada nos cartões de prévia (ver buildArticleCard); sem ela, cai para `image`
  featured?: boolean; // marcado no admin: fixa o artigo na Home (ver selectHomeItems)
  references?: ArticleReference[]; // opcional: lista exibida após o corpo, antes de "Continue lendo" — citações não são traduzidas
  // Versão em inglês (todas opcionais, mantidas à mão pelo admin — ver
  // articleField() abaixo). Sem a tradução de um campo, a página em inglês
  // cai de volta pro campo em português correspondente.
  categoryEn?: string;
  titleEn?: string;
  subtitleEn?: string;
  bodyEn?: string;
  imageCaptionEn?: string;
  readingTimeEn?: string; // calculado a partir de bodyEn, não digitado (mesma lógica do admin pro campo em português)
}

interface ArticleReference {
  text: string; // citação/descrição da referência
  url?: string; // opcional: link para a fonte
}

interface MemberLink {
  label: string; // ex: "Instagram", "Lattes" — livre, definido pelo admin
  url: string;
}

interface Member {
  id: string;
  name: string;
  description: string;
  descriptionEn?: string; // opcional: tradução da descrição, mantida à mão pelo admin
  image?: string; // opcional: caminho da foto, ex: "images/integrantes/nome.jpg"
  links?: MemberLink[]; // opcional: quantos o admin quiser cadastrar
}

interface Loaded<T> {
  items: T[];
  failed: boolean;
}

// i18next é carregado via <script> (CDN, ver <head> de cada página) antes
// deste módulo — não há pacote/tipos instalados via npm neste projeto (não
// há bundler), então ele é tratado como global de tipo solto.
declare const i18next: any;

// ----------------------------------------------------------------------------
// Utilitários
// ----------------------------------------------------------------------------

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const locale = i18next.language === "en" ? "en-US" : "pt-BR";
  return new Intl.DateTimeFormat(locale, {
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

// Notícias também são servidas em /artigo/<id>/ (páginas estáticas geradas
// por scripts/generate_seo.py, com as tags Open Graph corretas para
// preview em redes sociais/WhatsApp) — o id vem do caminho, não da query
// string, nesse formato. ?id= continua funcionando (links antigos).
// Não usamos "/noticia/<id>/" aqui porque isso criaria uma pasta "noticia/"
// na raiz do site, colidindo com a URL limpa de noticia.html (/noticia).
function getArticleIdFromPath(): string | null {
  const match = location.pathname.match(/^\/artigo\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function loadJSON<T>(path: string): Promise<Loaded<T>> {
  try {
    // "no-cache" força o navegador a revalidar com o servidor a cada carga
    // (ETag/If-None-Match) em vez de reaproveitar cegamente uma cópia salva
    // — sem isso, uma edição salva no admin (que sempre busca fresco, ver
    // ghRequest em admin.js) podia não aparecer no site publicado até o
    // cache do navegador expirar por conta própria.
    const res = await fetch(path, { cache: "no-cache" });
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
const loadMembers = () => loadJSON<Member>("data/members.json");
// Ids de notícia, mais acessada primeiro (ver scripts/fetch_pageviews.py) —
// lista vazia até o workflow agendado rodar pela primeira vez com o token
// do GoatCounter configurado.
const loadPageviews = () => loadJSON<string>("data/pageviews.json");

// ----------------------------------------------------------------------------
// Idioma: pt/en via i18next. Os textos fixos do site vivem em data/site.json
// (pt, também usado pelo painel /admin) e data/site.en.json (en, tradução
// mantida à mão). data-text="a.b.c" no HTML marca onde aplicar cada chave;
// data-text-attr="atributo" aplica num atributo em vez de textContent (usado
// em <meta description> e nos aria-label).
// ----------------------------------------------------------------------------

type Lang = "pt" | "en";

function detectInitialLang(): Lang {
  const stored = localStorage.getItem("lang");
  if (stored === "pt" || stored === "en") return stored;
  return navigator.language.slice(0, 2).toLowerCase() === "en" ? "en" : "pt";
}

function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

// Se o i18next (carregado via CDN, ver <head>) não estiver disponível — CDN
// bloqueado/offline — substitui o global por um tradutor mínimo em cima do
// JSON em português, só para o site continuar funcionando (sem troca de
// idioma) em vez de quebrar por completo.
function installI18nFallback(ptResources: unknown): void {
  (window as any).i18next = {
    language: "pt",
    t: (key: string, opts?: Record<string, unknown>) => {
      const raw = getByPath(ptResources, key);
      if (typeof raw !== "string") return key;
      if (!opts) return raw;
      return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => (opts[k] !== undefined ? String(opts[k]) : ""));
    },
    exists: (key: string) => typeof getByPath(ptResources, key) === "string",
    changeLanguage: async () => {},
  };
}

async function initI18n(): Promise<void> {
  let ptResources = {};
  let enResources = {};
  try {
    const [pt, en] = await Promise.all([
      fetch("data/site.json").then((r) => r.json()),
      fetch("data/site.en.json").then((r) => r.json()),
    ]);
    ptResources = pt;
    enResources = en;
  } catch (err) {
    console.error("Falha ao carregar os textos do site", err);
  }

  if (typeof i18next === "undefined") {
    console.error("i18next não carregou (CDN indisponível?) — usando substituto em português.");
    installI18nFallback(ptResources);
    return;
  }

  try {
    await i18next.init({
      lng: detectInitialLang(),
      fallbackLng: "pt",
      resources: {
        pt: { translation: ptResources },
        en: { translation: enResources },
      },
    });
  } catch (err) {
    console.error("Falha ao iniciar i18next", err);
    installI18nFallback(ptResources);
    return;
  }

  document.documentElement.lang = i18next.language === "en" ? "en" : "pt-BR";
}

function applyTranslations(): void {
  document.querySelectorAll<HTMLElement>("[data-text]").forEach((node) => {
    const path = node.getAttribute("data-text");
    if (!path || !i18next.exists(path)) return;
    const value = i18next.t(path);
    const attr = node.getAttribute("data-text-attr");
    if (attr) node.setAttribute(attr, value);
    else node.textContent = value;
  });
}

// Coluna "Redes sociais" do rodapé (ao lado de "Navegação") — lista de
// tamanho livre (nome + link) cadastrada no admin em Marca & navegação (ver
// contentData.site.socialLinks/renderSiteSocialLinks em admin/admin.js).
// Sem link nenhum cadastrado, a coluna inteira fica escondida (ver `hidden`
// no HTML de cada página) em vez de aparecer com o título e nada embaixo.
function renderFooterSocial(): void {
  const col = document.getElementById("footer-social-col");
  const container = document.getElementById("footer-social");
  if (!col || !container) return;
  container.innerHTML = "";
  const links = i18next.t("socialLinks", { returnObjects: true });
  const list = Array.isArray(links) ? (links as { label: string; url: string }[]) : [];
  const valid = list.filter((link) => link.label && link.url);
  if (valid.length === 0) {
    col.hidden = true;
    return;
  }
  col.hidden = false;
  for (const link of valid) {
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.label;
    container.appendChild(a);
  }
}

function setupLangSwitch(onChange: () => void): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".lang-btn");
  if (buttons.length === 0) return;

  function reflect(): void {
    buttons.forEach((btn) => {
      btn.setAttribute("aria-current", String(btn.dataset.lang === i18next.language));
    });
  }

  reflect();

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lang = btn.dataset.lang;
      if (!lang || lang === i18next.language) return;
      await i18next.changeLanguage(lang);
      localStorage.setItem("lang", lang);
      document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
      reflect();
      applyTranslations();
      onChange();
    });
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

  if (episode.image) {
    const image = el("div", "episode-row-image");
    const img = document.createElement("img");
    img.src = episode.image;
    img.alt = "";
    img.loading = "lazy";
    image.appendChild(img);
    row.appendChild(image);
  }

  row.appendChild(
    el("span", "episode-row-number", i18next.t("episodio.epNumber", { number: pad(episode.number) }))
  );
  const main = el("div", "episode-row-main");
  main.appendChild(el("div", "episode-row-title", episode.title));
  if (showDescription) {
    main.appendChild(el("p", "episode-row-desc", episode.description));
  }
  row.appendChild(main);
  const meta = el("div", "episode-row-meta");
  meta.appendChild(el("span", "", formatDate(episode.date)));
  meta.appendChild(el("span", "", episode.duration));
  row.appendChild(meta);

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
    list.innerHTML = "";
    list.appendChild(el("p", "empty-state", i18next.t("podcast.loadError")));
    return;
  }
  renderEpisodeRows(list, episodes.items, i18next.t("podcast.emptyList"), true);
}

// ----------------------------------------------------------------------------
// Episódio: detalhe (episodio.html?id=...)
// ----------------------------------------------------------------------------

function renderEpisodeDetail(episodes: Loaded<Episode>): void {
  const root = document.getElementById("episodio-content");
  if (!root) return;
  root.innerHTML = "";

  if (episodes.failed) {
    root.appendChild(el("p", "empty-state", i18next.t("episodio.loadError")));
    return;
  }

  const id = getParam("id");
  const episode = (id ? episodes.items.find((e) => e.id === id) : undefined) ?? episodes.items[0];

  if (!episode) {
    root.appendChild(el("p", "empty-state", i18next.t("episodio.notFound")));
    return;
  }

  const tag = el("span", "tag tag-accent", i18next.t("episodio.tag", { number: episode.number }));
  const heading = el("h1", "", episode.title);
  const meta = el("p", "episode-detail-meta", `${formatDate(episode.date)} · ${episode.duration}`);

  if (episode.image) {
    // Com imagem: título/etiqueta/meta ficam sobrepostos nela (canto
    // inferior esquerdo), então o player vem logo em seguida.
    const cover = el("div", "episode-cover");
    const img = document.createElement("img");
    img.src = episode.image;
    img.alt = "";
    cover.appendChild(img);
    const overlay = el("div", "episode-cover-overlay");
    overlay.appendChild(tag);
    overlay.appendChild(heading);
    overlay.appendChild(meta);
    cover.appendChild(overlay);
    root.appendChild(cover);
  } else {
    root.appendChild(tag);
    root.appendChild(heading);
    root.appendChild(meta);
  }

  // Descrição/player/transcrição ficam numa coluna de leitura própria
  // (.episode-content-col, largura de --content-width) — só a capa acima
  // usa a largura cheia de .wrap (mesmo padrão do corpo da notícia, ver
  // .article-layout).
  const contentCol = el("div", "episode-content-col");

  contentCol.appendChild(el("p", "player-label", i18next.t("episodio.listenLabel")));

  const player = el("div", "player-panel");
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  const source = document.createElement("source");
  source.src = episode.audioSrc;
  source.type = "audio/mpeg";
  audio.appendChild(source);
  audio.appendChild(document.createTextNode(i18next.t("episodio.audioUnsupported")));
  player.appendChild(audio);
  contentCol.appendChild(player);

  const body = el("div", "episode-description");
  body.appendChild(el("p", "", episode.description));
  contentCol.appendChild(body);

  if (episode.transcript && episode.transcript.length > 0) {
    contentCol.appendChild(el("h2", "transcript-heading", i18next.t("episodio.transcriptHeading")));

    // Começa recolhida (só as primeiras linhas, com fade) pra não empurrar
    // "outros episódios" pra longe — o botão abaixo expande sob demanda.
    const wrap = el("div", "transcript-wrap collapsed");
    const transcript = el("div", "episode-body");
    for (const paragraph of episode.transcript) {
      transcript.appendChild(el("p", "", paragraph));
    }
    wrap.appendChild(transcript);
    contentCol.appendChild(wrap);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "transcript-toggle";
    const chevron = el("span", "chevron", "▼");
    const label = document.createTextNode(` ${i18next.t("episodio.transcriptExpand")}`);
    toggle.appendChild(chevron);
    toggle.appendChild(label);
    toggle.addEventListener("click", () => {
      const collapsed = wrap.classList.toggle("collapsed");
      chevron.textContent = collapsed ? "▼" : "▲";
      label.textContent = ` ${i18next.t(collapsed ? "episodio.transcriptExpand" : "episodio.transcriptCollapse")}`;
    });
    contentCol.appendChild(toggle);
  }

  root.appendChild(contentCol);

  const related = document.getElementById("episodio-related");
  if (related) {
    related.innerHTML = "";
    const others = episodes.items.filter((e) => e.id !== episode.id);
    if (others.length === 0) {
      related.appendChild(el("p", "empty-state", i18next.t("episodio.noOthers")));
    } else {
      for (const ep of others) {
        const row = document.createElement("a");
        row.className = "episode-row";
        row.href = `/episodio?id=${ep.id}`;
        row.appendChild(el("span", "episode-row-number", i18next.t("episodio.epNumber", { number: pad(ep.number) })));
        row.appendChild(el("div", "episode-row-main episode-row-title", ep.title));
        row.appendChild(el("div", "episode-row-meta", ep.duration));
        related.appendChild(row);
      }
    }
  }

  document.title = `${episode.title} — Astrobotânica`;
}

// Campo traduzido de uma notícia (categoria/título/subtítulo/corpo/legenda/
// tempo de leitura — ver categoryEn/titleEn/etc. em Article): usa a versão
// em inglês só quando o idioma atual é inglês E ela foi de fato preenchida
// no admin; sem isso, cai pro campo em português correspondente. Autor,
// data, imagens e referências não passam por aqui — não se traduzem.
function localize(pt: string, en: string | undefined): string;
function localize(pt: string | undefined, en: string | undefined): string | undefined;
function localize(pt: string | undefined, en: string | undefined): string | undefined {
  return i18next.language === "en" && en ? en : pt;
}

// ----------------------------------------------------------------------------
// Artigos: cartão em grade (pôster + título), usado na lista de artigos,
// na lista pequena da Home e em "continue lendo" — sempre da mesma forma.
// ----------------------------------------------------------------------------

// "horizontal": só a lista pequena da Home usa isso (ver renderHomeArticles)
// — capa horizontal em vez de vertical, card com menos destaque.
type ArticleCardVariant = "horizontal";

function buildArticleCard(article: Article, variant?: ArticleCardVariant): HTMLAnchorElement {
  const card = document.createElement("a");
  card.className = variant ? `article-card article-card--${variant}` : "article-card";
  card.href = `/artigo/${article.id}/`;

  const image = el("div", "article-card-image");
  const cardImageSrc = variant ? article.image || article.imageVertical : article.imageVertical || article.image;
  if (cardImageSrc) {
    const img = document.createElement("img");
    img.src = cardImageSrc;
    img.alt = "";
    img.loading = "lazy";
    image.appendChild(img);
  }
  card.appendChild(image);

  card.appendChild(el("div", "article-card-kicker", localize(article.category, article.categoryEn)));
  card.appendChild(el("div", "article-card-title", localize(article.title, article.titleEn)));
  card.appendChild(
    el("div", "article-card-meta", `${formatDate(article.date)} · ${localize(article.readingTime, article.readingTimeEn)}`)
  );
  // Sem autor aqui de propósito: nome completo estourava a largura desses
  // cards pequenos (grade da Home, /noticias, "continue lendo"), quebrando
  // o layout — ver .article-author-card na página de detalhe, que tem
  // espaço de sobra pra isso, e o card 50/50 (buildArticleSplitCard).

  return card;
}

function renderArticleGrid(container: HTMLElement, articles: Article[], emptyMessage: string): void {
  container.innerHTML = "";
  container.classList.add("article-grid");
  if (articles.length === 0) {
    container.appendChild(el("p", "empty-state", emptyMessage));
    return;
  }
  articles.forEach((article) => container.appendChild(buildArticleCard(article)));
}

// Card 50/50 (texto à esquerda, imagem à direita) — só a notícia mais
// recente/destacada da Home usa isso (ver renderHomeArticles).
function buildArticleSplitCard(article: Article): HTMLAnchorElement {
  const card = document.createElement("a");
  card.className = "article-card-split";
  card.href = `/artigo/${article.id}/`;

  const info = el("div", "article-card-split-info");
  info.appendChild(el("div", "article-card-kicker", localize(article.category, article.categoryEn)));
  info.appendChild(el("div", "article-card-split-title", localize(article.title, article.titleEn)));
  const splitSubtitle = localize(article.subtitle, article.subtitleEn);
  if (splitSubtitle) {
    info.appendChild(el("p", "article-card-split-subtitle", splitSubtitle));
  }
  info.appendChild(
    el("div", "article-card-meta", `${formatDate(article.date)} · ${localize(article.readingTime, article.readingTimeEn)}`)
  );
  if (article.author) {
    info.appendChild(el("div", "article-card-author", i18next.t("artigo.byLine", { author: article.author })));
  }
  card.appendChild(info);

  const image = el("div", "article-card-split-image");
  const cardImageSrc = article.image || article.imageVertical;
  if (cardImageSrc) {
    const img = document.createElement("img");
    img.src = cardImageSrc;
    img.alt = "";
    img.loading = "lazy";
    image.appendChild(img);
  }
  card.appendChild(image);

  return card;
}

// Banner de evento (opcional, cadastrado no admin em Home) — imagem solta
// entre a linha das 4 próximas notícias e a lista completa, com link
// opcional. Fica de fora por completo sem imagem cadastrada.
function buildHomeEventBanner(): HTMLElement | null {
  const src = i18next.exists("home.eventBannerImage") ? i18next.t("home.eventBannerImage") : "";
  if (!src) return null;

  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.loading = "lazy";

  const link = i18next.exists("home.eventBannerLink") ? i18next.t("home.eventBannerLink") : "";
  if (link) {
    const a = document.createElement("a");
    a.className = "home-event-banner";
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.appendChild(img);
    return a;
  }
  const wrap = el("div", "home-event-banner");
  wrap.appendChild(img);
  return wrap;
}

// Home: 1) notícia de destaque em card 50/50 (buildArticleSplitCard); 2) as
// próximas 4 (topArticles[1..4]) em linha, formato pôster normal; 3) banner
// de evento (opcional); 4) todas as demais notícias, formato pequeno
// (variante "horizontal") — ao contrário do esquema antigo (uma seleção
// limitada + link "ver todos"), a Home lista literalmente todas as
// notícias, só a apresentação muda conforme a posição (ver
// renderHomeHighlights, que separa topArticles/remainingArticles).
function renderHomeArticles(
  container: HTMLElement,
  topArticles: Article[],
  remainingArticles: Article[],
  emptyMessage: string
): void {
  container.innerHTML = "";
  if (topArticles.length === 0 && remainingArticles.length === 0) {
    container.appendChild(el("p", "empty-state", emptyMessage));
    return;
  }

  const [featured, ...nextFour] = topArticles;
  if (featured) container.appendChild(buildArticleSplitCard(featured));

  if (nextFour.length > 0) {
    const row = el("div", "home-articles-row");
    nextFour.forEach((article) => row.appendChild(buildArticleCard(article)));
    container.appendChild(row);
  }

  const banner = buildHomeEventBanner();
  if (banner) container.appendChild(banner);

  if (remainingArticles.length > 0) {
    const grid = el("div", "article-grid");
    remainingArticles.forEach((article) => grid.appendChild(buildArticleCard(article, "horizontal")));
    container.appendChild(grid);
  }
}

// ----------------------------------------------------------------------------
// Artigos: lista
// ----------------------------------------------------------------------------

function renderArticleList(articles: Loaded<Article>): void {
  const list = document.getElementById("article-list");
  if (!list) return;

  if (articles.failed) {
    list.innerHTML = "";
    list.appendChild(el("p", "empty-state", i18next.t("artigos.loadError")));
    return;
  }
  renderArticleGrid(list, articles.items, i18next.t("artigos.emptyList"));
}

// ----------------------------------------------------------------------------
// Artigo: detalhe (noticia.html?id=...)
// ----------------------------------------------------------------------------

// Redes exibidas na linha de compartilhar — nome por extenso no próprio
// botão (ver .article-share-link), não é mais abreviação/logo.
const SHARE_NETWORKS: { name: string; buildUrl: (url: string, title: string) => string }[] = [
  { name: "Bluesky", buildUrl: (url, title) => `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}` },
  { name: "Facebook", buildUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { name: "X", buildUrl: (url, title) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
  { name: "LinkedIn", buildUrl: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
];

function buildArticleMetaRow(article: Article): HTMLElement {
  const row = el("div", "article-meta-row");

  // Autor/avatar não ficam mais aqui — ver buildAuthorCard, sempre depois
  // do corpo e das referências (desktop e celular).
  const bylineMeta = el("span", "article-byline-meta");
  bylineMeta.appendChild(document.createTextNode(formatDate(article.date)));
  bylineMeta.appendChild(document.createTextNode(" · "));
  bylineMeta.appendChild(document.createTextNode(localize(article.readingTime, article.readingTimeEn)));
  row.appendChild(bylineMeta);

  const share = el("div", "article-share");
  share.appendChild(el("span", "article-share-label", i18next.t("artigo.shareLabel")));
  for (const network of SHARE_NETWORKS) {
    const a = document.createElement("a");
    a.className = "article-share-link";
    a.href = network.buildUrl(location.href, localize(article.title, article.titleEn));
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", i18next.t("artigo.shareOn", { network: network.name }));
    a.textContent = network.name;
    share.appendChild(a);
  }
  row.appendChild(share);

  return row;
}

// Card do autor, sempre depois do corpo do texto e das referências
// (desktop e celular — ver renderArticleDetail). Cruza article.author com
// data/members.json (pelo nome) pra puxar bio e links, quando existir um
// integrante cadastrado com esse nome; sem isso, mostra só nome/avatar.
function buildAuthorCard(article: Article, members: Member[]): HTMLElement | null {
  if (!article.author) return null;
  const member = members.find((m) => m.name === article.author);

  const card = el("div", "article-author-card");

  const avatarSrc = article.authorAvatar || member?.image;
  if (avatarSrc) {
    const photoLink = document.createElement("a");
    photoLink.className = "article-author-photo";
    photoLink.href = "/sobre";
    const img = document.createElement("img");
    img.src = avatarSrc;
    img.alt = "";
    photoLink.appendChild(img);
    card.appendChild(photoLink);
  }

  const info = el("div", "article-author-info");
  info.appendChild(el("div", "article-author-name", article.author));

  const bio = member ? (i18next.language === "en" && member.descriptionEn ? member.descriptionEn : member.description) : undefined;
  if (bio) info.appendChild(el("p", "article-author-bio", bio));

  const actions = el("div", "article-author-actions");
  const cta = document.createElement("a");
  cta.className = "btn btn-primary";
  cta.href = "/sobre";
  cta.textContent = i18next.t("artigo.authorCta");
  actions.appendChild(cta);

  const firstLink = member?.links?.[0];
  if (firstLink) {
    const link = document.createElement("a");
    link.className = "btn btn-secondary";
    link.href = firstLink.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = firstLink.label;
    actions.appendChild(link);
  }
  info.appendChild(actions);
  card.appendChild(info);

  return card;
}

// Barra lateral ao lado do corpo do texto (ver .article-layout): "mais
// recentes" (mesmas notícias que iriam pra "Continue lendo", resumidas) e,
// quando há dados de acesso (ver data/pageviews.json e
// scripts/fetch_pageviews.py), "mais acessadas" logo abaixo.
const ARTICLE_SIDEBAR_MAX_ITEMS = 3;

function buildSidebarList(heading: string, items: Article[]): HTMLElement {
  const section = el("div", "article-sidebar-section");
  section.appendChild(el("span", "article-sidebar-heading", heading));
  const list = el("div", "article-sidebar-list");
  for (const item of items) {
    const a = document.createElement("a");
    a.className = "article-sidebar-item";
    a.href = `/artigo/${item.id}/`;
    if (item.image) {
      const img = document.createElement("img");
      img.className = "article-sidebar-thumb";
      img.src = item.image;
      img.alt = "";
      img.loading = "lazy";
      a.appendChild(img);
    }
    a.appendChild(el("span", "article-sidebar-title", localize(item.title, item.titleEn)));
    list.appendChild(a);
  }
  section.appendChild(list);
  return section;
}

function buildArticleSidebar(recentItems: Article[], mostViewedItems: Article[]): HTMLElement {
  const aside = el("aside", "article-sidebar");
  aside.appendChild(buildSidebarList(i18next.t("artigo.latestHeading"), recentItems.slice(0, ARTICLE_SIDEBAR_MAX_ITEMS)));
  if (mostViewedItems.length > 0) {
    aside.appendChild(buildSidebarList(i18next.t("artigo.mostViewedHeading"), mostViewedItems.slice(0, ARTICLE_SIDEBAR_MAX_ITEMS)));
  }
  return aside;
}

function renderArticleDetail(articles: Loaded<Article>, members: Loaded<Member>, pageviews: Loaded<string>): void {
  const root = document.getElementById("artigo-content");
  if (!root) return;
  root.innerHTML = "";

  if (articles.failed) {
    root.appendChild(el("p", "empty-state", i18next.t("artigo.loadError")));
    return;
  }

  const id = getParam("id") ?? getArticleIdFromPath();
  const article = (id ? articles.items.find((a) => a.id === id) : undefined) ?? articles.items[0];

  if (!article) {
    root.appendChild(el("p", "empty-state", i18next.t("artigo.notFound")));
    return;
  }

  // Ordem fixa, sem sobrepor texto na imagem: etiqueta, título, subtítulo,
  // depois a linha de autor/data + compartilhar, e só então a capa (com
  // legenda opcional logo abaixo).
  root.appendChild(el("span", "tag tag-accent", localize(article.category, article.categoryEn)));
  root.appendChild(el("h1", "", localize(article.title, article.titleEn)));
  const detailSubtitle = localize(article.subtitle, article.subtitleEn);
  if (detailSubtitle) {
    root.appendChild(el("p", "article-subtitle", detailSubtitle));
  }
  root.appendChild(buildArticleMetaRow(article));

  if (article.image) {
    const cover = el("div", "article-cover");
    const img = document.createElement("img");
    img.src = article.image;
    img.alt = "";
    cover.appendChild(img);
    root.appendChild(cover);
    const caption = localize(article.imageCaption, article.imageCaptionEn);
    if (caption) {
      root.appendChild(el("p", "article-cover-caption", caption));
    }
  }

  const others = articles.items.filter((a) => a.id !== article.id);
  const mostViewed = pageviews.items
    .map((id) => others.find((a) => a.id === id))
    .filter((a): a is Article => a !== undefined);

  const layout = el("div", "article-layout");
  const main = el("div", "article-main");

  const body = el("div", "article-body");
  body.innerHTML = localize(article.body, article.bodyEn);
  main.appendChild(body);

  if (article.references && article.references.length > 0) {
    const refsSection = el("div", "article-references");
    refsSection.appendChild(el("h2", "article-references-heading", i18next.t("artigo.referencesHeading")));
    const list = document.createElement("ol");
    list.className = "article-references-list";
    for (const ref of article.references) {
      const li = document.createElement("li");
      if (ref.url) {
        const a = document.createElement("a");
        a.href = ref.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = ref.text;
        li.appendChild(a);
      } else {
        li.textContent = ref.text;
      }
      list.appendChild(li);
    }
    refsSection.appendChild(list);
    main.appendChild(refsSection);
  }

  const authorCard = buildAuthorCard(article, members.items);
  if (authorCard) {
    main.appendChild(el("hr", "article-divider"));
    main.appendChild(authorCard);
  }

  layout.appendChild(main);

  if (others.length > 0) {
    layout.appendChild(buildArticleSidebar(others, mostViewed));
  }
  root.appendChild(layout);

  const related = document.getElementById("artigo-related");
  if (related) {
    renderArticleGrid(related, others, i18next.t("artigo.noOthers"));
  }

  document.title = `${localize(article.title, article.titleEn)} — Astrobotânica`;
}

// ----------------------------------------------------------------------------
// Home: destaques
// ----------------------------------------------------------------------------

const HOME_MAX_ITEMS = 6;
// Quantas notícias ocupam as posições "de destaque" da Home: a 1ª vira o
// card 50/50 (ver buildArticleSplitCard), as outras 4 formam a linha de
// pôsteres logo abaixo (ver renderHomeArticles) — diferente de
// HOME_MAX_ITEMS (episódios), que ainda limita quantos aparecem na Home; as
// notícias que sobram desse recorte de 5 continuam aparecendo, só que na
// lista pequena mais abaixo (nenhuma notícia fica de fora da Home).
const HOME_ARTICLES_TOP = 5;

// A Home mostra, no máximo, HOME_MAX_ITEMS itens: primeiro todos os
// marcados como "featured" no admin (até o limite), e as vagas restantes
// são preenchidas pelos não marcados mais próximos do topo do array (ou
// seja, os mais recentes — um item novo entra no topo por padrão). A
// ordem final preserva a ordem original do array, então o resultado é
// sempre um subconjunto contíguo-por-prioridade da lista completa.
function selectHomeItems<T extends { featured?: boolean }>(items: T[], max: number): T[] {
  const featured = items.filter((item) => item.featured);
  const nonFeatured = items.filter((item) => !item.featured);
  const fill = nonFeatured.slice(0, Math.max(0, max - featured.length));
  const selected = new Set([...featured.slice(0, max), ...fill]);
  return items.filter((item) => selected.has(item));
}

function renderHomeHighlights(episodes: Loaded<Episode>, articles: Loaded<Article>): void {
  const epRoot = document.getElementById("home-episodes");
  if (epRoot) {
    if (episodes.failed) {
      epRoot.innerHTML = "";
      epRoot.appendChild(el("p", "empty-state", i18next.t("home.loadErrorEpisodes")));
    } else {
      renderEpisodeRows(epRoot, selectHomeItems(episodes.items, HOME_MAX_ITEMS), i18next.t("home.emptyEpisodes"), false);
    }
  }

  const artRoot = document.getElementById("home-featured-article");
  if (artRoot) {
    if (articles.failed) {
      artRoot.innerHTML = "";
      artRoot.appendChild(el("p", "empty-state", i18next.t("home.loadErrorArticles")));
    } else {
      const topArticles = selectHomeItems(articles.items, HOME_ARTICLES_TOP);
      const topSet = new Set(topArticles);
      const remainingArticles = articles.items.filter((article) => !topSet.has(article));
      renderHomeArticles(artRoot, topArticles, remainingArticles, i18next.t("home.emptyArticles"));
    }
  }
}

// ----------------------------------------------------------------------------
// Sobre: integrantes (cadastrados pelo painel /admin, ver data/members.json)
// ----------------------------------------------------------------------------

function buildMemberCard(member: Member): HTMLDivElement {
  const row = el("div", "member-card");

  const photo = el("div", "member-photo");
  if (member.image) {
    const img = document.createElement("img");
    img.src = member.image;
    img.alt = "";
    img.loading = "lazy";
    photo.appendChild(img);
  }
  row.appendChild(photo);

  const description = i18next.language === "en" && member.descriptionEn ? member.descriptionEn : member.description;

  const info = el("div", "card member-info");
  info.appendChild(el("div", "card-title", member.name));
  info.appendChild(el("p", "card-body", description));

  if (member.links && member.links.length > 0) {
    const links = el("div", "member-links");
    for (const link of member.links) {
      const a = document.createElement("a");
      a.className = "text-link";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link.label;
      links.appendChild(a);
    }
    info.appendChild(links);
  }
  row.appendChild(info);

  return row;
}

function renderMembersList(members: Loaded<Member>): void {
  const list = document.getElementById("members-list");
  if (!list) return;
  list.innerHTML = "";
  list.classList.add("members-grid");

  if (members.failed) {
    list.appendChild(el("p", "empty-state", i18next.t("sobre.loadErrorMembers")));
    return;
  }
  if (members.items.length === 0) {
    list.appendChild(el("p", "empty-state", i18next.t("sobre.noMembers")));
    return;
  }
  for (const member of members.items) {
    list.appendChild(buildMemberCard(member));
  }
}

// ----------------------------------------------------------------------------
// Menu: overlay de navegação aberto pelo botão hamburguer (.nav-toggle)
// ----------------------------------------------------------------------------

function setupNavOverlay(): void {
  const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
  const overlay = document.getElementById("nav-overlay");
  if (!toggle || !overlay) return;

  const closeBtn = overlay.querySelector<HTMLButtonElement>(".nav-overlay-close");

  function open(): void {
    overlay!.classList.add("is-open");
    toggle!.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-open");
  }

  function close(): void {
    overlay!.classList.remove("is-open");
    toggle!.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    if (isOpen) close();
    else open();
  });

  closeBtn?.addEventListener("click", close);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") close();
  });
}

// ----------------------------------------------------------------------------
// Cabeçalho: recua ao rolar para baixo, reaparece ao rolar para cima
// (a transição em si é feita via CSS, em .site-header/.site-header--hidden)
// ----------------------------------------------------------------------------

function setupHeaderAutoHide(): void {
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!header) return;

  const scrollMargin = 12; // ignora tremores pequenos (ex: bounce do iOS)
  let lastY = window.scrollY;
  let ticking = false;

  function update(): void {
    const currentY = window.scrollY;
    const delta = currentY - lastY;
    if (Math.abs(delta) > scrollMargin) {
      const scrollingDown = delta > 0 && currentY > (header as HTMLElement).offsetHeight;
      (header as HTMLElement).classList.toggle("site-header--hidden", scrollingDown);
      lastY = currentY;
    }
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  setupHeaderAutoHide();
  setupNavOverlay();

  await initI18n();
  applyTranslations();
  renderFooterSocial();

  const [episodes, articles, members, pageviews] = await Promise.all([
    loadEpisodes(),
    loadArticles(),
    loadMembers(),
    loadPageviews(),
  ]);

  function renderAll(): void {
    renderEpisodeList(episodes);
    renderEpisodeDetail(episodes);
    renderArticleList(articles);
    renderArticleDetail(articles, members, pageviews);
    renderHomeHighlights(episodes, articles);
    renderMembersList(members);
  }

  renderAll();
  setupLangSwitch(renderAll);
});
