import { EPISODES, ARTICLES } from "./data.js";

// ----------------------------------------------------------------------------
// Utilitários
// ----------------------------------------------------------------------------

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return formatted;
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

// ----------------------------------------------------------------------------
// Renderização: Episódios
// ----------------------------------------------------------------------------

function renderEpisodes(): void {
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
    const card = el("article", "episode-card");
    card.id = episode.id;

    const number = el("span", "episode-number", pad(episode.number));
    const main = el("div", "episode-main");

    const meta = el("div", "episode-meta");
    meta.appendChild(el("span", "eyebrow-mono", `EP. ${pad(episode.number)}`));
    meta.appendChild(el("span", "meta-dot", "·"));
    meta.appendChild(el("time", "meta-date", formatDate(episode.date)));

    const title = el("h3", "episode-title", episode.title);
    const desc = el("p", "episode-desc", episode.description);

    const player = document.createElement("audio");
    player.controls = true;
    player.preload = "none";
    player.className = "episode-audio";
    const source = document.createElement("source");
    source.src = episode.audioSrc;
    source.type = "audio/mpeg";
    player.appendChild(source);
    player.appendChild(
      document.createTextNode("Seu navegador não suporta áudio incorporado.")
    );

    const footer = el("div", "episode-footer");
    footer.appendChild(el("span", "episode-duration", episode.duration));

    if (episode.articleId) {
      const link = el("button", "text-link", "Ler roteiro →");
      link.type = "button";
      link.addEventListener("click", () => openArticle(episode.articleId!));
      footer.appendChild(link);
    }

    main.appendChild(meta);
    main.appendChild(title);
    main.appendChild(desc);
    main.appendChild(player);
    main.appendChild(footer);

    card.appendChild(number);
    card.appendChild(main);
    list.appendChild(card);
  }
}

// ----------------------------------------------------------------------------
// Renderização: Roteiros (lista)
// ----------------------------------------------------------------------------

function renderArticles(): void {
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
    const card = el("article", "article-card");

    const meta = el("div", "article-meta");
    meta.appendChild(el("time", "meta-date", formatDate(article.date)));
    meta.appendChild(el("span", "meta-dot", "·"));
    meta.appendChild(el("span", "meta-reading", article.readingTime));

    const title = el("h3", "article-title", article.title);
    const body = card;

    body.appendChild(meta);
    body.appendChild(title);

    if (article.subtitle) {
      body.appendChild(el("p", "article-subtitle", article.subtitle));
    }

    const cta = el("button", "text-link", "Ler roteiro completo →");
    cta.type = "button";
    cta.addEventListener("click", () => openArticle(article.id));
    body.appendChild(cta);

    list.appendChild(card);
  }
}

// ----------------------------------------------------------------------------
// Leitor de roteiro (overlay em tela cheia)
// ----------------------------------------------------------------------------

function openArticle(id: string): void {
  const article = ARTICLES.find((a) => a.id === id);
  const overlay = document.getElementById("reader-overlay");
  const content = document.getElementById("reader-content");
  if (!article || !overlay || !content) return;

  content.innerHTML = "";

  const meta = el("div", "reader-meta");
  meta.appendChild(el("time", "meta-date", formatDate(article.date)));
  meta.appendChild(el("span", "meta-dot", "·"));
  meta.appendChild(el("span", "meta-reading", article.readingTime));
  content.appendChild(meta);

  content.appendChild(el("h1", "reader-title", article.title));

  if (article.subtitle) {
    content.appendChild(el("p", "reader-subtitle", article.subtitle));
  }

  const body = el("div", "reader-body");
  for (const paragraph of article.body) {
    body.appendChild(el("p", "", paragraph));
  }
  content.appendChild(body);

  if (article.episodeId) {
    const episode = EPISODES.find((e) => e.id === article.episodeId);
    if (episode) {
      const link = el(
        "button",
        "text-link",
        "← Voltar e ouvir o episódio correspondente"
      );
      link.type = "button";
      link.addEventListener("click", () => {
        closeArticle();
        document
          .getElementById(episode.id)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      content.appendChild(link);
    }
  }

  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  content.scrollTop = 0;
  (document.getElementById("reader-close") as HTMLButtonElement | null)?.focus();
}

function closeArticle(): void {
  const overlay = document.getElementById("reader-overlay");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

// ----------------------------------------------------------------------------
// Navegação mobile + inicialização
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

function setupReader(): void {
  document.getElementById("reader-close")?.addEventListener("click", closeArticle);
  document.getElementById("reader-overlay")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("reader-overlay")) closeArticle();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeArticle();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderEpisodes();
  renderArticles();
  setupNav();
  setupReader();
});
