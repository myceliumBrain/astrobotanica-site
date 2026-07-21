// ============================================================================
// admin.js — painel de administração de conteúdo.
//
// Modelo: ao entrar, episodes.json/articles.json/site.json são carregados
// uma vez para a memória (contentData). Reordenar, adicionar, remover e
// editar campos só mudam essa cópia em memória e marcam a seção como suja
// (dirty) — nada é gravado no GitHub até clicar em "Salvar no GitHub", que
// faz o commit de cada arquivo sujo de uma vez. Os acessos (data/auth.json)
// são a exceção: cada ação ali já commita na hora, como antes.
//
// Autenticação: cada pessoa usa seu próprio token de acesso pessoal do
// GitHub, criptografado (AES-GCM, chave derivada via PBKDF2 a partir da
// senha escolhida) e guardado em data/auth.json. O token decifrado vive só
// na memória da aba durante a sessão.
// ============================================================================

const CONFIG = {
  owner: "myceliumBrain",
  repo: "astrobotanica-site",
  branch: "main",
  authPath: "data/auth.json",
  episodesPath: "data/episodes.json",
  articlesPath: "data/articles.json",
  sitePath: "data/site.json",
};

const PATHS = {
  articles: CONFIG.articlesPath,
  episodes: CONFIG.episodesPath,
  site: CONFIG.sitePath,
};

const LOCKOUT = {
  storageKey: "astrobotanica-admin-attempts",
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
};

let TOKEN = ""; // token decifrado, só em memória — nunca persistido

// Textos do site: cada campo é uma chave "a.b.c" dentro de data/site.json.
// GENERAL_SCHEMA vira o painel "Marca & navegação"; cada item de
// PAGE_SCHEMA vira seu próprio item de menu + painel em "Páginas".
const GENERAL_SCHEMA = [
  {
    heading: "Marca",
    fields: [
      { key: "brand.name", label: "Nome (logo no menu e rodapé)", type: "text" },
      { key: "brand.footerTagline", label: "Frase do rodapé", type: "textarea" },
      { key: "brand.copyright", label: "Linha de copyright do rodapé", type: "text" },
    ],
  },
  {
    heading: "Menu de navegação",
    fields: [
      { key: "nav.home", label: "Home", type: "text" },
      { key: "nav.articles", label: "Artigos", type: "text" },
      { key: "nav.podcast", label: "Podcast", type: "text" },
      { key: "nav.about", label: "Sobre", type: "text" },
      { key: "nav.contact", label: "Contato", type: "text" },
    ],
  },
  {
    heading: "Rodapé",
    fields: [
      { key: "footer.navHeading", label: "Título da coluna de navegação", type: "text" },
      { key: "footer.listenHeading", label: "Título da coluna \"Ouça em\"", type: "text" },
    ],
  },
  {
    heading: "Plataformas (usado no rodapé, Podcast e Contato)",
    fields: [
      { key: "platforms.spotify", label: "Spotify", type: "text" },
      { key: "platforms.apple", label: "Apple Podcasts", type: "text" },
      { key: "platforms.rss", label: "RSS", type: "text" },
      { key: "platforms.instagram", label: "Instagram", type: "text" },
    ],
  },
];

