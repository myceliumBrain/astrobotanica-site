// ============================================================================
// admin.js — painel de administração de conteúdo.
//
// Modelo: ao entrar, as notícias (src/content/noticias/{pt,en}/*.md, ver
// noticias-md.js) e episodes.json/site.json etc. são carregados uma vez para
// a memória (contentData). Cada tela (um item, ou uma tela de textos do
// site) tem o próprio "Publicar", que grava só aquela parte (ver "Publicação
// por tela"); remover um item publica na hora, e a ordem da lista é
// publicada pela barra no rodapé da lista. Os acessos (data/auth.json) já
// commitam a cada ação, como antes.
//
// Autenticação: cada pessoa usa seu próprio token de acesso pessoal do
// GitHub, criptografado (AES-GCM, chave derivada via PBKDF2 a partir da
// senha escolhida) e guardado em data/auth.json. O token decifrado vive só
// na memória da aba durante a sessão.
// ============================================================================

import {
  PASTA_NOTICIAS,
  arquivosParaNoticias,
  mudancasDeArquivos,
  noticiasParaArquivos,
  problemasDasNoticias,
} from "./noticias-md.js";
import {
  PASTA_PAGINAS,
  caminhoPagina,
  htmlParaMarkdown,
  lerPagina,
  markdownParaHtml,
  montarPagina,
  slugDoCaminho,
} from "./paginas-md.js";

const CONFIG = {
  owner: "myceliumBrain",
  repo: "astrobotanica-site",
  branch: "main",
  authPath: "data/auth.json",
  episodesPath: "data/episodes.json",
  membersPath: "data/members.json",
  sitePath: "data/site.json",
  siteEnPath: "data/site.en.json",
  estudosPath: "data/estudos.json",
  categoriasEstudoPath: "data/categorias_estudo.json",
};

// Seções gravadas como um arquivo JSON cada. As notícias (seção "articles")
// são gravadas à parte, um .md por notícia e idioma (ver salvarNoticias).
const PATHS = {
  episodes: CONFIG.episodesPath,
  members: CONFIG.membersPath,
  site: CONFIG.sitePath,
  siteEn: CONFIG.siteEnPath,
  estudos: CONFIG.estudosPath,
  categoriasEstudo: CONFIG.categoriasEstudoPath,
};

// Quantos episódios marcados como "destaque" cabem na Home (ver
// selectHomeItems em src/main.ts) — mantido em sincronia manualmente com
// aquela constante, já que este arquivo não passa pelo bundler do site.
const HOME_MAX_ITEMS = 6;
// Idem, mas pras notícias: só as 5 primeiras posições da Home (1 card 50/50
// + 4 na linha de baixo) respeitam "destaque" — o resto aparece de qualquer
// jeito na lista pequena mais abaixo (ver HOME_ARTICLES_TOP em src/main.ts).
const HOME_ARTICLES_TOP = 5;

// Caracteres/minuto usados pra estimar o tempo de leitura (ver
// computeReadingTime) — media de ~200 palavras/min de leitura silenciosa,
// contando só caracteres não-espaço (tags HTML e espaços em branco excluídos).
const READING_CHARS_PER_MINUTE = 900;

const LOCKOUT = {
  storageKey: "astrobotanica-admin-attempts",
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
};

let TOKEN = ""; // token decifrado, só em memória — nunca persistido
// Categoria de quem entrou: "admin" (painel inteiro) ou "colaborador" (só a
// seção Conteúdo). Acessos antigos, sem "role" no auth.json, contam como admin.
let ROLE = "admin";
const ROLES = { admin: "Admin", colaborador: "Colaborador" };
const roleOf = (entry) => (entry.role === "colaborador" ? "colaborador" : "admin");
// Registros antigos, sem uid, usam o salt como identificador até o uid ser
// gravado (migrateCurrentEntry/saveAccount gravam exatamente esse valor), então
// a posse dos integrantes não depende de essa gravação ter dado certo.
const uidOf = (entry) => entry.uid || entry.salt;
// Registro do auth.json de quem entrou, identificado pelo salt (único por
// registro e trocado só quando a senha muda). Usado em "Dados de acesso".
let CURRENT_SALT = null;
let CURRENT_LABEL = "";
// Identificador fixo do acesso ("uid" no auth.json — não muda com nome nem
// senha). Gravado como ownerUid em cada integrante criado, pra que um
// colaborador só edite os integrantes que ele mesmo adicionou.
let CURRENT_UID = null;
// Integrante (id em data/members.json) ligado a esse acesso — "integrante" no
// auth.json, escolhido pelo admin em "Acessos". Diz quem é o autor dos
// textos de quem entrou (ver PLANO-PAINEL.md, P2 e P7).
let CURRENT_INTEGRANTE = null;

// Textos do site: cada campo é uma chave "a.b.c" dentro de data/site.json.
// GENERAL_SCHEMA vira a tela "Site → Rodapé e marca"; cada item de
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
    heading: "Rodapé",
    fields: [
      { key: "footer.navHeading", label: "Título da coluna de navegação", type: "text" },
      { key: "footer.socialHeading", label: "Título da coluna de redes sociais", type: "text" },
    ],
  },
];

