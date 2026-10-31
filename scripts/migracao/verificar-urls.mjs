// Confere se cada URL do site antigo (urls-atuais.txt) continua funcionando
// numa pasta de saída, resolvendo os caminhos como o GitHub Pages faz:
//   /x        → x (arquivo), senão x.html
//   /pasta    → 301 para /pasta/
//   /pasta/   → pasta/index.html
//   o resto   → 404 (servindo 404.html, se existir)
// A query string não chega ao servidor; nas páginas de redirecionamento
// (noticia.html etc.) o destino é calculado pela tabela embutida nelas, do
// mesmo jeito que o script da página faz no navegador.
//
// Além das URLs, confere: colisões x.html × pasta x/, sitemap.xml (todas as <loc> existem), robots.txt
// apontando para o sitemap, 404.html, CNAME, rss.xml/podcast.xml (mesmos
// guid do feed atual, texto completo no rss) e a cópia de images/ e audio/.
//
// Uso:
//   node scripts/migracao/verificar-urls.mjs [pasta] [--relatorio arquivo.md] [--so-urls]
// pasta padrão: _site. --so-urls pula as checagens extras (para rodar contra
// a raiz do repositório, que é o site antigo, e validar o próprio verificador).
// Sai com código 1 se algo falhar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE_URL = "https://astrobotanica.com.br";

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const relatorio = opcao("--relatorio");
const soUrls = args.includes("--so-urls");
const pasta = path.resolve(RAIZ, args.filter((a) => !a.startsWith("--"))[0] ?? "_site");

const ehArquivo = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
const ehPasta = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;

/** Resolve um caminho (sem query) como o GitHub Pages. */
function resolver(caminho) {
  const rel = decodeURIComponent(caminho).replace(/^\/+/, "");
  const alvo = path.join(pasta, rel);
  if (!alvo.startsWith(pasta)) return { status: 404 };
  if (caminho.endsWith("/")) {
    const indice = path.join(alvo, "index.html");
    return ehArquivo(indice) ? { status: 200, arquivo: indice } : { status: 404 };
  }
  if (ehArquivo(alvo)) return { status: 200, arquivo: alvo };
  if (ehPasta(alvo)) return { status: 301, local: `${caminho}/` };
  if (ehArquivo(`${alvo}.html`)) return { status: 200, arquivo: `${alvo}.html` };
  return { status: 404 };
}

/** Segue até 3 redirecionamentos 301. */
function abrir(url) {
  const u = new URL(url, BASE_URL);
  let caminho = u.pathname;
  const saltos = [];
  for (let i = 0; i < 4; i++) {
    const r = resolver(caminho);
    if (r.status !== 301) return { ...r, saltos, query: u.searchParams };
    saltos.push(r.local);
    caminho = r.local;
  }
  return { status: 310, saltos, query: u.searchParams };
}

const AVISO_PROVISORIO = "Página provisória";

/** Analisa uma página de redirecionamento e devolve os destinos (JS e sem JS). */
function destinosDoRedirecionamento(html, query) {
  const m = html.match(/<script type="application\/json" id="redirecionamentos">([\s\S]*?)<\/script>/);
  if (!m) return null;
  const tabela = JSON.parse(m[1]);
  const valor = query.get(tabela.parametro);
  const js = (valor && Object.hasOwn(tabela.destinos, valor) && tabela.destinos[valor]) || tabela.padrao;
  const refresh = html.match(/http-equiv="refresh" content="\d+;\s*url=([^"]+)"/)?.[1];
  return { js, refresh };
}

// ---------------------------------------------------------------------------
// URLs do site antigo
// ---------------------------------------------------------------------------