const PAGE_SCHEMA = [
  {
    key: "home",
    label: "Home",
    fields: [
      { key: "home.metaTitle", label: "Título da aba do navegador", type: "text" },
      { key: "home.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "home.featuredHeading", label: "Título \"Artigos em destaque\"", type: "text" },
      { key: "home.featuredCta", label: "Link \"ver todos\"", type: "text" },
      { key: "home.panelKicker", label: "Selo do painel do podcast", type: "text" },
    ],
  },
  {
    key: "podcast",
    label: "Podcast",
    fields: [
      { key: "podcast.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "podcast.tag", label: "Selo", type: "text" },
      { key: "podcast.title", label: "Título", type: "text" },
      { key: "podcast.intro", label: "Texto de introdução", type: "textarea" },
    ],
  },
  {
    key: "episodio",
    label: "Episódio",
    fields: [
      { key: "episodio.backLink", label: "Link \"voltar\"", type: "text" },
      { key: "episodio.relatedHeading", label: "Título \"outros episódios\"", type: "text" },
    ],
  },
  {
    key: "artigos",
    label: "Artigos",
    fields: [
      { key: "artigos.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "artigos.tag", label: "Selo", type: "text" },
      { key: "artigos.title", label: "Título", type: "text" },
      { key: "artigos.intro", label: "Texto de introdução", type: "textarea" },
    ],
  },
  {
    key: "artigo",
    label: "Artigo",
    fields: [
      { key: "artigo.backLink", label: "Link \"voltar\"", type: "text" },
      { key: "artigo.relatedHeading", label: "Título \"continue lendo\"", type: "text" },
    ],
  },
  {
    key: "sobre",
    label: "Sobre",
    fields: [
      { key: "sobre.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "sobre.tag", label: "Selo", type: "text" },
      { key: "sobre.title", label: "Título", type: "text" },
      { key: "sobre.intro", label: "Texto de introdução", type: "textarea" },
      { key: "sobre.card1Kicker", label: "Cartão 1 — selo", type: "text" },
      { key: "sobre.card1Title", label: "Cartão 1 — título", type: "text" },
      { key: "sobre.card1Body", label: "Cartão 1 — texto", type: "textarea" },
      { key: "sobre.card2Kicker", label: "Cartão 2 — selo", type: "text" },
      { key: "sobre.card2Title", label: "Cartão 2 — título", type: "text" },
      { key: "sobre.card2Body", label: "Cartão 2 — texto", type: "textarea" },
      { key: "sobre.card3Kicker", label: "Cartão 3 — selo", type: "text" },
      { key: "sobre.card3Title", label: "Cartão 3 — título", type: "text" },
      { key: "sobre.card3Body", label: "Cartão 3 — texto", type: "textarea" },
    ],
  },
  {
    key: "contato",
    label: "Contato",
    fields: [
      { key: "contato.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "contato.tag", label: "Selo", type: "text" },
      { key: "contato.title", label: "Título", type: "text" },
      { key: "contato.intro", label: "Texto de introdução", type: "textarea" },
      { key: "contato.emailKicker", label: "Selo do cartão de email", type: "text" },
      { key: "contato.email", label: "Email de contato", type: "text" },
      { key: "contato.emailNote", label: "Nota abaixo do email", type: "text" },
    ],
  },
];

// ----------------------------------------------------------------------------
// Utilitários gerais
// ----------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function linesToParagraphs(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function uniqueSlug(existingIds, base) {
  let candidate = slugify(base) || "item";
  let n = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${slugify(base)}-${n}`;
    n += 1;
  }
  return candidate;
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      cur[key] = value;
    } else {
      if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
      cur = cur[key];
    }
  });
}

// ----------------------------------------------------------------------------
// Criptografia — AES-GCM com chave derivada via PBKDF2
// ----------------------------------------------------------------------------

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToB64(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptToken(token, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(token));
  return { salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(encrypted) };
}

async function decryptToken(entry, password) {
  try {
    const salt = b64ToBytes(entry.salt);
    const iv = b64ToBytes(entry.iv);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, b64ToBytes(entry.data));
    return textDecoder.decode(decrypted);
  } catch {
    return null; // senha errada (ou registro corrompido) — indistinguível de propósito
  }
}

// ----------------------------------------------------------------------------
// Tentativas de login (só um deterrente de UX no navegador — não é uma
// trava de segurança real, dá pra contornar limpando o localStorage)
// ----------------------------------------------------------------------------

function getLoginState() {
  try {
    return JSON.parse(localStorage.getItem(LOCKOUT.storageKey)) || {};
  } catch {
    return {};
  }
}

function setLoginState(state) {
  localStorage.setItem(LOCKOUT.storageKey, JSON.stringify(state));
}

function checkLockout() {
  const state = getLoginState();
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    const mins = Math.ceil((state.lockedUntil - Date.now()) / 60000);
    return `Muitas tentativas. Aguarde ${mins} min.`;
  }
  return null;
}

function recordFailedAttempt() {
  const state = getLoginState();
  state.attempts = (state.attempts || 0) + 1;
  let remaining = LOCKOUT.maxAttempts - state.attempts;
  if (state.attempts >= LOCKOUT.maxAttempts) {
    state.lockedUntil = Date.now() + LOCKOUT.lockoutMs;
    state.attempts = 0;
    remaining = 0;
  }
  setLoginState(state);
  return remaining;
}

function clearLoginState() {
  localStorage.removeItem(LOCKOUT.storageKey);
}

// ----------------------------------------------------------------------------
// GitHub API
// ----------------------------------------------------------------------------

async function ghRequest(path, { auth = true, ...options } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {}),
  };
  if (auth) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { ...options, headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `GitHub API: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function utf8ToBase64(str) {
  return bytesToB64(textEncoder.encode(str));
}

function base64ToUtf8(b64) {
  return textDecoder.decode(b64ToBytes(b64.replace(/\n/g, "")));
}

// Um arquivo vazio/corrompido no GitHub (ex: alguém apagou o conteúdo sem
// colocar um JSON válido) não deve travar o app com um erro de parse — é
// tratado como "sem dados" e cada chamador decide o que fazer com isso.
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getFileAnon(path) {
  const data = await ghRequest(
    `/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}&_=${Date.now()}`,
    { auth: false }
  );
  return { content: safeJsonParse(base64ToUtf8(data.content)), sha: data.sha };
}

async function getFile(path) {
  const data = await ghRequest(
    `/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}&_=${Date.now()}`
  );
  return { content: safeJsonParse(base64ToUtf8(data.content)), sha: data.sha };
}

async function putFile(path, contentObj, sha, message) {
  const content = JSON.stringify(contentObj, null, 2) + "\n";
  return ghRequest(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: utf8ToBase64(content),
      sha,
      branch: CONFIG.branch,
    }),
  });
}

// ----------------------------------------------------------------------------
// Telas de acesso
// ----------------------------------------------------------------------------

function showScreen(id) {
  ["setup-screen", "login-screen", "app-screen"].forEach((s) => {
    document.getElementById(s).hidden = s !== id;
  });
}

async function init() {
  let auth;
  try {
    auth = await getFileAnon(CONFIG.authPath);
  } catch (err) {
    showScreen("login-screen");
    document.getElementById("login-error").textContent = `Não foi possível verificar os acessos: ${err.message}`;
    return;
  }

  const tokens = auth.content?.tokens;
  if (!tokens || tokens.length === 0) {
    setupSetupScreen();
  } else {
    setupLoginScreen();
  }
}

function setupSetupScreen() {
  showScreen("setup-screen");
  const submit = document.getElementById("setup-submit");
  const labelInput = document.getElementById("setup-label");
  const tokenInput = document.getElementById("setup-token");
  const passwordInput = document.getElementById("setup-password");
  const error = document.getElementById("setup-error");

  const attempt = async () => {
    const label = labelInput.value.trim() || "admin";
    const token = tokenInput.value.trim();
    const password = passwordInput.value;
    if (!token || !password) {
      error.textContent = "Preencha o token e a senha.";
      return;
    }
    submit.disabled = true;
    error.textContent = "";
    TOKEN = token;
    try {
      const fresh = await getFile(CONFIG.authPath);
      const encrypted = await encryptToken(token, password);
      const updated = { tokens: [...(fresh.content?.tokens || []), { label, ...encrypted }] };
      await putFile(CONFIG.authPath, updated, fresh.sha, `admin: configura autenticação (${label})`);
      await enterApp();
    } catch (err) {
      TOKEN = "";
      error.textContent = `Não foi possível configurar: ${err.message}`;
    } finally {
      submit.disabled = false;
    }
  };

  submit.addEventListener("click", attempt);
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attempt();
  });
}

