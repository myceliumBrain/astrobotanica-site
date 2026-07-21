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
function renderEpisodeList(episodes) {
    const list = document.getElementById("episode-list");
    if (!list)
        return;
    if (episodes.failed) {
        list.appendChild(el("p", "empty-state", "Não foi possível carregar os episódios agora."));
        return;
    }
    if (episodes.items.length === 0) {
        list.appendChild(el("p", "empty-state", "Nenhum episódio publicado ainda. Volte em breve."));
        return;
    }
    for (const episode of episodes.items) {
        const row = document.createElement("a");
        row.className = "episode-row";
        row.href = `episodio.html?id=${episode.id}`;
        const main = el("div", "episode-row-main");
        main.appendChild(el("div", "episode-row-title", episode.title));
        main.appendChild(el("p", "episode-row-desc", episode.description));
        row.appendChild(el("span", "episode-row-number", pad(episode.number)));
        row.appendChild(main);
        row.appendChild(el("div", "episode-row-meta", `${episode.duration} · ${formatDate(episode.date)}`));
        list.appendChild(row);
    }
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
    root.appendChild(el("span", "tag tag-accent", `Episódio ${episode.number}`));
    root.appendChild(el("h1", "", episode.title));
    root.appendChild(el("p", "episode-detail-meta", `${formatDate(episode.date)} · ${episode.duration}`));
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
            related.appendChild(el("p", "empty-state", "Ainda não há outros episódios publicados."));
        }
        else {
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
function renderArticleList(articles) {
    const list = document.getElementById("article-list");
    if (!list)
        return;
    if (articles.failed) {
        list.appendChild(el("p", "empty-state", "Não foi possível carregar os artigos agora."));
        return;
    }
    if (articles.items.length === 0) {
        list.appendChild(el("p", "empty-state", "Nenhum artigo publicado ainda. Volte em breve."));
        return;
    }
    for (const article of articles.items) {
        const card = document.createElement("a");
        card.className = "card";
        card.href = `artigo.html?id=${article.id}`;
        card.appendChild(el("div", "card-kicker", article.category));
        card.appendChild(el("div", "card-title", article.title));
        card.appendChild(el("p", "card-body", article.excerpt));
        const meta = el("div", "card-meta");
        meta.appendChild(el("span", "", formatDate(article.date)));
        meta.appendChild(el("span", "", "·"));
        meta.appendChild(el("span", "", article.readingTime));
        card.appendChild(meta);
        list.appendChild(card);
    }
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
        if (others.length === 0) {
            related.appendChild(el("p", "empty-state", "Ainda não há outros artigos publicados."));
        }
        else {
            for (const art of others) {
                const card = document.createElement("a");
                card.className = "card";
                card.href = `artigo.html?id=${art.id}`;
                card.appendChild(el("div", "card-kicker", art.category));
                card.appendChild(el("div", "card-title", art.title));
                related.appendChild(card);
            }
        }
    }
    document.title = `${article.title} — Astrobotânica`;
}
function renderHomeHighlights(episodes, articles) {
    const epRoot = document.getElementById("home-latest-episode");
    if (epRoot) {
        if (episodes.failed) {
            epRoot.appendChild(el("p", "empty-state", "Não foi possível carregar os episódios agora."));
        }
        else {
            const latest = episodes.items[0];
            if (latest) {
                const row = document.createElement("a");
                row.className = "episode-row";
                row.href = `episodio.html?id=${latest.id}`;
                row.appendChild(el("span", "episode-row-number", pad(latest.number)));
                const main = el("div", "episode-row-main");
                main.appendChild(el("div", "episode-row-title", latest.title));
                main.appendChild(el("div", "episode-row-meta", `${latest.duration} · ${formatDate(latest.date)}`));
                row.appendChild(main);
                epRoot.appendChild(row);
            }
            else {
                epRoot.appendChild(el("p", "empty-state", "Nenhum episódio publicado ainda."));
            }
        }
    }
    const artRoot = document.getElementById("home-featured-article");
    if (artRoot) {
        if (articles.failed) {
            artRoot.appendChild(el("p", "empty-state", "Não foi possível carregar os artigos agora."));
        }
        else {
            const featured = articles.items[0];
            if (featured) {
                const card = document.createElement("a");
                card.className = "card";
                card.href = `artigo.html?id=${featured.id}`;
                card.appendChild(el("div", "card-kicker", featured.category));
                card.appendChild(el("div", "card-title", featured.title));
                card.appendChild(el("p", "card-body", featured.excerpt));
                artRoot.appendChild(card);
            }
            else {
                artRoot.appendChild(el("p", "empty-state", "Nenhum artigo publicado ainda."));
            }
        }
    }
}
function setupNav() {
    const toggle = document.getElementById("nav-toggle");
    const nav = document.getElementById("primary-nav");
    if (!toggle || !nav)
        return;
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
document.addEventListener("DOMContentLoaded", async () => {
    setupNav();
    const [episodes, articles, site] = await Promise.all([loadEpisodes(), loadArticles(), loadSiteText()]);
    applySiteText(site);
    renderEpisodeList(episodes);
    renderEpisodeDetail(episodes);
    renderArticleList(articles);
    renderArticleDetail(articles);
    renderHomeHighlights(episodes, articles);
});