const urls = fs
  .readFileSync(path.join(RAIZ, "scripts/migracao/urls-atuais.txt"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const linhas = [];
let falhas = 0;

for (const url of urls) {
  const r = abrir(url);
  let status = r.saltos.length ? `301 → ${r.saltos.at(-1)} → ${r.status}` : String(r.status);
  let destino = "";
  let ok = r.status === 200;
  let obs = "";

  if (ok && r.arquivo.endsWith(".html")) {
    const html = fs.readFileSync(r.arquivo, "utf8");
    const red = destinosDoRedirecionamento(html, r.query);
    if (red) {
      const dJs = abrir(red.js);
      const dRefresh = red.refresh ? abrir(red.refresh) : null;
      destino = red.js;
      status = `200 (redirecionamento) → ${dJs.status}`;
      ok = dJs.status === 200 && dRefresh?.status === 200;
      obs = `sem JS: meta refresh → ${red.refresh ?? "ausente"}${dRefresh && dRefresh.status !== 200 ? ` (${dRefresh.status})` : ""}`;
      if (dJs.status === 200 && dJs.arquivo.endsWith(".html") && fs.readFileSync(dJs.arquivo, "utf8").includes(AVISO_PROVISORIO)) {
        obs += "; destino ainda é página provisória";
      }
    } else if (html.includes(AVISO_PROVISORIO)) {
      obs = "página provisória (conteúdo em fase posterior do plano)";
    }
  }
  if (!ok) falhas++;
  linhas.push({ url, status, destino, ok, obs });
}

// ---------------------------------------------------------------------------
// Checagens extras (só na saída do build)
// ---------------------------------------------------------------------------

const extras = [];
const checar = (nome, ok, detalhe = "") => {
  extras.push({ nome, ok, detalhe });
  if (!ok) falhas++;
};

const ler = (rel) => (ehArquivo(path.join(pasta, rel)) ? fs.readFileSync(path.join(pasta, rel), "utf8") : "");
const tags = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
const caminhoDe = (url) => (url.startsWith(BASE_URL) ? url.slice(BASE_URL.length) || "/" : null);

if (!soUrls) {
  // sitemap.xml
  const sitemap = ler("sitemap.xml");
  const locs = tags(sitemap, "loc");
  const alternativos = [...sitemap.matchAll(/<xhtml:link [^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const quebradas = [...new Set([...locs, ...alternativos])].filter((u) => abrir(caminhoDe(u) ?? "/__fora__").status !== 200);
  checar(
    "sitemap.xml: toda <loc> e <xhtml:link> existe",
    locs.length > 0 && quebradas.length === 0,
    `${locs.length} URLs${quebradas.length ? `; quebradas: ${quebradas.join(", ")}` : ""}`
  );
  const antigas = tags(fs.readFileSync(path.join(RAIZ, "sitemap.xml"), "utf8"), "loc");
  const faltando = antigas.filter((u) => !locs.includes(u));
  checar("sitemap.xml: contém as URLs do sitemap atual", faltando.length === 0, `${antigas.length} atuais${faltando.length ? `; faltando: ${faltando.join(", ")}` : ""}`);

  // robots.txt
  const robots = ler("robots.txt");
  checar("robots.txt aponta para o sitemap", /^Sitemap:\s*https:\/\/astrobotanica\.com\.br\/sitemap\.xml\s*$/m.test(robots));
  checar("robots.txt bloqueia /admin/", /^Disallow:\s*\/admin\/\s*$/m.test(robots));

  // 404 e CNAME
  const html404 = ler("404.html");
  checar("404.html própria existe (noindex)", html404.includes('name="robots" content="noindex"'));
  checar("CNAME idêntico ao da raiz", ler("CNAME") !== "" && ler("CNAME") === fs.readFileSync(path.join(RAIZ, "CNAME"), "utf8"));

  // rss.xml
  const rss = ler("rss.xml");
  const itens = tags(rss, "item");
  const guidsNovos = itens.map((i) => tags(i, "guid")[0]);
  const guidsAtuais = tags(fs.readFileSync(path.join(RAIZ, "rss.xml"), "utf8"), "guid");
  checar(
    "rss.xml: mesmos guid do feed atual, na mesma ordem",
    JSON.stringify(guidsNovos) === JSON.stringify(guidsAtuais),
    `${guidsNovos.length} itens (atual: ${guidsAtuais.length})`
  );
  const semTexto = itens.filter((i) => !/<content:encoded><!\[CDATA\[[\s\S]{200,}/.test(i)).length;
  checar("rss.xml: todo item traz o texto completo (content:encoded)", itens.length > 0 && semTexto === 0, semTexto ? `${semTexto} sem texto` : "");
  const linksRss = itens.map((i) => tags(i, "link")[0]).filter((u) => abrir(caminhoDe(u) ?? "/__fora__").status !== 200);
  checar("rss.xml: todo <link> existe", linksRss.length === 0, linksRss.join(", "));
  const imagensRss = [...rss.matchAll(/<enclosure url="([^"]+)"/g)].map((m) => m[1]);
  const imagensQuebradas = imagensRss.filter((u) => abrir(caminhoDe(u)).status !== 200);
  checar("rss.xml: todo <enclosure> existe", imagensQuebradas.length === 0, `${imagensRss.length} imagens`);
  const imgsCorpo = itens.flatMap((i) => [...i.matchAll(/src="(https:\/\/astrobotanica\.com\.br\/[^"]+)"/g)].map((m) => m[1]));
  const imgsCorpoQuebradas = imgsCorpo.filter((u) => abrir(caminhoDe(u)).status !== 200);
  checar("rss.xml: toda imagem do texto completo existe", imgsCorpoQuebradas.length === 0, `${imgsCorpo.length} imagens${imgsCorpoQuebradas.length ? `; quebradas: ${imgsCorpoQuebradas.join(", ")}` : ""}`);

  // podcast.xml
  const podcast = ler("podcast.xml");
  const guidsPodcast = tags(podcast, "guid");
  const guidsPodcastAtuais = tags(fs.readFileSync(path.join(RAIZ, "podcast.xml"), "utf8"), "guid");
  checar("podcast.xml: mesmos guid do feed atual", JSON.stringify(guidsPodcast) === JSON.stringify(guidsPodcastAtuais), guidsPodcast.join(", "));
  const linksPodcast = tags(podcast, "item").map((i) => tags(i, "link")[0]);
  checar("podcast.xml: todo <link> existe", linksPodcast.every((u) => abrir(caminhoDe(u)).status === 200), linksPodcast.join(", "));

  // x.html ao lado de uma pasta x/: o Pages manda /x para /x/ e a página
  // x.html deixa de responder pela URL limpa.
  const colisoes = [];
  for (const rel of fs.readdirSync(pasta, { recursive: true })) {
    if (rel.endsWith(".html") && ehPasta(path.join(pasta, rel.slice(0, -5)))) colisoes.push(rel);
  }
  checar("nenhum x.html ao lado de uma pasta x/", colisoes.length === 0, colisoes.join(", "));

  // images/ e audio/ copiados inteiros
  const naoCopiados = [];
  let total = 0;
  for (const dir of ["images", "audio"]) {
    for (const rel of fs.readdirSync(path.join(RAIZ, dir), { recursive: true })) {
      const origem = path.join(RAIZ, dir, rel);
      if (!ehArquivo(origem)) continue;
      total++;
      const copia = path.join(pasta, dir, rel);
      if (!ehArquivo(copia) || fs.statSync(copia).size !== fs.statSync(origem).size) naoCopiados.push(`${dir}/${rel}`);
    }
  }
  checar("images/ e audio/ copiados (mesmo tamanho)", naoCopiados.length === 0, `${total} arquivos${naoCopiados.length ? `; faltando: ${naoCopiados.join(", ")}` : ""}`);
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const esc = (s) => String(s).replace(/\|/g, "\\|");
let md = `# Verificação de URLs — ${path.relative(RAIZ, pasta) || "."}\n\n`;
md += `${urls.length} URLs de \`scripts/migracao/urls-atuais.txt\`: ${linhas.filter((l) => l.ok).length} OK, ${linhas.filter((l) => !l.ok).length} com falha.\n\n`;
md += "| URL antiga | Status no novo build | Destino | Resultado | Observação |\n|---|---|---|---|---|\n";
for (const l of linhas) {
  md += `| \`${esc(l.url)}\` | ${esc(l.status)} | ${l.destino ? `\`${esc(l.destino)}\`` : ""} | ${l.ok ? "OK" : "**FALHA**"} | ${esc(l.obs)} |\n`;
}
if (extras.length) {
  md += "\n## Checagens extras\n\n| Checagem | Resultado | Detalhe |\n|---|---|---|\n";
  for (const e of extras) md += `| ${esc(e.nome)} | ${e.ok ? "OK" : "**FALHA**"} | ${esc(e.detalhe)} |\n`;
}

if (relatorio) {
  fs.writeFileSync(path.resolve(RAIZ, relatorio), md);
  console.log(`Relatório salvo em ${relatorio}`);
}
for (const l of linhas.filter((x) => !x.ok)) console.log(`FALHA  ${l.url}  ${l.status}  ${l.obs}`);
for (const e of extras.filter((x) => !x.ok)) console.log(`FALHA  ${e.nome}  ${e.detalhe}`);
console.log(
  `URLs: ${linhas.filter((l) => l.ok).length}/${urls.length} OK` +
    (extras.length ? ` | checagens extras: ${extras.filter((e) => e.ok).length}/${extras.length} OK` : "") +
    (falhas ? ` | ${falhas} falha(s)` : " | tudo OK")
);
process.exit(falhas ? 1 : 0);