function setupLoginScreen() {
  showScreen("login-screen");
  const submit = document.getElementById("login-submit");
  const passwordInput = document.getElementById("login-password");
  const error = document.getElementById("login-error");

  const lockMessage = checkLockout();
  if (lockMessage) error.textContent = lockMessage;

  const attempt = async () => {
    const lock = checkLockout();
    if (lock) {
      error.textContent = lock;
      return;
    }
    const password = passwordInput.value;
    if (!password) return;
    submit.disabled = true;
    error.textContent = "";
    try {
      const fresh = await getFileAnon(CONFIG.authPath);
      const tokens = fresh.content?.tokens || [];
      let recovered = null;
      for (const entry of tokens) {
        recovered = await decryptToken(entry, password);
        if (recovered) break;
      }
      if (!recovered) {
        const remaining = recordFailedAttempt();
        error.textContent =
          remaining > 0
            ? `Senha incorreta. ${remaining} tentativa(s) restante(s).`
            : `Muitas tentativas. Aguarde 15 min.`;
        return;
      }
      clearLoginState();
      TOKEN = recovered;
      await enterApp();
    } catch (err) {
      error.textContent = `Não foi possível entrar: ${err.message}`;
    } finally {
      submit.disabled = false;
    }
  };

  submit.addEventListener("click", attempt);
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attempt();
  });
}

