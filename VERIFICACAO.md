# Verificação da branch `migracao-ssg`

Data: 2026-10-31 · commit verificado: `40d8fb4` · build: `npm run build` (Astro 7.4.1, Node 22.23.1).
Nada foi corrigido durante a verificação. As correções sugeridas estão no fim e
dependem da sua aprovação.

## Resumo

| # | Item | Resultado |
|---|---|---|
| 1 | Build sem erros e sem avisos relevantes | **OK** (13 avisos, nenhum relevante) |
| 2 | Todas as URLs do INVENTARIO.md respondem | **OK** (137/137) |
| 3 | Nenhum link interno quebrado; nenhuma imagem faltando | **OK** (1.802 referências) |
| 4 | CNAME na saída do build com "astrobotanica.com.br" | **OK** |
| 5 | Texto visível sem JavaScript no HTML gerado | **OK** (49 páginas) |
| 6 | rss.xml e sitemap.xml válidos | **FALHA** (sitemap fora do schema; rss sem `length` no enclosure) |
| 7 | Lighthouse em início, notícia e Política Editorial | **FALHA** (notícia abaixo de 90 em performance e acessibilidade) |
| 8 | Funciona em tela de celular | **FALHA** (tabela do Expediente passa da largura da tela) |

---

## 1. Build — OK

- `npm run build` termina com código 0 e gera 49 páginas.
- 0 erros.
- 13 avisos, todos `[WARN] [content] Entry paginas → en/<página> was not found`
  (expediente, normas-para-colaboradores, politica-editorial, sobre). Vêm das
  buscas pela versão EN das páginas institucionais que ainda não existem, usadas
  de propósito para decidir hreflang, sitemap e página provisória. Não indicam
  problema, mas poluem o log e podem esconder um aviso real no futuro (ver
  correção C6).

## 2. URLs do inventário — OK

`node scripts/migracao/verificar-urls.mjs _site`: **137/137 URLs OK** e 15/15
checagens extras OK. A tabela completa, URL por URL, está em
`scripts/migracao/relatorio-urls.md`.

- Páginas `/x` e `/x.html`, pastas com e sem barra, `/artigo/noticia-N/` (com
  og-image), feeds, robots, CNAME e mídia dos feeds respondem 200 (ou 301 para a
  versão com barra, como no Pages).
- `/noticia?id=`, `/episodio?id=` e `/estudo?slug=` (31 variantes) chegam à
  página de redirecionamento, e o destino de cada id existe.
- **Ressalva:** 15 dessas URLs ainda respondem com página provisória (início,
  notícias, podcast, estudos, contato e variantes). Respondem, mas o conteúdo é
  da Fase 4.

## 3. Links internos e imagens — OK

Script que lê todo HTML do build (fora `/admin/`) e o CSS e resolve cada
referência como o GitHub Pages:

- 1.802 referências internas conferidas (1.464 `<a>`, 231 `<link>`, 105 `<img>`,
  2 `<source>` de áudio), além dos `url(...)` do CSS. **Nenhuma quebrada.**
- Âncoras internas (`#id`) também conferidas: todas existem.
- `scripts/migracao/verificar-conteudo.mjs`: corpos das notícias idênticos ao
  JSON e todas as imagens dos corpos existem.
- Fora do escopo: links externos (31 domínios: nature.com, nasa.gov etc.) não
  foram testados. Os links das redes sociais no rodapé apontam só para o
  domínio (`www.youtube.com`, `www.facebook.com`, `www.bluesky.com`), não para
  um perfil: é o que está cadastrado no painel.

## 4. CNAME — OK

`_site/CNAME` existe, contém exatamente `astrobotanica.com.br` (20 bytes, sem
quebra de linha) e é idêntico byte a byte ao `CNAME` da raiz, que não foi
alterado.

## 5. Texto visível sem JavaScript — OK

Verificação só no HTML gerado (scripts removidos, sem navegador), página por
página:

| Tipo | Páginas | Conferido | Resultado |
|---|---|---|---|
| Notícias PT e EN | 23 | `<h1>` e o **texto inteiro do corpo** (do Markdown) presentes no HTML | OK |
| Episódios | 2 | todos os parágrafos da transcrição no HTML (aberta; o JS só recolhe) | OK |
| Institucionais com texto | 6 | todos os trechos do Markdown presentes no HTML | OK |
| Provisórias | 13 | `<h1>` e aviso de página provisória | OK, mas sem conteúdo (Fase 4) |
| 404 | 1 | `<h1>` e texto | OK |
| Redirecionamento | 3 | link visível e `<noscript>` com meta refresh | OK, mas sem JS o destino é a lista, não o item |

