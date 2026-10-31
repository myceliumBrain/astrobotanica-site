# Plano de migração — astrobotanica.com.br → Astro + GitHub Pages via Actions

Baseado em `INVENTARIO.md` (2026-10-31). **Nada deste plano foi executado.**
Todo o trabalho acontece na branch `migracao-ssg`. A `main` só muda na virada
(Fase 11), com o seu pedido explícito.

---

## 0. Decisão de ferramenta: Astro

**Recomendo seguir com Astro.** Para este site ele resolve, com recursos
nativos, quase todos os riscos do inventário:

| Necessidade | Como o Astro resolve |
|---|---|
| HTML completo sem JS | Gera HTML estático por padrão; JS só onde marcarmos |
| Manter `/podcast` **e** `/podcast.html` funcionando | `build.format: "preserve"`: `podcast.astro` → `podcast.html` e `artigo/[id]/index.astro` → `artigo/<id>/index.html`. É exatamente a disposição atual, então o Pages responde às mesmas variantes de hoje sem nenhum redirecionamento |
| Notícias em Markdown com front matter | Content Collections, com schema (zod) que **falha o build** se faltar campo ou o tipo estiver errado |
| `rss.xml`, `podcast.xml`, `sitemap.xml` nos mesmos endereços | Endpoints (`src/pages/rss.xml.ts` etc.) com XML escrito por nós, igual ao de hoje |
| og-image por notícia | `sharp` (já vem com o Astro) gera `/artigo/<id>/og-image.jpg` no mesmo caminho |
| Inglês com hreflang | Rotas `/en/...` geradas só para o que tiver tradução |
| Deploy grátis | Action oficial `withastro/action` + `actions/deploy-pages` (grátis em repositório público) |

Alternativas consideradas:
- **Eleventy**: também serviria bem e é mais simples, mas não tem validação
  de schema, e o "preserve" de URLs dá mais trabalho manual. Não compensa
  trocar a sua preferência.
- **Gerador em Python (Pelican etc.)**: evitaria instalar Node, mas a
  modelagem de i18n e de URLs fica pior. Não recomendo.

Custo do Astro: é preciso **instalar Node LTS nesta máquina** (hoje só há
Python). Sem isso, a regra "rodar o build antes de cada commit" não pode ser
cumprida.

---

## 1. Decisões tomadas (2026-10-31)

1. **Painel `/admin`: opção A.** O painel atual é adaptado para ler e gravar
   `src/content/noticias/{pt,en}/<id>.md`; episódios, integrantes, estudos e
   textos fixos continuam em JSON. As **edições pelo painel ficam congeladas**
   do ensaio final até a virada (Fases 10–11) e só voltam depois que o site
   novo estiver no ar.
2. **Inglês: o site inteiro.** Toda página pública ganha versão `/en/`,
   inclusive Podcast, Episódios e Estudos (ver seção 4 e Fase 5).
3. **Workflows: aprovado** criar `.github/workflows/deploy.yml` e remover
   `generate-seo.yml` na virada. A troca da fonte do Pages para "GitHub
   Actions" continua sendo **sua**, manual (Fase 11).
4. **Node instalado:** v22.23.1, npm 10.9.8.

**Pendente:** quem traduz o conteúdo que hoje não tem versão em inglês
(notícias 9, 10, 11, 12 e 14; os 2 episódios com transcrição; as descrições
das 4 categorias de estudo). Até haver tradução, esses itens seguem a regra
da seção 4.

---

## 2. Arquitetura proposta

```
site/                        (raiz do repositório)
├── CNAME                    ← continua aqui, intocado; copiado para a saída no build
├── images/  audio/          ← continuam na raiz (o painel grava aqui); copiados no build
├── css/style.css            ← reaproveitado sem alteração; continua em /css/style.css
├── robots.txt               ← copiado no build
├── admin/                   ← copiado no build (adaptado na Fase 8)
├── data/                    ← episodes, members, estudos, categorias, site(.en), pageviews: continuam JSON
├── src/
│   ├── content/noticias/pt/noticia-N.md   ← 14 arquivos
│   ├── content/noticias/en/noticia-N.md   ← 9 arquivos (só as traduzidas)
│   ├── content.config.ts                  ← schema das notícias
│   ├── layouts/Base.astro                 ← <head>, cabeçalho, nav, rodapé (fim da duplicação)
│   ├── components/…                       ← cards, lista de episódios, sidebar, compartilhar…
│   ├── pages/…                            ← uma página .astro por URL (ver Fase 4)
│   ├── lib/i18n.ts                        ← lê data/site.json e data/site.en.json
│   └── scripts/cliente.ts                 ← o que sobra de main.ts (só interatividade)
├── astro.config.mjs  package.json  package-lock.json
└── _site/                   ← saída do build (no .gitignore). Não usar dist/: hoje dist/ guarda o main.js antigo
```