// ----------------------------------------------------------------------------
// App: navegação por abas laterais
// ----------------------------------------------------------------------------

function setupNav() {
  document.querySelector(".adm-sidebar").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-btn");
    if (!btn) return;
    showPanel(btn.dataset.panel);
  });
}

function showPanel(name) {
  document.querySelectorAll(".section-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  const panel = document.getElementById("panel-" + name);
  if (panel) panel.classList.add("active");
  const btn = document.querySelector(`.nav-btn[data-panel="${name}"]`);
  if (btn) btn.classList.add("active");
}

function setupPagePanels() {
  const sidebarContainer = document.getElementById("sidebar-pages");
  const panelsContainer = document.getElementById("page-panels");
  sidebarContainer.innerHTML = "";
  panelsContainer.innerHTML = "";

  for (const page of PAGE_SCHEMA) {
    const navBtn = el("button", "nav-btn", page.label);
    navBtn.type = "button";
    navBtn.dataset.panel = `page-${page.key}`;
    sidebarContainer.appendChild(navBtn);

    const panel = el("div", "section-panel");
    panel.id = `panel-page-${page.key}`;
    const header = el("div", "panel-header");
    header.appendChild(el("span", "panel-title", page.label));
    panel.appendChild(header);
    const formContainer = el("div");
    formContainer.id = `page-form-${page.key}`;
    panel.appendChild(formContainer);
    panelsContainer.appendChild(panel);
  }
}

async function enterApp() {
  showScreen("app-screen");
  setupPagePanels();
  setupNav();
  document.getElementById("logout-btn").addEventListener("click", () => {
    TOKEN = "";
    location.reload();
  });
  document.getElementById("save-btn").addEventListener("click", saveAll);
  document.getElementById("add-article-btn").addEventListener("click", addArticle);
  document.getElementById("add-episode-btn").addEventListener("click", addEpisode);
  document.getElementById("access-submit").addEventListener("click", addAccess);

  await loadContent();
  renderPageForms();
  await loadAccess();
}

// ----------------------------------------------------------------------------
// Conteúdo: carregar, salvar, marcar sujo
// ----------------------------------------------------------------------------

let contentData = { articles: null, episodes: null, site: null };
const dirty = new Set();

function setSaveStatus(message, kind) {
  const status = document.getElementById("save-status");
  status.textContent = message;
  if (kind) status.setAttribute("data-kind", kind);
  else status.removeAttribute("data-kind");
}

let toastTimer = null;
function toast(message, kind) {
  const node = document.getElementById("toast");
  node.textContent = message;
  if (kind) node.setAttribute("data-kind", kind);
  else node.removeAttribute("data-kind");
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
}

function markDirty(section) {
  dirty.add(section);
  document.getElementById("save-btn").disabled = false;
  setSaveStatus("alterações pendentes", "pending");
}

async function loadContent() {
  setSaveStatus("carregando…");
  try {
    const [articles, episodes, site] = await Promise.all([
      getFile(CONFIG.articlesPath),
      getFile(CONFIG.episodesPath),
      getFile(CONFIG.sitePath),
    ]);
    contentData.articles = articles.content;
    contentData.episodes = episodes.content;
    contentData.site = site.content;
    dirty.clear();
    renderArticlesList();
    renderEpisodesList();
    renderGeneralForm();
    setSaveStatus("dados carregados ✓", "ok");
    document.getElementById("save-btn").disabled = true;
  } catch (err) {
    setSaveStatus("erro ao carregar ✗", "err");
    toast(`Não foi possível carregar: ${err.message}`, "error");
  }
}

function collectAll() {
  document.querySelectorAll("[data-article]").forEach((input) => {
    const i = Number(input.dataset.article);
    const key = input.dataset.key;
    const record = contentData.articles[i];
    if (!record) return;
    const value = input.dataset.multiline === "paragraphs" ? linesToParagraphs(input.value) : input.value;
    if ((key === "subtitle" || key === "image") && !value) delete record[key];
    else record[key] = value;
  });
  document.querySelectorAll("[data-episode]").forEach((input) => {
    const i = Number(input.dataset.episode);
    const key = input.dataset.key;
    const record = contentData.episodes[i];
    if (!record) return;
    if (key === "number") {
      record.number = Number(input.value);
      return;
    }
    if (input.dataset.multiline === "paragraphs") {
      const paragraphs = linesToParagraphs(input.value);
      if (paragraphs.length === 0) delete record.transcript;
      else record.transcript = paragraphs;
      return;
    }
    record[key] = input.value;
  });
  document.querySelectorAll("[data-site]").forEach((input) => {
    setByPath(contentData.site, input.dataset.site, input.value);
  });
}

async function saveAll() {
  collectAll();
  if (dirty.size === 0) return;
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  setSaveStatus("salvando…", "pending");
  try {
    for (const section of dirty) {
      const fresh = await getFile(PATHS[section]);
      await putFile(PATHS[section], contentData[section], fresh.sha, `admin: atualiza ${section}`);
    }
    dirty.clear();
    setSaveStatus("salvo ✓", "ok");
    toast("Salvo no GitHub!", "ok");
  } catch (err) {
    setSaveStatus("erro ao salvar ✗", "err");
    toast(`Erro: ${err.message}`, "error");
    saveBtn.disabled = false;
  }
}

// ----------------------------------------------------------------------------
// Helpers de campo/reordenação (compartilhados)
// ----------------------------------------------------------------------------

function buildField(labelText, inputEl) {
  const field = el("div", "field");
  const labelId = `f-${Math.random().toString(36).slice(2, 9)}`;
  const label = el("label", "", labelText);
  label.htmlFor = labelId;
  inputEl.id = labelId;
  field.appendChild(label);
  field.appendChild(inputEl);
  return field;
}

function buildInput(labelText, type, value, dataset, placeholder) {
  const input = document.createElement("input");
  input.className = "input";
  input.type = type;
  input.value = value ?? "";
  if (placeholder) input.placeholder = placeholder;
  Object.entries(dataset).forEach(([k, v]) => { input.dataset[k] = v; });
  return buildField(labelText, input);
}

function buildTextarea(labelText, value, dataset, multilineParagraphs) {
  const textarea = document.createElement("textarea");
  textarea.className = "input";
  textarea.value = value ?? "";
  textarea.rows = 4;
  Object.entries(dataset).forEach(([k, v]) => { textarea.dataset[k] = v; });
  if (multilineParagraphs) textarea.dataset.multiline = "paragraphs";
  return buildField(labelText, textarea);
}

function buildReorderButtons(idx, total, onUp, onDown) {
  const wrap = el("div", "reorder-btns");
  const up = el("button", "reorder-btn", "▲");
  up.type = "button";
  up.title = "Mover para cima";
  up.disabled = idx === 0;
  up.addEventListener("click", (e) => { e.stopPropagation(); onUp(); });
  const down = el("button", "reorder-btn", "▼");
  down.type = "button";
  down.title = "Mover para baixo";
  down.disabled = idx === total - 1;
  down.addEventListener("click", (e) => { e.stopPropagation(); onDown(); });
  wrap.appendChild(up);
  wrap.appendChild(down);
  return wrap;
}

// ----------------------------------------------------------------------------
// Artigos
// ----------------------------------------------------------------------------

function renderArticlesList() {
  const container = document.getElementById("articles-list");
  container.innerHTML = "";
  const items = contentData.articles;
  document.getElementById("nav-count-articles").textContent = items.length || "";
  document.getElementById("count-articles").textContent = `${items.length} ${items.length === 1 ? "artigo" : "artigos"}`;

  if (items.length === 0) {
    container.appendChild(el("p", "empty-state", "Nenhum artigo cadastrado ainda."));
    return;
  }

  items.forEach((article, i) => container.appendChild(buildArticleCard(article, i, items.length)));
}

function buildArticleCard(article, i, total) {
  const card = el("div", "card");
  card.id = `article-card-${i}`;

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  left.appendChild(buildReorderButtons(i, total, () => moveArticle(i, i - 1), () => moveArticle(i, i + 1)));
  left.appendChild(el("span", "card-num", String(i + 1).padStart(2, "0")));
  left.appendChild(el("span", "card-name", article.title || "(sem título)"));
  left.appendChild(el("span", "card-meta", `${article.category || ""} · ${article.date || ""}`));
  header.appendChild(left);
  header.appendChild(el("span", "card-chevron", "▼"));
  header.addEventListener("click", () => card.classList.toggle("open"));
  card.appendChild(header);

  const body = el("div", "card-body");
  const grid = el("div", "fields-grid");

  grid.appendChild(buildInput("Identificador (id)", "text", article.id, { article: i, key: "id" }));
  grid.appendChild(buildInput("Categoria", "text", article.category, { article: i, key: "category" }, "Fisiologia vegetal"));
  grid.appendChild(buildInput("Título", "text", article.title, { article: i, key: "title" }));
  grid.appendChild(buildInput("Subtítulo (opcional)", "text", article.subtitle, { article: i, key: "subtitle" }));

  const imageField = buildInput(
    "Imagem de capa (opcional)",
    "text",
    article.image,
    { article: i, key: "image" },
    "images/artigos/nome-do-arquivo.jpg"
  );
  imageField.classList.add("full");
  grid.appendChild(imageField);

  const excerpt = buildTextarea("Resumo (só na página do artigo)", article.excerpt, { article: i, key: "excerpt" });
  excerpt.classList.add("full");
  grid.appendChild(excerpt);

  grid.appendChild(buildInput("Data", "date", article.date, { article: i, key: "date" }));
  grid.appendChild(buildInput("Tempo de leitura", "text", article.readingTime, { article: i, key: "readingTime" }, "6 min"));

  const bodyField = buildTextarea("Corpo — um parágrafo por linha", (article.body || []).join("\n"), { article: i, key: "body" }, true);
  bodyField.classList.add("full");
  bodyField.querySelector("textarea").rows = 8;
  grid.appendChild(bodyField);

  body.appendChild(grid);

  const actions = el("div", "card-actions");
  const removeBtn = el("button", "btn btn-danger btn-small", "Remover artigo");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => removeArticle(i));
  actions.appendChild(removeBtn);
  body.appendChild(actions);

  card.appendChild(body);
  card.addEventListener("input", () => markDirty("articles"));
  card.addEventListener("change", () => markDirty("articles"));

  return card;
}

