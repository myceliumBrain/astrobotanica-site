// ----------------------------------------------------------------------------
// Utilitários
// ----------------------------------------------------------------------------

function formatDate(iso) {
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

function pad(n) {
    return n.toString().padStart(2, "0");
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function getParam(name) {
    return new URLSearchParams(location.search).get(name);
}

async function loadJSON(path) {
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        const items = await res.json();
        return { items, failed: false };
    } catch (err) {
        console.error(`Falha ao carregar ${path}`, err);
        return { items: [], failed: true };
    }
}

const loadEpisodes = () => loadJSON("data/episodes.json");
const loadArticles = () => loadJSON("data/articles.json");
const loadMembers = () => loadJSON("data/members.json");

// ----------------------------------------------------------------------------
// Idioma: pt/en via i18next. Os textos fixos do site vivem em data/site.json
// (pt, também usado pelo painel /admin) e data/site.en.json (en, tradução
// mantida à mão). data-text="a.b.c" no HTML marca onde aplicar cada chave;
// data-text-attr="atributo" aplica num atributo em vez de textContent (usado
// em <meta description> e nos aria-label).
// ----------------------------------------------------------------------------

function detectInitialLang() {
    const stored = localStorage.getItem("lang");
    if (stored === "pt" || stored === "en") return stored;
    return navigator.language.slice(0, 2).toLowerCase() === "en" ? "en" : "pt";
}

function getByPath(obj, path) {
    return path
        .split(".")
        .reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

// Se o i18next (carregado via CDN, ver <head>) não estiver disponível — CDN
// bloqueado/offline — substitui o global por um tradutor mínimo em cima do
// JSON em português, só para o site continuar funcionando (sem troca de
// idioma) em vez de quebrar por completo.
function installI18nFallback(ptResources) {
    window.i18next = {
        language: "pt",
        t: (key, opts) => {
            const raw = getByPath(ptResources, key);
            if (typeof raw !== "string") return key;
            if (!opts) return raw;
            return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => (opts[k] !== undefined ? String(opts[k]) : ""));
        },
        exists: (key) => typeof getByPath(ptResources, key) === "string",
        changeLanguage: async () => {},
    };
}

async function initI18n() {
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

function applyTranslations() {
    document.querySelectorAll("[data-text]").forEach((node) => {
        const path = node.getAttribute("data-text");
        if (!path || !i18next.exists(path)) return;
        const value = i18next.t(path);
        const attr = node.getAttribute("data-text-attr");
        if (attr) node.setAttribute(attr, value);
        else node.textContent = value;
    });
}

function setupLangSwitch(onChange) {
    const buttons = document.querySelectorAll(".lang-btn");
    if (buttons.length === 0) return;

    function reflect() {
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

function buildEpisodeRow(episode, showDescription) {
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

// ----------------------------------------------------------------------------
// Podcast: lista de episódios
// ----------------------------------------------------------------------------

function renderEpisodeList(episodes) {
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

function renderEpisodeDetail(episodes) {
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

    root.appendChild(el("p", "player-label", i18next.t("episodio.listenLabel")));

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
    root.appendChild(player);

    const body = el("div", "episode-description");
    body.appendChild(el("p", "", episode.description));
    root.appendChild(body);

    if (episode.transcript && episode.transcript.length > 0) {
        root.appendChild(el("h2", "transcript-heading", i18next.t("episodio.transcriptHeading")));

        // Começa recolhida (só as primeiras linhas, com fade) pra não empurrar
        // "outros episódios" pra longe — o botão abaixo expande sob demanda.
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
        const label = document.createTextNode(` ${i18next.t("episodio.transcriptExpand")}`);
        toggle.appendChild(chevron);
        toggle.appendChild(label);
        toggle.addEventListener("click", () => {
            const collapsed = wrap.classList.toggle("collapsed");
            chevron.textContent = collapsed ? "▼" : "▲";
            label.textContent = ` ${i18next.t(collapsed ? "episodio.transcriptExpand" : "episodio.transcriptCollapse")}`;
        });
        root.appendChild(toggle);
    }

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

// ----------------------------------------------------------------------------
// Artigos: cartão em grade (pôster + título), usado na lista de artigos,
// nos destaques da Home e em "continue lendo" — sempre da mesma forma.
// ----------------------------------------------------------------------------

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
    card.appendChild(
        el("div", "article-card-meta", `${formatDate(article.date)} · ${article.readingTime}`)
    );

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

// ----------------------------------------------------------------------------
// Artigos: lista
// ----------------------------------------------------------------------------

function renderArticleList(articles) {
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
// Artigo: detalhe (artigo.html?id=...)
// ----------------------------------------------------------------------------

function renderArticleDetail(articles) {
    const root = document.getElementById("artigo-content");
    if (!root) return;
    root.innerHTML = "";

    if (articles.failed) {
        root.appendChild(el("p", "empty-state", i18next.t("artigo.loadError")));
        return;
    }

    const id = getParam("id");
    const article = (id ? articles.items.find((a) => a.id === id) : undefined) ?? articles.items[0];

    if (!article) {
        root.appendChild(el("p", "empty-state", i18next.t("artigo.notFound")));
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
        renderArticleGrid(related, others, i18next.t("artigo.noOthers"));
    }

    document.title = `${article.title} — Astrobotânica`;
}

// ----------------------------------------------------------------------------
// Home: destaques
// ----------------------------------------------------------------------------

const HOME_MAX_ITEMS = 6;

// A Home mostra, no máximo, HOME_MAX_ITEMS itens: primeiro todos os
// marcados como "featured" no admin (até o limite), e as vagas restantes
// são preenchidas pelos não marcados mais próximos do topo do array (ou
// seja, os mais recentes — um item novo entra no topo por padrão). A
// ordem final preserva a ordem original do array, então o resultado é
// sempre um subconjunto contíguo-por-prioridade da lista completa.
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
            renderArticleGrid(artRoot, selectHomeItems(articles.items, HOME_MAX_ITEMS), i18next.t("home.emptyArticles"));
        }
    }
}

// ----------------------------------------------------------------------------
// Sobre: integrantes (cadastrados pelo painel /admin, ver data/members.json)
// ----------------------------------------------------------------------------

function buildMemberCard(member) {
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

    const info = el("div", "card member-info");
    info.appendChild(el("div", "card-title", member.name));
    info.appendChild(el("p", "card-body", member.description));

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

function renderMembersList(members) {
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
// Tema claro/escuro: a escolha (ou preferência do sistema) já é aplicada em
// <html data-theme="..."> por um script inline no <head> de cada página,
// antes da primeira pintura (evita flash do tema errado). Aqui só cuidamos
// do botão: refletir o estado atual e alternar/persistir ao clicar.
// ----------------------------------------------------------------------------

function setupThemeToggle() {
    const toggle = document.querySelector(".theme-toggle");
    if (!toggle) return;

    const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
    toggle.setAttribute("aria-checked", String(isDark()));

    toggle.addEventListener("click", () => {
        const next = isDark() ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        toggle.setAttribute("aria-checked", String(next === "dark"));
    });
}

// ----------------------------------------------------------------------------
// Menu: overlay de navegação aberto pelo botão hamburguer (.nav-toggle)
// ----------------------------------------------------------------------------

function setupNavOverlay() {
    const toggle = document.querySelector(".nav-toggle");
    const overlay = document.getElementById("nav-overlay");
    if (!toggle || !overlay) return;

    const closeBtn = overlay.querySelector(".nav-overlay-close");

    function open() {
        overlay.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
        document.body.classList.add("nav-open");
    }

    function close() {
        overlay.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
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

function setupHeaderAutoHide() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const scrollMargin = 12; // ignora tremores pequenos (ex: bounce do iOS)
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
    setupThemeToggle();

    await initI18n();
    applyTranslations();

    const [episodes, articles, members] = await Promise.all([loadEpisodes(), loadArticles(), loadMembers()]);

    function renderAll() {
        renderEpisodeList(episodes);
        renderEpisodeDetail(episodes);
        renderArticleList(articles);
        renderArticleDetail(articles);
        renderHomeHighlights(episodes, articles);
        renderMembersList(members);
    }

    renderAll();
    setupLangSwitch(renderAll);
});