Pontos-chave:
- **Nada é movido nem apagado** durante a migração. `images/`, `audio/`,
  `css/`, `robots.txt`, `admin/` e **`CNAME`** são copiados para `_site/`
  por uma integração de ~20 linhas no `astro.config.mjs` (hook
  `astro:build:done`). Assim o CNAME nunca sai do lugar e as URLs de mídia
  ficam idênticas.
- Os HTMLs antigos da raiz (`index.html`, `noticia.html`…), `artigo/`,
  `dist/main.js` e `scripts/generate_*.py` ficam no repositório até a
  limpeza (Fase 13, com a sua confirmação). Eles simplesmente não entram na
  saída do build.
- **Mesmas classes CSS** que `main.ts` gera hoje. Os componentes Astro
  reproduzem a mesma marcação (`.article-card`, `.article-card-split`,
  `.episode-row`, `.header-nav`…), para que o `style.css` funcione sem
  alteração. As fontes (Google Fonts) e as cores (`:root`) continuam como
  estão. O "logo" é o texto `brand.name` estilizado pelo CSS (não há imagem
  nem favicon), e passa a vir preenchido no HTML; hoje ele fica vazio sem JS.
- **i18next sai.** Os textos de `site.json`/`site.en.json` passam a ser
  aplicados no build. O CDN deixa de ser necessário.
- **JS no cliente vira só melhoria progressiva**: menu do celular, cabeçalho
  que se esconde, expandir transcrição, "copiar link" do Instagram, busca em
  `/estudos`. Os botões de compartilhar viram links gerados no build com a
  URL canônica.
- **GoatCounter** continua nas mesmas páginas de hoje (notícias e estudos),
  com o mesmo código, para não quebrar o ranking de "mais acessadas".

### Formato de uma notícia

`src/content/noticias/pt/noticia-13.md`:

```markdown
---
id: noticia-13
ordem: 2                      # posição no array original (1 = topo); preserva a ordem do site
title: "Cultivando Alimento no Espaço: …"
subtitle: "…"
category: "…"
author: "…"
authorAvatar: images/integrantes/integrante-pedro.jpeg
date: 2026-10-25
time: "12:39"
readingTime: "6 min"
image: images/noticias/noticia-13-imagem-principal.jpg
imageVertical: images/noticias/noticia-13-imagem-vertical.jpg
imageCaption: "…"
featured: false
references:
  - text: "…"
    url: "https://…"
---
<p>Corpo original, byte a byte igual ao campo "body" do JSON…</p>
```

`src/content/noticias/en/noticia-13.md` tem só os campos traduzidos (`title`,
`subtitle`, `category`, `imageCaption`, `readingTime`) e o `bodyEn` como
corpo. Os demais campos vêm do arquivo PT, pelo `id`.

**Sobre "não reescrever conteúdo":** o corpo das notícias é HTML. Convertê-lo
para sintaxe Markdown (`**negrito**`, `![img]()`) seria reescrever e arriscaria
perder formatação. HTML é Markdown válido, então o corpo vai para o `.md`
**exatamente como está** e é renderizado como HTML bruto (`set:html` sobre o
corpo cru), sem passar pelo processador de Markdown. Assim nada é
reinterpretado, nem o `<style>` estranho da `noticia-1`. Arquivos novos
escritos à mão podem usar Markdown normal; isso é decidido pelo campo
`formato: html | markdown` no front matter, com padrão `html` para as
migradas.