function moveArticle(from, to) {
  if (to < 0 || to >= contentData.articles.length) return;
  collectAll();
  const [item] = contentData.articles.splice(from, 1);
  contentData.articles.splice(to, 0, item);
  renderArticlesList();
  markDirty("articles");
  toast('Ordem atualizada — clique em "Salvar no GitHub" para confirmar.', "ok");
}

function removeArticle(i) {
  const article = contentData.articles[i];
  if (!confirm(`Remover o artigo "${article.title || "(sem título)"}"? Só é definitivo ao clicar em "Salvar no GitHub".`)) return;
  collectAll();
  contentData.articles.splice(i, 1);
  renderArticlesList();
  markDirty("articles");
  toast('Artigo removido — clique em "Salvar no GitHub" para confirmar.', "ok");
}

function addArticle() {
  collectAll();
  const id = uniqueSlug(contentData.articles.map((a) => a.id), "novo-artigo");
  // Insere no início: a home e a lista pública mostram os artigos na ordem
  // do array, então um artigo novo já aparece em primeiro sem precisar
  // reordenar manualmente.
  contentData.articles.unshift({
    id,
    category: "",
    title: "",
    excerpt: "",
    date: new Date().toISOString().slice(0, 10),
    readingTime: "",
    body: [],
  });
  renderArticlesList();
  markDirty("articles");
  const card = document.getElementById("article-card-0");
  if (card) card.classList.add("open");
}