// Textos fixos do site (data/site.json e data/site.en.json), agrupados por
// página. Cada grupo aparece numa tela (ver TELAS_DE_TEXTOS); "sobre" fica na
// tela do texto do Sobre (ver garantirPainelDePagina).
const PAGE_SCHEMA = [
  {
    key: "home",
    label: "Início",
    fields: [
      { key: "home.metaTitle", label: "Título da aba do navegador", type: "text" },
      { key: "home.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "home.panelKicker", label: "Selo do painel do podcast", type: "text" },
    ],
  },
  {
    key: "sobre",
    label: "Seção \"Integrantes\"",
    fields: [
      { key: "sobre.membersHeading", label: "Título da seção \"Integrantes\"", type: "text" },
    ],
  },
  {
    key: "contato",
    label: "Contato",
    fields: [
      { key: "contato.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "contato.title", label: "Título", type: "text" },
      { key: "contato.intro", label: "Texto de introdução", type: "textarea" },
      { key: "contato.emailKicker", label: "Selo do cartão de email", type: "text" },
      { key: "contato.email", label: "Email de contato", type: "text" },
      { key: "contato.emailNote", label: "Nota abaixo do email", type: "text" },
    ],
  },
  {
    key: "artigos",
    label: "Página com a lista de notícias",
    fields: [
      { key: "artigos.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "artigos.title", label: "Título", type: "text" },
      { key: "artigos.intro", label: "Texto de introdução", type: "textarea" },
    ],
  },
  {
    key: "artigo",
    label: "Página de cada notícia",
    fields: [
      { key: "artigo.backLink", label: "Link \"voltar\"", type: "text" },
      { key: "artigo.byLine", label: "Texto do autor (use {{author}})", type: "text" },
      { key: "artigo.latestHeading", label: "Título da barra lateral \"mais recentes\"", type: "text" },
      { key: "artigo.relatedHeading", label: "Título \"continue lendo\"", type: "text" },
    ],
  },
  {
    key: "podcast",
    label: "Página com a lista de episódios",
    fields: [
      { key: "podcast.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "podcast.title", label: "Título", type: "text" },
      { key: "podcast.intro", label: "Texto de introdução", type: "textarea" },
    ],
  },
  {
    key: "episodio",
    label: "Página de cada episódio",
    fields: [
      { key: "episodio.backLink", label: "Link \"voltar\"", type: "text" },
      { key: "episodio.relatedHeading", label: "Título \"outros episódios\"", type: "text" },
    ],
  },
  {
    key: "estudos",
    label: "Página com a lista de verbetes",
    fields: [
      { key: "estudos.metaDescription", label: "Descrição (SEO)", type: "textarea" },
      { key: "estudos.title", label: "Título", type: "text" },
      { key: "estudos.intro", label: "Texto de introdução", type: "textarea" },
      { key: "estudos.searchPlaceholder", label: "Placeholder do campo de busca", type: "text" },
    ],
  },
  {
    key: "estudo",
    label: "Página de cada verbete",
    fields: [
      { key: "estudo.backLink", label: "Link \"voltar\"", type: "text" },
      { key: "estudo.updatedAt", label: "Texto \"atualizado em\" (use {{date}})", type: "text" },
      { key: "estudo.relatedHeading", label: "Título \"termos relacionados\"", type: "text" },
      { key: "estudo.sourcesHeading", label: "Título \"fontes\"", type: "text" },
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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Compatibilidade com o formato antigo do corpo da notícia (array de
// parágrafos em texto puro, sem formatação) — migra para HTML na hora de
// abrir o editor; o formato salvo a partir de agora já é sempre uma string.
function articleBodyToHtml(body) {
  if (typeof body === "string") return body;
  if (Array.isArray(body)) return body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return "";
}

// Tempo de leitura estimado a partir da quantidade de caracteres do corpo —
// não é mais digitado à mão (ver "Tempo de leitura" em buildArticleCard),
// pra nunca ficar desatualizado ou inconsistente com o texto de verdade.
function computeReadingTime(bodyHtml) {
  const text = (bodyHtml || "").replace(/<[^>]*>/g, " ");
  const chars = text.replace(/\s/g, "").length;
  const minutes = Math.max(1, Math.round(chars / READING_CHARS_PER_MINUTE));
  return `${minutes} min`;
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

// Identificador de integrante: o nome completo sem acentos, em minúsculas e
// com hífens ("Eduardo Dreyer Simões Saraiva" → "eduardo-dreyer-simoes-saraiva").
// É também o nome do arquivo da foto (images/integrantes/<id>.<ext>).
function memberIdFromName(name, otherIds) {
  return slugify(name || "") ? uniqueSlug(otherIds, name) : "";
}
const MEMBER_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

function bytesToB64(bytesLike) {
  // Conversão em blocos: evita o custo (e, em arquivos grandes, o risco de
  // estourar a pilha) de chamar String.fromCharCode um byte por vez ou
  // espalhar milhões de argumentos de uma vez.
  const bytes = new Uint8Array(bytesLike);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Repetições do PBKDF2 (recomendação da OWASP para PBKDF2-SHA256). Cada
// registro do auth.json guarda as suas em "iterations"; os antigos, sem o
// campo, usam LEGACY_PBKDF2_ITERATIONS e são atualizados no próximo login.
const PBKDF2_ITERATIONS = 600000;
const LEGACY_PBKDF2_ITERATIONS = 100000;

async function deriveKey(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptToken(token, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(token));
  return { salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(encrypted), iterations: PBKDF2_ITERATIONS };
}

async function decryptToken(entry, password) {
  try {
    const salt = b64ToBytes(entry.salt);
    const iv = b64ToBytes(entry.iv);
    const key = await deriveKey(password, salt, entry.iterations || LEGACY_PBKDF2_ITERATIONS);
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

// Texto de todos os .md de notícias (pt/ e en/), como { caminho: texto }.
// Uma pasta que ainda não existe (ex: en/ sem nenhuma tradução) conta como
// vazia.
async function getNoticiasMarkdown() {
  return getMarkdownDaPasta(PASTA_NOTICIAS);
}

// Todos os .md de <pasta>/pt e <pasta>/en, como { caminho: texto }.
async function getMarkdownDaPasta(pasta) {
  const repoBase = `/repos/${CONFIG.owner}/${CONFIG.repo}/contents`;
  const arquivos = {};
  for (const lang of ["pt", "en"]) {
    let lista;
    try {
      lista = await ghRequest(`${repoBase}/${pasta}/${lang}?ref=${CONFIG.branch}&_=${Date.now()}`);
    } catch (err) {
      if (err.status === 404) continue;
      throw err;
    }
    const mds = lista.filter((item) => item.type === "file" && item.name.endsWith(".md"));
    const textos = await Promise.all(
      mds.map((item) =>
        ghRequest(`${repoBase}/${item.path}?ref=${CONFIG.branch}&_=${Date.now()}`).then((d) => base64ToUtf8(d.content))
      )
    );
    mds.forEach((item, i) => (arquivos[item.path] = textos[i]));
  }
  return arquivos;
}

// O GitHub responde 404 (ou 403) a uma escrita quando o token não tem
// permissão de escrita no repositório — "Not Found" sozinho não ajuda ninguém.
function explainWriteError(err) {
  if (err.status === 404 || err.status === 403) {
    err.message = `seu token do GitHub não tem permissão de escrita no repositório ${CONFIG.owner}/${CONFIG.repo} (${err.message})`;
  }
  return err;
}

async function putFile(path, contentObj, sha, message) {
  const content = JSON.stringify(contentObj, null, 2) + "\n";
  try {
    return await ghRequest(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: utf8ToBase64(content),
        sha,
        branch: CONFIG.branch,
      }),
    });
  } catch (err) {
    throw explainWriteError(err);
  }
}

// ----------------------------------------------------------------------------
// Upload de arquivos binários (áudio/imagem) — a Contents API (putFile) só
// aceita arquivos pequenos; para .mp3/imagens usamos a Git Data API
// (blob + tree + commit + atualização da referência), que suporta arquivos
// bem maiores e cria um commit próprio direto na branch.
// ----------------------------------------------------------------------------

// Passo comum a qualquer commit direto na branch via Git Data API (usado
// tanto para enviar quanto para remover um arquivo binário): busca a ponta
// atual da branch, monta uma tree só com as mudanças pedidas (por cima da
// tree atual, via base_tree) e move a branch pra esse novo commit.
async function commitTreeChange(entries, message) {
  const repoBase = `/repos/${CONFIG.owner}/${CONFIG.repo}`;
  const ref = await ghRequest(`${repoBase}/git/ref/heads/${CONFIG.branch}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await ghRequest(`${repoBase}/git/commits/${baseCommitSha}`);
  const tree = await ghRequest(`${repoBase}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }),
  });
  const commit = await ghRequest(`${repoBase}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
  });
  await ghRequest(`${repoBase}/git/refs/heads/${CONFIG.branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });
}

async function commitBinaryFile(path, base64Content, message) {
  const repoBase = `/repos/${CONFIG.owner}/${CONFIG.repo}`;
  try {
    const blob = await ghRequest(`${repoBase}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: base64Content, encoding: "base64" }),
    });
    await commitTreeChange([{ path, mode: "100644", type: "blob", sha: blob.sha }], message);
  } catch (err) {
    throw explainWriteError(err);
  }
  return path;
}

async function uploadBinaryFile(path, file, message) {
  const buffer = await file.arrayBuffer();
  const base64 = bytesToB64(buffer);
  return commitBinaryFile(path, base64, message);
}

// Remove um arquivo binário da branch (usado quando um upload novo substitui
// um arquivo antigo com caminho diferente — ver pendingDeletions). Uma
// entrada de tree com sha: null apaga aquele caminho no commit resultante;
// se o arquivo já não existir mais (ex: dois envios apontando pro mesmo
// arquivo antigo), o GitHub só ignora essa entrada, sem erro.
async function deleteBinaryFile(path, message) {
  await commitTreeChange([{ path, mode: "100644", type: "blob", sha: null }], message);
}

function fileExtension(filename, fallback) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
  return match ? match[1].toLowerCase() : fallback;
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
      const uid = crypto.randomUUID();
      const updated = { tokens: [...(fresh.content?.tokens || []), { uid, label, role: "admin", ...encrypted }] };
      await putFile(CONFIG.authPath, updated, fresh.sha, `admin: configura autenticação (${label})`);
      CURRENT_SALT = encrypted.salt;
      CURRENT_LABEL = label;
      CURRENT_UID = uid;
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

// Atualiza o registro de quem acabou de entrar, se ele for de uma versão
// antiga do painel: recriptografa com PBKDF2_ITERATIONS (se usar menos
// repetições) e/ou cria o uid. Falhar aqui não impede o login — tenta de
// novo na próxima vez.
async function migrateCurrentEntry(password) {
  try {
    const fresh = await getFile(CONFIG.authPath);
    const tokens = [...(fresh.content?.tokens || [])];
    const index = tokens.findIndex((t) => t.salt === CURRENT_SALT);
    if (index === -1) return;
    const entry = tokens[index];
    const weak = (entry.iterations || LEGACY_PBKDF2_ITERATIONS) < PBKDF2_ITERATIONS;
    if (!weak && entry.uid) return;
    tokens[index] = {
      ...entry,
      uid: uidOf(entry),
      ...(weak ? await encryptToken(TOKEN, password) : {}),
    };
    await putFile(CONFIG.authPath, { tokens }, fresh.sha, `admin: atualiza registro do acesso "${entry.label}"`);
    CURRENT_SALT = tokens[index].salt;
    CURRENT_UID = tokens[index].uid;
  } catch (err) {
    console.warn("Não foi possível atualizar o registro do acesso:", err);
    toast(`Não foi possível atualizar seu registro de acesso: ${err.message}`, "error");
  }
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
        if (recovered) {
          ROLE = roleOf(entry);
          CURRENT_SALT = entry.salt;
          CURRENT_LABEL = entry.label || "";
          CURRENT_UID = uidOf(entry);
          CURRENT_INTEGRANTE = entry.integrante || null;
          break;
        }
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
      await migrateCurrentEntry(password);
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

// Grupos da barra lateral (Conteúdo, Páginas, Site, Configurações) podem ser
// retraídos; o estado de cada um fica salvo no localStorage deste navegador.
const SIDEBAR_GROUPS_KEY = "adm-sidebar-groups";

function loadSidebarGroups() {
  try {
    return JSON.parse(localStorage.getItem(SIDEBAR_GROUPS_KEY)) || {};
  } catch {
    return {};
  }
}

function setSidebarGroup(toggle, expanded) {
  toggle.setAttribute("aria-expanded", String(expanded));
  const state = loadSidebarGroups();
  state[toggle.dataset.group] = expanded;
  try {
    localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(state));
  } catch {}
}

function setupNav() {
  const sidebar = document.querySelector(".adm-sidebar");
  const saved = loadSidebarGroups();
  sidebar.querySelectorAll(".sidebar-section[data-group]").forEach((toggle) => {
    if (toggle.dataset.group in saved) toggle.setAttribute("aria-expanded", String(saved[toggle.dataset.group]));
  });

  sidebar.addEventListener("click", (e) => {
    const toggle = e.target.closest(".sidebar-section[data-group]");
    if (toggle) {
      setSidebarGroup(toggle, toggle.getAttribute("aria-expanded") !== "true");
      return;
    }
    const btn = e.target.closest(".nav-btn");
    if (!btn) return;
    showPanel(btn.dataset.panel);
  });

  // Tela inicial: cartões e páginas levam às telas; "Escrever uma notícia
  // nova" já abre a notícia em branco.
  document.getElementById("panel-inicio").addEventListener("click", (e) => {
    const alvo = e.target.closest("[data-ir]");
    if (!alvo) return;
    if (alvo.dataset.ir === "nova-noticia") {
      showPanel("articles");
      if (painelAtual === "articles") addArticle();
      return;
    }
    showPanel(alvo.dataset.ir);
  });
  document.getElementById("logo-btn").addEventListener("click", () => showPanel("inicio"));
  // No celular a barra lateral fica escondida atrás do botão "Menu".
  const menuBtn = document.getElementById("menu-btn");
  menuBtn.addEventListener("click", () => {
    const aberto = document.body.classList.toggle("menu-aberto");
    menuBtn.setAttribute("aria-expanded", String(aberto));
    if (aberto) window.scrollTo({ top: 0 });
  });
}

let painelAtual = "inicio";

function showPanel(name) {
  if (ROLE !== "admin" && document.getElementById("panel-" + name)?.closest(".admin-only")) return;
  if (!podeSairDaTela()) return;
  painelAtual = name;
  document.body.classList.remove("menu-aberto");
  document.getElementById("menu-btn")?.setAttribute("aria-expanded", "false");
  document.querySelectorAll(".section-panel.em-detalhe").forEach(fecharItem);
  document.querySelectorAll(".section-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  const panel = document.getElementById("panel-" + name);
  if (panel) panel.classList.add("active");
  abrirTela(panel?.querySelector(":scope > .barra-publicar") ? panel : null, SECOES_DE_TEXTOS);
  atualizarBarrasDeLista();
  irParaOConteudo();
  const btn = document.querySelector(`.nav-btn[data-panel="${BOTAO_DA_TELA[name] || name}"]`);
  if (btn) {
    btn.classList.add("active");
    // Se a aba ativa estiver num grupo retraído, abre o grupo pra ela aparecer.
    const toggle = btn.closest(".sidebar-group")?.previousElementSibling;
    if (toggle?.getAttribute("aria-expanded") === "false") setSidebarGroup(toggle, true);
  }
}

// Telas dos textos fixos (PAGE_SCHEMA). Início e Contato ficam em "Páginas"
// na barra lateral (ver renderSidebarPaginas). As de Notícias, Podcast e
// Estudos abrem pela própria lista ("Textos da página") e voltam para ela.
const TELAS_DE_TEXTOS = [
  { id: "home", titulo: "Início", chaves: ["home"] },
  { id: "contato", titulo: "Contato", chaves: ["contato"] },
  { id: "noticias", titulo: "Textos da página de notícias", chaves: ["artigos", "artigo"], lista: "articles", voltar: "Notícias" },
  { id: "podcast", titulo: "Textos da página do podcast", chaves: ["podcast", "episodio"], lista: "episodes", voltar: "Podcast" },
  { id: "estudos", titulo: "Textos da página de estudos", chaves: ["estudos", "estudo"], lista: "estudos", voltar: "Estudos" },
];

// Tela que não tem botão próprio na barra lateral → botão que fica aceso
// enquanto ela está aberta.
const BOTAO_DA_TELA = Object.fromEntries(
  TELAS_DE_TEXTOS.filter((t) => t.lista).map((t) => [`page-${t.id}`, t.lista])
);

function setupPagePanels() {
  const panelsContainer = document.getElementById("page-panels");
  panelsContainer.innerHTML = "";

  for (const tela of TELAS_DE_TEXTOS) {
    const panel = el("div", "section-panel");
    panel.id = `panel-page-${tela.id}`;
    if (tela.lista) {
      const voltar = el("button", "item-voltar tela-voltar", `← ${tela.voltar}`);
      voltar.type = "button";
      voltar.addEventListener("click", () => showPanel(tela.lista));
      panel.appendChild(voltar);
    }
    const header = el("div", "panel-header");
    header.appendChild(el("span", "panel-title", tela.titulo));
    panel.appendChild(header);
    const formContainer = el("div");
    formContainer.id = `page-form-${tela.id}`;
    panel.appendChild(formContainer);
    panel.appendChild(barraDePublicar(publicarTextos));
    panelsContainer.appendChild(panel);

    // Na lista, uma linha leva a esta tela.
    if (tela.lista) {
      const lista = document.getElementById(`panel-${tela.lista}`);
      const linha = el("button", "textos-da-pagina");
      linha.type = "button";
      linha.appendChild(el("span", "textos-da-pagina-nome", "Textos da página"));
      linha.appendChild(el("span", "textos-da-pagina-dica", "título, introdução, descrição para buscadores e rótulos"));
      linha.appendChild(el("span", "card-chevron", "›"));
      linha.addEventListener("click", () => showPanel(`page-${tela.id}`));
      lista.querySelector(".panel-header").after(linha);
    }
  }
}

async function enterApp() {
  document.body.dataset.role = ROLE;
  showScreen("app-screen");
  setupPagePanels();
  setupNav();
  document.getElementById("logout-btn").addEventListener("click", () => {
    if (!podeSairDaTela()) return;
    TOKEN = "";
    location.reload();
  });
  // Fechar ou recarregar a aba com alterações não publicadas.
  window.addEventListener("beforeunload", (e) => {
    if (TOKEN && (telaTemAlteracoes() || dirty.size)) e.preventDefault();
  });
  // A barra da tela aberta acompanha o que é digitado.
  document.getElementById("app-screen").addEventListener("input", atualizarBarrasDeTela);
  document.getElementById("app-screen").addEventListener("change", atualizarBarrasDeTela);
  document.getElementById("app-screen").addEventListener("click", atualizarBarrasDeTela);
  // Telas de textos que já vêm no HTML.
  for (const id of ["panel-menu", "panel-general"]) {
    document.getElementById(id).appendChild(barraDePublicar(publicarTextos));
  }
  vigiarVersaoDoPainel();
  document.getElementById("add-article-btn").addEventListener("click", addArticle);
  document.getElementById("add-episode-btn").addEventListener("click", addEpisode);
  document.getElementById("add-member-btn").addEventListener("click", addMember);
  document.getElementById("add-categoria-estudo-btn").addEventListener("click", addCategoriaEstudo);
  document.getElementById("add-estudo-btn").addEventListener("click", addEstudo);
  document.getElementById("access-submit").addEventListener("click", addAccess);
  document.getElementById("account-submit").addEventListener("click", saveAccount);
  document.getElementById("account-cancel").addEventListener("click", resetAccountForm);
  document.getElementById("account-edit-label").addEventListener("click", () => {
    const input = document.getElementById("account-label");
    input.disabled = false;
    input.focus();
    document.getElementById("account-edit-label").hidden = true;
    document.getElementById("account-confirm").hidden = false;
  });
  document.getElementById("account-edit-password").addEventListener("click", () => {
    document.getElementById("account-password-fields").hidden = false;
    document.getElementById("account-edit-password").hidden = true;
    document.getElementById("account-confirm").hidden = false;
    document.getElementById("account-new-password").focus();
  });
  document.getElementById("user-btn").addEventListener("click", () => showPanel("account"));
  renderCurrentUser();

  await loadContent();
  renderCurrentUser(); // agora com contentData.members, para o nome do integrante
  renderPageForms();
  renderHomeEventBanner();
  if (ROLE === "admin") await loadAccess();
}

// ----------------------------------------------------------------------------
// Conteúdo: carregar, salvar, marcar sujo
// ----------------------------------------------------------------------------

let contentData = { articles: null, episodes: null, members: null, site: null, siteEn: null, estudos: null, categoriasEstudo: null };
const dirty = new Set();
// Os .md de notícias como estavam no GitHub no último carregamento ou
// salvamento — base para gravar só o que mudou (ver salvarNoticias).
let noticiasMarkdownOriginais = {};

// Campo de upload do banner de evento da Home (ver renderHomeEventBanner) —
// guardado à parte porque, ao contrário dos campos de artigo/episódio/
// integrante, não há um botão "Salvar alterações" de card que chame
// confirmFileUpload() na hora certa; collectAll() chama direto por aqui.
let homeEventBannerField = null;

// Uploads de áudio/imagem confirmados (via "Salvar alterações" de um card),
// aguardando o clique em "Salvar no GitHub" — só então são de fato
// enviados. Cada item: { path, file, message }.
const pendingUploads = [];

// Arquivos antigos a apagar do repositório porque um upload novo tomou o
// lugar deles (capa/áudio substituídos, ou imagem removida do corpo) —
// preenchido em confirmFileUpload (buildFileUploadField) e em
// applyArticleField (corpo). Processado em saveAll(), depois dos uploads.
// Cada item: { path, message }.
const pendingDeletions = [];

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
  setSaveStatus("não publicado", "pending");
  atualizarBarrasDeLista();
}

// ----------------------------------------------------------------------------
// Publicação por tela
// ----------------------------------------------------------------------------
// Cada tela (um item, ou uma tela de textos do site) tem o próprio botão
// "Publicar", que grava só aquela parte. Ao sair de uma tela com alterações
// não publicadas, o painel pergunta se pode descartá-las; descartar volta a
// seção para a última versão publicada (`publicado`).

// Cópia de contentData como está publicado (no carregamento e a cada
// publicação). Descartar restaura daqui.
let publicado = {};

// Seções gravadas pelas telas de textos do site.
const SECOES_DE_TEXTOS = ["site", "siteEn", "paginas"];

// Tela aberta agora: { root, secoes, base, novo }. `base` é a assinatura dos
// campos quando a tela abriu; `novo` marca um item criado e ainda não
// publicado.
let telaAberta = null;

// Retrato dos campos de uma tela, para saber se algo mudou desde que ela
// abriu. Inclui os arquivos escolhidos e ainda não enviados (status
// "pending" de buildFileUploadField).
function assinatura(root) {
  if (!root) return "";
  const campos = [...root.querySelectorAll("input, textarea, select, [contenteditable]")].map((e) => {
    if (e.isContentEditable) return e.innerHTML;
    if (e.type === "checkbox") return e.checked;
    if (e.type === "file") return "";
    return e.value;
  });
  campos.push(root.querySelectorAll('[data-kind="pending"]').length);
  return JSON.stringify(campos);
}

function abrirTela(root, secoes, novo = false) {
  telaAberta = root ? { root, secoes, base: assinatura(root), novo } : null;
  atualizarBarrasDeTela();
}

function telaTemAlteracoes() {
  return !!telaAberta && (telaAberta.novo || assinatura(telaAberta.root) !== telaAberta.base);
}

// Antes de sair da tela aberta. Devolve false se a pessoa preferiu ficar.
function podeSairDaTela() {
  if (!telaAberta) return true;
  const mudou = assinatura(telaAberta.root) !== telaAberta.base;
  if (mudou && !confirm("Esta tela tem alterações que ainda não foram publicadas. Sair e descartar as alterações?")) return false;
  if (mudou || telaAberta.novo) descartarSecoes(telaAberta.secoes);
  else if (telaAberta.secoes === SECOES_DE_TEXTOS) {
    // Digitou e desfez: o campo marcou a seção, mas nada mudou de fato.
    for (const secao of SECOES_DE_TEXTOS) {
      if (secao === "paginas" || JSON.stringify(contentData[secao]) === JSON.stringify(publicado[secao])) dirty.delete(secao);
    }
  }
  telaAberta = null;
  return true;
}

// Volta as seções para a última versão publicada e redesenha as telas delas.
function descartarSecoes(secoes) {
  for (const secao of secoes) {
    if (secao in publicado) contentData[secao] = structuredClone(publicado[secao]);
    dirty.delete(secao);
  }
  pendingUploads.length = 0;
  pendingDeletions.length = 0;
  redesenharSecoes(secoes);
  setSaveStatus(dirty.size ? "não publicado" : "tudo publicado", dirty.size ? "pending" : "ok");
  atualizarBarrasDeLista();
}

function redesenharSecoes(secoes) {
  const s = new Set(secoes);
  if (s.has("articles")) renderArticlesList();
  if (s.has("episodes")) renderEpisodesList();
  if (s.has("members")) renderMembersList();
  if (s.has("categoriasEstudo")) renderCategoriasEstudoList();
  if (s.has("estudos") || s.has("categoriasEstudo")) renderEstudosList();
  if (SECOES_DE_TEXTOS.some((x) => s.has(x))) redesenharTextosDoSite();
}

function redesenharTextosDoSite() {
  renderGeneralForm();
  renderSiteSocialLinks();
  renderSiteMenu();
  renderPageForms();
  renderHomeEventBanner();
  carregarPaginasDeTexto(paginasMarkdownOriginais);
  renderSidebarPaginas();
}

// Seção de um cartão de item, pelo id do cartão.
function secaoDoCard(card) {
  const prefixos = [
    ["article-card-", "articles"],
    ["episode-card-", "episodes"],
    ["member-card-", "members"],
    ["member-view-", "members"],
    ["categoria-estudo-card-", "categoriasEstudo"],
    ["estudo-card-", "estudos"],
  ];
  return prefixos.find(([p]) => card.id.startsWith(p))?.[1];
}

// "Publicar" de um item: `preparar` confirma os arquivos escolhidos e passa
// os campos do cartão para contentData (o que o antigo "Salvar alterações"
// fazia). Depois de publicar, redesenha a lista (a linha mostra o título
// novo) e reabre o mesmo item.
async function publicarItem(card, preparar) {
  const secao = secaoDoCard(card);
  preparar();
  markDirty(secao);
  const id = card.id;
  const ok = await saveAll([secao]);
  if (!ok) return;
  redesenharSecoes([secao]);
  const reaberto = document.getElementById(id);
  if (reaberto) abrirItem(reaberto, { manterRolagem: true });
}

// "Publicar" de uma tela de textos do site.
async function publicarTextos() {
  const ok = await saveAll(SECOES_DE_TEXTOS);
  if (!ok) return;
  // A tela de uma página de texto é recriada depois de publicar.
  const painel = document.getElementById(`panel-${painelAtual}`);
  abrirTela(painel, SECOES_DE_TEXTOS);
}

// Barra "Publicar" no rodapé das telas de textos do site.
function barraDePublicar(onPublicar) {
  const barra = el("div", "barra-publicar");
  barra.appendChild(el("span", "barra-estado"));
  const btn = el("button", "btn btn-primary btn-small btn-publicar", "Publicar");
  btn.type = "button";
  btn.addEventListener("click", onPublicar);
  barra.appendChild(btn);
  return barra;
}

// Mostra "alterações não publicadas" na barra da tela aberta.
let barraTimer = null;
function atualizarBarrasDeTela() {
  if (barraTimer) return;
  barraTimer = requestAnimationFrame(() => {
    barraTimer = null;
    document.querySelectorAll(".barra-publicar:not(.barra-lista) .barra-estado, .card-actions .barra-estado").forEach((e) => (e.textContent = ""));
    const mudou = !!telaAberta && telaTemAlteracoes();
    if (telaAberta) {
      let estado = telaAberta.root.querySelector(":scope > .barra-publicar .barra-estado, .card-actions .barra-estado");
      const acoes = telaAberta.root.querySelector(".card-actions");
      if (!estado && acoes) acoes.prepend((estado = el("span", "barra-estado")));
      if (estado) estado.textContent = mudou ? "alterações não publicadas" : "";
    }
    // O topo acompanha a tela, mas não apaga "publicando…" nem um erro.
    const topo = document.getElementById("save-status");
    if (topo && /^(tudo publicado|não publicado|publicado ✓)$/.test(topo.textContent)) {
      if (mudou || dirty.size) setSaveStatus("não publicado", "pending");
      else if (topo.textContent === "não publicado") setSaveStatus("tudo publicado", "ok");
    }
  });
}

// Lista com mudança que não é de um item só (ordem, ou correção automática
// do carregamento): uma barra no rodapé da lista oferece Publicar e
// Desfazer.
const LISTAS = {
  articles: "panel-articles",
  episodes: "panel-episodes",
  members: "panel-members",
  estudos: "panel-estudos",
  categoriasEstudo: "panel-estudos",
};

function atualizarBarrasDeLista() {
  for (const [secao, painelId] of Object.entries(LISTAS)) {
    const painel = document.getElementById(painelId);
    if (!painel) continue;
    let barra = painel.querySelector(`.barra-lista[data-secao="${secao}"]`);
    const aberto = telaAberta?.secoes.includes(secao);
    const mostrar = dirty.has(secao) && !aberto;
    if (!mostrar) {
      barra?.remove();
      continue;
    }
    if (barra) continue;
    barra = barraDePublicar(async () => {
      if (await saveAll([secao])) atualizarBarrasDeLista();
    });
    barra.classList.add("barra-lista");
    barra.dataset.secao = secao;
    barra.querySelector(".barra-estado").textContent =
      secao === "categoriasEstudo" ? "As categorias têm alterações não publicadas (ordem ou correções)." : "A lista tem alterações não publicadas (ordem ou correções).";
    const desfazer = el("button", "btn btn-secondary btn-small", "Desfazer");
    desfazer.type = "button";
    desfazer.addEventListener("click", () => descartarSecoes([secao]));
    barra.insertBefore(desfazer, barra.querySelector(".btn-publicar"));
    painel.appendChild(barra);
  }
}

// Busca um arquivo de conteúdo que pode ainda não existir no repositório
// (ex: data/members.json antes do primeiro "Salvar no GitHub" desta feature)
// — trata 404 como "lista vazia" em vez de derrubar o carregamento inteiro.
async function getFileOrEmpty(path, fallback) {
  try {
    return await getFile(path);
  } catch (err) {
    if (err.status !== 404) throw err;
    return { content: fallback, sha: undefined };
  }
}

// Corrige ids que fujam do padrão slug (ex: espaço em vez de traço,
// maiúsculas) — acontece em registros criados antes do id virar automático
// (ver nextIdNumber), ou editados à mão direto no JSON. Sem isso, o id
// destoa dos nomes de arquivo (imagem/áudio), que são derivados dele.
// Não mexe em `image`/`audioSrc`: só o texto do id muda aqui, o arquivo já
// enviado com o nome antigo continua onde está — é preciso reenviá-lo (o
// campo de upload já vai calcular o novo caminho certo a partir do id
// corrigido) pra ele passar a bater com o id novo.
function normalizeIds(items) {
  let changed = false;
  for (const item of items) {
    if (!item.id) continue;
    const clean = slugify(item.id);
    if (clean && clean !== item.id) {
      item.id = clean;
      changed = true;
    }
  }
  return changed;
}

// Remove campos que saíram do formulário (ex: "excerpt", tirado do card de
// notícia por não ser usado em lugar nenhum do site) mas que podem ter
// ficado gravados em registros salvos antes da mudança.
function stripLegacyFields(items, keys) {
  let changed = false;
  for (const item of items) {
    for (const key of keys) {
      if (key in item) {
        delete item[key];
        changed = true;
      }
    }
  }
  return changed;
}

async function loadContent() {
  setSaveStatus("carregando…");
  try {
    const [articles, episodes, members, site, siteEn, estudos, categoriasEstudo, paginas] = await Promise.all([
      getNoticiasMarkdown(),
      getFile(CONFIG.episodesPath),
      getFileOrEmpty(CONFIG.membersPath, []),
      getFile(CONFIG.sitePath),
      getFileOrEmpty(CONFIG.siteEnPath, {}),
      getFileOrEmpty(CONFIG.estudosPath, []),
      getFileOrEmpty(CONFIG.categoriasEstudoPath, []),
      getMarkdownDaPasta(PASTA_PAGINAS),
    ]);
    noticiasMarkdownOriginais = articles;
    carregarPaginasDeTexto(paginas);
    contentData.articles = arquivosParaNoticias(articles);
    contentData.episodes = episodes.content;
    contentData.members = members.content || [];
    contentData.site = site.content;
    contentData.siteEn = siteEn.content || {};
    contentData.estudos = estudos.content || [];
    contentData.categoriasEstudo = categoriasEstudo.content || [];
    dirty.clear();
    let fixedArticles = normalizeIds(contentData.articles);
    if (stripLegacyFields(contentData.articles, ["excerpt"])) fixedArticles = true;
    const fixedEpisodes = normalizeIds(contentData.episodes);
    const fixedEstudos = normalizeIds(contentData.estudos);
    const fixedCategoriasEstudo = normalizeIds(contentData.categoriasEstudo);
    if (fixedArticles) dirty.add("articles");
    if (fixedEpisodes) dirty.add("episodes");
    if (fixedEstudos) dirty.add("estudos");
    if (fixedCategoriasEstudo) dirty.add("categoriasEstudo");
    renderArticlesList();
    renderEpisodesList();
    renderMembersList();
    renderCategoriasEstudoList();
    renderEstudosList();
    renderGeneralForm();
    renderSiteSocialLinks();
    renderSiteMenu();
    renderSidebarPaginas();
    publicado = structuredClone(contentData);
    atualizarBarrasDeLista();
    if (fixedArticles || fixedEpisodes || fixedEstudos || fixedCategoriasEstudo) {
      setSaveStatus("não publicado", "pending");
      toast('Encontrei alguma coisa desatualizada (identificador fora do padrão ou campo removido) e já corrigi. Confira e clique em "Publicar" na barra da lista.', "ok");
    } else {
      setSaveStatus("tudo publicado", "ok");
    }
  } catch (err) {
    setSaveStatus("erro ao carregar ✗", "err");
    toast(`Não foi possível carregar: ${err.message}`, "error");
  }
}

// Caminhos de imagem no corpo são salvos relativos à raiz do site (ex:
// "images/noticias/x.jpg"), porque é de lá que as páginas públicas (noticia.html
// etc.) os carregam. Mas o próprio painel vive em /admin/, um nível abaixo —
// então, exibido cru dentro do editor, esse mesmo src resolveria para
// /admin/images/noticias/x.jpg (404, ícone quebrado). toEditorPreviewHtml
// corrige só a exibição (soma um "../"); finalizeRichTextHtml desfaz antes de
// gravar, pra nunca persistir o "../" no JSON.
function toEditorPreviewHtml(html) {
  if (!html) return "";
  // <template>: o HTML é analisado sem carregar nada — um <div> solto já
  // baixaria cada imagem pelo caminho cru (/admin/images/…, 404).
  const div = document.createElement("template");
  div.innerHTML = html;
  div.content.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !/^(https?:|blob:|\.\.\/|\/)/i.test(src)) {
      img.setAttribute("src", `../${src}`);
    }
  });
  return div.innerHTML;
}

// O corpo (contenteditable) não tem .value — e as imagens inseridas nele
// ficam com um src temporário (blob local) até o upload de fato acontecer,
// então salvar precisa trocar esse src pelo caminho definitivo primeiro
// (ver data-final-src em buildRichTextField/confirmBodyImages). Além disso
// desfaz o "../" de preview (ver toEditorPreviewHtml) nas imagens já salvas.
function finalizeRichTextHtml(container) {
  // Cópia num <template> (não carrega nada): num clone comum, trocar o src
  // abaixo já faria o navegador baixar cada imagem pelo caminho sem "../".
  const template = document.createElement("template");
  template.innerHTML = container.innerHTML;
  const clone = template.content;
  clone.querySelectorAll("img[data-final-src]").forEach((img) => {
    img.setAttribute("src", img.getAttribute("data-final-src"));
    img.removeAttribute("data-final-src");
  });
  clone.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && src.startsWith("../")) {
      img.setAttribute("src", src.slice(3));
    }
  });
  clone.querySelectorAll("[data-legenda]").forEach((node) => node.removeAttribute("data-legenda"));
  // Rede de segurança: parágrafo/subtítulo vazio nunca é salvo (some sua
  // margem à do vizinho e dobra o espaço no site publicado) — não importa se
  // veio de colar, de Enter em sequência ou de conteúdo antigo.
  clone.querySelectorAll("p, h2, h3").forEach((node) => {
    if (node.textContent.trim() === "" && !node.querySelector("img")) node.remove();
  });
  return template.innerHTML;
}

// Caminhos de imagem (não http(s), não blob: de pré-visualização) que
// aparecem num HTML de corpo — usado para comparar a versão antiga com a
// nova e descobrir quais imagens saíram do texto (ver applyArticleField).
function extractImagePaths(html) {
  const paths = new Set();
  if (!html) return paths;
  // <template> pelo mesmo motivo de toEditorPreviewHtml: não carrega as imagens.
  const div = document.createElement("template");
  div.innerHTML = html;
  div.content.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !/^(https?:|blob:)/i.test(src)) paths.add(src);
  });
  return paths;
}

function applyArticleField(input) {
  const i = Number(input.dataset.article);
  const key = input.dataset.key;
  const record = contentData.articles[i];
  if (!record) return;
  if (input.type === "checkbox") {
    if (input.checked) record[key] = true;
    else delete record[key];
    return;
  }
  if (input.dataset.richtext === "html") {
    const newHtml = finalizeRichTextHtml(input);
    // Imagem que estava no HTML salvo antes e não está mais no novo —
    // saiu do texto (apagada no editor); se nenhum outro corpo (a outra
    // língua desta notícia ou outra notícia) usar o mesmo arquivo, ele fica
    // sem uso e a remoção é agendada junto do resto das alterações pendentes.
    const oldPaths = extractImagePaths(record[key]);
    const newPaths = extractImagePaths(newHtml);
    const usedElsewhere = new Set();
    contentData.articles.forEach((article) => {
      ["body", "bodyEn"].forEach((k) => {
        if (article === record && k === key) return;
        extractImagePaths(article[k]).forEach((path) => usedElsewhere.add(path));
      });
    });
    oldPaths.forEach((path) => {
      if (!newPaths.has(path) && !usedElsewhere.has(path)) {
        pendingDeletions.push({ path, message: `admin: remove imagem não usada mais no corpo (${path})` });
      }
    });
    // bodyEn é opcional (diferente de body) — corpo em inglês vazio some
    // por completo (e o tempo de leitura calculado a partir dele junto),
    // em vez de salvar uma string vazia.
    if (key === "bodyEn" && !newHtml) {
      delete record.bodyEn;
      delete record.readingTimeEn;
    } else {
      record[key] = newHtml;
      if (key === "body") record.readingTime = computeReadingTime(newHtml);
      else if (key === "bodyEn") record.readingTimeEn = computeReadingTime(newHtml);
    }
    return;
  }
  const value = input.dataset.multiline === "paragraphs" ? linesToParagraphs(input.value) : input.value;
  const deleteIfEmpty = [
    "subtitle", "image", "author", "authorAvatar", "imageCaption", "imageVertical",
    "categoryEn", "titleEn", "subtitleEn", "imageCaptionEn", "time",
  ];
  if (deleteIfEmpty.includes(key) && !value) delete record[key];
  else record[key] = value;
}

function applyEpisodeField(input) {
  const i = Number(input.dataset.episode);
  const key = input.dataset.key;
  const record = contentData.episodes[i];
  if (!record) return;
  if (input.type === "checkbox") {
    if (input.checked) record[key] = true;
    else delete record[key];
    return;
  }
  if (key === "number") {
    record.number = Number(input.value);
    return;
  }
  if (input.dataset.multiline === "paragraphs") {
    const paragraphs = linesToParagraphs(input.value);
    if (paragraphs.length === 0) delete record[key];
    else record[key] = paragraphs;
    return;
  }
  if (["image", "time", "titleEn", "descriptionEn"].includes(key) && !input.value.trim()) { delete record[key]; return; }
  record[key] = input.value;
}

function applyMemberField(input) {
  const i = Number(input.dataset.member);
  const key = input.dataset.key;
  const record = contentData.members[i];
  if (!record) return;
  if ((key === "image" || key === "descriptionEn") && !input.value) { delete record[key]; return; }
  record[key] = input.value;
}

function applyCategoriaEstudoField(input) {
  const i = Number(input.dataset.categoriaEstudo);
  const key = input.dataset.key;
  const record = contentData.categoriasEstudo[i];
  if (!record) return;
  if (["descricao", "nomeEn", "descricaoEn"].includes(key) && !input.value.trim()) { delete record[key]; return; }
  record[key] = input.value;
}

// Diferente de "featured" (article/episode), "publicado" é sempre gravado
// como true/false explícito, nunca omitido — é o campo que distingue
// rascunho de publicado (ver Verbete em src/main.ts), então precisa
// continuar existindo mesmo desmarcado, em vez de sumir do JSON.
function applyEstudoField(input) {
  const i = Number(input.dataset.verbete);
  const key = input.dataset.key;
  const record = contentData.estudos[i];
  if (!record) return;
  if (input.type === "checkbox") {
    record[key] = input.checked;
    return;
  }
  if (input.dataset.richtext === "html") {
    const newHtml = finalizeRichTextHtml(input);
    // Como nas notícias: só remove a imagem se nenhum outro conteúdo (a
    // outra língua deste verbete ou outro verbete) ainda usar o arquivo.
    const oldPaths = extractImagePaths(record[key]);
    const newPaths = extractImagePaths(newHtml);
    const usedElsewhere = new Set();
    contentData.estudos.forEach((verbete) => {
      ["conteudo", "conteudoEn"].forEach((k) => {
        if (verbete === record && k === key) return;
        extractImagePaths(verbete[k]).forEach((path) => usedElsewhere.add(path));
      });
    });
    oldPaths.forEach((path) => {
      if (!newPaths.has(path) && !usedElsewhere.has(path)) {
        pendingDeletions.push({ path, message: `admin: remove imagem não usada mais no conteúdo (${path})` });
      }
    });
    if (key === "conteudoEn" && !newHtml) delete record.conteudoEn;
    else record[key] = newHtml;
    return;
  }
  if (["tituloEn", "definicaoCurtaEn"].includes(key) && !input.value.trim()) { delete record[key]; return; }
  record[key] = input.value;
}

// collectAll(): sincroniza TUDO que está na tela pra dentro de contentData —
// usado antes de reordenar/remover/adicionar (e no salvamento final), pra
// não perder edição em outros cards quando a lista é redesenhada do zero.
function collectAll() {
  document.querySelectorAll("[data-article]").forEach(applyArticleField);
  collectArticleReferences();
  document.querySelectorAll("[data-episode]").forEach(applyEpisodeField);
  document.querySelectorAll("[data-member]").forEach(applyMemberField);
  collectMemberLinks();
  document.querySelectorAll("[data-categoria-estudo]").forEach(applyCategoriaEstudoField);
  document.querySelectorAll("[data-verbete]").forEach(applyEstudoField);
  collectVerbeteFontes();
  collectVerbeteTermosRelacionados();
  if (homeEventBannerField) homeEventBannerField.confirmFileUpload();
  document.querySelectorAll("[data-site]").forEach((input) => {
    setByPath(contentData.site, input.dataset.site, input.value);
  });
  document.querySelectorAll("[data-site-en]").forEach((input) => {
    setByPath(contentData.siteEn, input.dataset.siteEn, input.value);
  });
  collectSiteSocialLinks();
  collectSiteMenu();
}

// Collectors por card: só sincronizam os campos daquele artigo/episódio
// específico — usados pelo botão "Salvar alterações" de cada bloco, que é
// o único jeito de uma edição de texto/checkbox/arquivo virar de fato uma
// alteração pendente (ver buildSaveCardButton).
function collectArticleCardFields(i) {
  document.querySelectorAll(`[data-article="${i}"]`).forEach(applyArticleField);
  collectArticleReferences();
}
function collectEpisodeCardFields(i) {
  document.querySelectorAll(`[data-episode="${i}"]`).forEach(applyEpisodeField);
}
function collectMemberCardFields(i) {
  document.querySelectorAll(`[data-member="${i}"]`).forEach(applyMemberField);
  collectMemberLinks();
}
function collectCategoriaEstudoCardFields(i) {
  document.querySelectorAll(`[data-categoria-estudo="${i}"]`).forEach(applyCategoriaEstudoField);
}
function collectEstudoCardFields(i) {
  document.querySelectorAll(`[data-verbete="${i}"]`).forEach(applyEstudoField);
  collectVerbeteFontes();
  collectVerbeteTermosRelacionados();
}

// Versão do painel (ver versionarPainel em astro.config.mjs): se o painel
// publicado mudou desde que esta página abriu, salvar daqui poderia gravar
// num formato que o site não lê mais. Uma faixa avisa assim que a mudança é
// percebida (a cada 5 minutos e ao voltar para a aba), e saveAll se recusa a
// enviar. Sem a meta (astro dev), não há conferência.
const VERSAO_PAINEL = document.querySelector('meta[name="versao-painel"]')?.content;

async function painelDesatualizado() {
  if (!VERSAO_PAINEL) return false;
  try {
    const r = await fetch(`versao.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return false;
    const { versao } = await r.json();
    return Boolean(versao) && versao !== VERSAO_PAINEL;
  } catch {
    return false; // sem rede: a conferência não bloqueia
  }
}

async function avisarSePainelDesatualizado() {
  if (document.getElementById("aviso-versao") || !(await painelDesatualizado())) return;
  const aviso = el("div", "aviso-versao");
  aviso.id = "aviso-versao";
  aviso.setAttribute("role", "alert");
  aviso.appendChild(
    el("span", "", "Há uma versão nova do painel. Copie o que ainda não salvou e recarregue a página (Ctrl+Shift+R) antes de salvar.")
  );
  const recarregar = el("button", "btn btn-primary btn-small", "Recarregar agora");
  recarregar.type = "button";
  recarregar.addEventListener("click", () => location.reload());
  aviso.appendChild(recarregar);
  document.getElementById("app-screen").prepend(aviso);
}

function vigiarVersaoDoPainel() {
  if (!VERSAO_PAINEL) return;
  setInterval(avisarSePainelDesatualizado, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") avisarSePainelDesatualizado();
  });
}

// Publica as seções `secoes` que tiverem alteração (todas, sem o
// argumento), mais os envios de arquivo na fila. Devolve true se publicou
// (ou se não havia nada a publicar) e false se algo deu errado ou foi
// cancelado.
async function saveAll(secoes) {
  const alvo = new Set([...dirty].filter((s) => !secoes || secoes.includes(s)));
  if (alvo.size === 0 && pendingUploads.length === 0 && pendingDeletions.length === 0) return true;
  if (await painelDesatualizado()) {
    await avisarSePainelDesatualizado();
    setSaveStatus("erro: painel desatualizado — recarregue a página", "err");
    toast("Nada foi enviado: o painel foi atualizado desde que esta página abriu. Recarregue (Ctrl+Shift+R) e refaça a alteração.", "error");
    return false;
  }
  // Sem isso, campos de "Rodapé e marca"/"Páginas" (data-site/data-site-en)
  // e as listas de tamanho livre (links de integrante, redes sociais do
  // rodapé) só entravam em contentData quando alguém reordenava/adicionava/
  // removia um item em outra seção (o que já chama collectAll) — clicar
  // direto em "Salvar no GitHub" depois de só editar um desses campos
  // salvava a versão antiga, sem a edição.
  collectAll();
  setSaveStatus("publicando…", "pending");
  try {
    // Antes dos envios: um id de integrante repetido faria a foto de um
    // sobrescrever a do outro (o caminho da foto vem do id).
    if (alvo.has("members")) {
      const problemas = contentData.members
        .filter((m) => m._isNew)
        .flatMap((m) => {
          if (!m.name?.trim()) return ["integrante novo sem nome completo"];
          if (!MEMBER_ID_RE.test(m.id || "")) return [`identificador inválido em "${m.name}" (só letras minúsculas sem acento, números e hífens)`];
          return [];
        });
      if (problemas.length) throw new Error(`corrija antes de salvar: ${problemas.join("; ")}`);
    }
    const memberIds = contentData.members?.map((m) => m.id) || [];
    const duplicate = memberIds.find((id, i) => memberIds.indexOf(id) !== i);
    if (duplicate) throw new Error(`dois integrantes com o mesmo identificador ("${duplicate}")`);
    if (alvo.has("members")) alinharFotosDeIntegrantesNovos();
    // Menu: item sem nome ou com link fora do formato faria o build falhar
    // (ver src/lib/menu.ts).
    if (alvo.has("site")) {
      const problemas = problemasDoMenu(contentData.site.menu || []);
      if (problemas.length) throw new Error(`corrija antes de salvar: ${problemas.join("; ")}`);
    }
    // Episódios: data inválida faria o build do site falhar.
    if (alvo.has("episodes")) {
      const semData = contentData.episodes.filter((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.date || ""));
      if (semData.length) throw new Error(`corrija antes de salvar: data inválida no episódio ${semData.map((e) => e.title || e.id).join(", ")}`);
    }
    // Notícias: valida e calcula os arquivos antes de qualquer envio — um
    // título vazio ou uma data inválida faria o build do site falhar.
    let noticias = null;
    if (alvo.has("articles")) {
      const problemas = problemasDasNoticias(contentData.articles);
      if (problemas.length) throw new Error(`corrija antes de salvar: ${problemas.join("; ")}`);
      const arquivos = noticiasParaArquivos(contentData.articles);
      noticias = { arquivos, mudancas: mudancasDeArquivos(noticiasMarkdownOriginais, arquivos) };
      if (!confirmarApagarTraducoes(noticias.mudancas.apagar, arquivos)) {
        setSaveStatus("não publicado", "pending");
        return false;
      }
    }
    // Páginas de texto: idem, um commit só com os .md que mudaram.
    let paginas = null;
    if (alvo.has("paginas")) {
      const { arquivos, problemas } = paginasParaArquivos();
      if (problemas.length) throw new Error(`corrija antes de salvar: ${problemas.join("; ")}`);
      paginas = { arquivos, mudancas: mudancasDeArquivos(paginasMarkdownOriginais, arquivos) };
      if (paginas.mudancas.apagar.length && !confirm(`Apagar a versão em inglês de: ${paginas.mudancas.apagar.map(slugDoCaminho).join(", ")}? (o texto em inglês foi esvaziado)`)) {
        setSaveStatus("não publicado", "pending");
        return false;
      }
    }
    for (const upload of pendingUploads) {
      await uploadBinaryFile(upload.path, upload.file, upload.message);
    }
    pendingUploads.length = 0;
    // Remoções depois dos envios: garante que o arquivo novo já está no
    // lugar antes de mexer em qualquer coisa antiga.
    for (const deletion of pendingDeletions) {
      await deleteBinaryFile(deletion.path, deletion.message);
    }
    pendingDeletions.length = 0;
    // Some antes de serializar: _isNew é só uma marca em memória (ver
    // addMember) pra liberar a edição do id enquanto o integrante ainda não
    // tinha sido salvo — nunca deve ir pro JSON do GitHub.
    let savedNewMembers = false;
    if (alvo.has("members")) {
      contentData.members.forEach((m) => {
        if (m._isNew) savedNewMembers = true;
        delete m._isNew;
        delete m._idManual;
      });
    }
    for (const section of alvo) {
      if (section === "articles") {
        await salvarNoticias(noticias);
        continue;
      }
      if (section === "paginas") {
        await salvarPaginas(paginas);
        continue;
      }
      // sha undefined (arquivo ainda não existe no repositório, ex: primeiro
      // salvamento de data/members.json) faz o PUT criar o arquivo em vez de
      // atualizar um existente — ver getFileOrEmpty.
      const fresh = await getFileOrEmpty(PATHS[section], null);
      if (section === "members" && ROLE !== "admin") {
        contentData.members = mergeOwnMembers(fresh.content || []);
        savedNewMembers = true; // redesenha com a lista mesclada
      }
      await putFile(PATHS[section], contentData[section], fresh.sha, `admin: atualiza ${section}`);
    }
    // A lista de integrantes de "Acessos" passa a ter os recém-salvos.
    if (alvo.has("members") && accessCache) renderAccessList();
    alvo.forEach((section) => {
      dirty.delete(section);
      publicado[section] = structuredClone(contentData[section]);
    });
    // Redesenha os cards de integrante pra travar o id dos que acabaram de
    // ser salvos pela primeira vez (some o campo editável, aparece o travado).
    if (savedNewMembers) renderMembersList();
    setSaveStatus("publicado ✓", "ok");
    toast("Publicado! O site atualiza em um ou dois minutos.", "ok");
    return true;
  } catch (err) {
    setSaveStatus("erro ao publicar ✗", "err");
    toast(`Erro: ${err.message}`, "error");
    return false;
  }
}

// Versão em inglês esvaziada (título e corpo EN em branco) apaga o .md EN da
// notícia — pede confirmação antes, já que o texto traduzido some do site.
// Os .md de notícias removidas inteiras já foram confirmados em removeArticle.
function confirmarApagarTraducoes(apagar, arquivos) {
  const traducoes = apagar.filter((caminho) => {
    const m = new RegExp(`^${PASTA_NOTICIAS}/en/(.+)\\.md$`).exec(caminho);
    return m && `${PASTA_NOTICIAS}/pt/${m[1]}.md` in arquivos;
  });
  if (traducoes.length === 0) return true;
  const ids = traducoes.map((caminho) => caminho.split("/").pop().replace(/\.md$/, "")).join(", ");
  return confirm(`A versão em inglês destas notícias está vazia e será apagada do site: ${ids}. Continuar?`);
}

// Grava as notícias num único commit, só com os .md que mudaram; apaga o .md
// de uma notícia removida e o EN de uma tradução esvaziada.
async function salvarNoticias({ arquivos, mudancas }) {
  const entries = [
    ...Object.entries(mudancas.gravar).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
    ...mudancas.apagar.map((path) => ({ path, mode: "100644", type: "blob", sha: null })),
  ];
  if (entries.length) {
    try {
      await commitTreeChange(entries, "admin: atualiza notícias");
    } catch (err) {
      throw explainWriteError(err);
    }
  }
  noticiasMarkdownOriginais = arquivos;
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

// Campo numérico que só muda pelas setinhas do próprio input (spinner
// nativo do navegador) — bloqueia qualquer tecla que insira caractere
// (dígitos inclusive) e também colar, então digitar direto não tem efeito.
function buildSpinnerNumberField(labelText, value, dataset) {
  const input = document.createElement("input");
  input.className = "input";
  input.type = "number";
  input.value = value ?? "";
  Object.entries(dataset).forEach(([k, v]) => { input.dataset[k] = v; });
  input.addEventListener("keydown", (e) => {
    // Deixa passar Tab, setas, Backspace/Delete etc. (todas com e.key com
    // mais de 1 caractere) — só bloqueia teclas que efetivamente escrevem
    // algo no campo.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) e.preventDefault();
  });
  input.addEventListener("paste", (e) => e.preventDefault());
  return buildField(labelText, input);
}

// Campo só de leitura — usado para o identificador (id), que é preenchido
// sozinho na criação do item (ver nextIdNumber) e não deve mudar depois:
// os nomes dos arquivos enviados (imagem/áudio) são derivados dele, então
// editá-lo à mão desalinharia o id do que já foi commitado no GitHub.
// `disabled` (não `readOnly`) de propósito: nem dá pra clicar/focar no campo,
// mesmo comportamento do caminho de arquivo em buildFileUploadField — reforça
// visualmente que não é editável, em vez de só bloquear a digitação.
function buildReadOnlyField(labelText, value) {
  const input = document.createElement("input");
  input.className = "input";
  input.type = "text";
  input.value = value ?? "";
  input.disabled = true;
  return buildField(labelText, input);
}

// Próximo número livre para um prefixo de identificador (ex: "noticia",
// "ep"): olha o maior número já usado entre os ids existentes com esse
// prefixo e soma 1 — nunca reaproveita o número de um item excluído, então
// dois itens diferentes nunca chegam a disputar o mesmo nome de arquivo.
function nextIdNumber(items, prefix) {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const item of items) {
    const match = re.exec(item.id || "");
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

// Checkbox "Destacar na Home". `onToggle` recalcula o limite de HOME_MAX_ITEMS
// marcados naquela seção (ver enforceFeaturedLimit) sempre que ela muda.
function buildCheckboxField(labelText, checked, dataset, onToggle) {
  const wrap = el("div", "field checkbox-field");
  const row = el("label", "checkbox-row");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  Object.entries(dataset).forEach(([k, v]) => { input.dataset[k] = v; });
  row.appendChild(input);
  row.appendChild(document.createTextNode(labelText));
  wrap.appendChild(row);
  if (onToggle) input.addEventListener("change", onToggle);
  return wrap;
}

// Trava o marcador de "destaque" no limite de cada seção (HOME_MAX_ITEMS
// pra episódios, HOME_ARTICLES_TOP pra notícias — ver as duas no topo do
// arquivo): ao chegar no limite, desabilita as checkboxes ainda desmarcadas
// (até alguém desmarcar uma) — evita ambiguidade sobre qual item sairia da
// Home se o JSON tivesse mais marcados do que cabem nela.
function enforceFeaturedLimit(section) {
  const container = document.getElementById(`${section}-list`);
  if (!container) return;
  const limit = section === "articles" ? HOME_ARTICLES_TOP : HOME_MAX_ITEMS;
  const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"][data-key="featured"]'));
  const checkedCount = checkboxes.filter((cb) => cb.checked).length;
  checkboxes.forEach((cb) => {
    cb.disabled = !cb.checked && checkedCount >= limit;
  });
  const counter = document.getElementById(`featured-count-${section}`);
  if (counter) counter.textContent = `${checkedCount}/${limit} na home`;
}

function buildTextarea(labelText, value, dataset, multilineParagraphs, rows) {
  const textarea = document.createElement("textarea");
  textarea.className = "input";
  textarea.value = value ?? "";
  textarea.rows = rows || 4;
  Object.entries(dataset).forEach(([k, v]) => { textarea.dataset[k] = v; });
  if (multilineParagraphs) textarea.dataset.multiline = "paragraphs";
  return buildField(labelText, textarea);
}

// Campo de upload: um input de texto (só mostra o caminho salvo — travado,
// nem clique nele funciona) + um botão de arquivo que faz o commit direto
// no GitHub e preenche o texto sozinho ao terminar.
function buildFileUploadField(labelText, currentValue, dataset, opts) {
  const wrap = el("div", "field file-upload-field");
  wrap.appendChild(el("label", "", labelText));
  if (opts.hint) wrap.appendChild(el("span", "field-hint", opts.hint));

  const row = el("div", "file-upload-row");
  const textInput = document.createElement("input");
  textInput.className = "input";
  textInput.type = "text";
  textInput.value = currentValue ?? "";
  textInput.disabled = true;
  Object.entries(dataset).forEach(([k, v]) => { textInput.dataset[k] = v; });
  row.appendChild(textInput);

  const fileLabel = el("label", "btn btn-secondary btn-small file-upload-btn", opts.buttonText || "Enviar arquivo");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.hidden = true;
  if (opts.accept) fileInput.accept = opts.accept;
  fileLabel.appendChild(fileInput);
  row.appendChild(fileLabel);

  let clearBtn;
  if (opts.allowClear) {
    clearBtn = el("button", "btn btn-secondary btn-small", "Remover");
    clearBtn.type = "button";
    row.appendChild(clearBtn);
  }
  wrap.appendChild(row);

  const status = el("span", "file-upload-status");
  wrap.appendChild(status);

  // Um upload pode ser recortado de formas diferentes pelo site (ver
  // article-cover x article-card-split-image, 16:9 x 4:3) — por isso um
  // campo pode pedir mais de uma prévia (opts.extraPreviews), cada uma com
  // a proporção/recorte real daquele lugar, pra não esconder um recorte
  // ruim que só apareceria depois de publicado.
  const previews = [];
  function makePreviewImg(className) {
    const img = document.createElement("img");
    img.className = className ? `file-upload-preview ${className}` : "file-upload-preview";
    img.style.display = currentValue ? "" : "none";
    // O painel vive em /admin/; os caminhos salvos são relativos à raiz do
    // site, então a pré-visualização precisa subir um nível.
    if (currentValue) img.src = /^https?:\/\//i.test(currentValue) ? currentValue : `../${currentValue}`;
    return img;
  }
  if (opts.preview) {
    const previewsWrap = el("div", "file-upload-previews");

    const mainGroup = el("div", "file-upload-preview-group");
    const mainImg = makePreviewImg(opts.previewClass);
    mainGroup.appendChild(mainImg);
    if (opts.previewCaption) mainGroup.appendChild(el("span", "file-upload-preview-caption", opts.previewCaption));
    previewsWrap.appendChild(mainGroup);
    previews.push(mainImg);

    for (const extra of opts.extraPreviews || []) {
      const group = el("div", "file-upload-preview-group");
      const img = makePreviewImg(extra.className);
      group.appendChild(img);
      if (extra.caption) group.appendChild(el("span", "file-upload-preview-caption", extra.caption));
      previewsWrap.appendChild(group);
      previews.push(img);
    }

    wrap.appendChild(previewsWrap);
  }

  // O arquivo escolhido só fica "pendente" aqui — nada é enviado ainda.
  // Só vira alteração de fato ao clicar em "Salvar alterações" do card
  // (confirmFileUpload), e só é transmitido ao GitHub ao clicar em
  // "Salvar no GitHub" (ver saveAll). Isso mantém arquivo e texto com a
  // mesma regra: nada sai do navegador sem confirmação explícita.
  let pending = null;
  // Idem para remoção: marcar "Remover" só agenda a exclusão do arquivo já
  // salvo (currentValue) — só é efetivada em confirmFileUpload/saveAll.
  let pendingClear = false;

  // Só nos campos com "Remover" (allowClear): "Enviar" fica desabilitado
  // enquanto já existir uma imagem (salva ou só selecionada, ainda não
  // confirmada) — pra trocar, primeiro precisa esvaziar pelo "Remover". Sem
  // allowClear (ex: áudio do episódio), mantém o comportamento antigo: dá
  // pra escolher um novo arquivo direto por cima do já salvo.
  function updateButtonStates() {
    if (!opts.allowClear) return;
    const hasContent = !!textInput.value || !!pending;
    fileInput.disabled = hasContent;
    fileLabel.classList.toggle("disabled", hasContent);
    if (clearBtn) clearBtn.disabled = !hasContent;
  }
  updateButtonStates();

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    pendingClear = false;
    const path = opts.buildPath(file);
    pending = { path, file, message: opts.buildMessage(path) };
    status.textContent = `Selecionado: ${path} — é enviado ao clicar em "Publicar".`;
    status.dataset.kind = "pending";
    if (previews.length) {
      const objectUrl = URL.createObjectURL(file);
      for (const img of previews) {
        img.src = objectUrl;
        img.style.display = "";
      }
    }
    fileInput.value = "";
    updateButtonStates();
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      pending = null;
      pendingClear = !!currentValue;
      textInput.value = "";
      status.textContent = currentValue
        ? `Marcado para remover — é removido ao clicar em "Publicar".`
        : "";
      status.dataset.kind = currentValue ? "pending" : "";
      for (const img of previews) img.style.display = "none";
      updateButtonStates();
    });
  }

  wrap.confirmFileUpload = function confirmFileUpload() {
    if (pendingClear) {
      pendingDeletions.push({
        path: currentValue,
        message: `admin: remove arquivo (${currentValue})`,
      });
      pendingClear = false;
      status.textContent = `Removido — será excluído ao clicar em "Publicar".`;
      status.dataset.kind = "ok";
      return;
    }
    if (!pending) return;
    // Se já existia um arquivo salvo com caminho diferente do novo (ex:
    // extensão trocou, jpg por png), o antigo fica órfão no repositório —
    // agenda a remoção dele junto com o novo envio, pra não acumular lixo.
    if (currentValue && currentValue !== pending.path) {
      pendingDeletions.push({
        path: currentValue,
        message: `admin: remove arquivo substituído (${currentValue})`,
      });
    }
    pendingUploads.push(pending);
    textInput.value = pending.path;
    status.textContent = `Na fila — será enviado ao clicar em "Publicar".`;
    status.dataset.kind = "ok";
    pending = null;
    updateButtonStates();
  };

  // Aponta o campo pra um caminho já existente (ex: foto de um integrante já
  // cadastrado) sem passar por upload — usado pelo seletor de autor (ver
  // buildArticleAuthorSourceField). Cancela qualquer upload/remoção pendente,
  // já que o valor está sendo trocado por outro meio.
  wrap.setValue = function setValue(path) {
    pending = null;
    pendingClear = false;
    textInput.value = path || "";
    status.textContent = "";
    delete status.dataset.kind;
    for (const img of previews) {
      if (path) {
        img.src = /^https?:\/\//i.test(path) ? path : `../${path}`;
        img.style.display = "";
      } else {
        img.style.display = "none";
      }
    }
    updateButtonStates();
  };

  wrap.getValue = function getValue() {
    return textInput.value;
  };

  return wrap;
}

// Um só ouvinte de seleção para todos os editores (eles são recriados a
// cada redesenho da lista): avisa o editor onde está a seleção, e esconde o
// menu dos outros.
let menusDeSelecaoLigados = false;
function ligarMenusDeSelecao() {
  if (menusDeSelecaoLigados) return;
  menusDeSelecaoLigados = true;
  document.addEventListener("selectionchange", () => {
    if (document.activeElement?.closest?.(".menu-selecao")) return;
    const n = window.getSelection()?.anchorNode;
    const editor = (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.(".rich-text-editor");
    document.querySelectorAll(".menu-selecao:not([hidden])").forEach((m) => {
      if (!editor || !m.parentElement.contains(editor)) m.hidden = true;
    });
    editor?.atualizarMenuDeSelecao?.();
  });
  // Clicar fora do campo fecha os menus, mesmo onde o clique não muda a
  // seleção (cabeçalho, botões).
  document.addEventListener("mousedown", (e) => {
    document.querySelectorAll(".menu-editor:not([hidden])").forEach((m) => {
      if (m.parentElement.contains(e.target)) return;
      m.hidden = true;
      if (m.classList.contains("menu-blocos")) m.aberto = false;
      if (m.classList.contains("menu-imagem")) m.parentElement.querySelector(".moldura-imagem").hidden = true;
    });
  });
}

// Divide o parágrafo no cursor sempre do mesmo jeito ao apertar Enter no
// corpo — o Enter nativo do contenteditable é inconsistente: dependendo de
// como a formatação (negrito/tamanho de fonte) estava aplicada na linha,
// às vezes cria o parágrafo novo sem um <p> ao redor (texto "solto" direto
// no editor). Como o espaçamento do site vem só de `.article-body p + p`
// (ver css/style.css), texto solto sem <p> fica sem essa margem e o
// espaço visual passa a depender só da altura de linha (que muda com o
// tamanho da fonte) — daí o espaçamento inconsistente. Esta função sempre
// produz um <p> novo dos dois lados do corte, então o Enter fica
// previsível independente do que veio antes; de brinde, autocorrige texto
// solto antigo (sem <p>) assim que o usuário edita perto dele.
function splitEditorParagraphAtCursor(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return;
  range.deleteContents();

  function placeCursor(node) {
    const newRange = document.createRange();
    newRange.setStart(node, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  // Cursor solto direto no editor (entre blocos, ou editor vazio) — não há
  // nó pra dividir, só insere o parágrafo novo na posição.
  if (range.startContainer === editor) {
    const newP = document.createElement("p");
    newP.appendChild(document.createElement("br"));
    editor.insertBefore(newP, editor.childNodes[range.startOffset] || null);
    placeCursor(newP);
    return;
  }

  let topNode = range.startContainer;
  while (topNode.parentNode !== editor) {
    topNode = topNode.parentNode;
  }

  const afterRange = document.createRange();
  afterRange.setStart(range.startContainer, range.startOffset);
  afterRange.setEnd(topNode, topNode.nodeType === Node.TEXT_NODE ? topNode.length : topNode.childNodes.length);
  const afterFragment = afterRange.extractContents();

  const isEmpty = (node) => node.textContent.trim() === "" && !node.querySelector?.("img");

  const newP = document.createElement("p");
  if (isEmpty(afterFragment)) newP.appendChild(document.createElement("br"));
  else newP.appendChild(afterFragment);
  editor.insertBefore(newP, topNode.nextSibling);

  // Garante que o lado "antes" do corte também seja um <p> — se já era
  // (caso normal), só reaproveita; se era texto solto (bug antigo), envolve
  // agora, corrigindo o espaçamento dali pra frente.
  // Título, lista e outros blocos ficam como estão (só texto solto ou
  // elementos de linha, como <b> ou <span>, ganham o <p>).
  let before = topNode;
  const ehBloco = before.nodeType === Node.ELEMENT_NODE && /^(P|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|DIV|FIGURE)$/.test(before.tagName);
  if (!ehBloco) {
    const wrapP = document.createElement("p");
    editor.insertBefore(wrapP, before);
    wrapP.appendChild(before);
    before = wrapP;
  }
  if (isEmpty(before)) {
    before.innerHTML = "";
    before.appendChild(document.createElement("br"));
  }

  placeCursor(newP);
}

// Campo de corpo com formatação, editor próprio (sem biblioteca: abrir e
// publicar sem mexer não pode alterar o texto guardado). Selecionar um
// trecho mostra o menu com negrito, itálico, link e título; "/" numa linha
// vazia (ou "+ Inserir") abre a lista de blocos; atalhos: Ctrl/⌘+B, I, K, e
// "## " no começo da linha (nas páginas de texto também "- " e "1. ").
//
// Notícias e verbetes guardam o corpo como HTML, desenhado direto no site
// (mesmo modelo de confiança do resto do painel: só quem tem acesso ao
// GitHub edita). Páginas de texto (opts.simples) passam por Markdown (ver
// paginas-md.js), então não têm imagem.
//
// Imagem inserida no corpo segue o mesmo fluxo de "pendente até publicar"
// do buildFileUploadField: ao escolher um arquivo, ele entra no editor com
// um src temporário (blob local, só para pré-visualização) e o caminho
// definitivo guardado em data-final-src; wrap.confirmBodyImages() (chamado
// pelo "Publicar" da tela) é que de fato enfileira o arquivo em
// pendingUploads, e finalizeRichTextHtml() troca o src temporário pelo
// definitivo na hora de gravar.
function buildRichTextField(labelText, value, dataset, opts) {
  const wrap = el("div", "field rich-text-field");
  wrap.appendChild(el("label", "", labelText));

  // Formatos de cada modo. O corpo das notícias e dos verbetes é HTML e o
  // site estiliza subtítulo (h3), negrito, itálico, link e imagem (ver
  // .article-body em css/style.css). As páginas de texto viram Markdown
  // (paginas-md.js) e aceitam também seção (h2) e listas, estilizadas em
  // PaginaInstitucional.astro.
  const simples = !!opts.simples;
  const TITULO = simples ? "h2" : "h3";
  const NOME_DO_TITULO = simples ? "Seção" : "Subtítulo";

  const imageInput = document.createElement("input");
  imageInput.type = "file";
  imageInput.accept = "image/*";
  imageInput.hidden = true;

  const ITENS_DO_MENU = simples
    ? [
        { rotulo: "Texto", dica: "parágrafo comum", acao: () => virarBloco("p") },
        { rotulo: "Seção", dica: "## + espaço", acao: () => virarBloco("h2") },
        { rotulo: "Subseção", dica: "### + espaço", acao: () => virarBloco("h3") },
        { rotulo: "Lista", dica: "- + espaço", acao: () => virarLista("ul") },
        { rotulo: "Lista numerada", dica: "1. + espaço", acao: () => virarLista("ol") },
      ]
    : [
        { rotulo: "Texto", dica: "parágrafo comum", acao: () => virarBloco("p") },
        { rotulo: "Subtítulo", dica: "## + espaço", acao: () => virarBloco("h3") },
        { rotulo: "Imagem", dica: "do computador, com legenda", acao: () => imageInput.click() },
      ];

  // Barra fina em cima do texto, só com o que não depende de selecionar
  // texto; negrito, itálico, link e título ficam no menu que aparece ao
  // selecionar um trecho (ver "Menu da seleção" abaixo).
  const toolbar = el("div", "rich-text-toolbar");
  const inserirBtn = el("button", "rich-text-btn", "+ Inserir");
  inserirBtn.type = "button";
  inserirBtn.title = simples ? "Seção, subseção ou lista na linha do cursor" : "Subtítulo ou imagem na linha do cursor";
  inserirBtn.addEventListener("mousedown", (e) => e.preventDefault());
  inserirBtn.addEventListener("click", () => {
    if (menuDeBlocos.aberto) return fecharMenuDeBlocos();
    garantirCursor();
    abrirMenuDeBlocos({ ancora: inserirBtn });
  });
  toolbar.appendChild(inserirBtn);

  const imageBtn = el("button", "rich-text-btn", "Imagem");
  imageBtn.type = "button";
  imageBtn.title = "Inserir imagem na posição do cursor";
  imageBtn.appendChild(imageInput);
  if (!simples) toolbar.appendChild(imageBtn);

  toolbar.appendChild(
    el("span", "rich-text-dica", "Selecione um trecho para formatar · digite / numa linha vazia para inserir")
  );

  const editor = document.createElement("div");
  editor.className = "input rich-text-editor";
  editor.contentEditable = "true";
  editor.innerHTML = toEditorPreviewHtml(value);
  Object.entries(dataset).forEach(([k, v]) => { editor.dataset[k] = v; });
  editor.dataset.richtext = "html";
  editor.addEventListener("focus", () => {
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* navegador sem suporte */ }
  });
  // Callback opcional pra reagir a cada edição do corpo em tempo real (ver
  // computeReadingTime/readingTimeInput em buildArticleCard) — usa o HTML
  // ainda "cru" do editor (sem passar por finalizeRichTextHtml), suficiente
  // pra uma contagem de caracteres em tempo real; o valor salvo de fato é
  // sempre recalculado a partir do HTML finalizado em applyArticleField.
  if (opts.onInput) editor.addEventListener("input", () => opts.onInput(editor.innerHTML));

  wrap.appendChild(toolbar);
  wrap.appendChild(editor);

  // Clicar no botão de imagem tira o foco do editor (é um <button>), então
  // sem guardar a seleção de texto a imagem sempre cairia no fim do
  // conteúdo em vez de no cursor.
  let savedRange = null;
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  editor.addEventListener("keyup", saveSelection);
  editor.addEventListener("mouseup", saveSelection);

  // ── Blocos: título, parágrafo, lista ──
  const SEL = () => window.getSelection();
  const elementoDoCursor = () => {
    const n = SEL()?.anchorNode;
    return n ? (n.nodeType === 1 ? n : n.parentElement) : null;
  };
  const naLista = () => !!elementoDoCursor()?.closest("li");
  function blocoAtual() {
    const sel = SEL();
    if (!sel?.rangeCount || !editor.contains(sel.anchorNode) || sel.anchorNode === editor) return null;
    let no = sel.anchorNode;
    while (no.parentNode !== editor) no = no.parentNode;
    return no;
  }
  function textoAntesDoCursor(bloco) {
    const r = SEL().getRangeAt(0);
    const antes = document.createRange();
    antes.setStart(bloco, 0);
    antes.setEnd(r.startContainer, r.startOffset);
    return antes;
  }
  // Depois de apagar o "## " ou o "/…": linha vazia ganha um <br> (senão
  // some) e o cursor volta para o começo dela, antes do <br> — com o cursor
  // depois dele, o formatBlock divide a linha em duas.
  function prepararLinha(bloco) {
    if (bloco.nodeType !== 1 || bloco.textContent || bloco.querySelector("img")) return;
    if (!bloco.querySelector("br")) bloco.appendChild(document.createElement("br"));
    const r = document.createRange();
    r.setStart(bloco, 0);
    r.collapse(true);
    SEL().removeAllRanges();
    SEL().addRange(r);
  }
  function sairDaLista() {
    const li = elementoDoCursor()?.closest("li");
    if (li) document.execCommand(li.parentElement.tagName === "OL" ? "insertOrderedList" : "insertUnorderedList");
  }
  function virarBloco(tag) {
    sairDaLista();
    document.execCommand("formatBlock", false, tag);
    // O formatBlock do Chrome às vezes deixa um <p></p> totalmente vazio
    // (invisível) logo depois da linha: tira só esse, vizinho da linha.
    const bloco = blocoAtual();
    for (const vizinho of [bloco?.previousSibling, bloco?.nextSibling]) {
      if (vizinho?.nodeType === 1 && /^(P|DIV)$/.test(vizinho.tagName) && !vizinho.textContent && !vizinho.querySelector("br, img")) vizinho.remove();
    }
  }
  function virarLista(tag) {
    const cmd = tag === "ol" ? "insertOrderedList" : "insertUnorderedList";
    if (!document.queryCommandState(cmd)) document.execCommand(cmd);
  }
  function alternarTitulo() {
    const atual = (document.queryCommandValue("formatBlock") || "").toLowerCase();
    virarBloco(atual === TITULO ? "p" : TITULO);
  }
  // Cursor no editor: o que estava guardado, ou o fim do texto.
  function garantirCursor() {
    const sel = SEL();
    if (sel?.rangeCount && editor.contains(sel.anchorNode)) return;
    editor.focus();
    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
      return;
    }
    if (!editor.lastChild) editor.innerHTML = "<p><br></p>";
    const r = document.createRange();
    r.selectNodeContents(editor.lastChild);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  // Escrever "## " (e, nas páginas, "- " ou "1. ") no começo de uma linha.
  const ATALHOS_DE_LINHA = simples
    ? { "#": () => virarBloco("h2"), "##": () => virarBloco("h2"), "###": () => virarBloco("h3"), "-": () => virarLista("ul"), "*": () => virarLista("ul"), "1.": () => virarLista("ol") }
    : { "##": () => virarBloco("h3"), "###": () => virarBloco("h3") };

  // Posição de um retângulo da tela dentro do campo (os menus ficam em
  // position:absolute no .rich-text-field).
  function posicionar(menu, rect, { abaixo = false } = {}) {
    const base = wrap.getBoundingClientRect();
    menu.style.visibility = "hidden";
    menu.hidden = false;
    const largura = menu.offsetWidth;
    const altura = menu.offsetHeight;
    let esquerda = rect.left - base.left + (abaixo ? 0 : rect.width / 2 - largura / 2);
    esquerda = Math.max(0, Math.min(esquerda, wrap.clientWidth - largura));
    let topo = abaixo ? rect.bottom - base.top + 6 : rect.top - base.top - altura - 8;
    if (!abaixo && rect.top - altura - 8 < 64) topo = rect.bottom - base.top + 8;
    menu.style.left = `${esquerda}px`;
    menu.style.top = `${topo}px`;
    menu.style.visibility = "";
  }
  function retanguloDoCursor() {
    const sel = SEL();
    if (!sel?.rangeCount) return editor.getBoundingClientRect();
    const r = sel.getRangeAt(0);
    const rect = r.getClientRects()[0] || r.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) return rect;
    const bloco = blocoAtual();
    return (bloco?.nodeType === 1 ? bloco : editor).getBoundingClientRect();
  }

  // ── Menu "/" e "+ Inserir" ──
  // Lista de blocos que dá para pôr na linha do cursor. Pelo "/", o que se
  // digita depois da barra filtra a lista, e escolher apaga o "/…".
  const menuDeBlocos = el("div", "menu-editor menu-blocos");
  menuDeBlocos.hidden = true;
  menuDeBlocos.setAttribute("role", "listbox");
  menuDeBlocos.aberto = false;
  let itensVisiveis = [];
  let itemAtivo = 0;
  let pelaBarra = false;
  const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function desenharMenuDeBlocos(filtro = "") {
    menuDeBlocos.innerHTML = "";
    itensVisiveis = ITENS_DO_MENU.filter((it) => semAcento(it.rotulo).includes(semAcento(filtro)));
    itemAtivo = Math.min(itemAtivo, Math.max(0, itensVisiveis.length - 1));
    itensVisiveis.forEach((it, k) => {
      const b = el("button", "menu-blocos-item");
      b.type = "button";
      b.setAttribute("role", "option");
      if (k === itemAtivo) b.classList.add("ativo");
      b.appendChild(el("span", "menu-blocos-rotulo", it.rotulo));
      b.appendChild(el("span", "menu-blocos-dica", it.dica));
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => escolherBloco(it));
      menuDeBlocos.appendChild(b);
    });
    return itensVisiveis.length;
  }
  function abrirMenuDeBlocos({ ancora = null, barra = false } = {}) {
    pelaBarra = barra;
    itemAtivo = 0;
    desenharMenuDeBlocos();
    menuDeBlocos.aberto = true;
    if (ancora) posicionar(menuDeBlocos, ancora.getBoundingClientRect(), { abaixo: true });
    else posicionar(menuDeBlocos, retanguloDoCursor(), { abaixo: true });
  }
  function fecharMenuDeBlocos() {
    menuDeBlocos.hidden = true;
    menuDeBlocos.aberto = false;
    pelaBarra = false;
  }
  function escolherBloco(it) {
    garantirCursor();
    if (pelaBarra) {
      // Apaga o "/" e o filtro digitado, deixando a linha vazia.
      const bloco = blocoAtual();
      if (bloco) {
        textoAntesDoCursor(bloco).deleteContents();
        prepararLinha(bloco);
      }
    }
    fecharMenuDeBlocos();
    saveSelection();
    it.acao();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    saveSelection();
  }
  wrap.appendChild(menuDeBlocos);

  // ── Menu da seleção ──
  // Aparece em cima do trecho selecionado: negrito, itálico, link e título.
  // O link é digitado no próprio menu (sem janela do navegador).
  const menuDeSelecao = el("div", "menu-editor menu-selecao");
  menuDeSelecao.hidden = true;
  const botoesDaSelecao = el("div", "menu-selecao-botoes");
  const botaoDaSelecao = (texto, titulo, classe, acao) => {
    const b = el("button", `menu-selecao-btn ${classe || ""}`, texto);
    b.type = "button";
    b.title = titulo;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      acao();
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      atualizarMenuDeSelecao();
    });
    botoesDaSelecao.appendChild(b);
    return b;
  };
  const atalho = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
  const negritoBtn = botaoDaSelecao("B", `Negrito (${atalho}B)`, "menu-selecao-btn--negrito", () => document.execCommand("bold"));
  const italicoBtn = botaoDaSelecao("I", `Itálico (${atalho}I)`, "menu-selecao-btn--italico", () => document.execCommand("italic"));
  const linkBtn = el("button", "menu-selecao-btn", "Link");
  linkBtn.type = "button";
  linkBtn.title = `Link (${atalho}K)`;
  linkBtn.addEventListener("mousedown", (e) => e.preventDefault());
  linkBtn.addEventListener("click", () => abrirCampoDeLink());
  botoesDaSelecao.appendChild(linkBtn);
  // Pelo HTML, não pelo queryCommandValue: este lê o tamanho calculado, e o
  // texto do editor é menor que o padrão do navegador.
  function selecaoPequena() {
    const sel = SEL();
    if (!sel?.rangeCount) return false;
    const n = sel.getRangeAt(0).commonAncestorContainer;
    return !!(n.nodeType === 1 ? n : n.parentElement)?.closest('font[size="2"]');
  }
  // Texto pequeno, para legendas e notas (no modo HTML; o Markdown das
  // páginas não tem tamanho).
  const pequenoBtn = simples
    ? null
    : botaoDaSelecao("Texto pequeno", "Letra pequena, para legendas e notas (clique de novo para voltar ao normal)", "", () => {
        document.execCommand("fontSize", false, selecaoPequena() ? "3" : "2");
      });
  const tituloBtn = botaoDaSelecao(NOME_DO_TITULO, `Transformar a linha em ${NOME_DO_TITULO.toLowerCase()} (ou voltar a texto)`, "", alternarTitulo);

  const formLink = el("form", "menu-selecao-link");
  formLink.hidden = true;
  const campoLink = document.createElement("input");
  campoLink.type = "text";
  campoLink.className = "menu-selecao-campo";
  campoLink.placeholder = "https://… ou /pagina-do-site";
  campoLink.setAttribute("aria-label", "Endereço do link");
  const okLink = el("button", "menu-selecao-btn", "OK");
  okLink.type = "submit";
  const tirarLink = el("button", "menu-selecao-btn", "Tirar link");
  tirarLink.type = "button";
  formLink.append(campoLink, okLink, tirarLink);
  menuDeSelecao.append(botoesDaSelecao, formLink);
  wrap.appendChild(menuDeSelecao);

  let rangeDoLink = null;
  const linkNaSelecao = () => elementoDoCursor()?.closest("a");
  function abrirCampoDeLink() {
    const sel = SEL();
    if (!sel?.rangeCount || !editor.contains(sel.anchorNode)) return;
    const a = linkNaSelecao();
    if (sel.isCollapsed) {
      if (!a) {
        toast("Selecione o trecho que vai virar link.", "error");
        return;
      }
      const r = document.createRange();
      r.selectNodeContents(a);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    rangeDoLink = sel.getRangeAt(0).cloneRange();
    botoesDaSelecao.hidden = true;
    formLink.hidden = false;
    tirarLink.hidden = !a;
    campoLink.value = a?.getAttribute("href") || "";
    posicionar(menuDeSelecao, rangeDoLink.getBoundingClientRect());
    campoLink.focus();
    campoLink.select();
  }
  function voltarParaASelecao() {
    editor.focus();
    if (rangeDoLink) {
      const sel = SEL();
      sel.removeAllRanges();
      sel.addRange(rangeDoLink);
    }
    rangeDoLink = null;
    formLink.hidden = true;
    botoesDaSelecao.hidden = false;
  }
  formLink.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = campoLink.value.trim();
    voltarParaASelecao();
    if (url) document.execCommand("createLink", false, url);
    else if (linkNaSelecao()) document.execCommand("unlink");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    atualizarMenuDeSelecao();
  });
  tirarLink.addEventListener("click", () => {
    voltarParaASelecao();
    const a = linkNaSelecao();
    if (a) {
      const r = document.createRange();
      r.selectNodeContents(a);
      SEL().removeAllRanges();
      SEL().addRange(r);
      document.execCommand("unlink");
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    atualizarMenuDeSelecao();
  });
  campoLink.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    voltarParaASelecao();
    atualizarMenuDeSelecao();
  });

  function atualizarMenuDeSelecao() {
    if (!formLink.hidden && menuDeSelecao.contains(document.activeElement)) return;
    const sel = SEL();
    const ativo = sel?.rangeCount && !sel.isCollapsed && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode) && sel.toString().trim();
    if (!ativo) {
      menuDeSelecao.hidden = true;
      formLink.hidden = true;
      botoesDaSelecao.hidden = false;
      return;
    }
    formLink.hidden = true;
    botoesDaSelecao.hidden = false;
    negritoBtn.classList.toggle("ativo", document.queryCommandState("bold"));
    italicoBtn.classList.toggle("ativo", document.queryCommandState("italic"));
    linkBtn.classList.toggle("ativo", !!linkNaSelecao());
    pequenoBtn?.classList.toggle("ativo", selecaoPequena());
    tituloBtn.classList.toggle("ativo", (document.queryCommandValue("formatBlock") || "").toLowerCase() === TITULO);
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    // No celular, o menu do próprio sistema aparece em cima da seleção.
    posicionar(menuDeSelecao, rect, { abaixo: matchMedia("(pointer: coarse)").matches });
  }
  editor.atualizarMenuDeSelecao = atualizarMenuDeSelecao;
  ligarMenusDeSelecao();

  editor.addEventListener("blur", () => {
    setTimeout(() => {
      if (!wrap.contains(document.activeElement)) fecharMenuDeBlocos();
    }, 0);
  });

  // ── Teclado ──
  editor.addEventListener("keydown", (e) => {
    if (menuDeBlocos.aberto) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = itensVisiveis.length;
        if (n) itemAtivo = (itemAtivo + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        desenharMenuDeBlocos(pelaBarra ? (blocoAtual()?.textContent || "").slice(1) : "");
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && itensVisiveis.length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        escolherBloco(itensVisiveis[itemAtivo]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        fecharMenuDeBlocos();
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      const tecla = e.key.toLowerCase();
      if (tecla === "b" || tecla === "i") {
        e.preventDefault();
        document.execCommand(tecla === "b" ? "bold" : "italic");
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        atualizarMenuDeSelecao();
        return;
      }
      if (tecla === "k") {
        e.preventDefault();
        abrirCampoDeLink();
        return;
      }
      // Sublinhado não existe no site (o Markdown não tem, e o corpo das
      // notícias segue o mesmo conjunto de formatos).
      if (tecla === "u") {
        e.preventDefault();
        return;
      }
    }
    const sel = SEL();
    if (!sel?.rangeCount || !sel.isCollapsed) return;
    if (e.key === " " && !naLista()) {
      const bloco = blocoAtual();
      if (!bloco) return;
      const antes = textoAntesDoCursor(bloco);
      const aplicar = ATALHOS_DE_LINHA[antes.toString()];
      if (!aplicar) return;
      e.preventDefault();
      antes.deleteContents();
      prepararLinha(bloco);
      aplicar();
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    // Backspace no começo de um título: volta a ser texto comum.
    if (e.key === "Backspace") {
      const bloco = blocoAtual();
      if (bloco?.nodeType === 1 && /^H[1-6]$/.test(bloco.tagName) && textoAntesDoCursor(bloco).toString() === "") {
        e.preventDefault();
        document.execCommand("formatBlock", false, "p");
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });

  editor.addEventListener("input", (e) => {
    const linha = blocoAtual();
    if (linha?.nodeType === 1 && linha.dataset.legenda !== undefined && linha.textContent) {
      delete linha.dataset.legenda;
      if (!linha.querySelector('font[size="2"]')) {
        const f = document.createElement("font");
        f.setAttribute("size", "2");
        while (linha.firstChild) f.appendChild(linha.firstChild);
        f.querySelectorAll("br").forEach((br) => br.remove());
        linha.appendChild(f);
        cursorEm(f, false);
      }
      return;
    }
    if (e.inputType === "insertText" && e.data === "/" && !menuDeBlocos.aberto && !naLista()) {
      const bloco = blocoAtual();
      if (bloco && bloco.textContent === "/") abrirMenuDeBlocos({ barra: true });
      return;
    }
    if (menuDeBlocos.aberto && pelaBarra) {
      const texto = blocoAtual()?.textContent || "";
      if (!texto.startsWith("/") || !desenharMenuDeBlocos(texto.slice(1))) fecharMenuDeBlocos();
    }
  });

  // Enter (sem Shift) sempre quebra o parágrafo do mesmo jeito, em vez de
  // deixar o comportamento nativo do contenteditable decidir (ver
  // splitEditorParagraphAtCursor acima). Shift+Enter continua nativo
  // (quebra de linha simples dentro do mesmo parágrafo).
  editor.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    // Dentro de lista ou tabela, o Enter nativo (novo item, sair da lista).
    if (opts.simples && window.getSelection()?.anchorNode?.parentElement?.closest("li, td, th")) return;
    e.preventDefault();
    splitEditorParagraphAtCursor(editor);
    saveSelection();
  });

  // Numeração sequencial (id-imagem-1, id-imagem-2...) olhando as imagens já
  // presentes no editor (tanto as já salvas quanto as ainda pendentes), pra
  // nunca repetir número mesmo remontando o card várias vezes.
  function nextImageNumber() {
    const re = new RegExp(`-imagem-(\\d+)\\.[a-zA-Z0-9]+$`);
    let maxN = 0;
    editor.querySelectorAll("img").forEach((existing) => {
      const src = existing.dataset.finalSrc || existing.getAttribute("src") || "";
      const match = re.exec(src);
      if (match) maxN = Math.max(maxN, Number(match[1]));
    });
    return maxN + 1;
  }

  // A imagem entra num parágrafo só dela, depois da linha do cursor (ou no
  // lugar da linha, se ela estiver vazia), com uma linha de legenda logo
  // abaixo, já com o cursor nela.
  function insertImageAtSelection(img) {
    editor.focus();
    const sel = window.getSelection();
    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    const pImg = document.createElement("p");
    pImg.appendChild(img);
    const bloco = blocoAtual();
    if (!bloco) editor.appendChild(pImg);
    else if (bloco.nodeType === 1 && bloco.tagName === "P" && !bloco.textContent.trim() && !bloco.querySelector("img")) bloco.replaceWith(pImg);
    else bloco.after(pImg);
    criarLinhaDeLegenda(pImg);
    saveSelection();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ── Legendas ──
  // A legenda é texto pequeno (<font size="2">) logo depois da imagem — o
  // mesmo formato das legendas já publicadas, para as novas e as antigas
  // ficarem iguais no site.
  function criarLinhaDeLegenda(blocoDaImagem) {
    const leg = document.createElement("p");
    leg.dataset.legenda = "";
    leg.appendChild(document.createElement("br"));
    blocoDaImagem.after(leg);
    cursorEm(leg, true);
    return leg;
  }
  function cursorEm(no, inicio) {
    const r = document.createRange();
    r.selectNodeContents(no);
    r.collapse(inicio);
    SEL().removeAllRanges();
    SEL().addRange(r);
  }
  function blocoDe(no) {
    while (no && no.parentNode !== editor) no = no.parentNode;
    return no;
  }
  const ehLegenda = (no) => no?.nodeType === 1 && (no.matches('font[size="2"]') || !!no.querySelector?.('font[size="2"]'));
  // Legenda que já existe para a imagem: texto pequeno logo depois dela, na
  // mesma linha (formato antigo) ou na linha seguinte.
  function legendaDe(img) {
    let n = img.nextSibling;
    while (n && ((n.nodeType === 3 && !n.nodeValue.trim()) || n.nodeName === "BR")) n = n.nextSibling;
    if (ehLegenda(n)) return n;
    const prox = blocoDe(img)?.nextElementSibling;
    if (prox && (prox.dataset.legenda !== undefined || (ehLegenda(prox.firstElementChild) && prox.textContent.trim()))) return prox;
    return null;
  }
  function escreverLegenda(img) {
    const leg = legendaDe(img);
    editor.focus();
    if (leg) cursorEm(leg, false);
    else criarLinhaDeLegenda(blocoDe(img));
    saveSelection();
  }

  // Insere um arquivo (File ou Blob) como imagem "pendente até confirmar" —
  // mesmo fluxo do botão "+ imagem", usado também pelo colar (ver
  // handlePastedImageBlob abaixo), pra nunca deixar imagem solta sem passar
  // por aqui (é o que garante que ela vira upload de verdade em vez de
  // base64 embutido no HTML salvo).
  function insertPendingImage(fileOrBlob, extFallback) {
    const path = `${opts.folder}/${opts.id}-imagem-${nextImageNumber()}.${fileExtension(fileOrBlob.name, extFallback || "jpg")}`;
    const img = document.createElement("img");
    img.src = URL.createObjectURL(fileOrBlob);
    img.dataset.finalSrc = path;
    img.pendingFile = fileOrBlob;
    insertImageAtSelection(img);
  }

  imageBtn.addEventListener("mousedown", (e) => e.preventDefault());
  imageBtn.addEventListener("click", () => imageInput.click());

  let imagemParaTrocar = null;
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    imageInput.value = "";
    const alvo = imagemParaTrocar;
    imagemParaTrocar = null;
    if (!file) return;
    if (alvo && editor.contains(alvo)) {
      // Arquivo novo com nome novo; o antigo sai do texto e é apagado ao
      // publicar (ver extractImagePaths).
      alvo.src = URL.createObjectURL(file);
      alvo.dataset.finalSrc = `${opts.folder}/${opts.id}-imagem-${nextImageNumber()}.${fileExtension(file.name, "jpg")}`;
      alvo.pendingFile = file;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      mostrarMenuDaImagem(alvo);
      return;
    }
    insertPendingImage(file);
  });

  // ── Menu da imagem ──
  // Clicar numa imagem do texto: Trocar, Legenda, Remover. A moldura é um
  // quadro por cima (fora do texto), para não gravar nada no HTML.
  const menuDaImagem = el("div", "menu-editor menu-imagem");
  menuDaImagem.hidden = true;
  const moldura = el("div", "moldura-imagem");
  moldura.hidden = true;
  let imagemAtual = null;
  const botaoDaImagem = (texto, acao, classe) => {
    const b = el("button", `menu-selecao-btn ${classe || ""}`, texto);
    b.type = "button";
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      const img = imagemAtual;
      esconderMenuDaImagem();
      if (img && editor.contains(img)) acao(img);
    });
    menuDaImagem.appendChild(b);
  };
  botaoDaImagem("Trocar imagem", (img) => {
    imagemParaTrocar = img;
    imageInput.click();
  });
  botaoDaImagem("Legenda", escreverLegenda);
  botaoDaImagem("Remover imagem", (img) => {
    if (!confirm("Tirar esta imagem do texto? A legenda dela continua; apague-a se quiser.")) return;
    const bloco = blocoDe(img);
    img.remove();
    if (bloco?.nodeType === 1 && !bloco.textContent.trim() && !bloco.querySelector("img")) bloco.remove();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, "menu-selecao-btn--perigo");
  wrap.append(menuDaImagem, moldura);

  function mostrarMenuDaImagem(img) {
    imagemAtual = img;
    const base = wrap.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    Object.assign(moldura.style, { left: `${r.left - base.left}px`, top: `${r.top - base.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    moldura.hidden = false;
    posicionar(menuDaImagem, { left: r.left, top: r.top + 8, width: r.width, bottom: r.top + 8, height: 0 }, { abaixo: true });
  }
  function esconderMenuDaImagem() {
    imagemAtual = null;
    menuDaImagem.hidden = true;
    moldura.hidden = true;
  }
  editor.addEventListener("click", (e) => {
    if (e.target.tagName === "IMG") mostrarMenuDaImagem(e.target);
    else esconderMenuDaImagem();
  });
  editor.addEventListener("input", () => {
    if (imagemAtual) esconderMenuDaImagem();
  });
  editor.addEventListener("keydown", () => {
    if (imagemAtual) esconderMenuDaImagem();
  });

  // Colar uma imagem de verdade (print, arquivo copiado do sistema) direto
  // no corpo — sem isso, o comportamento nativo do contenteditable insere a
  // imagem como base64 embutido no HTML, que é salvo dentro do próprio
  // articles.json. Isso já bloatou o JSON pra > 3 MB numa notícia (o
  // suficiente pra passar do limite de 1 MB da Contents API do GitHub, que é
  // como o painel carrega o conteúdo — ver getFile) e quebrou o carregamento
  // do painel inteiro. Interceptando aqui, a imagem colada passa pelo mesmo
  // upload de arquivo binário (Git Data API) usado pelo botão "+ imagem".
  editor.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    const fileItem = items && Array.from(items).find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (fileItem) {
      e.preventDefault();
      if (opts.simples) {
        toast("As páginas de texto não aceitam imagens.", "error");
        return;
      }
      const file = fileItem.getAsFile();
      if (file) insertPendingImage(file);
      return;
    }
    // Colar texto sempre entra como texto puro, nunca o HTML de origem —
    // Word/Google Docs (e até outros sites) trazem parágrafos vazios,
    // <span>/<font> com estilo embutido que ignora o CSS do site e é
    // exatamente o que produz espaçamento quebrado/inconsistente no corpo
    // publicado. Cada linha colada vira um parágrafo pelo mesmo caminho
    // determinístico do Enter (splitEditorParagraphAtCursor), então o
    // espaçamento fica sempre igual, texto digitado ou colado.
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") || "";
    const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length === 0) return;
    document.execCommand("insertText", false, lines[0]);
    for (let i = 1; i < lines.length; i++) {
      splitEditorParagraphAtCursor(editor);
      document.execCommand("insertText", false, lines[i]);
    }
    saveSelection();
  });

  wrap.confirmBodyImages = function confirmBodyImages() {
    editor.querySelectorAll("img[data-final-src]").forEach((img) => {
      if (img.pendingFile) {
        pendingUploads.push({
          path: img.dataset.finalSrc,
          file: img.pendingFile,
          message: opts.buildImageMessage(img.dataset.finalSrc),
        });
        img.pendingFile = null;
      }
    });
  };

  // Usado por "Copiar corpo em português" (ver buildArticleEnglishSection):
  // substitui o conteúdo do editor por um HTML já salvo (imagens com caminho
  // definitivo, sem data-final-src/pendingFile), então nada disso entra na
  // fila de upload — as imagens continuam sendo as mesmas já enviadas.
  wrap.setValue = function setValue(html) {
    editor.innerHTML = toEditorPreviewHtml(html);
    if (opts.onInput) opts.onInput(editor.innerHTML);
  };

  return wrap;
}

// Botão "Publicar" da tela de um item. `onSave` confirma os arquivos
// escolhidos e passa os campos do cartão para contentData; publicarItem
// grava só a seção do item.
function buildSaveCardButton(onSave) {
  const btn = el("button", "btn btn-primary btn-small btn-publicar", "Publicar");
  btn.type = "button";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    publicarItem(btn.closest(".card"), onSave);
  });
  return btn;
}

// Tela de um item (notícia, episódio, verbete, categoria, integrante). Na
// lista, o item é só uma linha (o .card-header); clicar nela abre a tela do
// item: a seção ganha .em-detalhe e o CSS esconde o resto da lista. "←
// voltar" (ou outra tela na barra lateral) fecha. `voltarPara` é o nome da
// lista, usado no botão de voltar.
function wireCardAccordion(card, header, body, _container, voltarPara) {
  const voltar = el("button", "item-voltar", `← ${voltarPara || "Voltar para a lista"}`);
  voltar.type = "button";
  voltar.addEventListener("click", () => {
    // Pega o painel antes: descartar redesenha a lista e tira este card da página.
    const panel = card.closest(".section-panel");
    if (podeSairDaTela()) fecharItem(panel);
  });
  card.prepend(voltar);
  header.addEventListener("click", () => {
    if (card.classList.contains("open") || !listaSemPendencias(secaoDoCard(card))) return;
    if (podeSairDaTela()) abrirItem(card);
  });
}

// Cards de item abertos guardam a posição da lista, para voltar ao mesmo
// ponto ao fechar.
const posicaoDaLista = new WeakMap();

// `novo`: item criado agora e ainda não publicado (sair sem publicar o
// descarta). `manterRolagem`: reabertura depois de publicar.
function abrirItem(card, { novo = false, manterRolagem = false } = {}) {
  const panel = card.closest(".section-panel");
  if (!panel) return;
  if (!panel.classList.contains("em-detalhe")) posicaoDaLista.set(panel, window.scrollY);
  panel.querySelectorAll(".card.open").forEach((c) => c !== card && c.classList.remove("open"));
  card.classList.add("open");
  panel.classList.add("em-detalhe");
  abrirTela(card, [secaoDoCard(card)], novo);
  atualizarBarrasDeLista();
  if (!manterRolagem) irParaOConteudo();
  ajustarAlturas(card);
  // A primeira medida pode ter sido com a fonte reserva, mais larga.
  document.fonts?.ready.then(() => ajustarAlturas(card));
  card.querySelectorAll(".previa-assinatura").forEach((l) => l.atualizar?.());
}

// Rola até o começo da área de conteúdo (no celular a barra lateral fica em
// cima dela; no computador isso é o topo da página).
function irParaOConteudo() {
  const conteudo = document.querySelector(".adm-content");
  const y = conteudo.getBoundingClientRect().top + window.scrollY - 56;
  window.scrollTo(0, Math.max(0, y));
}

function fecharItem(panel) {
  if (!panel?.classList.contains("em-detalhe")) return;
  panel.querySelectorAll(".card.open").forEach((c) => c.classList.remove("open"));
  panel.classList.remove("em-detalhe");
  if (telaAberta && panel.contains(telaAberta.root)) telaAberta = null;
  atualizarBarrasDeLista();
  window.scrollTo(0, posicaoDaLista.get(panel) || 0);
}

// Abas "Português | English" de uma tela de item: `pt` e `en` são listas de
// campos já montados. `pares` lista os campos com tradução, como
// [chavePt, chaveEn] (data-key): a aba English mostra quantos têm texto em
// português e estão vazios em inglês. `dica` aparece no topo da aba English.
function blocoDeIdiomas({ pt, en, pares = [], dica }) {
  const wrap = el("div", "field full bloco-idiomas");
  const blocoPt = el("div", "fields-grid campo-pt");
  pt.forEach((f) => blocoPt.appendChild(f));
  const blocoEn = el("div", "fields-grid campo-en");
  if (dica) blocoEn.appendChild(el("p", "field-hint full", dica));
  en.forEach((f) => blocoEn.appendChild(f));
  wrap.appendChild(blocoPt);
  wrap.appendChild(blocoEn);
  const valor = (bloco, chave) => {
    const campo = bloco.querySelector(`[data-key="${chave}"]`);
    if (!campo) return "";
    return (campo.isContentEditable ? campo.textContent : campo.value || "").trim();
  };
  abasDeIdioma(wrap, () => pares.filter(([a, b]) => valor(blocoPt, a) && !valor(blocoEn, b)).length);
  return wrap;
}

// Com a ordem da lista alterada e não publicada, abrir ou criar um item
// misturaria as duas coisas (descartar o item desfaria também a ordem).
function listaSemPendencias(secao) {
  if (!dirty.has(secao)) return true;
  toast('Antes, publique ou desfaça as alterações da lista (barra no rodapé).', "error");
  return false;
}

// Selo "falta traduzir" das linhas da lista.
function seloFaltaTraduzir(falta) {
  if (!falta) return document.createTextNode("");
  const selo = el("span", "selo-traduzir", "falta traduzir");
  selo.title = "A versão em inglês ainda não foi preenchida";
  return selo;
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

// Escolha de como preencher autor/foto de uma notícia: um integrante já
// cadastrado em contentData.members (ver renderMembersList) — nome e foto
// vêm de lá — ou "Outro", que mantém o comportamento antigo (texto livre +
// upload próprio, ver authorField/avatarField em buildArticleCard). A opção
// escolhida aqui não é salva por si — ela só decide qual controle fica
// visível; o que de fato vai pro JSON é sempre author/authorAvatar, exatos
// como se tivessem sido digitados/enviados à mão.
//
// Combobox sempre visível (mesmo padrão de buildArticleCategoryField), sem
// setinha de expandir/recolher: o campo antigo (some/aparece atrás de um
// clique) deixava fácil não notar que ele existia.
function buildArticleAuthorSourceField(article, authorField, authorInput, avatarField) {
  const wrap = el("div", "field author-source-field");
  wrap.appendChild(el("label", "", "Autor"));

  const select = document.createElement("select");
  select.className = "input";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— sem autor —";
  select.appendChild(blank);
  for (const member of contentData.members) {
    const opt = document.createElement("option");
    opt.value = member.id;
    opt.textContent = member.name || member.id;
    select.appendChild(opt);
  }
  const manualOpt = document.createElement("option");
  manualOpt.value = "__manual__";
  manualOpt.textContent = "Outra pessoa (digitar o nome)";
  select.appendChild(manualOpt);
  wrap.appendChild(select);

  // Autor/foto batem exatamente com um integrante cadastrado -> assume que
  // vieram de lá; senão, com texto de autor mas sem bater -> manual; sem
  // nenhum dos dois -> "sem autor".
  const matched = article.author
    ? contentData.members.find((m) => m.name === article.author && (m.image || "") === (article.authorAvatar || ""))
    : undefined;
  if (matched) select.value = matched.id;
  else if (article.author) select.value = "__manual__";

  function refresh() {
    const isManual = select.value === "__manual__";
    authorField.hidden = !isManual;
    avatarField.hidden = !isManual;
  }
  refresh();

  select.addEventListener("change", () => {
    if (select.value === "__manual__") {
      refresh();
      authorInput.focus();
      return;
    }
    const member = contentData.members.find((m) => m.id === select.value);
    authorInput.value = member ? member.name || "" : "";
    avatarField.setValue(member ? member.image || "" : "");
    refresh();
  });

  return wrap;
}

// Categoria da notícia: combobox com as categorias já usadas em outras
// notícias + opção "+ Adicionar nova categoria", que troca pra um campo de
// texto livre. O valor salvo continua sendo só article.category, no mesmo
// <input> de sempre (ver applyArticleField) — o select é só um atalho pra
// não redigitar à mão um nome já existente, nunca a fonte de verdade.
function buildArticleCategoryField(article, i) {
  const wrap = el("div", "field category-field");
  wrap.appendChild(el("label", "", "Categoria"));

  const input = document.createElement("input");
  input.className = "input";
  input.type = "text";
  input.value = article.category ?? "";
  input.placeholder = "Fisiologia vegetal";
  input.dataset.article = i;
  input.dataset.key = "category";

  // Lista deriva das categorias já usadas em QUALQUER notícia (inclusive
  // esta) — cresce sozinha assim que uma categoria nova é salva, sem precisar
  // cadastrar em lugar nenhum separado.
  const categories = Array.from(
    new Set(contentData.articles.map((a) => a.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const select = document.createElement("select");
  select.className = "input";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— selecione uma categoria —";
  select.appendChild(blank);
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  const newOpt = document.createElement("option");
  newOpt.value = "__new__";
  newOpt.textContent = "+ Adicionar nova categoria";
  select.appendChild(newOpt);
  select.value = categories.includes(article.category) ? article.category : "";

  function showSelect() {
    select.hidden = false;
    input.hidden = true;
  }
  function showInput(focus) {
    select.hidden = true;
    input.hidden = false;
    if (focus) input.focus();
  }

  // Categoria já definida mas fora da lista de opções (caso impossível hoje,
  // já que a lista inclui esta própria notícia — mas protege se o valor
  // salvo vier com espaços/capitalização diferente de todas as outras) cai
  // direto no campo de texto livre em vez de perder o valor escondendo-o.
  if (article.category && !categories.includes(article.category)) showInput(false);
  else showSelect();

  select.addEventListener("change", () => {
    if (select.value === "__new__") {
      input.value = "";
      showInput(true);
      return;
    }
    input.value = select.value;
  });

  wrap.appendChild(select);
  wrap.appendChild(input);
  return wrap;
}

// Categoria de um verbete de estudo: diferente de buildArticleCategoryField
// (texto livre), aqui é uma FK de verdade — o <select> guarda o id da
// categoria (data-key="categoriaId"), sincronizado pelo mecanismo genérico
// de applyEstudoField, sem lógica especial.
function buildVerbeteCategoriaField(verbete, i) {
  const wrap = el("div", "field");
  wrap.appendChild(el("label", "", "Categoria"));

  const select = document.createElement("select");
  select.className = "input";
  select.dataset.verbete = i;
  select.dataset.key = "categoriaId";

  if (contentData.categoriasEstudo.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "— cadastre uma categoria primeiro —";
    select.appendChild(opt);
  }
  contentData.categoriasEstudo.forEach((categoria) => {
    const opt = document.createElement("option");
    opt.value = categoria.id;
    opt.textContent = categoria.nome || categoria.id;
    select.appendChild(opt);
  });
  select.value = verbete.categoriaId || "";

  wrap.appendChild(select);
  return wrap;
}

// Termos relacionados: multi-seleção por checkbox entre os demais verbetes
// (exclui o próprio) — guarda uma lista de ids, não de slugs (ver
// termosRelacionadosIds em src/main.ts), então renomear o slug de um verbete
// não quebra o link relacionado de outro. Sem precedente de multi-seleção no
// painel; a coleta (collectVerbeteTermosRelacionados) segue o mesmo padrão de
// varredura por card usado em collectMemberLinks/collectArticleReferences.
function buildTermosRelacionadosField(verbete, i) {
  const wrap = el("div", "field full");
  wrap.appendChild(el("label", "", "Termos relacionados (opcional)"));

  const others = contentData.estudos.filter((v) => v !== verbete);
  if (others.length === 0) {
    wrap.appendChild(el("p", "field-hint", "Cadastre outros verbetes para linkar aqui."));
    return wrap;
  }

  const selected = new Set(verbete.termosRelacionadosIds || []);
  const list = el("div", "admin-item-list verbete-related-list");
  others.forEach((other) => {
    const row = el("label", "checkbox-row verbete-related-row");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "verbete-related-checkbox";
    input.value = other.id;
    input.checked = selected.has(other.id);
    row.appendChild(input);
    row.appendChild(document.createTextNode(other.titulo || "(sem título)"));
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

function collectVerbeteTermosRelacionados() {
  document.querySelectorAll('.card[id^="estudo-card-"]').forEach((card) => {
    const i = Number(card.id.slice("estudo-card-".length));
    const record = contentData.estudos[i];
    if (!record) return;
    const ids = Array.from(card.querySelectorAll(".verbete-related-checkbox:checked")).map((cb) => cb.value);
    if (ids.length > 0) record.termosRelacionadosIds = ids;
    else delete record.termosRelacionadosIds;
  });
}

// Fontes de um verbete: mesmo formato/linha de buildArticleReferenceRow
// (texto + url opcional) — reaproveitada diretamente, já que a própria
// função não tem nada específico de notícia (só monta a linha; quem
// amarra à entidade certa é o collector). collectArticleReferences não
// serve aqui porque é hardcoded para ".card[id^='article-card-']" e
// "record.references".
function collectVerbeteFontes() {
  document.querySelectorAll('.card[id^="estudo-card-"]').forEach((card) => {
    const i = Number(card.id.slice("estudo-card-".length));
    const record = contentData.estudos[i];
    if (!record) return;
    const fontes = Array.from(card.querySelectorAll(".article-reference-row"))
      .map((row) => ({
        text: row.querySelector(".article-reference-text").value.trim(),
        url: row.querySelector(".article-reference-url").value.trim(),
      }))
      .filter((f) => f.text || f.url)
      .map((f) => (f.url ? f : { text: f.text }));
    if (fontes.length > 0) record.fontes = fontes;
    else delete record.fontes;
  });
}

// Campos da aba "Português" da notícia (ver buildArticleCard): categoria,
// título, subtítulo, corpo e imagens. Autor, data, destaque, id e
// referências ficam fora das abas, por valerem para os dois idiomas.
// ── Tela da notícia com a cara da página publicada ──
// Os campos aparecem na ordem e no estilo da página da notícia no site
// (src/components/PaginaNoticia.astro): categoria, título, subtítulo, autor e
// data, foto de capa com legenda, texto. Cada um é um campo comum, só com a
// aparência do site (classes campo-previa--*, ver admin.css).
function noEstiloDoSite(campo, tipo, placeholder) {
  campo.classList.add("full", "campo-previa", `campo-previa--${tipo}`);
  const entrada = campo.querySelector("textarea, input:not([type=file]), select, .rich-text-editor");
  if (placeholder && entrada && "placeholder" in entrada) entrada.placeholder = placeholder;
  if (entrada?.tagName === "TEXTAREA") {
    entrada.rows = 1;
    entrada.addEventListener("input", () => ajustarAltura(entrada));
  }
  return campo;
}

// Caixa de texto que cresce com o texto (título, subtítulo), como na página.
function ajustarAltura(textarea) {
  if (!textarea.offsetParent) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}
function ajustarAlturas(raiz) {
  raiz.querySelectorAll(".campo-previa textarea").forEach(ajustarAltura);
}
window.addEventListener("resize", () => ajustarAlturas(document));

const formatarDataPt = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

// "Por: autor · Publicado em …": na página fica embaixo do título; aqui é só
// leitura, e clicar leva aos campos em "Detalhes da publicação".
function linhaDeAssinatura(card) {
  const linha = el("button", "previa-assinatura full");
  linha.type = "button";
  linha.title = "Autor e data ficam em \"Detalhes da publicação\"";
  const atualizar = () => {
    const autor = card.querySelector('[data-key="author"]')?.value.trim();
    const data = formatarDataPt(card.querySelector('[data-key="date"]')?.value);
    linha.textContent = [autor ? `Por: ${autor}` : "Sem autor", data ? `Publicado em ${data}` : "Sem data"].join("  ·  ");
    linha.appendChild(el("span", "previa-assinatura-dica", "alterar →"));
  };
  linha.atualizar = atualizar;
  linha.addEventListener("click", () => {
    const campo = card.querySelector(".tela-detalhes [data-key='author'], .tela-detalhes select");
    card.querySelector(".tela-detalhes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => campo?.focus(), 300);
  });
  return linha;
}

function buildArticlePortugueseSection(article, i, card) {
  const campos = [];
  const panel = { appendChild: (f) => campos.push(f) };

  const categoria = buildArticleCategoryField(article, i);
  categoria.querySelector("label").textContent = "Categoria";
  panel.appendChild(noEstiloDoSite(categoria, "categoria"));
  panel.appendChild(noEstiloDoSite(buildTextarea("Título", article.title, { article: i, key: "title" }), "titulo", "Escreva o título da notícia"));
  panel.appendChild(noEstiloDoSite(buildTextarea("Subtítulo (opcional)", article.subtitle, { article: i, key: "subtitle" }), "subtitulo", "Uma ou duas frases que resumem a notícia"));
  const assinatura = linhaDeAssinatura(card);
  panel.appendChild(assinatura);

  let readingTimeInput = null;
  const imageField = buildFileUploadField(
    "Foto de capa (opcional)",
    article.image,
    { article: i, key: "image" },
    {
      accept: "image/*",
      buttonText: "Escolher foto",
      preview: true,
      previewCaption: "Como aparece na notícia",
      extraPreviews: [
        { className: "file-upload-preview--split", caption: "Como aparece no destaque da página inicial" },
      ],
      allowClear: true,
      hint: "De preferência deitada, com 1600 × 900 pixels.",
      buildPath: (file) => `images/noticias/${article.id}-imagem-principal.${fileExtension(file.name, "jpg")}`,
      buildMessage: (path) => `admin: envia imagem da notícia "${article.title || article.id}" (${path})`,
    }
  );
  panel.appendChild(noEstiloDoSite(imageField, "capa"));
  panel.appendChild(noEstiloDoSite(buildTextarea("Legenda da foto de capa (opcional)", article.imageCaption, { article: i, key: "imageCaption" }), "legenda-capa", "Ex.: Vagens de feijão-fava. Foto: Fulano"));

  const bodyField = buildRichTextField(
    "Texto da notícia",
    articleBodyToHtml(article.body),
    { article: i, key: "body" },
    {
      id: article.id,
      folder: "images/noticias",
      buildImageMessage: (path) => `admin: envia imagem do corpo da notícia "${article.title || article.id}" (${path})`,
      onInput: (html) => { if (readingTimeInput) readingTimeInput.textContent = computeReadingTime(html) || "—"; },
    }
  );
  panel.appendChild(noEstiloDoSite(bodyField, "corpo"));

  // Tempo de leitura: só informação (calculado do texto), mostrado em
  // "Detalhes da publicação".
  readingTimeInput = el("span", "detalhe-valor", computeReadingTime(article.body) || "—");

  return { campos, imageField, bodyField, assinatura, readingTime: readingTimeInput };
}

// Campos da aba "English" da notícia. Todos opcionais: o que ficar vazio
// usa o texto em português no site (ver localize() no site).
function buildArticleEnglishSection(article, i, card) {
  const campos = [];
  const panel = { appendChild: (f) => campos.push(f) };

  panel.appendChild(noEstiloDoSite(buildInput("Categoria (em inglês)", "text", article.categoryEn, { article: i, key: "categoryEn" }), "categoria", "Space Agriculture"));
  panel.appendChild(noEstiloDoSite(buildTextarea("Título (em inglês)", article.titleEn, { article: i, key: "titleEn" }), "titulo", "Title in English"));
  panel.appendChild(noEstiloDoSite(buildTextarea("Subtítulo (em inglês)", article.subtitleEn, { article: i, key: "subtitleEn" }), "subtitulo", "Subtitle in English"));
  panel.appendChild(linhaDeAssinatura(card));
  panel.appendChild(noEstiloDoSite(buildTextarea("Legenda da foto de capa (em inglês)", article.imageCaptionEn, { article: i, key: "imageCaptionEn" }), "legenda-capa", "A foto é a mesma da versão em português"));

  const readingTimeEnInput = el("span", "detalhe-valor", (article.bodyEn && computeReadingTime(article.bodyEn)) || "—");

  // opts.id com sufixo "-en" só pra dar um prefixo de arquivo diferente às
  // imagens deste corpo (ver nextImageNumber/insertPendingImage em
  // buildRichTextField) — sem isso, os dois editores (PT e EN) gerariam o
  // mesmo caminho pra primeira imagem inserida (`${id}-imagem-1.ext`) e um
  // sobrescreveria o arquivo do outro no repositório.
  const bodyEnField = buildRichTextField(
    "Texto da notícia (em inglês)",
    articleBodyToHtml(article.bodyEn),
    { article: i, key: "bodyEn" },
    {
      id: `${article.id}-en`,
      folder: "images/noticias",
      buildImageMessage: (path) => `admin: envia imagem do corpo em inglês da notícia "${article.title || article.id}" (${path})`,
      onInput: (html) => { readingTimeEnInput.textContent = (html && computeReadingTime(html)) || "—"; },
    }
  );

  // O texto em inglês normalmente é só uma tradução do português — sem
  // isso, traduzir obrigava reenviar de novo cada imagem já publicada. O
  // botão copia o HTML do português (imagens com o caminho já definitivo)
  // para o editor em inglês; as imagens continuam sendo as mesmas.
  const copiar = el("div", "field full copiar-do-portugues");
  const copyBodyBtn = el("button", "btn btn-secondary btn-small", "Copiar o texto em português para traduzir por cima");
  copyBodyBtn.type = "button";
  copyBodyBtn.addEventListener("click", () => {
    collectAll();
    const currentEn = finalizeRichTextHtml(bodyEnField.querySelector(".rich-text-editor"));
    if (currentEn && !confirm("Isso troca o texto em inglês atual pelo texto em português (com as mesmas imagens). Continuar?")) return;
    bodyEnField.setValue(article.body || "");
  });
  copiar.appendChild(copyBodyBtn);
  copiar.appendChild(
    el(
      "p",
      "field-hint",
      "As imagens ficam as mesmas do português (o mesmo arquivo, não uma cópia). Se depois você tirar ou trocar uma imagem no texto em português, confira o texto em inglês: ela pode sumir de lá também."
    )
  );
  panel.appendChild(copiar);
  panel.appendChild(noEstiloDoSite(bodyEnField, "corpo"));

  return { campos, confirmBodyImages: bodyEnField.confirmBodyImages, readingTime: readingTimeEnInput };
}

// Linha de informação só para ler, em "Detalhes da publicação".
function detalheSoLeitura(rotulo, valor, dica) {
  const f = el("div", "field detalhe-leitura");
  f.appendChild(el("label", "", rotulo));
  f.appendChild(typeof valor === "string" ? el("span", "detalhe-valor", valor) : valor);
  if (dica) f.appendChild(el("span", "field-hint", dica));
  return f;
}

// ----------------------------------------------------------------------------
// Notícias
// ----------------------------------------------------------------------------

function renderArticlesList() {
  const container = document.getElementById("articles-list");
  container.innerHTML = "";
  const items = contentData.articles;
  document.getElementById("nav-count-articles").textContent = items.length || "";
  document.getElementById("count-articles").textContent = `${items.length} ${items.length === 1 ? "notícia" : "notícias"}`;

  if (items.length === 0) {
    container.appendChild(el("p", "empty-state", "Nenhuma notícia cadastrada ainda."));
    enforceFeaturedLimit("articles");
    return;
  }

  items.forEach((article, i) => container.appendChild(buildArticleCard(article, i, items.length, container)));
  enforceFeaturedLimit("articles");
}

function buildArticleCard(article, i, total, container) {
  const card = el("div", "card card--previa");
  card.id = `article-card-${i}`;

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  left.appendChild(buildReorderButtons(i, total, () => moveArticle(i, i - 1), () => moveArticle(i, i + 1)));
  const mini = el("span", "card-miniatura");
  if (article.image) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = "";
    img.src = /^https?:\/\//i.test(article.image) ? article.image : `../${article.image}`;
    mini.appendChild(img);
  }
  left.appendChild(mini);
  const textos = el("span", "card-textos");
  textos.appendChild(el("span", "card-name", article.title || "(sem título)"));
  textos.appendChild(el("span", "card-meta", [article.category, formatarDataPt(article.date), article.author].filter(Boolean).join(" · ")));
  left.appendChild(textos);
  left.appendChild(seloFaltaTraduzir(article.title && !article.titleEn));
  header.appendChild(left);
  header.appendChild(el("span", "card-chevron", "›"));
  card.appendChild(header);

  const body = el("div", "card-body");
  wireCardAccordion(card, header, body, container, "Notícias");

  const tela = el("div", "tela-previa");
  const principal = el("div", "tela-principal");
  const ptSection = buildArticlePortugueseSection(article, i, card);
  const englishSection = buildArticleEnglishSection(article, i, card);
  principal.appendChild(
    blocoDeIdiomas({
      pt: ptSection.campos,
      en: englishSection.campos,
      pares: [["title", "titleEn"], ["subtitle", "subtitleEn"], ["body", "bodyEn"], ["imageCaption", "imageCaptionEn"]],
      dica: "Tudo é opcional. O que ficar em branco aparece em português no site em inglês.",
    })
  );

  // Referências: o mesmo texto nas duas versões; no site vêm depois do texto.
  const referencesField = el("div", "field full campo-referencias");
  referencesField.appendChild(el("h2", "previa-secao", "Referências"));
  referencesField.appendChild(el("span", "field-hint", "Aparecem no fim da notícia, nas duas línguas. Opcional."));
  const referencesList = el("div", "article-references-list");
  (article.references || []).forEach((ref) => referencesList.appendChild(buildArticleReferenceRow(ref)));
  referencesField.appendChild(referencesList);
  const addReferenceBtn = el("button", "btn btn-secondary btn-small", "+ Adicionar referência");
  addReferenceBtn.type = "button";
  addReferenceBtn.addEventListener("click", () => referencesList.appendChild(buildArticleReferenceRow()));
  referencesField.appendChild(addReferenceBtn);
  principal.appendChild(referencesField);

  // Detalhes da publicação: o que não aparece no meio da página.
  const detalhes = el("aside", "tela-detalhes");
  detalhes.appendChild(el("h2", "tela-detalhes-titulo", "Detalhes da publicação"));

  const authorField = buildInput("Nome do autor", "text", article.author, { article: i, key: "author" }, "Nome e sobrenome");
  const authorInput = authorField.querySelector("input");
  const avatarField = buildFileUploadField(
    "Foto do autor",
    article.authorAvatar,
    { article: i, key: "authorAvatar" },
    {
      accept: "image/*",
      buttonText: "Escolher foto",
      preview: true,
      previewClass: "file-upload-preview--avatar",
      allowClear: true,
      buildPath: (file) => `images/equipe/${article.id}-autor.${fileExtension(file.name, "jpg")}`,
      buildMessage: (path) => `admin: envia foto do autor da notícia "${article.title || article.id}" (${path})`,
    }
  );
  detalhes.appendChild(buildArticleAuthorSourceField(article, authorField, authorInput, avatarField));
  detalhes.appendChild(authorField);
  detalhes.appendChild(avatarField);
  detalhes.appendChild(buildInput("Data de publicação", "date", article.date, { article: i, key: "date" }));
  detalhes.appendChild(buildInput("Hora (opcional)", "time", article.time, { article: i, key: "time" }));
  detalhes.appendChild(
    buildCheckboxField("Mostrar em destaque na página inicial", article.featured, { article: i, key: "featured" }, () => enforceFeaturedLimit("articles"))
  );
  const tempos = el("span", "detalhe-valor");
  tempos.append("Português: ", ptSection.readingTime, " · Inglês: ", englishSection.readingTime);
  detalhes.appendChild(detalheSoLeitura("Tempo de leitura", tempos, "Calculado sozinho a partir do tamanho do texto."));

  const imageVerticalField = buildFileUploadField(
    "Foto em pé (opcional)",
    article.imageVertical,
    { article: i, key: "imageVertical" },
    {
      accept: "image/*",
      buttonText: "Escolher foto",
      preview: true,
      previewClass: "file-upload-preview--vertical",
      allowClear: true,
      hint: "Usada nos cartões em grade. De preferência 900 × 1200 pixels.",
      buildPath: (file) => `images/noticias/${article.id}-imagem-vertical.${fileExtension(file.name, "jpg")}`,
      buildMessage: (path) => `admin: envia imagem vertical da notícia "${article.title || article.id}" (${path})`,
    }
  );
  detalhes.appendChild(imageVerticalField);
  detalhes.appendChild(detalheSoLeitura("Endereço no site", `astrobotanica.com.br/artigo/${article.id}`));

  tela.appendChild(principal);
  tela.appendChild(detalhes);
  body.appendChild(tela);

  // A linha "Por: … · Publicado em …" acompanha os campos de autor e data.
  const assinaturas = () => card.querySelectorAll(".previa-assinatura").forEach((l) => l.atualizar());
  card.addEventListener("input", (e) => { if (e.target.matches('[data-key="author"], [data-key="date"]')) assinaturas(); });
  card.addEventListener("change", (e) => { if (e.target.matches("select, [data-key='date']")) assinaturas(); });
  assinaturas();

  const actions = el("div", "card-actions");
  const saveBtn = buildSaveCardButton(() => {
    avatarField.confirmFileUpload();
    ptSection.imageField.confirmFileUpload();
    imageVerticalField.confirmFileUpload();
    ptSection.bodyField.confirmBodyImages();
    englishSection.confirmBodyImages();
    collectArticleCardFields(i);
    markDirty("articles");
  });
  actions.appendChild(saveBtn);
  const removeBtn = el("button", "btn btn-danger btn-small", "Tirar notícia do site");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => removeArticle(i));
  actions.appendChild(removeBtn);
  body.appendChild(actions);

  card.appendChild(body);

  return card;
}

function moveArticle(from, to) {
  if (to < 0 || to >= contentData.articles.length) return;
  collectAll();
  const [item] = contentData.articles.splice(from, 1);
  contentData.articles.splice(to, 0, item);
  renderArticlesList();
  markDirty("articles");
  toast('Ordem alterada. Para valer no site, clique em "Publicar" no rodapé da lista.', "ok");
}

function removeArticle(i) {
  const article = contentData.articles[i];
  if (!confirm(`Tirar a notícia "${article.title || "(sem título)"}" do site? Ela sai do site agora mesmo (em um ou dois minutos).`)) return;
  fecharItem(document.querySelector(".section-panel.em-detalhe"));
  collectAll();
  contentData.articles.splice(i, 1);
  renderArticlesList();
  markDirty("articles");
  saveAll(["articles"]).then(atualizarBarrasDeLista);
}

function addArticle() {
  if (!listaSemPendencias("articles")) return;
  collectAll();
  const id = `noticia-${nextIdNumber(contentData.articles, "noticia")}`;
  // Insere no início: a home e a lista pública mostram as notícias na ordem
  // do array, então uma notícia nova já aparece em primeiro sem precisar
  // reordenar manualmente.
  contentData.articles.unshift({
    id,
    category: "",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    readingTime: "",
    body: "",
  });
  renderArticlesList();
  markDirty("articles");
  const card = document.getElementById("article-card-0");
  if (card) abrirItem(card, { novo: true });
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
    enforceFeaturedLimit("episodes");
    return;
  }

  items.forEach((episode, i) => container.appendChild(buildEpisodeCard(episode, i, items.length, container)));
  enforceFeaturedLimit("episodes");
}

function buildEpisodeCard(episode, i, total, container) {
  const card = el("div", "card");
  card.id = `episode-card-${i}`;

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  left.appendChild(buildReorderButtons(i, total, () => moveEpisode(i, i - 1), () => moveEpisode(i, i + 1)));
  left.appendChild(el("span", "card-num", String(episode.number ?? i + 1).padStart(2, "0")));
  left.appendChild(el("span", "card-name", episode.title || "(sem título)"));
  left.appendChild(el("span", "card-meta", [episode.date, episode.duration].filter(Boolean).join(" · ")));
  left.appendChild(seloFaltaTraduzir(episode.title && !episode.titleEn));
  header.appendChild(left);
  header.appendChild(el("span", "card-chevron", "›"));
  card.appendChild(header);

  const body = el("div", "card-body");
  wireCardAccordion(card, header, body, container, "Podcast");
  const grid = el("div", "fields-grid");

  const title = buildInput("Título", "text", episode.title, { episode: i, key: "title" });
  title.classList.add("full");
  const description = buildTextarea("Descrição curta", episode.description, { episode: i, key: "description" });
  description.classList.add("full");
  const transcript = buildTextarea(
    "Transcrição (opcional) — um parágrafo por linha",
    (episode.transcript || []).join("\n"),
    { episode: i, key: "transcript" },
    true
  );
  transcript.classList.add("full");
  transcript.querySelector("textarea").rows = 8;

  const titleEn = buildInput("Título (EN)", "text", episode.titleEn, { episode: i, key: "titleEn" });
  titleEn.classList.add("full");
  const descriptionEn = buildTextarea("Descrição curta (EN)", episode.descriptionEn, { episode: i, key: "descriptionEn" });
  descriptionEn.classList.add("full");
  const transcriptEn = buildTextarea(
    "Transcrição (EN, opcional) — um parágrafo por linha",
    (episode.transcriptEn || []).join("\n"),
    { episode: i, key: "transcriptEn" },
    true
  );
  transcriptEn.classList.add("full");
  transcriptEn.querySelector("textarea").rows = 8;

  grid.appendChild(
    blocoDeIdiomas({
      pt: [title, description, transcript],
      en: [titleEn, descriptionEn, transcriptEn],
      pares: [["title", "titleEn"], ["description", "descriptionEn"], ["transcript", "transcriptEn"]],
      dica: "O episódio ganha página em inglês (/en/episodios/…) quando o título (EN) estiver preenchido. O áudio é o mesmo, em português.",
    })
  );

  grid.appendChild(el("h3", "section-heading full", "Áudio, data e destaque"));

  const audioField = buildFileUploadField(
    "Áudio do episódio",
    episode.audioSrc,
    { episode: i, key: "audioSrc" },
    {
      accept: "audio/mpeg,.mp3",
      buttonText: "Enviar .mp3",
      allowClear: true,
      buildPath: () => `audio/${episode.id}.mp3`,
      buildMessage: (path) => `admin: envia áudio do episódio "${episode.title || episode.id}" (${path})`,
    }
  );
  audioField.classList.add("full");
  grid.appendChild(audioField);

  grid.appendChild(buildSpinnerNumberField("Número", episode.number, { episode: i, key: "number" }));
  grid.appendChild(buildInput("Duração", "text", episode.duration, { episode: i, key: "duration" }, "38:00 ou —"));
  grid.appendChild(buildInput("Data", "date", episode.date, { episode: i, key: "date" }));
  grid.appendChild(buildInput("Hora (opcional, horário de Brasília — usado no podcast.xml)", "time", episode.time, { episode: i, key: "time" }));

  grid.appendChild(
    buildCheckboxField(
      "Destacar na Home",
      episode.featured,
      { episode: i, key: "featured" },
      () => enforceFeaturedLimit("episodes")
    )
  );
  grid.appendChild(buildReadOnlyField("Identificador (id)", episode.id));

  const imageField = buildFileUploadField(
    "Imagem do episódio (opcional)",
    episode.image,
    { episode: i, key: "image" },
    {
      accept: "image/*",
      buttonText: "Enviar imagem",
      preview: true,
      allowClear: true,
      buildPath: (file) => `images/episodios/${episode.id}-imagem-principal.${fileExtension(file.name, "jpg")}`,
      buildMessage: (path) => `admin: envia imagem do episódio "${episode.title || episode.id}" (${path})`,
    }
  );
  imageField.classList.add("full");
  grid.appendChild(imageField);

  body.appendChild(grid);

  const actions = el("div", "card-actions");
  const saveBtn = buildSaveCardButton(() => {
    audioField.confirmFileUpload();
    imageField.confirmFileUpload();
    collectEpisodeCardFields(i);
    markDirty("episodes");
  });
  actions.appendChild(saveBtn);
  const removeBtn = el("button", "btn btn-danger btn-small", "Remover episódio");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => removeEpisode(i));
  actions.appendChild(removeBtn);
  body.appendChild(actions);

  card.appendChild(body);

  return card;
}

function moveEpisode(from, to) {
  if (to < 0 || to >= contentData.episodes.length) return;
  collectAll();
  const [item] = contentData.episodes.splice(from, 1);
  contentData.episodes.splice(to, 0, item);
  renderEpisodesList();
  markDirty("episodes");
  toast('Ordem alterada. Para valer no site, clique em "Publicar" no rodapé da lista.', "ok");
}

function removeEpisode(i) {
  const episode = contentData.episodes[i];
  if (!confirm(`Remover o episódio "${episode.title || "(sem título)"}"? A remoção é publicada agora.`)) return;
  fecharItem(document.querySelector(".section-panel.em-detalhe"));
  collectAll();
  contentData.episodes.splice(i, 1);
  renderEpisodesList();
  markDirty("episodes");
  saveAll(["episodes"]).then(atualizarBarrasDeLista);
}

function addEpisode() {
  if (!listaSemPendencias("episodes")) return;
  collectAll();
  const nextNumber = nextIdNumber(contentData.episodes, "ep");
  const id = `ep-${nextNumber}`;
  // Insere no início: a home e a lista pública mostram os episódios na
  // ordem do array, então um episódio novo já aparece em primeiro sem
  // precisar reordenar manualmente.
  contentData.episodes.unshift({
    id,
    number: nextNumber,
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    duration: "",
    audioSrc: "",
  });
  renderEpisodesList();
  markDirty("episodes");
  const card = document.getElementById("episode-card-0");
  if (card) abrirItem(card, { novo: true });
}

// ----------------------------------------------------------------------------
// Integrantes
// ----------------------------------------------------------------------------

function renderMembersList() {
  const container = document.getElementById("members-list");
  container.innerHTML = "";
  const items = contentData.members;
  document.getElementById("nav-count-members").textContent = items.length || "";
  document.getElementById("count-members").textContent = `${items.length} ${items.length === 1 ? "integrante" : "integrantes"}`;

  if (items.length === 0) {
    container.appendChild(el("p", "empty-state", "Nenhum integrante cadastrado ainda."));
    return;
  }

  items.forEach((member, i) =>
    container.appendChild(canEditMember(member) ? buildMemberCard(member, i, items.length) : buildMemberReadOnlyCard(member, i))
  );
}

// Admin edita todos; colaborador só os integrantes que ele criou (ownerUid).
function canEditMember(member) {
  return ROLE === "admin" || (!!CURRENT_UID && member.ownerUid === CURRENT_UID);
}

// Card só de leitura (integrante de outra pessoa, visto por um colaborador).
// O id não começa com "member-card-" de propósito, e não há nenhum campo
// data-member: collectAll/collectMemberLinks ignoram esse card, então nada
// dele é relido do DOM pra contentData.
function buildMemberReadOnlyCard(member, i) {
  const card = el("div", "card");
  card.id = `member-view-${i}`;

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  left.appendChild(el("span", "card-num", String(i + 1).padStart(2, "0")));
  left.appendChild(el("span", "card-name", member.name || "(sem nome)"));
  header.appendChild(left);
  header.appendChild(el("span", "card-meta", "só leitura"));
  header.appendChild(el("span", "card-chevron", "›"));
  card.appendChild(header);

  const body = el("div", "card-body");
  wireCardAccordion(card, header, body, null, "Integrantes");
  const grid = el("div", "fields-grid");
  grid.appendChild(buildReadOnlyField("Identificador (id)", member.id));
  grid.appendChild(buildReadOnlyField("Nome", member.name));
  const readOnlyText = (label, text) => {
    const field = el("div", "field full");
    field.appendChild(el("label", "", label));
    field.appendChild(el("p", "card-readonly-text", text || "—"));
    return field;
  };
  grid.appendChild(readOnlyText("Descrição", member.description));
  grid.appendChild(readOnlyText("Descrição (EN)", member.descriptionEn));

  const photo = el("div", "field full");
  photo.appendChild(el("label", "", "Foto"));
  if (member.image) {
    const img = el("img", "file-upload-preview");
    img.src = /^https?:\/\//i.test(member.image) ? member.image : `../${member.image}`;
    img.alt = member.name || "";
    photo.appendChild(img);
  } else {
    photo.appendChild(el("p", "card-readonly-text", "—"));
  }
  grid.appendChild(photo);

  const links = el("div", "field full");
  links.appendChild(el("label", "", "Links"));
  if (member.links?.length) {
    const list = el("ul", "card-readonly-links");
    for (const link of member.links) {
      const item = el("li");
      const a = el("a", "", link.label || link.url);
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener";
      item.appendChild(a);
      list.appendChild(item);
    }
    links.appendChild(list);
  } else {
    links.appendChild(el("p", "card-readonly-text", "—"));
  }
  grid.appendChild(links);
  body.appendChild(grid);
  card.appendChild(body);

  return card;
}

// Lê o valor atual do campo "id" direto do DOM (pode ter sido editado e
// ainda não persistido em contentData) para nomear o arquivo de foto enviado.
function memberSlug(i, member) {
  const idInput = document.querySelector(`[data-member="${i}"][data-key="id"]`);
  const raw = (idInput && idInput.value.trim()) || member.id || `integrante-${i + 1}`;
  return slugify(raw) || `integrante-${i + 1}`;
}

// Links de um integrante: lista de tamanho livre ({label, url}), montada e
// desmontada pelos botões "+ adicionar link"/"Remover" — sem índice fixo,
// então não dá pra usar o mesmo mecanismo data-member/data-key dos outros
// campos. Cada linha só existe no DOM até alguém coletar o card (ver
// collectMemberLinks), igual a qualquer outro campo de texto não salvo.
function buildMemberLinkRow(link) {
  const row = el("div", "member-link-row");

  const labelInput = document.createElement("input");
  labelInput.className = "input member-link-label";
  labelInput.type = "text";
  labelInput.placeholder = "Instagram";
  labelInput.value = link?.label ?? "";
  row.appendChild(labelInput);

  const urlInput = document.createElement("input");
  urlInput.className = "input member-link-url";
  urlInput.type = "url";
  urlInput.placeholder = "https://instagram.com/...";
  urlInput.value = link?.url ?? "";
  row.appendChild(urlInput);

  const removeBtn = el("button", "btn btn-danger btn-small", "Remover");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => row.remove());
  row.appendChild(removeBtn);

  return row;
}

// Sincroniza os links de TODOS os cartões de integrante na tela pra dentro
// de contentData — chamado tanto pelo "Salvar alterações" de um card quanto
// por collectAll() (reordenar/remover/adicionar), já que rebuildar a lista
// inteira a partir do DOM é mais simples do que rastrear índice por linha.
function collectMemberLinks() {
  document.querySelectorAll('.card[id^="member-card-"]').forEach((card) => {
    const i = Number(card.id.slice("member-card-".length));
    const record = contentData.members[i];
    if (!record) return;
    const links = Array.from(card.querySelectorAll(".member-link-row"))
      .map((row) => ({
        label: row.querySelector(".member-link-label").value.trim(),
        url: row.querySelector(".member-link-url").value.trim(),
      }))
      .filter((link) => link.label || link.url);
    if (links.length > 0) record.links = links;
    else delete record.links;
  });
}

// Referências de uma notícia: mesma lógica de tamanho livre dos links de
// integrante (ver buildMemberLinkRow/collectMemberLinks) — exibidas no site
// após o corpo da notícia, antes de "Continue lendo" (ver renderArticleDetail
// em src/main.ts).
function buildArticleReferenceRow(reference) {
  const row = el("div", "article-reference-row");

  const textInput = document.createElement("input");
  textInput.className = "input article-reference-text";
  textInput.type = "text";
  textInput.placeholder = "Sobrenome, N. et al. (2026). Título do trabalho. Revista.";
  textInput.value = reference?.text ?? "";
  row.appendChild(textInput);

  const urlInput = document.createElement("input");
  urlInput.className = "input article-reference-url";
  urlInput.type = "url";
  urlInput.placeholder = "https://doi.org/... (opcional)";
  urlInput.value = reference?.url ?? "";
  row.appendChild(urlInput);

  const removeBtn = el("button", "btn btn-danger btn-small", "Remover");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => row.remove());
  row.appendChild(removeBtn);

  return row;
}

function collectArticleReferences() {
  document.querySelectorAll('.card[id^="article-card-"]').forEach((card) => {
    const i = Number(card.id.slice("article-card-".length));
    const record = contentData.articles[i];
    if (!record) return;
    const references = Array.from(card.querySelectorAll(".article-reference-row"))
      .map((row) => ({
        text: row.querySelector(".article-reference-text").value.trim(),
        url: row.querySelector(".article-reference-url").value.trim(),
      }))
      .filter((ref) => ref.text || ref.url)
      .map((ref) => (ref.url ? ref : { text: ref.text }));
    if (references.length > 0) record.references = references;
    else delete record.references;
  });
}

function buildMemberCard(member, i, total) {
  const card = el("div", "card");
  card.id = `member-card-${i}`;

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  // Reordenar mexe na posição dos integrantes dos outros — só admin.
  if (ROLE === "admin") {
    left.appendChild(buildReorderButtons(i, total, () => moveMember(i, i - 1), () => moveMember(i, i + 1)));
  }
  left.appendChild(el("span", "card-num", String(i + 1).padStart(2, "0")));
  left.appendChild(el("span", "card-name", member.name || "(sem nome)"));
  left.appendChild(seloFaltaTraduzir(member.description && !member.descriptionEn));
  header.appendChild(left);
  header.appendChild(el("span", "card-chevron", "›"));
  card.appendChild(header);

  const body = el("div", "card-body");
  wireCardAccordion(card, header, body, null, "Integrantes");
  const grid = el("div", "fields-grid");

  // Só editável enquanto o integrante ainda não foi salvo no GitHub (ver
  // _isNew em addMember/saveAll) — depois disso trava pra sempre, igual ao id
  // de artigo/episódio (buildReadOnlyField), pelo mesmo motivo: renomear um id
  // já em uso desalinha o caminho da foto e qualquer notícia que já tenha
  // selecionado esse integrante como autor.
  const nameField = buildInput("Nome completo", "text", member.name, { member: i, key: "name" });
  if (member._isNew) {
    // Integrante novo: o id é gerado do nome completo enquanto ele é
    // digitado. Só o admin pode ajustá-lo à mão; a partir daí o nome não
    // mexe mais nele (_idManual, só em memória, como _isNew).
    const idField = buildInput("Identificador (id)", "text", member.id, { member: i, key: "id" }, "gerado do nome completo");
    const idInput = idField.querySelector("input");
    idInput.disabled = ROLE !== "admin";
    idField.appendChild(
      el("span", "field-hint", "Nome completo sem acentos, ex.: eduardo-dreyer-simoes-saraiva. Também é o nome do arquivo da foto. Não muda depois de salvo.")
    );
    const otherIds = () => contentData.members.filter((m) => m !== member).map((m) => m.id);
    nameField.querySelector("input").addEventListener("input", (e) => {
      if (!member._idManual) idInput.value = memberIdFromName(e.target.value, otherIds());
    });
    idInput.addEventListener("input", () => {
      member._idManual = true;
    });
    grid.appendChild(idField);
  } else {
    grid.appendChild(buildReadOnlyField("Identificador (id)", member.id));
  }
  grid.appendChild(nameField);

  const description = buildTextarea("Descrição", member.description, { member: i, key: "description" });
  description.classList.add("full");
  const descriptionEn = buildTextarea("Descrição (EN)", member.descriptionEn, { member: i, key: "descriptionEn" });
  descriptionEn.classList.add("full");
  grid.appendChild(
    blocoDeIdiomas({
      pt: [description],
      en: [descriptionEn],
      pares: [["description", "descriptionEn"]],
      dica: "Aparece no Sobre em inglês. Sem a descrição (EN), mostra a descrição em português.",
    })
  );

  const photoField = buildFileUploadField(
    "Foto",
    member.image,
    { member: i, key: "image" },
    {
      accept: "image/*",
      buttonText: "Enviar foto",
      preview: true,
      allowClear: true,
      buildPath: (file) => `images/integrantes/${memberSlug(i, member)}.${fileExtension(file.name, "jpg")}`,
      buildMessage: (path) => `admin: envia foto do integrante "${member.name || member.id}" (${path})`,
    }
  );
  photoField.classList.add("full");
  grid.appendChild(photoField);

  const linksField = el("div", "field full");
  linksField.appendChild(el("label", "", "Links (Instagram, Lattes, site pessoal, etc.)"));
  const linksList = el("div", "member-links-list");
  (member.links || []).forEach((link) => linksList.appendChild(buildMemberLinkRow(link)));
  linksField.appendChild(linksList);
  const addLinkBtn = el("button", "btn btn-secondary btn-small", "+ adicionar link");
  addLinkBtn.type = "button";
  addLinkBtn.addEventListener("click", () => linksList.appendChild(buildMemberLinkRow()));
  linksField.appendChild(addLinkBtn);
  grid.appendChild(linksField);

  body.appendChild(grid);

  const actions = el("div", "card-actions");
  const saveBtn = buildSaveCardButton(() => {
    photoField.confirmFileUpload();
    collectMemberCardFields(i);
    markDirty("members");
  });
  actions.appendChild(saveBtn);
  const removeBtn = el("button", "btn btn-danger btn-small", "Remover integrante");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => removeMember(i));
  actions.appendChild(removeBtn);
  body.appendChild(actions);

  card.appendChild(body);

  return card;
}

function moveMember(from, to) {
  if (ROLE !== "admin") return;
  if (to < 0 || to >= contentData.members.length) return;
  collectAll();
  const [item] = contentData.members.splice(from, 1);
  contentData.members.splice(to, 0, item);
  renderMembersList();
  markDirty("members");
  toast('Ordem alterada. Para valer no site, clique em "Publicar" no rodapé da lista.', "ok");
}

function removeMember(i) {
  const member = contentData.members[i];
  if (!canEditMember(member)) return;
  const linked = (accessCache?.content?.tokens || []).filter((t) => member.id && t.integrante === member.id);
  const aviso = linked.length ? ` O acesso "${linked.map((t) => t.label).join('", "')}" vai ficar sem integrante (dá para ligar outro em "Acessos").` : "";
  if (!confirm(`Remover o integrante "${member.name || "(sem nome)"}"? A remoção é publicada agora.${aviso}`)) return;
  fecharItem(document.querySelector(".section-panel.em-detalhe"));
  collectAll();
  contentData.members.splice(i, 1);
  renderMembersList();
  markDirty("members");
  saveAll(["members"]).then(atualizarBarrasDeLista);
}

function addMember() {
  if (!listaSemPendencias("members")) return;
  collectAll();
  // O id nasce vazio e acompanha o nome digitado (ver buildMemberCard).
  const id = "";
  // _isNew é só uma marca em memória (nunca vai pro JSON, ver saveAll): libera
  // o id pra edição enquanto o integrante ainda não foi salvo de verdade no
  // GitHub. Depois do primeiro "Salvar no GitHub" bem-sucedido, a marca some e
  // o id trava pra sempre (ver buildMemberCard) — como já é o caso de artigo e
  // episódio, e pelo mesmo motivo: outras coisas passam a depender dele
  // (caminho da foto, correspondência por nome no seletor de autor da notícia).
  contentData.members.unshift({ id, name: "", description: "", ownerUid: CURRENT_UID, _isNew: true });
  renderMembersList();
  markDirty("members");
  const card = document.getElementById("member-card-0");
  if (card) abrirItem(card, { novo: true });
}

// A foto de um integrante novo pode ter sido escolhida antes de o nome estar
// completo (o caminho vem do id do momento, ver memberSlug). Antes de
// enviar, renomeia o arquivo na fila para images/integrantes/<id final>.<ext>.
function alinharFotosDeIntegrantesNovos() {
  contentData.members.forEach((m, i) => {
    if (!m._isNew || !m.image?.startsWith("images/integrantes/")) return;
    const esperado = `images/integrantes/${m.id}.${fileExtension(m.image, "jpg")}`;
    if (m.image === esperado) return;
    const upload = pendingUploads.find((u) => u.path === m.image);
    if (!upload) return;
    upload.path = esperado;
    upload.message = `admin: envia foto do integrante "${m.name}" (${esperado})`;
    m.image = esperado;
    const input = document.querySelector(`[data-member="${i}"][data-key="image"]`);
    if (input) input.value = esperado;
  });
}

// Salvamento de um colaborador: parte da versão do GitHub e troca só os
// integrantes dele (editados, removidos ou novos, no topo) — os dos outros
// ficam exatamente como estão lá, mesmo que algo tenha mudado em memória.
function mergeOwnMembers(remote) {
  const mine = contentData.members.filter((m) => m.ownerUid === CURRENT_UID);
  // Alguém criou, nesse meio-tempo, um integrante com o mesmo id de um novo.
  const clash = mine.find((m) => remote.some((r) => r.id === m.id && r.ownerUid !== CURRENT_UID));
  if (clash) throw new Error(`o identificador "${clash.id}" já existe — remova esse integrante e adicione de novo`);
  const mineById = new Map(mine.map((m) => [m.id, m]));
  const remoteIds = new Set(remote.map((m) => m.id));
  const added = mine.filter((m) => !remoteIds.has(m.id));
  const kept = remote.flatMap((m) => {
    if (m.ownerUid !== CURRENT_UID) return [m];
    return mineById.has(m.id) ? [mineById.get(m.id)] : [];
  });
  return [...added, ...kept];
}

// ----------------------------------------------------------------------------
// Categorias de estudo
// ----------------------------------------------------------------------------

function renderCategoriasEstudoList() {
  const container = document.getElementById("categorias-estudo-list");
  container.innerHTML = "";
  const items = contentData.categoriasEstudo;
  document.getElementById("count-categorias-estudo").textContent = `${items.length} ${items.length === 1 ? "categoria" : "categorias"}`;

  if (items.length === 0) {
    container.appendChild(el("p", "empty-state", "Nenhuma categoria cadastrada ainda."));
    return;
  }

  items.forEach((categoria, i) => container.appendChild(buildCategoriaEstudoCard(categoria, i, items.length)));
}

function buildCategoriaEstudoCard(categoria, i, total) {
  const card = el("div", "card");
  card.id = `categoria-estudo-card-${i}`;

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  left.appendChild(buildReorderButtons(i, total, () => moveCategoriaEstudo(i, i - 1), () => moveCategoriaEstudo(i, i + 1)));
  left.appendChild(el("span", "card-num", String(i + 1).padStart(2, "0")));
  left.appendChild(el("span", "card-name", categoria.nome || "(sem nome)"));
  left.appendChild(seloFaltaTraduzir(categoria.nome && !categoria.nomeEn));
  header.appendChild(left);
  header.appendChild(el("span", "card-chevron", "›"));
  card.appendChild(header);

  const body = el("div", "card-body");
  wireCardAccordion(card, header, body, null, "Estudos");
  const grid = el("div", "fields-grid");

  const slugField = buildInput("Slug (usado na URL)", "text", categoria.slug, { categoriaEstudo: i, key: "slug" }, "geologia-e-solo-espacial");
  const nomeField = buildInput("Nome", "text", categoria.nome, { categoriaEstudo: i, key: "nome" });
  nomeField.classList.add("full");
  nomeField.querySelector("input").addEventListener("blur", (e) => {
    const slugInput = slugField.querySelector("input");
    if (!slugInput.value.trim()) slugInput.value = slugify(e.target.value);
  });
  const descricao = buildTextarea("Descrição (opcional)", categoria.descricao, { categoriaEstudo: i, key: "descricao" }, false, 2);
  descricao.classList.add("full");
  const nomeEn = buildInput("Nome (EN)", "text", categoria.nomeEn, { categoriaEstudo: i, key: "nomeEn" });
  nomeEn.classList.add("full");
  const descricaoEn = buildTextarea("Descrição (EN)", categoria.descricaoEn, { categoriaEstudo: i, key: "descricaoEn" }, false, 2);
  descricaoEn.classList.add("full");
  grid.appendChild(
    blocoDeIdiomas({
      pt: [nomeField, descricao],
      en: [nomeEn, descricaoEn],
      pares: [["nome", "nomeEn"], ["descricao", "descricaoEn"]],
      dica: "Sem o nome (EN), o site em inglês mostra o nome em português. O slug da URL é o mesmo nos dois idiomas.",
    })
  );
  grid.appendChild(slugField);
  grid.appendChild(buildReadOnlyField("Identificador (id)", categoria.id));

  body.appendChild(grid);

  const actions = el("div", "card-actions");
  const saveBtn = buildSaveCardButton(() => {
    collectCategoriaEstudoCardFields(i);
    markDirty("categoriasEstudo");
  });
  actions.appendChild(saveBtn);
  const removeBtn = el("button", "btn btn-danger btn-small", "Remover categoria");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => removeCategoriaEstudo(i));
  actions.appendChild(removeBtn);
  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

function moveCategoriaEstudo(from, to) {
  if (to < 0 || to >= contentData.categoriasEstudo.length) return;
  collectAll();
  const [item] = contentData.categoriasEstudo.splice(from, 1);
  contentData.categoriasEstudo.splice(to, 0, item);
  renderCategoriasEstudoList();
  markDirty("categoriasEstudo");
  toast('Ordem alterada. Para valer no site, clique em "Publicar" no rodapé da lista.', "ok");
}

function removeCategoriaEstudo(i) {
  collectAll();
  const categoria = contentData.categoriasEstudo[i];
  const inUse = contentData.estudos.some((v) => v.categoriaId === categoria.id);
  if (inUse) {
    toast(`Não é possível remover "${categoria.nome || categoria.id}": ainda há verbetes cadastrados nessa categoria.`, "error");
    return;
  }
  if (!confirm(`Remover a categoria "${categoria.nome || "(sem nome)"}"? A remoção é publicada agora.`)) return;
  fecharItem(document.querySelector(".section-panel.em-detalhe"));
  contentData.categoriasEstudo.splice(i, 1);
  renderCategoriasEstudoList();
  markDirty("categoriasEstudo");
  saveAll(["categoriasEstudo"]).then(atualizarBarrasDeLista);
}

function addCategoriaEstudo() {
  if (!listaSemPendencias("categoriasEstudo")) return;
  collectAll();
  const id = `categoria-${nextIdNumber(contentData.categoriasEstudo, "categoria")}`;
  // Ao fim da lista (não no início, diferente de notícia/episódio): categoria
  // é uma lista curta e curada, não um feed cronológico — a ordem de exibição
  // é decidida pelas setas ▲▼, não pela ordem de cadastro.
  contentData.categoriasEstudo.push({ id, nome: "", slug: "", descricao: "" });
  renderCategoriasEstudoList();
  markDirty("categoriasEstudo");
  const card = document.getElementById(`categoria-estudo-card-${contentData.categoriasEstudo.length - 1}`);
  if (card) abrirItem(card, { novo: true });
}

// ----------------------------------------------------------------------------
// Estudos (verbetes)
// ----------------------------------------------------------------------------

function renderEstudosList() {
  const container = document.getElementById("estudos-list");
  container.innerHTML = "";
  const items = contentData.estudos;
  document.getElementById("nav-count-estudos").textContent = items.length || "";
  document.getElementById("count-estudos").textContent = `${items.length} ${items.length === 1 ? "verbete" : "verbetes"}`;

  if (items.length === 0) {
    container.appendChild(el("p", "empty-state", "Nenhum verbete cadastrado ainda."));
    return;
  }

  items.forEach((verbete, i) => container.appendChild(buildEstudoCard(verbete, i, items.length, container)));
}

function buildEstudoCard(verbete, i, total, container) {
  const card = el("div", "card");
  card.id = `estudo-card-${i}`;

  const categoria = contentData.categoriasEstudo.find((c) => c.id === verbete.categoriaId);

  const header = el("div", "card-header");
  const left = el("div", "card-header-left");
  left.appendChild(buildReorderButtons(i, total, () => moveEstudo(i, i - 1), () => moveEstudo(i, i + 1)));
  left.appendChild(el("span", "card-num", String(i + 1).padStart(2, "0")));
  left.appendChild(el("span", "card-name", verbete.titulo || "(sem título)"));
  left.appendChild(el("span", "card-meta", `${categoria ? categoria.nome : "sem categoria"} · ${verbete.publicado ? "publicado" : "rascunho"}`));
  left.appendChild(seloFaltaTraduzir(verbete.titulo && !verbete.tituloEn));
  header.appendChild(left);
  header.appendChild(el("span", "card-chevron", "›"));
  card.appendChild(header);

  const body = el("div", "card-body");
  wireCardAccordion(card, header, body, container, "Estudos");
  const grid = el("div", "fields-grid");

  const slugField = buildInput("Slug (usado na URL)", "text", verbete.slug, { verbete: i, key: "slug" }, "regolito-simulado");
  const tituloField = buildTextarea("Título", verbete.titulo, { verbete: i, key: "titulo" }, false, 2);
  tituloField.classList.add("full");
  tituloField.querySelector("textarea").addEventListener("blur", (e) => {
    const slugInput = slugField.querySelector("input");
    if (!slugInput.value.trim()) slugInput.value = slugify(e.target.value);
  });

  const definicaoCurta = buildTextarea(
    "Definição curta (1-2 frases — aparece nos cards e no topo do verbete)",
    verbete.definicaoCurta,
    { verbete: i, key: "definicaoCurta" },
    false,
    2
  );
  definicaoCurta.classList.add("full");

  const conteudoField = buildRichTextField(
    "Conteúdo (contexto, como funciona, por que importa para a astrobotânica)",
    verbete.conteudo,
    { verbete: i, key: "conteudo" },
    {
      folder: "images/estudos",
      id: verbete.id,
      buildImageMessage: (path) => `admin: envia imagem do conteúdo do verbete "${verbete.titulo || verbete.id}" (${path})`,
    }
  );
  conteudoField.classList.add("full");

  const tituloEn = buildInput("Título (EN)", "text", verbete.tituloEn, { verbete: i, key: "tituloEn" });
  tituloEn.classList.add("full");
  const definicaoCurtaEn = buildTextarea("Definição curta (EN)", verbete.definicaoCurtaEn, { verbete: i, key: "definicaoCurtaEn" }, false, 2);
  definicaoCurtaEn.classList.add("full");
  // id com "-en": prefixo de arquivo próprio para as imagens deste editor,
  // como no corpo em inglês da notícia.
  const conteudoEnField = buildRichTextField(
    "Conteúdo (EN)",
    verbete.conteudoEn,
    { verbete: i, key: "conteudoEn" },
    {
      folder: "images/estudos",
      id: `${verbete.id}-en`,
      buildImageMessage: (path) => `admin: envia imagem do conteúdo em inglês do verbete "${verbete.titulo || verbete.id}" (${path})`,
    }
  );
  conteudoEnField.classList.add("full");
  // Como na notícia: copia o HTML do português (mesmas imagens, sem novo
  // envio) para só traduzir o texto por cima.
  const copyConteudoBtn = el("button", "btn btn-secondary btn-small full", "Copiar conteúdo do português");
  copyConteudoBtn.type = "button";
  copyConteudoBtn.addEventListener("click", () => {
    collectAll();
    const currentEn = finalizeRichTextHtml(conteudoEnField.querySelector(".rich-text-editor"));
    if (currentEn && !confirm("Isso substitui o conteúdo em inglês atual pelo conteúdo em português (mesmas imagens). Continuar?")) return;
    conteudoEnField.setValue(contentData.estudos[i].conteudo || "");
  });

  grid.appendChild(
    blocoDeIdiomas({
      pt: [tituloField, definicaoCurta, conteudoField],
      en: [tituloEn, definicaoCurtaEn, copyConteudoBtn, conteudoEnField],
      pares: [["titulo", "tituloEn"], ["definicaoCurta", "definicaoCurtaEn"], ["conteudo", "conteudoEn"]],
      dica: "O verbete publicado ganha página em inglês (/en/estudos/…) quando o título (EN) estiver preenchido.",
    })
  );

  grid.appendChild(el("h3", "section-heading full", "Categoria, fontes e publicação"));
  grid.appendChild(buildVerbeteCategoriaField(verbete, i));
  grid.appendChild(slugField);

  const imagemCapaField = buildFileUploadField(
    "Imagem de capa (opcional)",
    verbete.imagemCapa,
    { verbete: i, key: "imagemCapa" },
    {
      accept: "image/*",
      buttonText: "Enviar imagem",
      preview: true,
      allowClear: true,
      buildPath: (file) => `images/estudos/${verbete.id}-capa.${fileExtension(file.name, "jpg")}`,
      buildMessage: (path) => `admin: envia imagem de capa do verbete "${verbete.titulo || verbete.id}" (${path})`,
    }
  );
  imagemCapaField.classList.add("full");
  grid.appendChild(imagemCapaField);

  grid.appendChild(buildTermosRelacionadosField(verbete, i));

  const fontesField = el("div", "field full");
  fontesField.appendChild(el("label", "", "Fontes e leitura complementar (opcional)"));
  const fontesList = el("div", "article-references-list");
  (verbete.fontes || []).forEach((fonte) => fontesList.appendChild(buildArticleReferenceRow(fonte)));
  fontesField.appendChild(fontesList);
  const addFonteBtn = el("button", "btn btn-secondary btn-small", "+ adicionar fonte");
  addFonteBtn.type = "button";
  addFonteBtn.addEventListener("click", () => fontesList.appendChild(buildArticleReferenceRow()));
  fontesField.appendChild(addFonteBtn);
  grid.appendChild(fontesField);

  grid.appendChild(buildCheckboxField("Publicado", verbete.publicado, { verbete: i, key: "publicado" }));
  grid.appendChild(buildReadOnlyField("Identificador (id)", verbete.id));

  body.appendChild(grid);

  const actions = el("div", "card-actions");
  const saveBtn = buildSaveCardButton(() => {
    imagemCapaField.confirmFileUpload();
    conteudoField.confirmBodyImages();
    conteudoEnField.confirmBodyImages();
    collectEstudoCardFields(i);
    // dataAtualizacao não tem campo próprio no formulário — é sempre a data
    // desta publicação, igual a como readingTime é recalculado a cada
    // publicação de notícia.
    contentData.estudos[i].dataAtualizacao = new Date().toISOString().slice(0, 10);
    markDirty("estudos");
  });
  actions.appendChild(saveBtn);
  const removeBtn = el("button", "btn btn-danger btn-small", "Remover verbete");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => removeEstudo(i));
  actions.appendChild(removeBtn);
  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

function moveEstudo(from, to) {
  if (to < 0 || to >= contentData.estudos.length) return;
  collectAll();
  const [item] = contentData.estudos.splice(from, 1);
  contentData.estudos.splice(to, 0, item);
  renderEstudosList();
  markDirty("estudos");
  toast('Ordem alterada. Para valer no site, clique em "Publicar" no rodapé da lista.', "ok");
}

function removeEstudo(i) {
  const verbete = contentData.estudos[i];
  if (!confirm(`Remover o verbete "${verbete.titulo || "(sem título)"}"? A remoção é publicada agora.`)) return;
  fecharItem(document.querySelector(".section-panel.em-detalhe"));
  collectAll();
  contentData.estudos.splice(i, 1);
  renderEstudosList();
  markDirty("estudos");
  saveAll(["estudos"]).then(atualizarBarrasDeLista);
}

function addEstudo() {
  if (!listaSemPendencias("estudos")) return;
  collectAll();
  const id = `verbete-${nextIdNumber(contentData.estudos, "verbete")}`;
  contentData.estudos.unshift({
    id,
    titulo: "",
    slug: "",
    categoriaId: contentData.categoriasEstudo[0]?.id || "",
    definicaoCurta: "",
    conteudo: "",
    publicado: false,
    dataAtualizacao: new Date().toISOString().slice(0, 10),
  });
  renderEstudosList();
  markDirty("estudos");
  const card = document.getElementById("estudo-card-0");
  if (card) abrirItem(card, { novo: true });
}

// ----------------------------------------------------------------------------
// Textos do site: Rodapé e marca + Páginas
// ----------------------------------------------------------------------------

// Cada campo de texto do site vem em par: a versão em português (editada
// direto em contentData.site) e a versão em inglês (contentData.siteEn),
// mantida à mão — não há tradução automática. As duas ficam em abas
// "Português | English" no topo da tela (ver abasDeIdioma); a aba English
// mostra quantos campos ainda faltam traduzir.
function buildSiteField(fieldDef) {
  const wrap = el("div", "field-group");
  if (fieldDef.type === "textarea") wrap.classList.add("full");

  const value = getByPath(contentData.site, fieldDef.key) ?? "";
  const ptField =
    fieldDef.type === "textarea"
      ? buildTextarea(fieldDef.label, value, { site: fieldDef.key })
      : buildInput(fieldDef.label, "text", value, { site: fieldDef.key });
  ptField.classList.add("campo-pt");
  wrap.appendChild(ptField);

  const valueEn = getByPath(contentData.siteEn, fieldDef.key) ?? "";
  const enField =
    fieldDef.type === "textarea"
      ? buildTextarea(fieldDef.label, valueEn, { siteEn: fieldDef.key })
      : buildInput(fieldDef.label, "text", valueEn, { siteEn: fieldDef.key });
  enField.classList.add("campo-en");
  // Na aba English, o texto em português aparece como referência.
  if (value) enField.appendChild(el("span", "field-hint campo-referencia", `Português: ${value}`));
  wrap.appendChild(enField);

  return wrap;
}

// Abas "Português | English" de uma tela de textos do site. A tela inteira
// troca de idioma (data-idioma no container; o CSS esconde .campo-pt ou
// .campo-en). Campos sem idioma (ex.: banner da Home) aparecem nas duas.
function abasDeIdioma(container, faltando) {
  container.dataset.idioma = "pt";
  const abas = el("div", "abas-idioma");
  abas.setAttribute("role", "tablist");
  const aba = (idioma, texto) => {
    const b = el("button", "aba-idioma", texto);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.idioma = idioma;
    b.addEventListener("click", () => {
      container.dataset.idioma = idioma;
      abas.querySelectorAll(".aba-idioma").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      ajustarAlturas(container);
    });
    abas.appendChild(b);
    return b;
  };
  aba("pt", "Português").setAttribute("aria-selected", "true");
  const abaEn = aba("en", "English");
  abaEn.setAttribute("aria-selected", "false");
  const falta = el("span", "aba-falta");
  abaEn.appendChild(falta);
  // Faltando = campo com texto em português e vazio em inglês.
  const contar = () => {
    let n = 0;
    if (faltando) n = faltando();
    else {
      container.querySelectorAll("[data-site-en]").forEach((en) => {
        const pt = container.querySelector(`[data-site="${en.dataset.siteEn}"]`);
        if (pt?.value.trim() && !en.value.trim()) n++;
      });
    }
    falta.textContent = n ? ` · falta traduzir ${n}` : "";
  };
  contar();
  container.addEventListener("input", contar);
  container.prepend(abas);
}

// Delegação: distingue se o campo que mudou é a versão pt (data-site) ou en
// (data-site-en) e marca só a seção correspondente como suja.
function handleSiteFieldChange(event) {
  if (event.target.dataset.site !== undefined) markDirty("site");
  if (event.target.dataset.siteEn !== undefined) markDirty("siteEn");
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
  abasDeIdioma(container);
  if (!container.dataset.ligado) {
    container.dataset.ligado = "1";
    container.addEventListener("input", handleSiteFieldChange);
    container.addEventListener("change", handleSiteFieldChange);
  }
}

// Redes sociais do rodapé: mesma lógica de tamanho livre dos links de
// integrante (ver buildMemberLinkRow) — nome e link livres, quantos o admin
// quiser, guardados em contentData.site.socialLinks. Sem versão (EN): é a
// mesma URL/nome em qualquer idioma, não haveria o que traduzir.
function buildSiteSocialLinkRow(link) {
  const row = el("div", "site-social-link-row");

  const labelInput = document.createElement("input");
  labelInput.className = "input site-social-link-label";
  labelInput.type = "text";
  labelInput.placeholder = "Bluesky";
  labelInput.value = link?.label ?? "";
  row.appendChild(labelInput);

  const urlInput = document.createElement("input");
  urlInput.className = "input site-social-link-url";
  urlInput.type = "url";
  urlInput.placeholder = "https://bsky.app/profile/...";
  urlInput.value = link?.url ?? "";
  row.appendChild(urlInput);

  const removeBtn = el("button", "btn btn-danger btn-small", "Remover");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => {
    row.remove();
    markDirty("site");
  });
  row.appendChild(removeBtn);

  return row;
}

// Sincroniza a lista de redes sociais do rodapé pra dentro de contentData —
// chamada por collectAll() (ver comentário em saveAll), igual aos outros
// campos de tamanho livre (referências de notícia, links de integrante).
function collectSiteSocialLinks() {
  const list = document.getElementById("site-social-links-list");
  if (!list) return;
  const links = Array.from(list.querySelectorAll(".site-social-link-row"))
    .map((row) => ({
      label: row.querySelector(".site-social-link-label").value.trim(),
      url: row.querySelector(".site-social-link-url").value.trim(),
    }))
    .filter((link) => link.label || link.url);
  if (links.length > 0) contentData.site.socialLinks = links;
  else delete contentData.site.socialLinks;
}

function renderSiteSocialLinks() {
  const list = document.getElementById("site-social-links-list");
  const addBtn = document.getElementById("add-social-link-btn");
  if (!list || !addBtn) return;
  list.innerHTML = "";
  (contentData.site.socialLinks || []).forEach((link) => list.appendChild(buildSiteSocialLinkRow(link)));
  if (list.dataset.ligado) return;
  list.dataset.ligado = "1";
  list.addEventListener("input", () => markDirty("site"));
  addBtn.addEventListener("click", () => {
    list.appendChild(buildSiteSocialLinkRow());
    markDirty("site");
  });
}

// Menu de navegação (cabeçalho, menu do celular e coluna "Navegação" do
// rodapé): itens livres em contentData.site.menu, na ordem da lista —
// { rotulo, rotuloEn, link, visivel }. Esconder só tira do menu; a página
// continua no ar. O site lê a lista em src/lib/menu.ts. Sem "menu" no
// site.json, o painel parte do menu original (os textos de nav.*).
function menuPadrao() {
  const nav = contentData.site.nav || {};
  const navEn = contentData.siteEn.nav || {};
  return [
    ["/noticias", "articles"],
    ["/estudos", "estudos"],
    ["/podcast", "podcast"],
    ["/sobre", "about"],
    ["/contato", "contact"],
  ].map(([link, chave]) => ({ rotulo: nav[chave] || "", rotuloEn: navEn[chave] || "", link, visivel: true }));
}

function problemasDoMenu(menu) {
  const problemas = [];
  menu.forEach((item, i) => {
    const nome = item.rotulo ? `"${item.rotulo}"` : `item ${i + 1}`;
    if (!item.rotulo) problemas.push(`menu: ${nome} sem nome`);
    if (!/^(\/|https?:\/\/)/.test(item.link)) problemas.push(`menu: link de ${nome} deve começar com "/" (página do site) ou "https://"`);
  });
  return problemas;
}

function buildSiteMenuRow(item) {
  const row = el("div", "site-menu-row");

  const visivelLabel = el("label", "site-menu-visivel");
  const visivel = document.createElement("input");
  visivel.type = "checkbox";
  visivel.className = "site-menu-visivel-input";
  visivel.checked = item?.visivel !== false;
  visivelLabel.appendChild(visivel);
  visivelLabel.appendChild(document.createTextNode(" Mostrar"));
  visivelLabel.title = "Desmarcado: o item some do menu, mas a página continua no ar";
  row.appendChild(visivelLabel);

  const campo = (classe, placeholder, valor, rotulo) => {
    const input = document.createElement("input");
    input.className = `input ${classe}`;
    input.type = "text";
    input.placeholder = placeholder;
    input.value = valor ?? "";
    input.setAttribute("aria-label", rotulo);
    row.appendChild(input);
  };
  campo("site-menu-rotulo", "Nome", item?.rotulo, "Nome no menu");
  campo("site-menu-rotulo-en", "Nome (EN)", item?.rotuloEn, "Nome no menu (EN)");
  campo("site-menu-link", "/pagina ou https://...", item?.link, "Link");

  const mover = (delta) => {
    const lista = row.parentElement;
    const irmao = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!irmao) return;
    if (delta < 0) lista.insertBefore(row, irmao);
    else lista.insertBefore(irmao, row);
    atualizarBotoesDoMenu();
    menuMudou();
  };
  row.appendChild(buildReorderButtons(0, 1, () => mover(-1), () => mover(1)));

  const removeBtn = el("button", "btn btn-danger btn-small", "Remover");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => {
    row.remove();
    atualizarBotoesDoMenu();
    menuMudou();
  });
  row.appendChild(removeBtn);

  return row;
}

// ▲ desabilitado no primeiro item, ▼ no último.
function atualizarBotoesDoMenu() {
  const linhas = Array.from(document.querySelectorAll("#site-menu-list .site-menu-row"));
  linhas.forEach((row, i) => {
    const [up, down] = row.querySelectorAll(".reorder-btn");
    up.disabled = i === 0;
    down.disabled = i === linhas.length - 1;
  });
}

function collectSiteMenu() {
  const list = document.getElementById("site-menu-list");
  if (!list) return;
  contentData.site.menu = Array.from(list.querySelectorAll(".site-menu-row"))
    .map((row) => {
      const item = {
        rotulo: row.querySelector(".site-menu-rotulo").value.trim(),
        rotuloEn: row.querySelector(".site-menu-rotulo-en").value.trim(),
        link: row.querySelector(".site-menu-link").value.trim(),
        visivel: row.querySelector(".site-menu-visivel-input").checked,
      };
      if (!item.rotuloEn) delete item.rotuloEn;
      return item;
    })
    .filter((item) => item.rotulo || item.link);
}

function renderSiteMenu() {
  const list = document.getElementById("site-menu-list");
  const addBtn = document.getElementById("add-menu-item-btn");
  if (!list || !addBtn) return;
  list.innerHTML = "";
  (contentData.site.menu || menuPadrao()).forEach((item) => list.appendChild(buildSiteMenuRow(item)));
  atualizarBotoesDoMenu();
  if (list.dataset.ligado) return;
  list.dataset.ligado = "1";
  list.addEventListener("input", menuMudou);
  list.addEventListener("change", menuMudou);
  addBtn.addEventListener("click", () => {
    list.appendChild(buildSiteMenuRow({ visivel: true }));
    atualizarBotoesDoMenu();
    menuMudou();
  });
}

// Menu editado: "Páginas" na barra lateral acompanha (ver renderSidebarPaginas).
let menuMudouTimer = null;
function menuMudou() {
  markDirty("site");
  clearTimeout(menuMudouTimer);
  menuMudouTimer = setTimeout(renderSidebarPaginas, 300);
}

// Menu como está na tela agora (mesmo ainda não salvo).
function menuAtual() {
  const list = document.getElementById("site-menu-list");
  if (!list || !list.querySelector(".site-menu-row")) return contentData.site.menu || menuPadrao();
  return Array.from(list.querySelectorAll(".site-menu-row")).map((row) => ({
    rotulo: row.querySelector(".site-menu-rotulo").value.trim(),
    link: row.querySelector(".site-menu-link").value.trim(),
    visivel: row.querySelector(".site-menu-visivel-input").checked,
  }));
}

// ----------------------------------------------------------------------------
// Páginas: barra lateral montada a partir do menu do site
// ----------------------------------------------------------------------------

// Links do menu que têm tela própria de textos. Notícias, Podcast e Estudos
// não aparecem em "Páginas": os textos delas ficam na própria lista, em
// Conteúdo (ver TELAS_DE_TEXTOS). Qualquer outro link "/slug" do menu é uma
// página de texto (src/content/paginas/<lang>/<slug>.md), criada ao salvar.
const SECOES_DAS_PAGINAS = {
  "/": { nome: "Início", painel: "page-home" },
  "/noticias": { nome: "Notícias", painel: null },
  "/podcast": { nome: "Podcast", painel: null },
  "/estudos": { nome: "Estudos", painel: null },
  "/contato": { nome: "Contato", painel: "page-contato" },
};
const RE_SLUG_PAGINA = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// "/estudos/" → "/estudos"; null para link externo ou com mais de um nível
// (ex.: "/artigo/noticia-3/"), que não tem tela própria.
function chaveDoLink(link) {
  if (!link?.startsWith("/")) return null;
  const caminho = link.replace(/[?#].*$/, "").replace(/\.html$/, "").replace(/\/+$/, "") || "/";
  if (caminho in SECOES_DAS_PAGINAS) return caminho;
  const slug = caminho.slice(1);
  return RE_SLUG_PAGINA.test(slug) ? caminho : null;
}

function painelDaChave(chave) {
  if (chave in SECOES_DAS_PAGINAS) return SECOES_DAS_PAGINAS[chave].painel;
  return `pagina-${chave.slice(1)}`;
}

// Um botão por página, numa lista simples.
function itemDaBarraDePaginas(nome, chave, oculto) {
  const painel = painelDaChave(chave);
  if (!painel) return [];
  if (painel.startsWith("pagina-")) garantirPainelDePagina(painel.slice("pagina-".length), nome);
  const b = el("button", "nav-btn", nome);
  b.type = "button";
  b.dataset.panel = painel;
  if (oculto) {
    const tag = el("span", "nav-tag", "oculto no menu");
    tag.title = "Desmarcado em Site → Menu: a página continua no ar, só não aparece no menu";
    b.appendChild(tag);
  }
  return [b];
}

function renderSidebarPaginas() {
  const container = document.getElementById("sidebar-pages");
  if (!container || !contentData.site) return;
  container.innerHTML = "";
  const usadas = new Set();
  const adicionar = (nome, chave, oculto) => {
    if (usadas.has(chave)) return;
    usadas.add(chave);
    itemDaBarraDePaginas(nome, chave, oculto).forEach((n) => container.appendChild(n));
  };

  // Início fica sempre no topo, esteja ou não no menu.
  adicionar("Início", "/", false);
  for (const item of menuAtual()) {
    const chave = chaveDoLink(item.link);
    if (chave) adicionar(item.rotulo || SECOES_DAS_PAGINAS[chave]?.nome || chave, chave, item.visivel === false);
  }
  // O que tem tela mas não está no menu (ex.: Expediente, que fica no rodapé).
  const fora = [
    ...Object.entries(SECOES_DAS_PAGINAS)
      .filter(([, s]) => s.painel)
      .map(([chave, s]) => [chave, s.nome]),
    ...[...paginasDeTexto.keys()].map((slug) => [`/${slug}`, paginasDeTexto.get(slug).pt?.campos.title || slug]),
  ].filter(([chave]) => !usadas.has(chave));
  if (fora.length) {
    container.appendChild(el("div", "nav-rotulo", "Fora do menu"));
    fora.sort((a, b) => a[1].localeCompare(b[1], "pt")).forEach(([chave, nome]) => adicionar(nome, chave, false));
  }

  const naInicio = document.getElementById("inicio-paginas");
  if (naInicio) {
    naInicio.innerHTML = "";
    container.querySelectorAll(".nav-btn[data-panel]").forEach((b) => {
      const c = el("button", "inicio-pagina", b.firstChild.textContent);
      c.type = "button";
      c.dataset.ir = b.dataset.panel;
      naInicio.appendChild(c);
    });
  }

  // A tela de uma página de texto é recriada depois de salvar (ver
  // carregarPaginasDeTexto): se era a tela aberta, continua aberta.
  if (painelAtual) {
    const ativo = container.querySelector(`.nav-btn[data-panel="${painelAtual}"]`);
    if (ativo) ativo.classList.add("active");
    document.getElementById(`panel-${painelAtual}`)?.classList.add("active");
  }
}

// ----------------------------------------------------------------------------
// Páginas de texto (src/content/paginas/<lang>/<slug>.md)
// ----------------------------------------------------------------------------

let paginasMarkdownOriginais = {}; // caminho → texto, como está no GitHub
// slug → { pt: {campos, corpo} | null, en: … | null, nome }
const paginasDeTexto = new Map();

function carregarPaginasDeTexto(arquivos) {
  paginasMarkdownOriginais = arquivos;
  paginasDeTexto.clear();
  document.querySelectorAll('[id^="panel-pagina-"]').forEach((p) => p.remove());
  for (const [caminho, texto] of Object.entries(arquivos)) {
    const lang = caminho.split("/").slice(-2)[0];
    const slug = slugDoCaminho(caminho);
    if (!paginasDeTexto.has(slug)) paginasDeTexto.set(slug, { pt: null, en: null });
    paginasDeTexto.get(slug)[lang] = lerPagina(texto);
  }
}

// Cria (uma vez) a tela de edição de uma página de texto. `nome` é o nome
// do item no menu, usado só como sugestão de título de uma página nova.
function garantirPainelDePagina(slug, nome) {
  if (document.getElementById(`panel-pagina-${slug}`)) return;
  if (!paginasDeTexto.has(slug)) paginasDeTexto.set(slug, { pt: null, en: null });
  const pagina = paginasDeTexto.get(slug);

  const panel = el("div", "section-panel");
  panel.id = `panel-pagina-${slug}`;
  const header = el("div", "panel-header");
  header.appendChild(el("span", "panel-title", pagina.pt?.campos.title || nome || slug));
  panel.appendChild(header);

  const dica = el("p", "admin-hint");
  if (!pagina.pt) {
    dica.textContent = `Esta página ainda não existe no site. Escreva o título e o texto e clique em "Publicar" para criá-la em /${slug}.`;
  } else {
    dica.textContent = `Texto da página /${slug}${slug === "sobre" ? ". A lista de integrantes aparece logo abaixo do texto e é editada em Conteúdo → Integrantes" : ""}.`;
  }
  panel.appendChild(dica);

  const form = el("div");
  form.id = `pagina-form-${slug}`;
  for (const lang of ["pt", "en"]) {
    const dados = pagina[lang];
    const bloco = el("div", `fields-grid campo-${lang}`);
    const ds = (campo) => ({ pagina: slug, lang, campo });
    const titulo = buildInput("Título", "text", dados?.campos.title ?? (lang === "pt" ? nome || "" : ""), ds("title"));
    bloco.appendChild(titulo);
    const atualizado = buildInput("Atualizado em (opcional, aparece no topo)", "date", dados?.campos.updated || "", ds("updated"));
    bloco.appendChild(atualizado);
    const descricao = buildTextarea("Descrição (SEO e compartilhamento)", dados?.campos.description || "", ds("description"));
    descricao.classList.add("full");
    bloco.appendChild(descricao);
    const texto = buildRichTextField("Texto", markdownParaHtml(dados?.corpo || ""), ds("corpo"), { simples: true });
    texto.classList.add("full");
    bloco.appendChild(texto);
    if (lang === "en") {
      bloco.appendChild(
        el("p", "admin-hint full", "Sem texto em inglês, /en/" + slug + " mostra a página provisória. Para tirar a versão em inglês, esvazie o título e o texto.")
      );
    }
    form.appendChild(bloco);
  }
  // Só o corpo alterado é convertido de volta para Markdown na hora de
  // salvar; o que não foi tocado é regravado exatamente como estava.
  form.addEventListener("input", (e) => {
    if (e.target.closest('[data-campo="corpo"]')) e.target.closest('[data-campo="corpo"]').dataset.alterado = "1";
    markDirty("paginas");
  });
  form.addEventListener("change", () => markDirty("paginas"));
  panel.appendChild(form);
  panel.appendChild(barraDePublicar(publicarTextos));
  // Textos fixos do site que aparecem nesta página (ex.: o título da seção
  // "Integrantes" do Sobre), na mesma tela e nas mesmas abas.
  const extras = PAGE_SCHEMA.find((p) => p.key === slug);
  if (extras) {
    const bloco = el("div", "textos-extras");
    bloco.appendChild(el("h3", "section-heading", extras.label));
    const grid = el("div", "fields-grid");
    extras.fields.forEach((f) => grid.appendChild(buildSiteField(f)));
    bloco.appendChild(grid);
    bloco.addEventListener("input", handleSiteFieldChange);
    bloco.addEventListener("change", handleSiteFieldChange);
    form.appendChild(bloco);
  }
  abasDeIdioma(form, () => {
    const vazio = (lang) => !form.querySelector(`.campo-${lang} [data-campo="corpo"]`).textContent.trim();
    let n = !vazio("pt") && vazio("en") ? 1 : 0;
    form.querySelectorAll("[data-site-en]").forEach((en) => {
      const pt = form.querySelector(`[data-site="${en.dataset.siteEn}"]`);
      if (pt?.value.trim() && !en.value.trim()) n++;
    });
    return n;
  });
  document.getElementById("page-panels").appendChild(panel);
}

// Arquivos .md de todas as páginas com tela, como { caminho: texto }.
function paginasParaArquivos() {
  const arquivos = {};
  const problemas = [];
  for (const [slug, pagina] of paginasDeTexto) {
    const form = document.getElementById(`pagina-form-${slug}`);
    for (const lang of ["pt", "en"]) {
      const original = pagina[lang];
      const caminho = caminhoPagina(lang, slug);
      if (!form) {
        if (original) arquivos[caminho] = paginasMarkdownOriginais[caminho];
        continue;
      }
      const campo = (nome) => form.querySelector(`[data-lang="${lang}"][data-campo="${nome}"]`);
      const editor = campo("corpo");
      let corpo = original?.corpo ?? "";
      if (editor.dataset.alterado) {
        const tpl = document.createElement("template");
        tpl.innerHTML = finalizeRichTextHtml(editor);
        corpo = htmlParaMarkdown(tpl.content);
      }
      const title = campo("title").value.trim();
      const nome = `${slug}${lang === "en" ? " (EN)" : ""}`;
      // Página nova só é criada com texto; a versão em inglês esvaziada
      // (título e texto) é apagada, com confirmação em saveAll.
      if (!original && !corpo.trim()) continue;
      if (original && lang === "en" && !corpo.trim() && !title) continue;
      if (!title) problemas.push(`página ${nome}: falta o título`);
      const campos = {
        ...(original?.campos || {}),
        title,
        description: campo("description").value.trim(),
        lang,
        updated: campo("updated").value,
      };
      // Sem mudança nenhuma: o arquivo fica exatamente como estava.
      const igual =
        original &&
        !editor.dataset.alterado &&
        ["title", "description", "updated"].every((k) => (original.campos[k] ?? "") === campos[k]);
      arquivos[caminho] = igual ? paginasMarkdownOriginais[caminho] : montarPagina(campos, corpo);
    }
  }
  return { arquivos, problemas };
}

async function salvarPaginas({ arquivos, mudancas }) {
  const entries = [
    ...Object.entries(mudancas.gravar).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
    ...mudancas.apagar.map((path) => ({ path, mode: "100644", type: "blob", sha: null })),
  ];
  if (entries.length) {
    const nomes = [...new Set([...Object.keys(mudancas.gravar), ...mudancas.apagar].map(slugDoCaminho))].join(", ");
    try {
      await commitTreeChange(entries, `admin: atualiza páginas (${nomes})`);
    } catch (err) {
      throw explainWriteError(err);
    }
  }
  // A partir daqui o GitHub tem estes arquivos: viram o novo "original".
  carregarPaginasDeTexto(arquivos);
  renderSidebarPaginas();
}

function renderPageForms() {
  const porChave = Object.fromEntries(PAGE_SCHEMA.map((p) => [p.key, p]));
  for (const tela of TELAS_DE_TEXTOS) {
    const container = document.getElementById(`page-form-${tela.id}`);
    container.innerHTML = "";
    for (const chave of tela.chaves) {
      const page = porChave[chave];
      if (tela.chaves.length > 1) container.appendChild(el("h3", "section-heading", page.label));
      const grid = el("div", "fields-grid");
      for (const fieldDef of page.fields) grid.appendChild(buildSiteField(fieldDef));
      container.appendChild(grid);
    }
    abasDeIdioma(container);
    if (!container.dataset.ligado) {
      container.dataset.ligado = "1";
      container.addEventListener("input", handleSiteFieldChange);
      container.addEventListener("change", handleSiteFieldChange);
    }
  }
}

// Banner de evento da Home: única imagem "solta" (não é campo de texto do
// PAGE_SCHEMA, por isso fica fora do loop acima) — aparece na Home entre a
// linha de notícias em destaque e a lista completa (ver renderHomeArticles
// em src/main.ts). Guardado em contentData.site.home.eventBannerImage/Link,
// mesmo mecanismo de "data-site" dos outros campos de texto da página Home
// (ver handleSiteFieldChange/collectAll), só que via buildFileUploadField.
// Como não há um botão "Salvar alterações" próprio aqui (diferente de
// notícia/episódio/integrante), confirmFileUpload() é chamado direto em
// collectAll() através de homeEventBannerField (ver mais abaixo).
function renderHomeEventBanner() {
  const container = document.getElementById("page-form-home");
  if (!container) return;
  const home = contentData.site.home || (contentData.site.home = {});

  const bannerField = buildFileUploadField(
    "Banner de evento (opcional)",
    home.eventBannerImage,
    { site: "home.eventBannerImage" },
    {
      accept: "image/*",
      buttonText: "Enviar imagem",
      preview: true,
      allowClear: true,
      hint: 'Aparece na Home, entre a linha de notícias em destaque e a lista completa. Some se vazio.',
      buildPath: (file) => `images/home/evento-banner.${fileExtension(file.name, "jpg")}`,
      buildMessage: (path) => `admin: envia banner de evento da Home (${path})`,
    }
  );
  container.appendChild(bannerField);

  const linkField = buildInput(
    "Link do banner (opcional)",
    "text",
    home.eventBannerLink,
    { site: "home.eventBannerLink" },
    "https://..."
  );
  container.appendChild(linkField);

  // Os ouvintes de input/change do container já vêm de renderPageForms.
  homeEventBannerField = bannerField;
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
    const memberSelect = buildAccessMemberSelect(entry.integrante);
    memberSelect.setAttribute("aria-label", `Integrante de ${entry.label || "sem nome"}`);
    memberSelect.addEventListener("change", () => changeAccessMember(index, entry.label, memberSelect));
    actions.appendChild(memberSelect);
    const roleSelect = el("select", "input role-select");
    roleSelect.setAttribute("aria-label", `Categoria de ${entry.label || "sem nome"}`);
    for (const [value, text] of Object.entries(ROLES)) {
      const option = el("option", null, text);
      option.value = value;
      roleSelect.appendChild(option);
    }
    roleSelect.value = roleOf(entry);
    roleSelect.addEventListener("change", () => changeAccessRole(index, entry.label, roleSelect));
    actions.appendChild(roleSelect);

    const delBtn = el("button", "btn btn-danger btn-small", "Revogar");
    delBtn.type = "button";
    delBtn.addEventListener("click", () => revokeAccess(index, entry.label));
    actions.appendChild(delBtn);
    row.appendChild(actions);

    list.appendChild(row);
  });

  // Formulário "Adicionar novo acesso": mesma lista, mantendo a escolha.
  const formSelect = document.getElementById("access-integrante");
  const chosen = formSelect.value;
  formSelect.replaceChildren(...buildAccessMemberSelect(chosen).children);
  formSelect.value = chosen;
}

// Integrantes já salvos (os novos ainda não têm id definitivo) + "nenhum".
// Um id que não existe mais em members.json aparece como "removido", pra não
// sumir calado da tela.
function buildAccessMemberSelect(current) {
  const select = el("select", "input member-select");
  const none = el("option", null, "— sem integrante —");
  none.value = "";
  select.appendChild(none);
  for (const member of contentData.members || []) {
    if (member._isNew) continue;
    const option = el("option", null, member.name || member.id);
    option.value = member.id;
    select.appendChild(option);
  }
  if (current && !(contentData.members || []).some((m) => m.id === current && !m._isNew)) {
    const option = el("option", null, `${current} (integrante removido)`);
    option.value = current;
    select.appendChild(option);
  }
  select.value = current || "";
  return select;
}

// Um integrante só pode estar ligado a um acesso.
function checkMemberFree(tokens, integrante, exceptIndex) {
  if (!integrante) return;
  const other = tokens.find((t, i) => i !== exceptIndex && t.integrante === integrante);
  if (other) throw new Error(`esse integrante já está ligado ao acesso "${other.label}"`);
}

async function changeAccessMember(index, label, select) {
  const integrante = select.value;
  select.disabled = true;
  try {
    const fresh = await getFile(CONFIG.authPath);
    const tokens = [...(fresh.content?.tokens || [])];
    if (!tokens[index] || tokens[index].label !== label) {
      throw new Error("a lista de acessos mudou — recarregue a página");
    }
    checkMemberFree(tokens, integrante, index);
    const entry = { ...tokens[index] };
    if (integrante) entry.integrante = integrante;
    else delete entry.integrante;
    tokens[index] = entry;
    const nome = contentData.members.find((m) => m.id === integrante)?.name;
    await putFile(
      CONFIG.authPath,
      { tokens },
      fresh.sha,
      integrante ? `admin: liga o acesso "${label}" ao integrante ${integrante}` : `admin: desliga o acesso "${label}" do integrante`
    );
    if (entry.salt === CURRENT_SALT) {
      CURRENT_INTEGRANTE = integrante || null;
      renderCurrentUser();
    }
    toast(integrante ? `"${label}" agora é ${nome || integrante}.` : `"${label}" ficou sem integrante.`, "ok");
    await loadAccess();
  } catch (err) {
    toast(`Erro ao ligar integrante: ${err.message}`, "error");
    await loadAccess();
  }
}

async function addAccess() {
  const labelInput = document.getElementById("access-label");
  const tokenInput = document.getElementById("access-token");
  const passwordInput = document.getElementById("access-password");
  const roleInput = document.getElementById("access-role");
  const memberInput = document.getElementById("access-integrante");
  const submit = document.getElementById("access-submit");

  const label = labelInput.value.trim();
  const role = roleInput.value;
  const integrante = memberInput.value;
  const token = tokenInput.value.trim();
  const password = passwordInput.value;

  if (!label || !token || !password) {
    toast("Preencha nome, token e senha para adicionar um acesso.", "error");
    return;
  }

  submit.disabled = true;
  try {
    const fresh = await getFile(CONFIG.authPath);
    checkMemberFree(fresh.content?.tokens || [], integrante, -1);
    const encrypted = await encryptToken(token, password);
    const entry = { uid: crypto.randomUUID(), label, role, ...(integrante ? { integrante } : {}), ...encrypted };
    const updated = { tokens: [...(fresh.content?.tokens || []), entry] };
    await putFile(CONFIG.authPath, updated, fresh.sha, `admin: adiciona acesso "${label}" (${role})`);
    toast(`Acesso de "${label}" adicionado.`, "ok");
    labelInput.value = "";
    tokenInput.value = "";
    passwordInput.value = "";
    roleInput.value = "colaborador";
    memberInput.value = "";
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
    if (tokens.length > 0 && !tokens.some((t) => roleOf(t) === "admin")) {
      throw new Error("precisa sobrar pelo menos um admin");
    }
    await putFile(CONFIG.authPath, { tokens }, fresh.sha, `admin: revoga acesso "${label}"`);
    toast(`Acesso de "${label}" revogado.`, "ok");
    await loadAccess();
  } catch (err) {
    toast(`Erro ao revogar: ${err.message}`, "error");
  }
}

async function changeAccessRole(index, label, select) {
  const role = select.value;
  select.disabled = true;
  try {
    const fresh = await getFile(CONFIG.authPath);
    const tokens = [...(fresh.content?.tokens || [])];
    if (!tokens[index] || tokens[index].label !== label) {
      throw new Error("a lista de acessos mudou — recarregue a página");
    }
    tokens[index] = { ...tokens[index], role };
    if (!tokens.some((t) => roleOf(t) === "admin")) {
      throw new Error("precisa sobrar pelo menos um admin");
    }
    await putFile(CONFIG.authPath, { tokens }, fresh.sha, `admin: muda categoria de "${label}" para ${role}`);
    toast(`"${label}" agora é ${ROLES[role].toLowerCase()}.`, "ok");
    await loadAccess();
  } catch (err) {
    toast(`Erro ao mudar categoria: ${err.message}`, "error");
    await loadAccess();
  }
}

// ----------------------------------------------------------------------------
// Dados de acesso: nome e senha de quem está logado (commita na hora)
// ----------------------------------------------------------------------------

function renderCurrentUser() {
  document.getElementById("user-btn").textContent = CURRENT_LABEL || "sem nome";
  document.getElementById("inicio-nome").textContent = CURRENT_LABEL ? `, ${CURRENT_LABEL.split(/\s+/)[0]}` : "";
  const member = CURRENT_INTEGRANTE && contentData.members?.find((m) => m.id === CURRENT_INTEGRANTE);
  document.getElementById("account-integrante").value = member
    ? `${member.name} (${member.id})`
    : CURRENT_INTEGRANTE || "nenhum — peça ao admin para ligar seu acesso a um integrante";
  resetAccountForm();
}

// Volta "Dados de acesso" ao estado inicial: nome travado, campos de senha
// e confirmação escondidos e vazios.
function resetAccountForm() {
  const labelInput = document.getElementById("account-label");
  labelInput.value = CURRENT_LABEL;
  labelInput.disabled = true;
  document.getElementById("account-edit-label").hidden = false;
  document.getElementById("account-edit-password").hidden = false;
  document.getElementById("account-password-fields").hidden = true;
  document.getElementById("account-confirm").hidden = true;
  for (const id of ["account-new-password", "account-confirm-password", "account-current-password"]) {
    document.getElementById(id).value = "";
  }
}

async function saveAccount() {
  const labelInput = document.getElementById("account-label");
  const newInput = document.getElementById("account-new-password");
  const confirmInput = document.getElementById("account-confirm-password");
  const currentInput = document.getElementById("account-current-password");
  const submit = document.getElementById("account-submit");

  const label = labelInput.value.trim();
  const newPassword = newInput.value;
  if (!label) {
    toast("O nome não pode ficar vazio.", "error");
    return;
  }
  if (newPassword !== confirmInput.value) {
    toast("As duas novas senhas não são iguais.", "error");
    return;
  }
  if (label === CURRENT_LABEL && !newPassword) {
    toast("Nada mudou.", "error");
    return;
  }
  if (!currentInput.value) {
    toast("Digite a senha atual para confirmar.", "error");
    return;
  }

  submit.disabled = true;
  try {
    const fresh = await getFile(CONFIG.authPath);
    const tokens = [...(fresh.content?.tokens || [])];
    const index = tokens.findIndex((t) => t.salt === CURRENT_SALT);
    if (index === -1) throw new Error("seu acesso não está mais no auth.json — recarregue a página");
    if ((await decryptToken(tokens[index], currentInput.value)) !== TOKEN) {
      throw new Error("senha atual incorreta");
    }

    let entry = { ...tokens[index], uid: uidOf(tokens[index]), label };
    if (newPassword) {
      // O login usa o primeiro registro que a senha abre — duas pessoas com
      // a mesma senha entrariam uma na conta da outra.
      for (const [i, other] of tokens.entries()) {
        if (i !== index && (await decryptToken(other, newPassword))) {
          throw new Error("essa senha já é usada por outro acesso");
        }
      }
      entry = { ...entry, ...(await encryptToken(TOKEN, newPassword)) };
    }
    tokens[index] = entry;
    await putFile(CONFIG.authPath, { tokens }, fresh.sha, `admin: atualiza dados de acesso de "${label}"`);

    CURRENT_SALT = entry.salt;
    CURRENT_LABEL = label;
    renderCurrentUser();
    toast("Dados de acesso atualizados.", "ok");
    if (ROLE === "admin") await loadAccess();
  } catch (err) {
    toast(`Erro ao salvar: ${err.message}`, "error");
  } finally {
    submit.disabled = false;
  }
}

// ----------------------------------------------------------------------------
// Início
// ----------------------------------------------------------------------------

init();