**Imagens do corpo** (`src="images/…"`, relativas): hoje só funcionam por
causa do `<base href="/">`. O layout da notícia mantém `<base href="/">` (o
mesmo comportamento de hoje), sem tocar no texto. Alternativa, se o `<base>`
atrapalhar: um transformador no build que prefixa `/` só no HTML de saída.

---

## 3. Mapa de URLs (antes → depois)

| URL atual | Depois da migração | Como |
|---|---|---|
| `/`, `/index.html` | igual | `pages/index.astro` → `index.html` |
| `/noticias`, `/noticias.html` | igual | `pages/noticias.astro` → `noticias.html` |
| `/podcast`, `/podcast.html` | igual | `pages/podcast.astro` |
| `/sobre`, `/sobre.html`, `/contato`, `/contato.html` | igual | `pages/sobre.astro`, `pages/contato.astro` |
| `/estudos`, `/estudos/`, `/estudos/index.html` | igual | `pages/estudos/index.astro` |
| `/estudos/<cat>/<verbete>/` | igual (gerado se houver verbetes) | `pages/estudos/[cat]/[slug]/index.astro` |
| `/artigo/noticia-N/` (14) | igual, agora com conteúdo no HTML | `pages/artigo/[id]/index.astro` |
| `/artigo/noticia-N` (sem barra) | igual (o Pages redireciona para a barra) | comportamento nativo |
| `/artigo/noticia-N/og-image.jpg` | igual | gerado com sharp (1200px, JPEG q82, como hoje) |
| `/noticia?id=X`, `/noticia.html?id=X` | **redireciona** para `/artigo/X/` | `noticia.html` vira página de redirecionamento (ver abaixo) |
| `/episodio?id=X`, `/episodio.html?id=X` | **redireciona** para `/podcast/X/` | idem, `episodio.html` |
| — (novo) | `/podcast/ep-01/`, `/podcast/ep-2/` | páginas estáticas de episódio, com transcrição no HTML |
| `/estudo?slug=X`, `/estudo.html?slug=X` | **redireciona** para `/estudos/<cat>/X/` | idem, `estudo.html` |
| `/rss.xml`, `/podcast.xml`, `/sitemap.xml`, `/robots.txt`, `/CNAME` | igual | endpoints/cópia |
| `/images/**`, `/audio/**`, `/css/style.css` | igual | cópia |
| `/admin/` | igual | cópia |
| — (novo) | `/404.html` | página de erro, que também redireciona padrões antigos que escaparem |

**Por que episódios ganham `/podcast/<id>/`, e não `/episodio/<id>/`:** uma
pasta `episodio/` ao lado de `episodio.html` é exatamente a colisão que o
código atual evita com `/artigo/`. O Pages não faz redirecionamento pelo
servidor e não enxerga query string, então `?id=` só pode ser tratado no
cliente.

**Páginas de redirecionamento** (`noticia.html`, `episodio.html`,
`estudo.html`): HTML mínimo com `<meta name="robots" content="noindex">` e um
script que lê `?id=` e faz `location.replace()` para a URL nova. A tabela
id → URL é gerada no build, então ids desconhecidos ou ausentes vão para o
mesmo destino de hoje (primeira notícia/episódio da lista; `/estudos` para
estudos). Um `<noscript>` mostra um link para a lista (`/noticias`,
`/podcast`, `/estudos`).

**Feeds:** o `guid` de cada item fica **idêntico**. Em `rss.xml` ele já é
`/artigo/<id>/`. Em `podcast.xml` continua sendo `/episodio?id=<id>` (só o
`<link>` passa a apontar para `/podcast/<id>/`), para que os apps de podcast
não dupliquem episódios.

---

## 4. Inglês e hreflang

### Páginas de seção: todas em EN
`/en/`, `/en/noticias`, `/en/podcast`, `/en/estudos`, `/en/sobre`,
`/en/contato`, mais as variantes `.html` e os redirecionamentos
`/en/noticia?id=`, `/en/episodio?id=`, `/en/estudo?slug=`. A interface
(nav, rodapé, títulos, rótulos, mensagens) vem de `data/site.en.json`. As 7
chaves que hoje só existem em PT (`social.*`, `socialLinks`,
`home.eventBanner*`) são nomes próprios e URLs: o EN reaproveita o valor PT.