// ----------------------------------------------------------------------------
// Episódios
// ----------------------------------------------------------------------------

function renderEpisodesList() {
  const container = document.getElementById("episodes-list");
  container.innerHTML = "";
  const items = contentData.episodes;
  document.getElementById("nav-count-episodes").textContent = items.length || "";
  document.getElementById("count-episodes").textContent = `${items.length} ${items.length === 1 ? "episódio" : "episódios"}`;

  if (items.length === 0) {
    container.appendChild(el("p", "empty-state", "Nenhum episódio cadastrado ainda."));
    return;
  }

  items.forEach((episode, i) => container.appendChild(buildEpisodeCard(episode, i, items.length)));
}

function buildEpisodeCard(episode, i, total) {
  const card = el("div", "card");
  card.id = `episode-card-${i}`;

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  left.appendChild(buildReorderButtons(i, total, () => moveEpisode(i, i - 1), () => moveEpisode(i, i + 1)));
  left.appendChild(el("span", "card-num", String(episode.number ?? i + 1).padStart(2, "0")));
  left.appendChild(el("span", "card-name", episode.title || "(sem título)"));
  left.appendChild(el("span", "card-meta", `${episode.date || ""} · ${episode.duration || ""}`));
  header.appendChild(left);
  header.appendChild(el("span", "card-chevron", "▼"));
  header.addEventListener("click", () => card.classList.toggle("open"));
  card.appendChild(header);

  const body = el("div", "card-body");
  const grid = el("div", "fields-grid");

  grid.appendChild(buildInput("Identificador (id)", "text", episode.id, { episode: i, key: "id" }));
  grid.appendChild(buildInput("Número", "number", episode.number, { episode: i, key: "number" }));
  grid.appendChild(buildInput("Título", "text", episode.title, { episode: i, key: "title" }));
  grid.appendChild(buildInput("Duração", "text", episode.duration, { episode: i, key: "duration" }, "38:00 ou —"));

  const description = buildTextarea("Descrição curta", episode.description, { episode: i, key: "description" });
  description.classList.add("full");
  grid.appendChild(description);

  grid.appendChild(buildInput("Data", "date", episode.date, { episode: i, key: "date" }));
  grid.appendChild(buildInput("Caminho do áudio", "text", episode.audioSrc, { episode: i, key: "audioSrc" }, "audio/episodio-02.mp3"));

  const transcript = buildTextarea(
    "Transcrição (opcional) — um parágrafo por linha",
    (episode.transcript || []).join("\n"),
    { episode: i, key: "transcript" },
    true
  );
  transcript.classList.add("full");
  transcript.querySelector("textarea").rows = 8;
  grid.appendChild(transcript);

  body.appendChild(grid);

  const actions = el("div", "card-actions");
  const removeBtn = el("button", "btn btn-danger btn-small", "Remover episódio");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => removeEpisode(i));
  actions.appendChild(removeBtn);
  body.appendChild(actions);

  card.appendChild(body);
  card.addEventListener("input", () => markDirty("episodes"));
  card.addEventListener("change", () => markDirty("episodes"));

  return card;
}

