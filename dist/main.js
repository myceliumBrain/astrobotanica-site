// ============================================================================
// main.js — gerado a partir de src/main.ts. Não edite diretamente:
// edite src/main.ts e recompile com `npx tsc`.
// ============================================================================
function formatDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}
function pad(n) {
    return n.toString().padStart(2, "0");
}
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function getParam(name) {
    return new URLSearchParams(location.search).get(name);
}
async function loadJSON(path) {
    try {
        const res = await fetch(path);
        if (!res.ok)
            throw new Error(`${path}: HTTP ${res.status}`);
        const items = (await res.json());
        return { items, failed: false };
    }
    catch (err) {
        console.error(`Falha ao carregar ${path}`, err);
        return { items: [], failed: true };
    }
}
const loadEpisodes = () => loadJSON("data/episodes.json");
const loadArticles = () => loadJSON("data/articles.json");
function getByPath(obj, path) {
    return path
        .split(".")
        .reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}
async function loadSiteText() {
    try {
        const res = await fetch("data/site.json");
        if (!res.ok)
            throw new Error(`data/site.json: HTTP ${res.status}`);
        return (await res.json());
    }
    catch (err) {
        console.error("Falha ao carregar data/site.json", err);
        return null;
    }
}
function applySiteText(site) {
    if (!site)
        return;
    document.querySelectorAll("[data-text]").forEach((el) => {
        const path = el.getAttribute("data-text");
        if (!path)
            return;
        const value = getByPath(site, path);
        if (typeof value !== "string")
            return;
        const attr = el.getAttribute("data-text-attr");
        if (attr)
            el.setAttribute(attr, value);
        else
            el.textContent = value;
    });
}
function buildEpisodeRow(episode, showDescription) {
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
    row.appendChild(el("div", "episode-row-meta", `${episode.duration} · ${formatDate(episode.date)}`));
    return row;
}
function renderEpisodeRows(container, episodes, emptyMessage, showDescription) {
    container.innerHTML = "";
    if (episodes.length === 0) {
        container.appendChild(el("p", "empty-state", emptyMessage));
        return;
    }
    for (const episode of episodes) {
        container.appendChild(buildEpisodeRow(episode, showDescription));
    }
}
function renderEpisodeList(episodes) {
    const list = document.getElementById("episode-list");
    if (!list)
        return;
    if (episodes.failed) {
        list.appendChild(el("p", "empty-state", "Não foi possível carregar os episódios agora."));
        return;
    }
    renderEpisodeRows(list, episodes.items, "Nenhum episódio publicado ainda. Volte em breve.", true);
}
function renderEpisodeDetail(episodes) {
    const root = document.getElementById("episodio-content");
    if (!root)
        return;
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
    const tag = el("span", "tag tag-accent", `Episódio ${episode.number}`);
    const heading = el("h1", "", episode.title);
    const meta = el("p", "episode-detail-meta", `${formatDate(episode.date)} · ${episode.duration}`);
    if (episode.image) {
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
    }
    else {
        root.appendChild(tag);
        root.appendChild(heading);
        root.appendChild(meta);
    }
    root.appendChild(el("p", "player-label", "Ouça o podcast"));
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
    const body = el("div", "episode-description");
    body.appendChild(el("p", "", episode.description));
    root.appendChild(body);
    if (episode.transcript && episode.transcript.length > 0) {
        root.appendChild(el("h2", "transcript-heading", "Transcrição completa"));
        const wrap = el("div", "transcript-wrap collapsed");
        const transcript = el("div", "episode-body");
        for (const paragraph of episode.transcript) {
            transcript.appendChild(el("p", "", paragraph));
        }
        wrap.appendChild(transcript);
        root.appendChild(wrap);
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "transcript-toggle";
        const chevron = el("span", "chevron", "▼");
        const label = document.createTextNode(" Ver transcrição completa");
        toggle.appendChild(chevron);
        toggle.appendChild(label);
        toggle.addEventListener("click", () => {
            const collapsed = wrap.classList.toggle("collapsed");
            chevron.textContent = collapsed ? "▼" : "▲";
            label.textContent = collapsed ? " Ver transcrição completa" : " Ver menos";
        });
        root.appendChild(toggle);
    }
    const related = document.getElementById("episodio-related");
    if (related) {
        const others = episodes.items.filter((e) => e.id !== episode.id);
        if (others.length === 0) {
            related.appendChild(el("p", "empty-state", "Ainda não há outros episódios publicados."));
        }
        else {
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
function buildArticleCard(article) {
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
    card.appendChild(el("div", "article-card-meta", `${formatDate(article.date)} · ${article.readingTime}`));
    return card;
}
function renderArticleGrid(container, articles, emptyMessage) {
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
function renderArticleList(articles) {
    const list = document.getElementById("article-list");
    if (!list)
        return;
    if (articles.failed) {
        list.appendChild(el("p", "empty-state", "Não foi possível carregar os artigos agora."));
        return;
    }
    renderArticleGrid(list, articles.items, "Nenhum artigo publicado ainda. Volte em breve.");
}
function renderArticleDetail(articles) {
    const root = document.getElementById("artigo-content");
    if (!root)
        return;
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
const HOME_MAX_ITEMS = 6;
function selectHomeItems(items, max) {
    const featured = items.filter((item) => item.featured);
    const nonFeatured = items.filter((item) => !item.featured);
    const fill = nonFeatured.slice(0, Math.max(0, max - featured.length));
    const selected = new Set([...featured.slice(0, max), ...fill]);
    return items.filter((item) => selected.has(item));
}
function renderHomeHighlights(episodes, articles) {
    const epRoot = document.getElementById("home-episodes");
    if (epRoot) {
        if (episodes.failed) {
            epRoot.appendChild(el("p", "empty-state", "Não foi possível carregar os episódios agora."));
        }
        else {
            renderEpisodeRows(epRoot, selectHomeItems(episodes.items, HOME_MAX_ITEMS), "Nenhum episódio publicado ainda.", false);
        }
    }
    const artRoot = document.getElementById("home-featured-article");
    if (artRoot) {
        if (articles.failed) {
            artRoot.appendChild(el("p", "empty-state", "Não foi possível carregar os artigos agora."));
        }
        else {
            renderArticleGrid(artRoot, selectHomeItems(articles.items, HOME_MAX_ITEMS), "Nenhum artigo publicado ainda.");
        }
    }
}
function setupHeaderAutoHide() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const scrollMargin = 12;
    let lastY = window.scrollY;
    let ticking = false;
    function update() {
        const currentY = window.scrollY;
        const delta = currentY - lastY;
        if (Math.abs(delta) > scrollMargin) {
            const scrollingDown = delta > 0 && currentY > header.offsetHeight;
            header.classList.toggle("site-header--hidden", scrollingDown);
            lastY = currentY;
        }
        ticking = false;
    }
    window.addEventListener("scroll", () => {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });
}
document.addEventListener("DOMContentLoaded", async () => {
    setupHeaderAutoHide();
    const [episodes, articles, site] = await Promise.all([loadEpisodes(), loadArticles(), loadSiteText()]);
    applySiteText(site);
    renderEpisodeList(episodes);
    renderEpisodeDetail(episodes);
    renderArticleList(articles);
    renderArticleDetail(articles);
    renderHomeHighlights(episodes, articles);
});
