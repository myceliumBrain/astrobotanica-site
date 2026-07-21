import { EPISODES, ARTICLES } from "./data.js";

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

function corners(): HTMLElement[] {
  return ["tl", "tr", "bl", "br"].map((pos) => el("i", `corner ${pos}`));
}

function getParam(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

// ----------------------------------------------------------------------------
// Podcast: lista de episódios
// ----------------------------------------------------------------------------

function renderEpisodeList(): void {
  const list = document.getElementById("episode-list");
  if (!list) return;

  if (EPISODES.length === 0) {
    list.appendChild(
      el("p", "empty-state", "Nenhum episódio publicado ainda. Volte em breve.")
    );
    return;
  }

  const sorted = [...EPISODES].sort((a, b) => b.number - a.number);

  for (const episode of sorted) {
    const row = document.createElement("a");
    row.className = "episode-row";
    row.href = `episodio.html?id=${episode.id}`;

    const main = el("div", "episode-row-main");
    main.appendChild(el("div", "episode-row-title", episode.title));
    main.appendChild(el("p", "episode-row-desc", episode.description));

    row.appendChild(el("span", "episode-row-number", pad(episode.number)));
    row.appendChild(main);
    row.appendChild(
      el("div", "episode-row-meta", `${episode.duration} · ${formatDate(episode.date)}`)
    );

    list.appendChild(row);
  }
}

// ----------------------------------------------------------------------------
// Episódio: detalhe (episodio.html?id=...)
// ----------------------------------------------------------------------------

function renderEpisodeDetail(): void {
  const root = document.getElementById("episodio-content");
  if (!root) return;

  const id = getParam("id");
  const episode = (id ? EPISODES.find((e) => e.id === id) : undefined) ?? EPISODES[0];

  if (!episode) {
    root.appendChild(el("p", "empty-state", "Episódio não encontrado."));
    return;
  }

  root.appendChild(el("span", "tag tag-accent", `Episódio ${episode.number}`));
  root.appendChild(el("h1", "", episode.title));
  root.appendChild(
    el("p", "episode-detail-meta", `${formatDate(episode.date)} · ${episode.duration}`)
  );

  const player = el("div", "player-panel blueprint");
  corners().forEach((c) => player.appendChild(c));
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

  if (episode.articleId && ARTICLES.some((a) => a.id === episode.articleId)) {
    const link = document.createElement("a");
    link.className = "text-link";
    link.style.display = "inline-block";
    link.style.marginTop = "1.5rem";
    link.href = `roteiro.html?id=${episode.articleId}`;
    link.textContent = "Ler o roteiro completo →";
    root.appendChild(link);
  }

  const related = document.getElementById("episodio-related");
  if (related) {
    const others = EPISODES.filter((e) => e.id !== episode.id);
    if (others.length === 0) {
      related.appendChild(
        el("p", "empty-state", "Ainda não há outros episódios publicados.")
      );
    } else {
      for (const ep of others) {
        const row = document.createElement("a");
        row.className = "episode-row";
        row.href = `episodio.html?id=${ep.id}`;
        row.appendChild(el("span", "episode-row-number", pad(ep.number)));
        row.appendChild(el("div", "episode-row-main episode-row-title", ep.title));
        row.appendChild(el("div", "episode-row-meta", ep.duration));
        related.appendChild(row);
      }
    }
  }

  document.title = `${episode.title} — Astrobotânica`;
}

// ----------------------------------------------------------------------------
// Roteiros: lista
// ----------------------------------------------------------------------------

function renderArticleList(): void {
  const list = document.getElementById("article-list");
  if (!list) return;

  if (ARTICLES.length === 0) {
    list.appendChild(
      el("p", "empty-state", "Nenhum roteiro publicado ainda. Volte em breve.")
    );
    return;
  }

  const sorted = [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const article of sorted) {
    const card = document.createElement("a");
    card.className = "card blueprint";
    card.href = `roteiro.html?id=${article.id}`;
    corners().forEach((c) => card.appendChild(c));
    card.appendChild(el("div", "card-kicker", "Roteiro"));
    card.appendChild(el("div", "card-title", article.title));
    if (article.subtitle) card.appendChild(el("p", "card-body", article.subtitle));

    const meta = el("div", "card-meta");
    meta.appendChild(el("span", "", formatDate(article.date)));
    meta.appendChild(el("span", "", "·"));
    meta.appendChild(el("span", "", article.readingTime));
    card.appendChild(meta);

    list.appendChild(card);
  }
}

// ----------------------------------------------------------------------------
// Roteiro: detalhe (roteiro.html?id=...)
// ----------------------------------------------------------------------------

function renderArticleDetail(): void {
  const root = document.getElementById("roteiro-content");
  if (!root) return;

  const id = getParam("id");
  const article = (id ? ARTICLES.find((a) => a.id === id) : undefined) ?? ARTICLES[0];

  if (!article) {
    root.appendChild(el("p", "empty-state", "Roteiro não encontrado."));
    return;
  }

  root.appendChild(el("span", "tag tag-accent", "Roteiro"));
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

  if (article.episodeId) {
    const episode = EPISODES.find((e) => e.id === article.episodeId);
    if (episode) {
      const link = document.createElement("a");
      link.className = "text-link";
      link.style.display = "inline-block";
      link.style.marginTop = "1.5rem";
      link.href = `episodio.html?id=${episode.id}`;
      link.textContent = "← Ouvir o episódio correspondente";
      root.appendChild(link);
    }
  }

  const related = document.getElementById("roteiro-related");
  if (related) {
    const others = ARTICLES.filter((a) => a.id !== article.id);
    if (others.length === 0) {
      related.appendChild(
        el("p", "empty-state", "Ainda não há outros roteiros publicados.")
      );
    } else {
      for (const art of others) {
        const card = document.createElement("a");
        card.className = "card blueprint";
        card.href = `roteiro.html?id=${art.id}`;
        corners().forEach((c) => card.appendChild(c));
        card.appendChild(el("div", "card-kicker", "Roteiro"));
        card.appendChild(el("div", "card-title", art.title));
        related.appendChild(card);
      }
    }
  }

  document.title = `${article.title} — Astrobotânica`;
}

// ----------------------------------------------------------------------------
// Home: destaques
// ----------------------------------------------------------------------------

function renderHomeHighlights(): void {
  const epRoot = document.getElementById("home-latest-episode");
  if (epRoot) {
    const latest = [...EPISODES].sort((a, b) => b.number - a.number)[0];
    if (latest) {
      const row = document.createElement("a");
      row.className = "episode-row";
      row.href = `episodio.html?id=${latest.id}`;
      row.appendChild(el("span", "episode-row-number", pad(latest.number)));
      const main = el("div", "episode-row-main");
      main.appendChild(el("div", "episode-row-title", latest.title));
      main.appendChild(
        el("div", "episode-row-meta", `${latest.duration} · ${formatDate(latest.date)}`)
      );
      row.appendChild(main);
      epRoot.appendChild(row);
    } else {
      epRoot.appendChild(el("p", "empty-state", "Nenhum episódio publicado ainda."));
    }
  }

  const artRoot = document.getElementById("home-featured-article");
  if (artRoot) {
    const featured = ARTICLES[0];
    if (featured) {
      const card = document.createElement("a");
      card.className = "card blueprint";
      card.href = `roteiro.html?id=${featured.id}`;
      corners().forEach((c) => card.appendChild(c));
      card.appendChild(el("div", "card-kicker", "Roteiro"));
      card.appendChild(el("div", "card-title", featured.title));
      if (featured.subtitle) card.appendChild(el("p", "card-body", featured.subtitle));
      artRoot.appendChild(card);
    } else {
      artRoot.appendChild(el("p", "empty-state", "Nenhum roteiro publicado ainda."));
    }
  }
}

// ----------------------------------------------------------------------------
// Navegação mobile
// ----------------------------------------------------------------------------

function setupNav(): void {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  renderEpisodeList();
  renderEpisodeDetail();
  renderArticleList();
  renderArticleDetail();
  renderHomeHighlights();
});