### Páginas de item: EN quando o item tiver tradução
| Item | Campos EN | Situação hoje |
|---|---|---|
| Notícia | arquivo `src/content/noticias/en/<id>.md` | 9 de 14 traduzidas |
| Episódio | **novos** `titleEn`, `descriptionEn`, `transcriptEn` em `episodes.json` | 0 de 2 |
| Verbete | **novos** `tituloEn`, `definicaoCurtaEn`, `conteudoEn` em `estudos.json` | não há verbetes |
| Categoria de estudo | **novos** `nomeEn`, `descricaoEn` | 0 de 4 |
| Integrante | `descriptionEn` (já existe) | já preenchido |

- Item traduzido: ganha página EN (`/en/artigo/<id>/`, `/en/podcast/<id>/`,
  `/en/estudos/<cat>/<slug>/`), com hreflang.
- Item ainda sem tradução: **não** ganha página EN com texto em português.
  Nas listas EN (Home, Notícias, Podcast, Estudos) ele aparece com o título
  original e um selo "Portuguese only", com link para a página PT. Assim o
  site EN fica completo, nada some, e o Google não indexa página "EN" em
  português. Quando a tradução for preenchida no painel, a página EN passa a
  existir no build seguinte, sem mudança de código.
- Categorias sem `nomeEn` mostram o nome PT na listagem EN; a URL usa o
  mesmo `slug` nos dois idiomas, para não multiplicar URLs.

### Cabeçalho e seletor
- `<head>` de cada par PT/EN:
  ```html
  <link rel="alternate" hreflang="pt-BR" href="https://astrobotanica.com.br/artigo/noticia-1/" />
  <link rel="alternate" hreflang="en"    href="https://astrobotanica.com.br/en/artigo/noticia-1/" />
  <link rel="alternate" hreflang="x-default" href="https://astrobotanica.com.br/artigo/noticia-1/" />
  ```
  Páginas sem par (itens ainda não traduzidos) não levam hreflang. Mais:
  `<html lang>`, `og:locale` (`pt_BR`/`en_US`) e canonical próprios em cada
  idioma.
- O seletor 🇧🇷/🇺🇸 vira **link** para a página equivalente no outro idioma.
  Num item sem tradução, o 🇺🇸 leva para a lista EN da seção (ex.:
  `/en/noticias`), com um `title` explicando.
- Mudança de comportamento: hoje um visitante com navegador em inglês vê
  inglês automaticamente. Depois, entra em PT e escolhe. Redirecionar
  sozinho prejudica SEO; no máximo, um aviso discreto "Read in English" via
  JS quando existir par EN e o navegador for `en`.
- `sitemap.xml` inclui as URLs EN, com `xhtml:link` de alternância.
- `rss.xml` continua **idêntico e só PT** (mesmo endereço, mesmos GUIDs).
  Novo `/en/rss.xml` com as notícias traduzidas, linkado nas páginas EN.
  `podcast.xml` continua só PT: o áudio é em português.

---

## 5. Passos, em ordem

Cada passo termina com `npm run build` sem erros e um commit pequeno em
português na `migracao-ssg`. O verificador de URLs (passo 0.3) roda a partir
da Fase 4.

### Fase 0 — Preparação
**0.1** Criar a branch `migracao-ssg` a partir da `main` e commitar
`CLAUDE.md`, `INVENTARIO.md` e `PLANO-MIGRACAO.md`.
✔ Verificar: `git log main` sem commits novos; branch criada; nada enviado
ao remoto sem você pedir.

**0.2** ~~Instalar Node LTS~~: já instalado (v22.23.1).
✔ `node -v` ≥ 20, `npm -v`.

**0.3** Criar `scripts/migracao/urls-atuais.txt` (todas as URLs do
inventário, com as variantes `.html`, sem barra e `?id=`) e
`scripts/migracao/verificar-urls.mjs`, que sobe um servidor local imitando o
Pages sobre uma pasta (resolve `x` → `x.html`, `pasta` → `pasta/`) e checa
cada URL: status 200 e, nas páginas de redirecionamento, que o destino
existe.
✔ Rodado contra o site **atual** (raiz do repositório): 100% OK. Isso valida
o próprio verificador.

**0.4** Baixar uma cópia de referência do site no ar (HTML renderizado de
cada página com JS, mais screenshots desktop/celular) para comparação, em
pasta fora do repositório.
✔ Uma captura por URL da lista.