function moveEpisode(from, to) {
  if (to < 0 || to >= contentData.episodes.length) return;
  collectAll();
  const [item] = contentData.episodes.splice(from, 1);
  contentData.episodes.splice(to, 0, item);
  renderEpisodesList();
  markDirty("episodes");
  toast('Ordem atualizada — clique em "Salvar no GitHub" para confirmar.', "ok");
}

function removeEpisode(i) {
  const episode = contentData.episodes[i];
  if (!confirm(`Remover o episódio "${episode.title || "(sem título)"}"? Só é definitivo ao clicar em "Salvar no GitHub".`)) return;
  collectAll();
  contentData.episodes.splice(i, 1);
  renderEpisodesList();
  markDirty("episodes");
  toast('Episódio removido — clique em "Salvar no GitHub" para confirmar.', "ok");
}

function addEpisode() {
  collectAll();
  const nextNumber = Math.max(0, ...contentData.episodes.map((e) => e.number || 0)) + 1;
  const id = uniqueSlug(contentData.episodes.map((e) => e.id), `ep-${nextNumber}`);
  // Insere no início: a home e a lista pública mostram os episódios na
  // ordem do array, então um episódio novo já aparece em primeiro sem
  // precisar reordenar manualmente.
  contentData.episodes.unshift({
    id,
    number: nextNumber,
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    duration: "",
    audioSrc: "",
  });
  renderEpisodesList();
  markDirty("episodes");
  const card = document.getElementById("episode-card-0");
  if (card) card.classList.add("open");
}

// ----------------------------------------------------------------------------
// Textos do site: Marca & navegação + Páginas
// ----------------------------------------------------------------------------

function buildSiteField(fieldDef) {
  const value = getByPath(contentData.site, fieldDef.key) ?? "";
  const field =
    fieldDef.type === "textarea"
      ? buildTextarea(fieldDef.label, value, { site: fieldDef.key })
      : buildInput(fieldDef.label, "text", value, { site: fieldDef.key });
  if (fieldDef.type === "textarea") field.classList.add("full");
  return field;
}

