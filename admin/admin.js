// ============================================================================
// admin.js — painel de administração de conteúdo.
//
// Autenticação: cada pessoa usa seu próprio token de acesso pessoal do
// GitHub, criptografado (AES-GCM, chave derivada via PBKDF2 a partir da
// senha escolhida) e guardado em data/auth.json, no próprio repositório —
// nunca em texto puro. O token decifrado vive só na memória da aba durante
// a sessão; não é salvo em localStorage/sessionStorage. Fechar ou recarregar
// a página desconecta.
//
// Conteúdo (episódios/artigos) é lido e gravado via commits diretos na API
// do GitHub, uma vez autenticado.
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

// Descreve todos os campos de texto do site (ver data/site.json e os
// atributos data-text="..." no HTML de cada página). Editar aqui só muda
// o formulário do painel — os valores em si vêm sempre do arquivo.
const SITE_TEXT_SCHEMA = [
  {
    heading: "Marca (aparece em todas as páginas)",
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
  {
    heading: "Home",
    fields: [
      { key: "home.metaTitle", label: "Título da aba do navegador", type: "text" },
      { key: "home.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "home.heroTag", label: "Selo acima do título", type: "text" },
      { key: "home.heroTitle", label: "Título principal", type: "text" },
      { key: "home.heroQuote", label: "Citação", type: "textarea" },
      { key: "home.heroAttribution", label: "Autoria da citação", type: "text" },
      { key: "home.heroText", label: "Texto de apresentação", type: "textarea" },
      { key: "home.ctaPrimary", label: "Botão primário", type: "text" },
      { key: "home.ctaSecondary", label: "Botão secundário", type: "text" },
      { key: "home.featuredHeading", label: "Título \"Artigos em destaque\"", type: "text" },
      { key: "home.featuredCta", label: "Link \"ver todos\"", type: "text" },
      { key: "home.panelKicker", label: "Selo do painel do podcast", type: "text" },
      { key: "home.panelHeading", label: "Título do painel do podcast", type: "text" },
      { key: "home.panelText", label: "Texto do painel do podcast", type: "textarea" },
    ],
  },
  {
    heading: "Podcast (lista de episódios)",
    fields: [
      { key: "podcast.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "podcast.tag", label: "Selo", type: "text" },
      { key: "podcast.title", label: "Título", type: "text" },
      { key: "podcast.intro", label: "Texto de introdução", type: "textarea" },
    ],
  },
  {
    heading: "Episódio (página de detalhe)",
    fields: [
      { key: "episodio.backLink", label: "Link \"voltar\"", type: "text" },
      { key: "episodio.relatedHeading", label: "Título \"outros episódios\"", type: "text" },
    ],
  },
  {
    heading: "Artigos (lista)",
    fields: [
      { key: "artigos.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "artigos.tag", label: "Selo", type: "text" },
      { key: "artigos.title", label: "Título", type: "text" },
      { key: "artigos.intro", label: "Texto de introdução", type: "textarea" },
    ],
  },
  {
    heading: "Artigo (página de detalhe)",
    fields: [
      { key: "artigo.backLink", label: "Link \"voltar\"", type: "text" },
      { key: "artigo.relatedHeading", label: "Título \"continue lendo\"", type: "text" },
    ],
  },
  {
    heading: "Sobre",
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
    heading: "Contato",
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

const LOCKOUT = {
  storageKey: "astrobotanica-admin-attempts",
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
};

let TOKEN = ""; // token decifrado, só em memória — nunca persistido

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

function setStatus(message, kind) {
  const status = document.getElementById("app-status");
  if (!status) return;
  status.textContent = message;
  if (kind) status.setAttribute("data-kind", kind);
  else status.removeAttribute("data-kind");
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
  const res = await fetch(`https://api.github.com${path}`, { ...options, headers });
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

async function whoAmI() {
  return ghRequest("/user");
}

// path lido sem autenticação (repositório é público — leitura não exige token)
async function getFileAnon(path) {
  const data = await ghRequest(
    `/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`,
    { auth: false }
  );
  return { content: JSON.parse(base64ToUtf8(data.content)), sha: data.sha };
}

async function getFile(path) {
  const data = await ghRequest(
    `/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`
  );
  return { content: JSON.parse(base64ToUtf8(data.content)), sha: data.sha };
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
// Telas
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

  if (!auth.content.tokens || auth.content.tokens.length === 0) {
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
      const updated = { tokens: [...(fresh.content.tokens || []), { label, ...encrypted }] };
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
      const tokens = fresh.content.tokens || [];
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

async function enterApp() {
  renderHeaderActions();
  whoAmI()
    .then((user) => {
      const nameEl = document.getElementById("header-actions").querySelector("[data-user]");
      if (nameEl) nameEl.textContent = `Conectado como ${user.login}`;
    })
    .catch(() => {}); // cosmético — se falhar, só não mostra o nome
  showScreen("app-screen");
  setupTabs();
  await Promise.all([loadArticles(), loadEpisodes(), loadAccess(), loadTexts()]);
}

function renderHeaderActions() {
  const container = document.getElementById("header-actions");
  container.innerHTML = "";
  const nameEl = el("span", "", "Conectado");
  nameEl.setAttribute("data-user", "");
  container.appendChild(nameEl);
  const logout = el("button", "btn btn-secondary", "Sair");
  logout.type = "button";
  logout.addEventListener("click", () => {
    TOKEN = "";
    location.reload();
  });
  container.appendChild(logout);
}

// ----------------------------------------------------------------------------
// Abas
// ----------------------------------------------------------------------------

function setupTabs() {
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const target = tab.dataset.tab;
      document.getElementById("tab-articles").hidden = target !== "articles";
      document.getElementById("tab-episodes").hidden = target !== "episodes";
      document.getElementById("tab-texts").hidden = target !== "texts";
      document.getElementById("tab-access").hidden = target !== "access";
    });
  });

  document.querySelector('[data-action="new-article"]').addEventListener("click", () => openArticleForm(null));
  document.querySelector('[data-action="new-episode"]').addEventListener("click", () => openEpisodeForm(null));
  document.getElementById("access-submit").addEventListener("click", addAccess);
  document
    .querySelectorAll('[data-action="save-texts"]')
    .forEach((btn) => btn.addEventListener("click", saveTexts));
}

// ----------------------------------------------------------------------------
// Artigos: listagem
// ----------------------------------------------------------------------------

let articlesCache = null; // { content: Article[], sha }
let episodesCache = null;

async function loadArticles() {
  const list = document.getElementById("articles-list");
  list.innerHTML = "";
  list.appendChild(el("p", "empty-state", "Carregando…"));
  try {
    articlesCache = await getFile(CONFIG.articlesPath);
    renderArticlesList();
  } catch (err) {
    list.innerHTML = "";
    list.appendChild(el("p", "empty-state", `Não foi possível carregar: ${err.message}`));
  }
}

function renderArticlesList() {
  const list = document.getElementById("articles-list");
  list.innerHTML = "";
  const items = [...articlesCache.content].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (items.length === 0) {
    list.appendChild(el("p", "empty-state", "Nenhum artigo cadastrado ainda."));
    return;
  }

  for (const article of items) {
    const row = el("div", "admin-item-row");
    const main = el("div", "admin-item-main");
    main.appendChild(el("div", "admin-item-title", article.title));
    main.appendChild(el("div", "admin-item-meta", `${article.category} · ${article.date}`));
    row.appendChild(main);

    const actions = el("div", "admin-item-actions");
    const editBtn = el("button", "btn btn-secondary", "Editar");
    editBtn.type = "button";
    editBtn.addEventListener("click", () => openArticleForm(article));
    const delBtn = el("button", "btn btn-danger", "Excluir");
    delBtn.type = "button";
    delBtn.addEventListener("click", () => deleteArticle(article));
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    list.appendChild(row);
  }
}

async function deleteArticle(article) {
  if (!confirm(`Excluir o artigo "${article.title}"? Isso faz um commit imediatamente.`)) return;
  setStatus(`Excluindo "${article.title}"…`);
  try {
    const fresh = await getFile(CONFIG.articlesPath);
    const updated = fresh.content.filter((a) => a.id !== article.id);
    await putFile(CONFIG.articlesPath, updated, fresh.sha, `admin: remove artigo "${article.title}"`);
    setStatus(`Artigo "${article.title}" excluído.`, "ok");
    await loadArticles();
  } catch (err) {
    setStatus(`Erro ao excluir: ${err.message}`, "error");
  }
}

// ----------------------------------------------------------------------------
// Artigos: formulário
// ----------------------------------------------------------------------------

function openArticleForm(existing) {
  const overlay = document.getElementById("form-overlay");
  const container = document.getElementById("form-container");
  container.innerHTML = "";

  container.appendChild(el("h2", "", existing ? "Editar artigo" : "Novo artigo"));

  const form = el("div", "admin-form-grid");
  const fCategory = formField("Categoria", "text", existing?.category ?? "", "Fisiologia vegetal");
  const fTitle = formField("Título", "text", existing?.title ?? "");
  const fSubtitle = formField("Subtítulo (opcional)", "text", existing?.subtitle ?? "");
  const fExcerpt = formField("Resumo (para o cartão de listagem)", "textarea", existing?.excerpt ?? "");
  const fDate = formField("Data", "date", existing?.date ?? new Date().toISOString().slice(0, 10));
  const fReadingTime = formField("Tempo de leitura", "text", existing?.readingTime ?? "", "6 min");
  const fBody = formField("Corpo do artigo — um parágrafo por linha", "textarea", (existing?.body ?? []).join("\n"));
  fBody.querySelector("textarea").rows = 10;

  [fCategory, fTitle, fSubtitle, fExcerpt, fDate, fReadingTime, fBody].forEach((f) => form.appendChild(f));
  container.appendChild(form);
  container.appendChild(el("p", "admin-form-note", "O id é gerado automaticamente a partir do título."));

  const actions = el("div", "admin-form-actions");
  const cancelBtn = el("button", "btn btn-secondary", "Cancelar");
  cancelBtn.type = "button";
  cancelBtn.addEventListener("click", closeForm);
  const saveBtn = el("button", "btn btn-primary", "Salvar");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      await saveArticle(existing, {
        category: inputValue(fCategory),
        title: inputValue(fTitle),
        subtitle: inputValue(fSubtitle),
        excerpt: inputValue(fExcerpt),
        date: inputValue(fDate),
        readingTime: inputValue(fReadingTime),
        body: linesToParagraphs(inputValue(fBody)),
      });
    } finally {
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  container.appendChild(actions);

  overlay.hidden = false;
}

async function saveArticle(existing, values) {
  if (!values.title.trim()) {
    setStatus("O título é obrigatório.", "error");
    return;
  }
  setStatus("Salvando artigo…");
  try {
    const fresh = await getFile(CONFIG.articlesPath);
    const id = existing ? existing.id : uniqueSlug(fresh.content.map((a) => a.id), values.title);
    const record = {
      id,
      category: values.category,
      title: values.title,
      ...(values.subtitle ? { subtitle: values.subtitle } : {}),
      excerpt: values.excerpt,
      date: values.date,
      readingTime: values.readingTime,
      body: values.body,
    };
    const updated = existing
      ? fresh.content.map((a) => (a.id === existing.id ? record : a))
      : [...fresh.content, record];
    const action = existing ? "atualiza" : "adiciona";
    await putFile(CONFIG.articlesPath, updated, fresh.sha, `admin: ${action} artigo "${values.title}"`);
    setStatus(`Artigo "${values.title}" salvo.`, "ok");
    closeForm();
    await loadArticles();
  } catch (err) {
    setStatus(`Erro ao salvar: ${err.message}`, "error");
  }
}

// ----------------------------------------------------------------------------
// Episódios: listagem
// ----------------------------------------------------------------------------

async function loadEpisodes() {
  const list = document.getElementById("episodes-list");
  list.innerHTML = "";
  list.appendChild(el("p", "empty-state", "Carregando…"));
  try {
    episodesCache = await getFile(CONFIG.episodesPath);
    renderEpisodesList();
  } catch (err) {
    list.innerHTML = "";
    list.appendChild(el("p", "empty-state", `Não foi possível carregar: ${err.message}`));
  }
}

function renderEpisodesList() {
  const list = document.getElementById("episodes-list");
  list.innerHTML = "";
  const items = [...episodesCache.content].sort((a, b) => b.number - a.number);

  if (items.length === 0) {
    list.appendChild(el("p", "empty-state", "Nenhum episódio cadastrado ainda."));
    return;
  }

  for (const episode of items) {
    const row = el("div", "admin-item-row");
    const main = el("div", "admin-item-main");
    main.appendChild(el("div", "admin-item-title", `${episode.number}. ${episode.title}`));
    main.appendChild(el("div", "admin-item-meta", `${episode.date} · ${episode.duration}`));
    row.appendChild(main);

    const actions = el("div", "admin-item-actions");
    const editBtn = el("button", "btn btn-secondary", "Editar");
    editBtn.type = "button";
    editBtn.addEventListener("click", () => openEpisodeForm(episode));
    const delBtn = el("button", "btn btn-danger", "Excluir");
    delBtn.type = "button";
    delBtn.addEventListener("click", () => deleteEpisode(episode));
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    list.appendChild(row);
  }
}

async function deleteEpisode(episode) {
  if (!confirm(`Excluir o episódio "${episode.title}"? Isso faz um commit imediatamente.`)) return;
  setStatus(`Excluindo "${episode.title}"…`);
  try {
    const fresh = await getFile(CONFIG.episodesPath);
    const updated = fresh.content.filter((e) => e.id !== episode.id);
    await putFile(CONFIG.episodesPath, updated, fresh.sha, `admin: remove episódio "${episode.title}"`);
    setStatus(`Episódio "${episode.title}" excluído.`, "ok");
    await loadEpisodes();
  } catch (err) {
    setStatus(`Erro ao excluir: ${err.message}`, "error");
  }
}

// ----------------------------------------------------------------------------
// Episódios: formulário
// ----------------------------------------------------------------------------

function openEpisodeForm(existing) {
  const overlay = document.getElementById("form-overlay");
  const container = document.getElementById("form-container");
  container.innerHTML = "";

  container.appendChild(el("h2", "", existing ? "Editar episódio" : "Novo episódio"));

  const form = el("div", "admin-form-grid");
  const nextNumber = existing
    ? existing.number
    : Math.max(0, ...(episodesCache?.content ?? []).map((e) => e.number)) + 1;

  const fNumber = formField("Número", "number", String(nextNumber));
  const fTitle = formField("Título", "text", existing?.title ?? "");
  const fDescription = formField("Descrição curta", "textarea", existing?.description ?? "");
  const fDate = formField("Data", "date", existing?.date ?? new Date().toISOString().slice(0, 10));
  const fDuration = formField("Duração", "text", existing?.duration ?? "", "38:00 ou —");
  const fAudioSrc = formField(
    "Caminho do áudio (o .mp3 é enviado por fora, via git)",
    "text",
    existing?.audioSrc ?? "",
    "audio/episodio-02.mp3"
  );
  const fTranscript = formField(
    "Transcrição (opcional) — um parágrafo por linha",
    "textarea",
    (existing?.transcript ?? []).join("\n")
  );
  fTranscript.querySelector("textarea").rows = 10;

  [fNumber, fTitle, fDescription, fDate, fDuration, fAudioSrc, fTranscript].forEach((f) => form.appendChild(f));
  container.appendChild(form);
  container.appendChild(el("p", "admin-form-note", "O id é gerado automaticamente a partir do título."));

  const actions = el("div", "admin-form-actions");
  const cancelBtn = el("button", "btn btn-secondary", "Cancelar");
  cancelBtn.type = "button";
  cancelBtn.addEventListener("click", closeForm);
  const saveBtn = el("button", "btn btn-primary", "Salvar");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      await saveEpisode(existing, {
        number: parseInt(inputValue(fNumber), 10),
        title: inputValue(fTitle),
        description: inputValue(fDescription),
        date: inputValue(fDate),
        duration: inputValue(fDuration),
        audioSrc: inputValue(fAudioSrc),
        transcript: linesToParagraphs(inputValue(fTranscript)),
      });
    } finally {
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  container.appendChild(actions);

  overlay.hidden = false;
}

async function saveEpisode(existing, values) {
  if (!values.title.trim()) {
    setStatus("O título é obrigatório.", "error");
    return;
  }
  if (!Number.isFinite(values.number)) {
    setStatus("O número do episódio é obrigatório.", "error");
    return;
  }
  setStatus("Salvando episódio…");
  try {
    const fresh = await getFile(CONFIG.episodesPath);
    const id = existing ? existing.id : uniqueSlug(fresh.content.map((e) => e.id), values.title, "ep");
    const record = {
      id,
      number: values.number,
      title: values.title,
      description: values.description,
      date: values.date,
      duration: values.duration,
      audioSrc: values.audioSrc,
      ...(values.transcript.length > 0 ? { transcript: values.transcript } : {}),
    };
    const updated = existing
      ? fresh.content.map((e) => (e.id === existing.id ? record : e))
      : [...fresh.content, record];
    const action = existing ? "atualiza" : "adiciona";
    await putFile(CONFIG.episodesPath, updated, fresh.sha, `admin: ${action} episódio "${values.title}"`);
    setStatus(`Episódio "${values.title}" salvo.`, "ok");
    closeForm();
    await loadEpisodes();
  } catch (err) {
    setStatus(`Erro ao salvar: ${err.message}`, "error");
  }
}

// ----------------------------------------------------------------------------
// Textos do site: formulário único, gerado a partir de SITE_TEXT_SCHEMA
// ----------------------------------------------------------------------------

let siteTextCache = null; // { content: {...}, sha }
const siteTextInputs = new Map(); // key ("a.b.c") -> <input>/<textarea>

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

async function loadTexts() {
  const container = document.getElementById("texts-form");
  container.innerHTML = "";
  container.appendChild(el("p", "empty-state", "Carregando…"));
  try {
    siteTextCache = await getFile(CONFIG.sitePath);
    renderTextsForm();
  } catch (err) {
    container.innerHTML = "";
    container.appendChild(el("p", "empty-state", `Não foi possível carregar: ${err.message}`));
  }
}

function renderTextsForm() {
  const container = document.getElementById("texts-form");
  container.innerHTML = "";
  siteTextInputs.clear();

  for (const section of SITE_TEXT_SCHEMA) {
    container.appendChild(el("h3", "", section.heading));
    const grid = el("div", "admin-form-grid");
    for (const fieldDef of section.fields) {
      const currentValue = getByPath(siteTextCache.content, fieldDef.key) ?? "";
      const field = formField(fieldDef.label, fieldDef.type, currentValue);
      grid.appendChild(field);
      siteTextInputs.set(fieldDef.key, field.querySelector("input, textarea"));
    }
    container.appendChild(grid);
  }
}

async function saveTexts() {
  setStatus("Salvando textos…");
  try {
    const fresh = await getFile(CONFIG.sitePath);
    const updated = JSON.parse(JSON.stringify(fresh.content));
    siteTextInputs.forEach((input, key) => {
      setByPath(updated, key, input.value);
    });
    await putFile(CONFIG.sitePath, updated, fresh.sha, "admin: atualiza textos do site");
    setStatus("Textos salvos.", "ok");
    await loadTexts();
  } catch (err) {
    setStatus(`Erro ao salvar: ${err.message}`, "error");
  }
}

// ----------------------------------------------------------------------------
// Acessos: listagem e gestão
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
  const tokens = accessCache.content.tokens || [];

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
    const delBtn = el("button", "btn btn-danger", "Revogar");
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
    setStatus("Preencha nome, token e senha para adicionar um acesso.", "error");
    return;
  }

  submit.disabled = true;
  setStatus(`Adicionando acesso para "${label}"…`);
  try {
    const fresh = await getFile(CONFIG.authPath);
    const encrypted = await encryptToken(token, password);
    const updated = { tokens: [...(fresh.content.tokens || []), { label, ...encrypted }] };
    await putFile(CONFIG.authPath, updated, fresh.sha, `admin: adiciona acesso "${label}"`);
    setStatus(`Acesso de "${label}" adicionado.`, "ok");
    labelInput.value = "";
    tokenInput.value = "";
    passwordInput.value = "";
    await loadAccess();
  } catch (err) {
    setStatus(`Erro ao adicionar acesso: ${err.message}`, "error");
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
  setStatus(`Revogando acesso de "${label}"…`);
  try {
    const fresh = await getFile(CONFIG.authPath);
    const tokens = [...(fresh.content.tokens || [])];
    tokens.splice(index, 1);
    await putFile(CONFIG.authPath, { tokens }, fresh.sha, `admin: revoga acesso "${label}"`);
    setStatus(`Acesso de "${label}" revogado.`, "ok");
    await loadAccess();
  } catch (err) {
    setStatus(`Erro ao revogar: ${err.message}`, "error");
  }
}

// ----------------------------------------------------------------------------
// Helpers de formulário
// ----------------------------------------------------------------------------

function formField(label, type, value, placeholder) {
  const field = el("div", "field");
  const labelId = `f-${slugify(label)}-${Math.random().toString(36).slice(2, 7)}`;
  const labelEl = el("label", "", label);
  labelEl.htmlFor = labelId;
  field.appendChild(labelEl);

  let input;
  if (type === "textarea") {
    input = document.createElement("textarea");
    input.className = "input";
    input.rows = 3;
  } else {
    input = document.createElement("input");
    input.className = "input";
    input.type = type;
  }
  input.id = labelId;
  input.value = value ?? "";
  if (placeholder) input.placeholder = placeholder;
  field.appendChild(input);
  return field;
}

function inputValue(field) {
  return field.querySelector("input, textarea").value;
}

function uniqueSlug(existingIds, title, prefix) {
  const base = prefix ? `${prefix}-${slugify(title)}` : slugify(title);
  let candidate = base || (prefix ? `${prefix}-item` : "item");
  let n = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

function closeForm() {
  document.getElementById("form-overlay").hidden = true;
  document.getElementById("form-container").innerHTML = "";
}

// ----------------------------------------------------------------------------
// Início
// ----------------------------------------------------------------------------

init();