### Fase 1 — Esqueleto Astro
**1.1** `package.json`, `astro.config.mjs` (`site:
"https://astrobotanica.com.br"`, `build.format: "preserve"`, `outDir:
"_site"`, `trailingSlash: "ignore"`), integração de cópia (`CNAME`,
`images/`, `audio/`, `css/`, `robots.txt`, `admin/`), `.gitignore`
(`node_modules/`, `_site/`, `.astro/`).
✔ `npm run build` OK; `cmp CNAME _site/CNAME` idêntico; `_site/images` e
`_site/audio` com as mesmas contagens da raiz (86 e 2 arquivos).

**1.2** `Base.astro` com o `<head>`, cabeçalho, nav e rodapé atuais,
textos lidos de `data/site.json`; uma página de teste.
✔ O HTML de saída tem nav e rodapé preenchidos, visíveis com
`curl`/sem JS.

### Fase 2 — Notícias em Markdown
**2.1** `scripts/migracao/json-para-md.mjs`: lê `data/articles.json` e
escreve 14 `.md` PT e 9 `.md` EN. É **idempotente**: roda de novo na
Fase 10 com o JSON mais recente da `main`.
✔ 14 arquivos em `pt/`, 9 em `en/`.

**2.2** `content.config.ts` com o schema de todos os campos existentes.
✔ Build passa; alterar um campo de propósito faz o build falhar (testar e
desfazer).

**2.3** `scripts/migracao/verificar-conteudo.mjs`: relê cada `.md` e compara
**cada campo e o corpo, byte a byte**, com o JSON.
✔ 0 diferenças em 14 + 9 arquivos. Esta é a garantia da regra "conteúdo não
pode ser reescrito".

### Fase 3 — Componentes e visual
**3.1** Portar para componentes Astro, com a mesma marcação e as mesmas
classes, cada função de render do `main.ts`: card de notícia (3 variantes),
card dividido, linha de episódio, sidebar "Recentes/Mais acessadas", card de
autor, referências, compartilhar, card de integrante, card de verbete.

**3.2** `cliente.ts` com só a interatividade (overlay, auto-hide,
transcrição, Instagram, busca de estudos).
✔ Comparação lado a lado, `python3 serve.py` (atual) × `npm run preview`
(novo), em 1280px e 375px, para cada tipo de página: mesmas cores, fontes,
espaçamentos e quebras. Console sem erros.

### Fase 4 — Páginas em português
**4.1** `index` (com a lógica exata de `selectHomeItems`: até 6 destaques,
card dividido + 4 pôsteres + banner opcional + restante), `noticias`,
`artigo/[id]` (com `<head>` de SEO idêntico ao do `generate_seo.py`: title,
description com o mesmo resumo de 220 caracteres, canonical, OG, Twitter,
JSON-LD), `podcast`, `podcast/[id]`, `sobre`, `contato`, `estudos/index`,
`estudos/[cat]/[slug]`.
✔ Para cada página, `curl` sem JS mostra título, texto e imagens. A ordem
das notícias bate com a do JSON. O `<head>` das 14 notícias bate com o atual
(diff de `artigo/<id>/index.html` × `_site/artigo/<id>/index.html`, só no
`<head>`). "Mais acessadas" usa `data/pageviews.json`.

**4.2** og-image com sharp no mesmo caminho e com os mesmos parâmetros.
✔ 14 arquivos, largura ≤ 1200px, peso semelhante aos atuais.

### Fase 5 — Inglês (site inteiro)
**5.1** Todas as páginas de seção em `pages/en/…`, com o mesmo layout e os
textos de `site.en.json`.
✔ Cada URL PT de seção tem a equivalente EN (o verificador de URLs ganha a
lista EN); nenhuma chave de interface aparece em PT numa página EN, salvo os
nomes próprios listados na seção 4.

**5.2** Páginas EN de item (notícia, episódio, verbete) geradas só para
itens traduzidos; selo "Portuguese only" nas listas EN para os demais.
✔ Hoje: exatamente 9 páginas em `/en/artigo/`, 0 em `/en/podcast/<id>/`.
Nenhuma página de item EN contém corpo em português.