function renderGeneralForm() {
  const container = document.getElementById("general-form");
  container.innerHTML = "";
  for (const section of GENERAL_SCHEMA) {
    container.appendChild(el("h3", "section-heading", section.heading));
    const grid = el("div", "fields-grid");
    for (const fieldDef of section.fields) {
      grid.appendChild(buildSiteField(fieldDef));
    }
    container.appendChild(grid);
  }
  container.addEventListener("input", () => markDirty("site"));
  container.addEventListener("change", () => markDirty("site"));
}

function renderPageForms() {
  for (const page of PAGE_SCHEMA) {
    const container = document.getElementById(`page-form-${page.key}`);
    container.innerHTML = "";
    const grid = el("div", "fields-grid");
    for (const fieldDef of page.fields) {
      grid.appendChild(buildSiteField(fieldDef));
    }
    container.appendChild(grid);
    container.addEventListener("input", () => markDirty("site"));
    container.addEventListener("change", () => markDirty("site"));
  }
}

// ----------------------------------------------------------------------------
// Acessos: listagem e gestão (cada ação já commita — sem "sujo"/save global)
// ----------------------------------------------------------------------------

let accessCache = null; // { content: { tokens: [...] }, sha }

async function loadAccess() {
  const list = document.getElementById("access-list");
  list.innerHTML = "";
  list.appendChild(el("p", "empty-state", "Carregando…"));
  try {
    accessCache = await getFile(CONFIG.authPath);
    renderAccessList();
  } catch (err) {
    list.innerHTML = "";
    list.appendChild(el("p", "empty-state", `Não foi possível carregar: ${err.message}`));
  }
}

function renderAccessList() {
  const list = document.getElementById("access-list");
  list.innerHTML = "";
  const tokens = accessCache.content?.tokens || [];

  if (tokens.length === 0) {
    list.appendChild(el("p", "empty-state", "Nenhum acesso cadastrado."));
    return;
  }

  tokens.forEach((entry, index) => {
    const row = el("div", "admin-item-row");
    const main = el("div", "admin-item-main");
    main.appendChild(el("div", "admin-item-title", entry.label || "sem nome"));
    row.appendChild(main);

    const actions = el("div", "admin-item-actions");
    const delBtn = el("button", "btn btn-danger btn-small", "Revogar");
    delBtn.type = "button";
    delBtn.addEventListener("click", () => revokeAccess(index, entry.label));
    actions.appendChild(delBtn);
    row.appendChild(actions);

    list.appendChild(row);
  });
}

async function addAccess() {
  const labelInput = document.getElementById("access-label");
  const tokenInput = document.getElementById("access-token");
  const passwordInput = document.getElementById("access-password");
  const submit = document.getElementById("access-submit");

  const label = labelInput.value.trim();
  const token = tokenInput.value.trim();
  const password = passwordInput.value;

  if (!label || !token || !password) {
    toast("Preencha nome, token e senha para adicionar um acesso.", "error");
    return;
  }

  submit.disabled = true;
  try {
    const fresh = await getFile(CONFIG.authPath);
    const encrypted = await encryptToken(token, password);
    const updated = { tokens: [...(fresh.content?.tokens || []), { label, ...encrypted }] };
    await putFile(CONFIG.authPath, updated, fresh.sha, `admin: adiciona acesso "${label}"`);
    toast(`Acesso de "${label}" adicionado.`, "ok");
    labelInput.value = "";
    tokenInput.value = "";
    passwordInput.value = "";
    await loadAccess();
  } catch (err) {
    toast(`Erro ao adicionar acesso: ${err.message}`, "error");
  } finally {
    submit.disabled = false;
  }
}

async function revokeAccess(index, label) {
  if (
    !confirm(
      `Revogar o acesso de "${label}"? Isso remove o registro de data/auth.json. Se o token dessa pessoa foi comprometido, revogue-o também diretamente no GitHub.`
    )
  )
    return;
  try {
    const fresh = await getFile(CONFIG.authPath);
    const tokens = [...(fresh.content?.tokens || [])];
    tokens.splice(index, 1);
    await putFile(CONFIG.authPath, { tokens }, fresh.sha, `admin: revoga acesso "${label}"`);
    toast(`Acesso de "${label}" revogado.`, "ok");
    await loadAccess();
  } catch (err) {
    toast(`Erro ao revogar: ${err.message}`, "error");
  }
}

// ----------------------------------------------------------------------------
// Início
// ----------------------------------------------------------------------------

init();