Nenhuma página tem resto de `data-text` (texto preenchido por JS no site
antigo) nem contêiner vazio esperando JS.

**Observação:** o processador de Markdown troca aspas retas por curvas nas
páginas institucionais (`"[nome do projeto]"` → `“[nome do projeto]”` em Sobre;
também em Privacidade e na Privacidade EN). O texto continua visível, mas não é
idêntico ao que você colou. As notícias **não** são afetadas: o corpo é HTML
inserido sem processamento. Ver correção C7.

## 6. rss.xml e sitemap.xml — FALHA

| Arquivo | XML bem-formado | Validação de estrutura | Resultado |
|---|---|---|---|
| `rss.xml` | OK (xmllint) | 14 itens com title, link, guid único, pubDate RFC 822 válida, category, description, `content:encoded` com o texto completo e `atom:link rel="self"`. **Mas os 14 `<enclosure>` não têm o atributo `length`, que a especificação RSS 2.0 exige** (o validador do W3C acusa como erro). | **FALHA** |
| `sitemap.xml` | OK (xmllint) | Contra o XSD oficial (`sitemaps.org/schemas/sitemap/0.9`) mais a declaração do `xhtml:link`: **30 entradas inválidas**. Em cada `<url>` com hreflang, os `<xhtml:link>` vêm logo depois do `<loc>`, e o schema exige `loc`, `lastmod`, `changefreq` antes de elementos de outro namespace. Movendo os `<xhtml:link>` para o fim de cada `<url>`, o mesmo arquivo valida. | **FALHA** |
| `podcast.xml` (extra) | OK | 2 itens com guid, pubDate, enclosure com `length`, campos iTunes | OK |

- O erro do RSS é **herdado**: o `rss.xml` no ar hoje também não tem `length`.
  Mantive o formato idêntico de propósito.
- O erro do sitemap é **novo** (meu). Na prática o Google costuma aceitar, mas
  pelo schema é inválido.
- O W3C Feed Validator online não foi usado, para não enviar conteúdo a um
  serviço externo. A validação foi local: xmllint, o XSD oficial e as regras da
  especificação.

## 7. Lighthouse — FALHA

Lighthouse 13.5.0 com Chrome headless, perfis **celular** (padrão: CPU e rede
lentas simuladas) e **desktop**. Servidor local que imita o GitHub Pages: gzip,
`Cache-Control: max-age=600`, URLs limpas. As notas de performance em produção
podem variar: CDN, HTTP/2 e um aviso de "CPU mais lenta que o esperado" nesta
máquina. Critério usado: **OK com 90 ou mais em todas as categorias.**

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | Resultado |
|---|---|---|---|---|---|---|
| Início `/` | celular | 93 | 95 | 96 | 100 | OK |
| Início `/` | desktop | 99 | 95 | 96 | 100 | OK |
| Notícia `/artigo/noticia-14/` | celular | **69** | **87** | 96 | 92 | **FALHA** |
| Notícia `/artigo/noticia-14/` | desktop | 94 | **89** | 96 | 92 | **FALHA** |
| Política Editorial | celular | 90 | 95 | 96 | 100 | OK (no limite) |
| Política Editorial | desktop | 99 | 96 | 96 | 100 | OK |

A página inicial ainda é **provisória** (só título e aviso), então a nota dela
diz pouco sobre a home de verdade.

**Comparação com o site atual** (mesmo servidor, mesmas condições):

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|---|---|
| Notícia atual `/artigo/noticia-14/` | celular | 68 | 82 | 77 | 92 |
| Notícia nova | celular | 69 | 87 | 96 | 92 |
| Notícia atual | desktop | 70 | 85 | 77 | 92 |
| Notícia nova | desktop | 94 | 89 | 96 | 92 |

A notícia nova é igual ou melhor que a atual em todas as categorias, mas ainda
não chega a 90.

**O que derruba as notas** (problema → páginas → origem):