**5.3** Schema: campos EN opcionais em `episodes.json`, `estudos.json` e
`categorias_estudo.json`. Os campos ficam ausentes até alguém traduzir, e
nenhum texto existente é alterado.
✔ Build passa com os campos ausentes. Um teste temporário com `titleEn` num
episódio (desfeito depois) gera `/en/podcast/<id>/` e o hreflang do par.

**5.4** `/en/rss.xml`, hreflang e seletor de idioma por link.
✔ Os hreflang de cada par apontam um para o outro (script verifica
reciprocidade); `/en/rss.xml` válido no W3C Feed Validator depois do deploy;
validação manual no
[validador de hreflang](https://technicalseo.com/tools/hreflang/).

### Fase 6 — Feeds e sitemap
**6.1** `rss.xml.ts`: mesmo canal, mesmos 30 itens máx., mesma ordem,
mesmos `guid`, `pubDate`, `category`, `description` e `enclosure`.
✔ `diff` entre o `rss.xml` atual e `_site/rss.xml`, ignorando
`lastBuildDate`: **idêntico**.

**6.2** `podcast.xml.ts`: igual ao atual, salvo o `<link>` dos itens.
✔ `diff` mostra só essa mudança; `guid` iguais; `length` dos MP3 iguais.

**6.3** `sitemap.xml.ts`: as 20 URLs atuais, mais os episódios e as EN.
✔ Todas as `<loc>` existem em `_site/`; `robots.txt` continua apontando para
`/sitemap.xml`.

### Fase 7 — Compatibilidade de URLs
**7.1** `noticia.html`, `episodio.html`, `estudo.html` como páginas de
redirecionamento; `404.html`.
✔ `verificar-urls.mjs` contra `_site/`: **100% das URLs de
`urls-atuais.txt` OK**. Teste no navegador de `/noticia?id=noticia-3`,
`/episodio.html?id=ep-01` e `/noticia` (sem id).

### Fase 8 — Painel `/admin` (conforme decisão 1)
**8.1 (opção A)** Trocar, só no módulo de notícias do `admin.js`, a leitura
e a escrita de `articles.json` pela leitura e escrita dos `.md` (o commit de
vários arquivos de uma vez já existe via Git Data API). Reordenar = atualizar
`ordem`. EN vazio = remove o arquivo EN (com confirmação na UI).

**8.2** Painéis de Episódios e Estudos ganham a seção "Versão em inglês"
(mesmo padrão já usado nas notícias) para os novos campos EN.
`site.en.json` continua editado à mão, como hoje (fora do escopo, salvo
pedido seu).
✔ Num fork ou repositório de teste, nunca na `main`: criar, editar,
reordenar e traduzir uma notícia pelo painel; o build seguinte passa e a
página aparece certa; papéis admin/colaborador intactos.

### Fase 9 — Workflow de deploy (decisão 3)
**9.1** `.github/workflows/deploy.yml`: em `push` na `main`, em
`workflow_dispatch` e em **agendamento diário logo após o `pageviews.yml`**.
Commits feitos pelo bot com `GITHUB_TOKEN` não disparam outros workflows,
então sem o agendamento o "mais acessadas" nunca seria republicado. Passos:
checkout → `withastro/action` (build) → checagem de que `_site/CNAME` existe
→ `actions/deploy-pages`.
✔ O arquivo existe só na `migracao-ssg`, então não roda até a virada. `npm
run build` local continua OK. Revisão do YAML por você.

### Fase 10 — Ensaio geral
**10.1** Congelar as edições pelo painel (avisar a equipe). Atualizar a
branch com a `main` e rodar `json-para-md.mjs` de novo para pegar notícias
novas.
✔ `verificar-conteudo.mjs` com 0 diferenças; build OK;
`verificar-urls.mjs` 100%; comparação visual refeita nas páginas alteradas.

**10.2** Abrir o PR `migracao-ssg` → `main` (**sem merge**) para sua
revisão.

### Fase 11 — Virada (com você, nesta ordem)
1. Você cria uma tag de segurança na `main` atual, ou me pede para criar
   (ex.: `antes-da-migracao`).
2. **Você** muda o Pages para *Source: GitHub Actions* (Settings → Pages).
   O site publicado continua no ar até o primeiro deploy novo.
3. Você faz o merge do PR, ou me pede explicitamente.
4. Acompanhar o `deploy.yml` até concluir.
✔ No site real:
- `verificar-urls.mjs` contra `https://astrobotanica.com.br`: 100%;
- HTTPS válido e domínio customizado mantido;
- `rss.xml` e `podcast.xml` aprovados no
  [W3C Feed Validator](https://validator.w3.org/feed/);
- preview de uma notícia no WhatsApp ou no
  [debugger do Facebook](https://developers.facebook.com/tools/debug/);
- `curl -s https://astrobotanica.com.br/artigo/noticia-1/ | grep "<h1"` mostra
  o título;
- reenviar o sitemap no Search Console (você).
5. Liberar o painel para a equipe.

### Fase 12 — Plano de volta (se algo der errado na virada)
`git revert` do merge na `main` (com o seu pedido) **e** você volta o Pages
para *Deploy from a branch: main /*. Como nenhum arquivo antigo foi apagado,
a `main` revertida é o site atual, inteiro.

### Fase 13 — Limpeza (só depois de alguns dias estável, com a sua confirmação)
Lista do que **poderá** ser apagado. Eu apresento a lista final e espero o
seu OK antes de qualquer remoção:
- HTMLs antigos da raiz: `index.html`, `noticias.html`, `podcast.html`,
  `sobre.html`, `contato.html`, `estudos/index.html` (`noticia.html`,
  `episodio.html` e `estudo.html` antigos são substituídos pelas versões de
  redirecionamento);
- `artigo/` (14 pastas geradas pelo sistema antigo), `dist/main.js`,
  `src/main.ts`, `tsconfig.json` antigo;
- `scripts/generate_seo.py`, `generate_estudos_seo.py`,
  `generate_podcast_feed.py`, `generate_sitemap.py`, `scripts/__pycache__/`;
- `.github/workflows/generate-seo.yml`, se não removido na virada;
- `serve.py` (o verificador da Fase 0 o substitui) e as entradas de
  `rss.xml`/`podcast.xml` no `.gitattributes`;
- `data/articles.json` (vira redundante com os `.md`, mas convém guardar
  algumas semanas);
- as 3 imagens órfãs do inventário: decisão separada, porque podem ter sido
  compartilhadas;
- atualizar o `README.md`.
✔ Depois de cada remoção: build OK e `verificar-urls.mjs` 100%.

---

## 6. Riscos do inventário × onde são tratados

| Risco (INVENTARIO §8) | Tratamento |
|---|---|
| 1. Painel grava na `main` | Decisão 1, Fase 8, congelamento nas Fases 10–11 |
| 2. Bot commita na `main` | `generate-seo.yml` removido na virada; o deploy gera tudo sem commitar |
| 3. CNAME | Não é movido; copiado no build; checado no build e no workflow |
| 4. URLs com `?id=` | Páginas de redirecionamento (Fase 7) |
| 5. GUIDs dos feeds | Mantidos idênticos (Fase 6, verificados por diff) |
| 6. Variantes `.html` | `build.format: "preserve"`: funcionam nativamente |
| 7. Imagens relativas no corpo | `<base href="/">` no layout da notícia, como hoje |
| 8. HTML bruto / `<style>` | Corpo copiado byte a byte e renderizado sem Markdown |
| 9. i18n | `/en/` no site inteiro; páginas de item só com tradução real (seção 4, Fase 5) |
| 10. Ordem das notícias | Campo `ordem` |
| 11. Lógica da Home | Portada literalmente (Fase 4.1) |
| 12. og-image | Mesmo caminho e mesmos parâmetros (Fase 4.2) |
| 13. Jekyll legacy | Deploy por Actions não passa pelo Jekyll |
| 14. Node ausente | Resolvido: Node 22 instalado |
| 15. "Mais acessadas" | URLs `/artigo/` preservadas; deploy agendado (Fase 9) |
| 16. Mídia pesada | Copiada como está; sem mudança |
| 17. Órfãos | Não tocados até a Fase 13 |
| 18. Nav duplicado | Vira um único layout |
| 19. IDs inconsistentes | Mantidos como estão |
| 20. Certificado | Domínio e CNAME inalterados; checado na virada |
