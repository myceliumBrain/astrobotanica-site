// ============================================================================
// paginas-md.js — páginas de texto do site (Sobre, Expediente, Política
// Editorial…) em src/content/paginas/<lang>/<slug>.md, editadas no painel.
//
// O corpo continua em Markdown: o painel converte Markdown → HTML para o
// editor e HTML → Markdown na hora de salvar. A conversão cobre o que essas
// páginas usam: parágrafos, subtítulos (## e ###), negrito, itálico, links
// (inclusive endereços soltos, como o GitHub/Astro fazem), listas com marcador
// ou numeradas e tabelas. Abrir e salvar sem mexer gera o mesmo arquivo, byte
// a byte, e o painel só grava as páginas que mudaram.
// ============================================================================

import { load, CORE_SCHEMA } from "./vendor/js-yaml.mjs";

export const PASTA_PAGINAS = "src/content/paginas";

export function caminhoPagina(lang, slug) {
  return `${PASTA_PAGINAS}/${lang}/${slug}.md`;
}

/** Slug de uma página a partir do caminho do arquivo (…/pt/sobre.md → sobre). */
export function slugDoCaminho(caminho) {
  return caminho.split("/").pop().replace(/\.md$/, "");
}

const CAMPOS = ["title", "description", "lang", "updated"];

/** { campos, corpo } de um arquivo .md de página. `corpo` é Markdown. */
export function lerPagina(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(texto);
  if (!m) throw new Error("arquivo sem front matter (--- … ---)");
  const campos = load(m[1], { schema: CORE_SCHEMA }) ?? {};
  if (typeof campos !== "object" || Array.isArray(campos)) throw new Error("front matter inválido");
  // Uma linha em branco entre o front matter e o texto, e uma quebra no fim.
  return { campos, corpo: m[2].replace(/^\r?\n/, "").replace(/\r?\n$/, "") };
}

/** Texto do arquivo .md. Campos que o painel não conhece vão no fim, como estavam. */
export function montarPagina(campos, corpo) {
  const linhas = ["---"];
  const chaves = [...CAMPOS, ...Object.keys(campos).filter((k) => !CAMPOS.includes(k))];
  for (const k of chaves) {
    const v = campos[k];
    if (v === undefined) continue;
    linhas.push(`${k}: ${typeof v === "string" || v === null ? JSON.stringify(v ?? "") : JSON.stringify(v)}`);
  }
  linhas.push("---");
  return `${linhas.join("\n")}\n\n${corpo}\n`;
}

// ----------------------------------------------------------------------------
// Markdown → HTML
// ----------------------------------------------------------------------------

const escaparHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escaparAtributo = (s) => escaparHtml(s).replace(/"/g, "&quot;");

// Posição do "]" que fecha o "[" em `ini`, contando colchetes aninhados.
function fechaColchete(texto, ini) {
  let nivel = 0;
  for (let i = ini; i < texto.length; i++) {
    if (texto[i] === "\\") i++;
    else if (texto[i] === "[") nivel++;
    else if (texto[i] === "]" && --nivel === 0) return i;
  }
  return -1;
}

// Endereço solto (https://…): a pontuação final fica fora do link, como no GFM.
function enderecoSolto(texto, i) {
  if (i > 0 && /[\w/]/.test(texto[i - 1])) return null;
  const m = /^https?:\/\/[^\s<]+/.exec(texto.slice(i));
  if (!m) return null;
  let url = m[0];
  while (/[.,:;!?"'*_~]$/.test(url) || (url.endsWith(")") && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length)) {
    url = url.slice(0, -1);
  }
  return url;
}

function inline(texto) {
  let html = "";
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (c === "\\" && /[!-/:-@[-`{-~]/.test(texto[i + 1] || "")) {
      html += escaparHtml(texto[i + 1]);
      i += 2;
      continue;
    }
    if (texto.startsWith("**", i)) {
      const fim = texto.indexOf("**", i + 2);
      if (fim > i + 2) {
        html += `<strong>${inline(texto.slice(i + 2, fim))}</strong>`;
        i = fim + 2;
        continue;
      }
    }
    if ((c === "*" || c === "_") && texto[i + 1] && texto[i + 1] !== " " && (c === "*" || i === 0 || !/\w/.test(texto[i - 1]))) {
      const fim = texto.indexOf(c, i + 1);
      if (fim > i + 1 && texto[fim - 1] !== " " && (c === "*" || !/\w/.test(texto[fim + 1] || ""))) {
        html += `<em>${inline(texto.slice(i + 1, fim))}</em>`;
        i = fim + 1;
        continue;
      }
    }
    if (c === "[") {
      const fim = fechaColchete(texto, i);
      if (fim !== -1 && texto[fim + 1] === "(") {
        const fimUrl = texto.indexOf(")", fim + 2);
        if (fimUrl !== -1) {
          const url = texto.slice(fim + 2, fimUrl).trim();
          html += `<a href="${escaparAtributo(url)}">${inline(texto.slice(i + 1, fim))}</a>`;
          i = fimUrl + 1;
          continue;
        }
      }
    }
    if (c === "<") {
      const tag = /^<\/?[a-zA-Z][^<>]*>/.exec(texto.slice(i));
      if (tag) {
        html += tag[0];
        i += tag[0].length;
        continue;
      }
    }
    if (c === "h") {
      const url = enderecoSolto(texto, i);
      if (url) {
        html += `<a href="${escaparAtributo(url)}">${escaparHtml(url)}</a>`;
        i += url.length;
        continue;
      }
    }
    html += escaparHtml(c);
    i++;
  }
  return html;
}

const RE_TITULO = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_ITEM = /^[-*+]\s+(.*)$/;
const RE_ITEM_NUM = /^(\d+)[.)]\s+(.*)$/;
const RE_LINHA_TABELA = /^\s*\|/;
const RE_SEPARADOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function celulas(linha) {
  const s = linha.trim().replace(/^\|/, "").replace(/\|$/, "");
  const partes = [];
  let atual = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      atual += "|";
      i++;
    } else if (s[i] === "|") {
      partes.push(atual.trim());
      atual = "";
    } else atual += s[i];
  }
  partes.push(atual.trim());
  return partes;
}

const iniciaBloco = (linha, seguinte) =>
  RE_TITULO.test(linha) || RE_ITEM.test(linha) || RE_ITEM_NUM.test(linha) || (RE_LINHA_TABELA.test(linha) && RE_SEPARADOR.test(seguinte || ""));

export function markdownParaHtml(md) {
  const linhas = (md || "").split(/\r?\n/);
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.trim()) {
      i++;
      continue;
    }
    const titulo = RE_TITULO.exec(linha);
    if (titulo) {
      const n = titulo[1].length;
      blocos.push(`<h${n}>${inline(titulo[2])}</h${n}>`);
      i++;
      continue;
    }
    if (RE_LINHA_TABELA.test(linha) && RE_SEPARADOR.test(linhas[i + 1] || "")) {
      const cab = celulas(linha);
      i += 2;
      const corpo = [];
      while (i < linhas.length && RE_LINHA_TABELA.test(linhas[i])) corpo.push(celulas(linhas[i++]));
      const tr = (cs, tag) => `<tr>\n${cab.map((_, k) => `<${tag}>${inline(cs[k] ?? "")}</${tag}>`).join("\n")}\n</tr>`;
      blocos.push(
        `<table>\n<thead>\n${tr(cab, "th")}\n</thead>` + (corpo.length ? `\n<tbody>\n${corpo.map((cs) => tr(cs, "td")).join("\n")}\n</tbody>` : "") + "\n</table>"
      );
      continue;
    }
    for (const [re, tag, grupo] of [[RE_ITEM, "ul", 1], [RE_ITEM_NUM, "ol", 2]]) {
      if (!re.test(linha)) continue;
      const itens = [];
      const inicio = tag === "ol" ? Number(RE_ITEM_NUM.exec(linha)[1]) : 1;
      while (i < linhas.length && re.test(linhas[i])) {
        let texto = re.exec(linhas[i])[grupo];
        i++;
        // Continuação do item: linha recuada logo abaixo.
        while (i < linhas.length && /^\s{2,}\S/.test(linhas[i]) && !iniciaBloco(linhas[i].trim())) texto += "\n" + linhas[i++].trim();
        itens.push(`<li>${inline(texto)}</li>`);
      }
      const abre = tag === "ol" && inicio !== 1 ? `<ol start="${inicio}">` : `<${tag}>`;
      blocos.push(`${abre}\n${itens.join("\n")}\n</${tag}>`);
      break;
    }
    if (i < linhas.length && linhas[i] === linha) {
      const partes = [linha];
      i++;
      while (i < linhas.length && linhas[i].trim() && !iniciaBloco(linhas[i], linhas[i + 1])) partes.push(linhas[i++]);
      blocos.push(`<p>${inline(partes.map((p) => p.trim()).join("\n"))}</p>`);
    }
  }
  return blocos.join("\n");
}

// ----------------------------------------------------------------------------
// HTML (do editor) → Markdown
// ----------------------------------------------------------------------------

function escaparTexto(texto) {
  return texto.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/(^|\W)_|_(?=\W|$)/g, (m) => m.replace("_", "\\_"));
}

function inlineMd(no, emTabela) {
  let md = "";
  for (const filho of no.childNodes) {
    if (filho.nodeType === 3) {
      let t = escaparTexto(filho.nodeValue);
      if (emTabela) t = t.replace(/\|/g, "\\|").replace(/\n/g, " ");
      md += t;
      continue;
    }
    if (filho.nodeType !== 1) continue;
    const tag = filho.tagName.toLowerCase();
    const dentro = inlineMd(filho, emTabela);
    if (tag === "strong" || tag === "b") md += dentro.trim() ? `**${dentro}**` : dentro;
    else if (tag === "em" || tag === "i") md += dentro.trim() ? `*${dentro}*` : dentro;
    else if (tag === "a") {
      const href = filho.getAttribute("href") || "";
      md += href && filho.textContent === href && /^https?:\/\//.test(href) ? href : href ? `[${dentro}](${href})` : dentro;
    } else if (tag === "br") md += emTabela ? " " : "<br>";
    else md += dentro;
  }
  return md;
}

// Início de linha que o Markdown leria como outra coisa (título, lista,
// tabela): vai escapado.
const protegerInicio = (md) => md.replace(/^(#|[-+*]\s|\d+[.)]\s|\|)/, (m) => (/^\d/.test(m) ? m.replace(/([.)])/, "\\$1") : `\\${m}`));

export function htmlParaMarkdown(raiz) {
  const blocos = [];
  let soltos = null; // texto/inline direto na raiz vira um parágrafo
  const fecharSoltos = () => {
    if (soltos && soltos.textContent.trim()) blocos.push(protegerInicio(inlineMd(soltos).trim()));
    soltos = null;
  };
  for (const no of [...raiz.childNodes]) {
    const tag = no.nodeType === 1 ? no.tagName.toLowerCase() : "";
    const ehBloco = /^(p|div|h[1-6]|ul|ol|table|blockquote)$/.test(tag);
    if (!ehBloco) {
      if (!soltos) soltos = raiz.ownerDocument.createElement("div");
      soltos.appendChild(no.cloneNode(true));
      continue;
    }
    fecharSoltos();
    if (/^h[1-6]$/.test(tag)) {
      const texto = inlineMd(no).trim();
      if (texto) blocos.push(`${"#".repeat(Number(tag[1]))} ${texto}`);
    } else if (tag === "ul" || tag === "ol") {
      const inicio = Number(no.getAttribute("start") || 1);
      const itens = [...no.children].filter((li) => li.tagName === "LI" && li.textContent.trim());
      if (itens.length) {
        blocos.push(itens.map((li, k) => `${tag === "ol" ? `${inicio + k}.` : "-"} ${inlineMd(li).trim().replace(/\n/g, "\n  ")}`).join("\n"));
      }
    } else if (tag === "table") {
      const linhas = [...no.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => inlineMd(c, true).trim()));
      if (linhas.length) {
        const n = Math.max(...linhas.map((l) => l.length));
        const linha = (cs) => `| ${Array.from({ length: n }, (_, k) => cs[k] ?? "").join(" | ")} |`;
        blocos.push([linha(linhas[0]), `|${"---|".repeat(n)}`, ...linhas.slice(1).map(linha)].join("\n"));
      }
    } else {
      const texto = inlineMd(no).trim();
      if (texto) blocos.push(protegerInicio(texto));
    }
  }
  fecharSoltos();
  return blocos.join("\n\n");
}