| Problema | Onde | Origem |
|---|---|---|
| **LCP de 7,9 s no celular.** Imagens pesadas: o Lighthouse estima 931 KiB de economia na notícia 14 (PNG/JPG originais, sem redimensionar; a capa é servida no tamanho original). | notícia | imagens enviadas pelo painel, herdado |
| Google Fonts bloqueando a renderização (estimativa de 0,8 a 1,8 s no celular) | todas | `<link>` das fontes, herdado |
| Contraste insuficiente: cor `--ink-faint` #939394 sobre branco (3,06:1) no rodapé, datas, legenda da capa e aviso "página provisória" | todas | paleta do `css/style.css`, herdado |
| Contraste insuficiente: links das referências em #7fad8b (2,54:1) | notícia | `css/style.css`, herdado |
| Contraste insuficiente: títulos das caixas "Fonte original" / "Como citar" (#8d8e8d sobre #f4f4f2, 2,98:1) e nota de licença | notícia | **novo** (meu componente) |
| 5 imagens sem `alt` | notícia 14 | **corpo da notícia** (conteúdo) |
| Ordem de títulos: `h1` seguido de `h3` | notícia 14 | **corpo da notícia** (conteúdo) |
| Erro no console: `/favicon.ico` 404 | todas | o site não tem favicon, herdado |

## 8. Tela de celular — FALHA

Chrome com celular simulado (375×812, toque, densidade 2), 11 páginas: início,
3 notícias (PT e EN), Política Editorial, Expediente, Sobre, Privacidade,
episódio, notícias, 404.

| Checagem | Resultado |
|---|---|
| Meta viewport (`width=device-width, initial-scale=1.0`) | OK em todas |
| Rolagem horizontal | **FALHA em `/expediente`**: a tabela passa 35 px da tela (vai até 410 px numa tela de 375) e o texto da coluna da direita aparece cortado. Nas outras 10 páginas: 0 px. |
| Menu do celular (botão ☰) | OK em todas: abre com os 5 itens e o seletor de idioma, e fecha |
| Capas, imagens do corpo, player de áudio, caixas Fonte/Como citar | OK (conferido nas capturas) |
| Texto pequeno | etiquetas, datas e rodapé com 11,5 px e rótulo do player com 10,9 px; legível, mas abaixo de 12 px. Herdado do `css/style.css`. |

Causa do Expediente: a primeira coluna da tabela tem `white-space: nowrap` (meu
estilo em `PaginaInstitucional.astro`) e a tabela não tem rolagem própria.

**Observação (conteúdo):** na notícia 14 aparecem asteriscos literais
(`**o regolito lunar pode, sim, ...**`). Eles já estão assim no
`data/articles.json`, no ar hoje, e foram preservados porque o conteúdo não
pode ser reescrito.

---

## Correções sugeridas (nenhuma aplicada)

| # | Correção | Resolve | Mexe em conteúdo? |
|---|---|---|---|
| C1 | Sitemap: escrever `<xhtml:link>` depois de `lastmod`/`changefreq` | 6 | não |
| C2 | RSS: adicionar `length` (tamanho do arquivo em bytes) aos `<enclosure>`; guid e itens continuam iguais | 6 | não |
| C3 | Expediente: deixar a tabela quebrar linha no celular (tirar o `nowrap`) ou dar rolagem horizontal própria à tabela | 8 | não |
| C4 | Contraste das caixas "Fonte original"/"Como citar" e da nota de licença: usar `--ink-dim` em vez de `--ink-faint` | 7 | não |
| C5 | Capa da notícia: servir uma versão redimensionada (como a og-image), com `width`/`height` | 7 (LCP) | não (o arquivo original fica) |
| C6 | Silenciar os 13 avisos do build (checar a existência da versão EN sem `getEntry`) | 1 | não |
| C7 | Desligar a troca automática de aspas do Markdown (`smartypants: false`), para o texto institucional sair idêntico ao colado | 5 | não (deixa o texto **mais** fiel) |

**Precisam de decisão sua:**

- **D1 — Paleta:** escurecer `--ink-faint` (#939394 → algo como #6b6b6c) e a
  cor dos links das referências. Corrige o contraste no site inteiro, mas muda a
  identidade visual atual.
- **D2 — Favicon:** criar um ícone. O site não tem logo; pode ser provisório.
- **D3 — Fontes:** hospedar Barlow e IBM Plex no próprio site em vez de puxar do
  Google Fonts. Melhora a performance e tira o envio de IPs ao Google; a página
  de Privacidade teria que ser atualizada.
- **D4 — Imagens do corpo:** recomprimir os arquivos em `images/noticias/`
  (mesmos nomes e URLs, arquivos menores). O texto das notícias não muda, mas
  os arquivos de imagem mudam.
- **D5 — Conteúdo das notícias:** `alt` das imagens, ordem dos títulos e
  asteriscos literais só podem ser corrigidos editando o corpo, o que a regra do
  repositório proíbe sem sua autorização expressa.

## Como foi verificado

- Itens 2, 4, 6 (parte): scripts do repositório `scripts/migracao/verificar-urls.mjs`
  e `verificar-conteudo.mjs`.
- Itens 3, 5, 6, 7 e 8: scripts temporários (links, texto sem JS, schema do
  sitemap, regras do RSS, Lighthouse 13.5.0, Chrome simulando celular), rodados
  fora do repositório. Capturas de tela e relatórios do Lighthouse ficaram numa
  pasta temporária, não versionada.

---

## Depois das correções (2026-10-31)

Correções C1 a C7 aplicadas, cada uma em um commit (`76777db` a `2866d02`).
Build, verificadores do repositório e checagens refeitos:

| # | Item | Antes | Depois |
|---|---|---|---|
| 1 | Build | OK, 13 avisos | **OK, 0 avisos** (C6) |
| 2 | URLs | OK | OK (137/137) |
| 3 | Links e imagens | OK | OK |
| 4 | CNAME | OK | OK |
| 5 | Texto sem JS | OK, aspas trocadas | **OK, texto idêntico ao Markdown** (C7); só as 4 páginas institucionais mudaram |
| 6 | rss.xml / sitemap.xml | FALHA | **OK**: sitemap valida no XSD oficial (C1); enclosures do RSS com `length` (C2) |
| 7 | Lighthouse | FALHA | **FALHA**, melhor: notícia 14 no celular 71/87/96/92 (LCP 7,9 s → 6,2 s), desktop 95/89/96/92 |
| 8 | Celular | FALHA | **OK**: 0 px de rolagem horizontal nas 11 páginas, inclusive Expediente (C3) |

O que ainda segura o item 7:

- **Performance no celular:** a capa agora chega em 0,1 s (C5: WebP de 640,
  960 e 1400 px com `srcset`; o original continua em `images/noticias/`). Os
  2,1 s restantes do LCP são **renderização bloqueada** pelo Google Fonts e pelo
  CSS → decisão D3. As imagens do corpo ainda são pesadas → decisão D4.
- **Acessibilidade 87–89:** o contraste dos elementos novos foi corrigido (C4:
  títulos das caixas, revisor, licença, cabeçalho da tabela, botão Copiar). O
  que resta é a paleta herdada (rodapé, datas, legenda, links das referências)
  → decisão D1; e `alt`/ordem de títulos no corpo da notícia → decisão D5.
- **Boas práticas 96:** falta o favicon → decisão D2.

---

## Decisões D1–D5 (2026-11-01)

| Decisão | O que foi feito |
|---|---|
| D1 — Paleta | `--ink-faint` de 48% para 64% da tinta; links e botão principal em `--accent-700` |
| D2 — Favicon | Provisório (broto verde) em `public/`: SVG, PNG 32 px e `apple-touch-icon` |
| D3 — Fontes | Barlow, Barlow Condensed e IBM Plex Mono em `public/fonts/` (Fontsource, OFL), no site e no `/admin`; Privacidade atualizada |
| D4 — Imagens do corpo | **Arquivos mantidos.** Na página da notícia elas ganham `loading="lazy"` (RSS e texto inalterados). Fotos de integrantes passam a ser servidas em miniatura WebP de 192 px |
| D5 — Conteúdo | **Mantido como publicado.** Eventuais ajustes estéticos ficam para o fim da migração |

Lighthouse (celular, preview local):

| Página | Performance | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|---|
| Início | 92 | 100 | 100 | 100 |
| Notícia 14 | 91 (LCP 3,1 s) | 92 | 100 | 92 |
| Sobre | 98 | 100 | 100 | 100 |

O que resta na notícia 14 (`image-alt`, `heading-order`) e no Expediente
(`heading-order`) vem do texto publicado, mantido por decisão (D5).

## Ensaio geral — Fase 10.1 (2026-11-02)

| Verificação | Resultado |
|---|---|
| `main` desde a criação da branch | Sem commits novos (14 notícias, 9 traduzidas) |
| `json-para-md.mjs` de novo | `.md` idênticos aos versionados |
| `verificar-conteudo.mjs` | 0 diferenças |
| Build | OK, sem avisos |
| `verificar-urls.mjs` | 137/137 URLs, 18/18 checagens extras |
| `verificar-seo.mjs` | OK (hreflang recíproco, seletor de idioma, pares do sitemap) |
| `/rss.xml` | Igual ao anterior, fora o `lastBuildDate` |
| Comparação visual (site no ar × build, 1280 px e 390 px) | Início, Notícias, notícia 13, Podcast, Estudos: iguais, com as mudanças previstas (paleta D1, autor e data na notícia) |

Encontrado e corrigido no ensaio: o link "RSS feed" do menu em Notícias e
Estudos tinha ficado de fora; voltou (nas páginas EN, para `/en/rss.xml`).

Diferença mantida: em Estudos, sem verbete publicado, o site novo mostra só
o aviso "Nenhum verbete publicado ainda", sem a caixa de busca vazia (ela
aparece quando houver verbetes).
