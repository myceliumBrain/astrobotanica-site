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
function getArticleIdFromPath() {
    const match = location.pathname.match(/^\/artigo\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
}

async function loadJSON(path) {
    try {
        // "no-cache" força revalidação com o servidor a cada carga (ver
        // src/main.ts) em vez de reaproveitar cegamente uma cópia salva do
        // navegador — sem isso, uma edição salva no admin podia não
        // aparecer no site publicado até o cache expirar sozinho.
        const res = await fetch(path, { cache: "no-cache" });
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
const loadPageviews = () => loadJSON("data/pageviews.json");

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

// Coluna "Redes sociais" do rodapé (ao lado de "Navegação") — lista de
// tamanho livre (nome + link) cadastrada no admin em Marca & navegação (ver
// contentData.site.socialLinks/renderSiteSocialLinks em admin/admin.js).
// Sem link nenhum cadastrado, a coluna inteira fica escondida (ver `hidden`
// no HTML de cada página) em vez de aparecer com o título e nada embaixo.
function renderFooterSocial() {
    const col = document.getElementById("footer-social-col");
    const container = document.getElementById("footer-social");
    if (!col || !container) return;
    container.innerHTML = "";
    const links = i18next.t("socialLinks", { returnObjects: true });
    const list = Array.isArray(links) ? links : [];
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

function localize(pt, en) {
    return i18next.language === "en" && en ? en : pt;
}

// ----------------------------------------------------------------------------
// Artigos: cartão em grade (pôster + título), usado na lista de artigos,
// na lista pequena da Home e em "continue lendo" — sempre da mesma forma.
// ----------------------------------------------------------------------------

function buildArticleCard(article, variant) {
    const card = document.createElement("a");
    card.className = variant ? `article-card article-card--${variant}` : "article-card";
    card.href = `/artigo/${article.id}/`;

    const image = el("div", "article-card-image");
    const cardImageSrc = variant ? (article.image || article.imageVertical) : (article.imageVertical || article.image);
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

    return card;
}

function renderArticleGrid(container, articles, emptyMessage) {
    container.innerHTML = "";
    container.classList.add("article-grid");
    if (articles.length === 0) {
        container.appendChild(el("p", "empty-state", emptyMessage));
        return;
    }
    articles.forEach((article) => container.appendChild(buildArticleCard(article)));
}

function buildArticleSplitCard(article) {
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

function buildHomeEventBanner() {
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

function renderHomeArticles(container, topArticles, remainingArticles, emptyMessage) {
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
// Artigo: detalhe (noticia.html?id=...)
// ----------------------------------------------------------------------------

// Ícones das redes (Simple Icons, CC0) — só os <path>, sem fill: a cor vem
// de currentColor (ver .article-share-link svg no CSS), pra acompanhar o
// hover/tema do resto do link sem precisar duplicar cada ícone por cor.
const SHARE_ICON_FACEBOOK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"/></svg>';
const SHARE_ICON_X =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231ZM17.083 19.77h1.833L7.084 4.126H5.117Z"/></svg>';
const SHARE_ICON_BLUESKY =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .689.378 5.629.624 6.479.815 2.736 3.713 3.66 6.383 3.364-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078 2.67.297 5.568-.628 6.383-3.364.246-.85.624-5.79.624-6.479 0-.689-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.747 13.087 8.686 12 10.8Z"/></svg>';
const SHARE_ICON_LINKEDIN =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 .001-4.124 2.062 2.062 0 0 1-.001 4.124ZM7.119 20.452H3.554V9h3.565v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0Z"/></svg>';
const SHARE_ICON_REDDIT =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0Zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701ZM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249Zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249Zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.593.593-1.856.793-2.512.793-.657 0-1.935-.2-2.512-.793a.326.326 0 0 0-.232-.094Z"/></svg>';
const SHARE_ICON_WHATSAPP =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347Zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884Zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>';
const SHARE_ICON_INSTAGRAM =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.332.014 7.052.072 2.695.272.273 2.69.073 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.69.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.668-.072-4.948-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z"/></svg>';
const SHARE_ICON_EMAIL =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13Zm2.2.3 7.8 6.5 7.8-6.5H4.2ZM20 7.1l-7.4 6.2a1 1 0 0 1-1.2 0L4 7.1v11.4c0 .3.2.5.5.5h15c.3 0 .5-.2.5-.5V7.1Z"/></svg>';

// Redes exibidas na linha de compartilhar. A maioria abre um link de
// compartilhamento numa aba nova (buildUrl); Instagram não tem intent de
// compartilhamento por URL (a plataforma não suporta isso pra links comuns),
// então em vez de um link quebrado, copia o endereço da notícia pra área de
// transferência (ver handleShareClick).
const SHARE_NETWORKS = [
    { name: "Facebook", icon: SHARE_ICON_FACEBOOK, buildUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { name: "X", icon: SHARE_ICON_X, buildUrl: (url, title) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
    { name: "Bluesky", icon: SHARE_ICON_BLUESKY, buildUrl: (url, title) => `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}` },
    { name: "LinkedIn", icon: SHARE_ICON_LINKEDIN, buildUrl: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { name: "Reddit", icon: SHARE_ICON_REDDIT, buildUrl: (url, title) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
    { name: "WhatsApp", icon: SHARE_ICON_WHATSAPP, buildUrl: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { name: "Instagram", icon: SHARE_ICON_INSTAGRAM },
    { name: "Email", icon: SHARE_ICON_EMAIL, buildUrl: (url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
];

// Instagram (ver comentário em SHARE_NETWORKS): copia o link e mostra um
// aviso curto ao lado dos ícones, que some sozinho.
function handleInstagramShareClick(container) {
    navigator.clipboard?.writeText(location.href).catch(() => { });
    const note = el("span", "article-share-copied", i18next.t("artigo.linkCopied"));
    container.appendChild(note);
    requestAnimationFrame(() => note.classList.add("visible"));
    setTimeout(() => note.remove(), 2600);
}

function buildArticleMetaRow(article) {
    const row = el("div", "article-meta-row");

    const bylineMeta = el("span", "article-byline-meta");
    bylineMeta.appendChild(document.createTextNode(formatDate(article.date)));
    if (article.time) {
        bylineMeta.appendChild(document.createTextNode(` ${i18next.t("artigo.publishedAt", { time: article.time })}`));
    }
    bylineMeta.appendChild(document.createTextNode(" · "));
    bylineMeta.appendChild(document.createTextNode(localize(article.readingTime, article.readingTimeEn)));
    row.appendChild(bylineMeta);

    const share = el("div", "article-share");
    share.appendChild(el("span", "article-share-label", i18next.t("artigo.shareLabel")));
    for (const network of SHARE_NETWORKS) {
        const a = document.createElement("a");
        a.className = "article-share-link";
        a.innerHTML = network.icon;
        a.setAttribute("aria-label", i18next.t("artigo.shareOn", { network: network.name }));
        a.title = network.name;
        if (network.buildUrl) {
            a.href = network.buildUrl(location.href, localize(article.title, article.titleEn));
            a.target = "_blank";
            a.rel = "noopener noreferrer";
        }
        else {
            a.href = "#";
            a.addEventListener("click", (e) => {
                e.preventDefault();
                handleInstagramShareClick(share);
            });
        }
        share.appendChild(a);
    }
    row.appendChild(share);

    return row;
}

function buildAuthorCard(article, members) {
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

// Barra lateral "mais recentes" ao lado do corpo do texto (ver
// .article-layout) — mesmas notícias que iriam pra "Continue lendo", só que
// resumidas (miniatura + título) e limitadas às N mais novas, não todas.
const ARTICLE_SIDEBAR_MAX_ITEMS = 3;

function buildSidebarList(heading, items) {
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

function buildArticleSidebar(recentItems, mostViewedItems) {
    const aside = el("aside", "article-sidebar");
    aside.appendChild(buildSidebarList(i18next.t("artigo.latestHeading"), recentItems.slice(0, ARTICLE_SIDEBAR_MAX_ITEMS)));
    if (mostViewedItems.length > 0) {
        aside.appendChild(buildSidebarList(i18next.t("artigo.mostViewedHeading"), mostViewedItems.slice(0, ARTICLE_SIDEBAR_MAX_ITEMS)));
    }
    return aside;
}

function renderArticleDetail(articles, members, pageviews) {
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
        .filter((a) => a !== undefined);

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
            }
            else {
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
const HOME_ARTICLES_TOP = 5;

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

    await initI18n();
    applyTranslations();
    renderFooterSocial();

    const [episodes, articles, members, pageviews] = await Promise.all([
        loadEpisodes(),
        loadArticles(),
        loadMembers(),
        loadPageviews(),
    ]);

    function renderAll() {
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
