# Inventário do site atual — astrobotanica.com.br

Levantado em 2026-10-31, a partir da branch `main` (commit `988898e`). Nenhum
arquivo do site foi alterado para produzir este documento.

---

## 1. Estrutura de pastas e tecnologias

```
site/
├── index.html, noticias.html, noticia.html, podcast.html, episodio.html,
│   estudo.html, sobre.html, contato.html   → páginas "casca" (HTML fixo)
├── estudos/index.html      → índice de estudos (manual, fica em pasta para servir /estudos)
├── artigo/<id>/            → GERADO: index.html + og-image.jpg por notícia (14 pastas)
├── admin/                  → painel de conteúdo (index.html, admin.js ~3.8k linhas, admin.css)
├── css/style.css           → todo o visual
├── src/main.ts             → lógica do site (~1.360 linhas, TypeScript)
├── dist/main.js            → JS compilado de src/main.ts (versionado)
├── data/*.json             → TODO o conteúdo (ver seção 2)
├── images/                 → 86 arquivos, ~27 MB (noticias/, episodios/, integrantes/)
├── audio/                  → 2 MP3, ~24 MB (episodio-01.mp3 15 MB, ep-2.mp3 8,5 MB)
├── scripts/                → geradores Python (SEO, RSS, podcast, sitemap, pageviews)
├── .github/workflows/      → generate-seo.yml, pageviews.yml
├── rss.xml, podcast.xml, sitemap.xml  → GERADOS pelos scripts
├── CNAME, robots.txt, .gitattributes, .gitignore
├── serve.py                → servidor local que imita URLs limpas do Pages
├── tsconfig.json, README.md
└── CLAUDE.md               → (novo, ainda não commitado)
```

**Tecnologias**

| Camada | O que é usado |
|---|---|
| HTML | Páginas estáticas escritas à mão; nav e rodapé **duplicados** em cada página |
| CSS | Um único `css/style.css`, fontes Google (Barlow, Barlow Condensed, IBM Plex Mono) |
| JS | TypeScript (`src/main.ts`) compilado com `tsc` para `dist/main.js` (ES module, sem bundler, sem framework) |
| i18n | i18next 23.16.8 via CDN jsDelivr |
| Analytics | GoatCounter (`astrobotanica.goatcounter.com`), só em `noticia.html`, `estudo.html` e páginas `artigo/` |
| Geradores | Python 3 + Pillow (`scripts/*.py`), rodados por GitHub Actions |
| CMS | `/admin` próprio: lê/grava `data/*.json` e mídia direto na branch `main` via API do GitHub (token pessoal criptografado em `data/auth.json`) |
| Hospedagem | GitHub Pages, build "legacy" (sem Jekyll customizado), branch `main`, pasta `/` |

Não há `package.json` nem `node_modules`; **Node/npx não está instalado nesta
máquina** (só Python 3.14). Não foi possível confirmar que `dist/main.js`
está em sincronia com `src/main.ts` recompilando — o último commit de ambos é
o mesmo (`8cda387`, 2026-08-26), o que sugere que sim.

---

## 2. Como o conteúdo é carregado

**Sim: o HTML vem praticamente vazio e o JavaScript monta o conteúdo.**

- Cada página HTML traz só a estrutura (cabeçalho, nav, rodapé, contêineres
  vazios como `#article-list`, `#artigo-content`, `#episode-list`,
  `#home-featured-article`, `#members-list`, `#estudos-list`,
  `#verbete-content`...).
- Todas as páginas carregam o **mesmo** `dist/main.js`. Ao carregar:
  1. `initI18n()` faz `fetch` de `data/site.json` e `data/site.en.json`;
  2. `applyTranslations()` preenche todo elemento com
     `data-text="secao.chave"` (texto) ou `data-text-attr="content"`
     (atributo, ex.: `<meta description>`, `<title>`);
  3. em paralelo faz `fetch` de `episodes.json`, `articles.json`,
     `members.json`, `pageviews.json`, `estudos.json`,
     `categorias_estudo.json` (sempre todos, em todas as páginas);
  4. cada `render*()` procura o seu contêiner e, se existir, monta o
     conteúdo (cards, detalhe, listas). O corpo das notícias é HTML inserido
     via `innerHTML`.
- O HTML estático tem textos em português como "valor inicial" (ex.:
  `<title>Notícias — Astrobotânica</title>`), substituídos pelo JS.

**Origem dos textos**

| Arquivo | Conteúdo | Editado por |
|---|---|---|
| `data/articles.json` (196 KB) | 14 notícias (corpo em HTML) | painel |
| `data/episodes.json` | 2 episódios (com transcrição) | painel |
| `data/estudos.json` | verbetes — **vazio (`[]`)** hoje | painel |
| `data/categorias_estudo.json` | 4 categorias de estudo | painel |
| `data/members.json` | 2 integrantes (página Sobre / card de autor) | painel |
| `data/site.json` | textos fixos PT (nav, rodapé, títulos, metas, mensagens) — 104 chaves | painel |
| `data/site.en.json` | tradução EN dos textos fixos — 97 chaves | manual |
| `data/pageviews.json` | ranking "mais acessadas" (lista de ids) | workflow diário |
| `data/auth.json` | tokens do painel, criptografados | painel |

**Exceção às páginas vazias:** `artigo/<id>/index.html` (gerado) já traz no
`<head>` título, descrição, canonical, Open Graph, Twitter Card e JSON-LD
reais da notícia — mas o **corpo** continua vazio e é montado pelo JS, igual
às demais.

---

## 3. Troca PT/EN

- **Mecanismo**: i18next via CDN. Idioma inicial = `localStorage.lang`, senão
  idioma do navegador (`en*` → inglês, qualquer outro → português).
- **Seletor**: bandeiras 🇧🇷/🇺🇸 no cabeçalho (desktop) e no menu overlay
  (celular). Trocar chama `i18next.changeLanguage()`, salva em
  `localStorage` e **re-renderiza tudo no cliente**. A URL **não muda** —
  não existe `/en/` nem nenhuma URL em inglês; o Google só vê português.
- **Fallback**: se o CDN falhar, um tradutor mínimo usa só o PT.

**O que existe em inglês**

| Conteúdo | Em inglês? |
|---|---|
| Textos fixos (nav, rodapé, títulos/intro de páginas, metas, mensagens de erro/vazio, rótulos) | Sim, `data/site.en.json` (97 chaves) |
| Chaves só em PT (caem para PT): `home.eventBannerImage`, `home.eventBannerLink`, `social.bluesky/facebook/linkedin/x`, `socialLinks` | Não |
| Notícias: `titleEn`, `subtitleEn`, `categoryEn`, `imageCaptionEn`, `bodyEn`, `readingTimeEn` | **11 de 14** traduzidas (noticia-1 a 8 e noticia-13). **Sem tradução: noticia-9, 10, 11, 12 e 14** (mostram PT) |
| Notícia 13 tem imagens próprias para a versão EN (`noticia-13-en-imagem-*`) | Sim |
| Integrantes: `descriptionEn` | Sim (campo existe) |
| Episódios (título, descrição, transcrição) | Não |
| Estudos/verbetes | Não (nem há campos EN) |
| Autor, datas, imagens | Não se aplica (data formatada conforme o idioma) |
| `<head>` das páginas `artigo/` (OG/JSON-LD), RSS, podcast.xml | Só PT |

---

## 4. URLs públicas atuais

O Pages serve URLs "limpas": `/podcast` e `/podcast.html` respondem o mesmo
arquivo. Pastas sem barra final (`/artigo/noticia-1`) redirecionam para a
versão com barra. **Todas as variantes abaixo podem estar em links externos.**

### Páginas
| URL limpa (usada nos links) | Também responde | Arquivo |
|---|---|---|
| `/` | `/index.html` | index.html |
| `/noticias` | `/noticias.html` | noticias.html |
| `/noticia?id=<id>` (formato **antigo** de notícia, ainda funciona) | `/noticia.html?id=...`; sem `id` mostra a 1ª notícia | noticia.html |
| `/podcast` | `/podcast.html` | podcast.html |
| `/episodio?id=<id>` | `/episodio.html?id=...` | episodio.html |
| `/estudos` | `/estudos/`, `/estudos/index.html` | estudos/index.html |
| `/estudo?slug=<slug>` (pré-visualização) | `/estudo.html?slug=...` | estudo.html |
| `/sobre` | `/sobre.html` | sobre.html |
| `/contato` | `/contato.html` | contato.html |
| `/admin/` | `/admin/index.html` (bloqueado no robots.txt) | admin/index.html |

### Notícias (URL canônica `/artigo/<id>/`)
`/artigo/noticia-1/` … `/artigo/noticia-14/` (14 URLs), mais as variantes
antigas `/noticia?id=noticia-N`. Cada uma tem também
`/artigo/noticia-N/og-image.jpg` (usada em previews já compartilhados no
WhatsApp/Facebook/X — o cache dessas redes aponta para ela).

### Episódios
- `/episodio?id=ep-01`
- `/episodio?id=ep-2`

(São também o `<link>`/`<guid>` de cada item em `podcast.xml` — o `guid` não
pode mudar, ou os apps de podcast duplicam episódios.)

### Estudos
- `/estudos` (índice)
- `/estudos/<categoria>/<verbete>/` — **nenhuma existe hoje** (`estudos.json`
  vazio), mas o formato já está definido no código, no gerador e no sitemap.

### Feeds e arquivos de máquina
- `/rss.xml` (notícias) — linkado no cabeçalho de todas as páginas
- `/podcast.xml` (feed do podcast, iTunes) — pode estar cadastrado em
  Spotify/Apple
- `/sitemap.xml` (20 URLs: 6 páginas + 14 notícias)
- `/robots.txt`
- `/CNAME`

### Mídia referenciada de fora
Referenciadas com URL absoluta `https://astrobotanica.com.br/...` em feeds
e metas (portanto potencialmente em caches/agregadores externos):
- `rss.xml` → `<enclosure>` de cada notícia: `/images/noticias/noticia-N-imagem-principal.{jpg,png,jpeg}`
- `podcast.xml` → `/audio/episodio-01.mp3`, `/audio/ep-2.mp3` e
  `/images/episodios/ep-01.jpg`, `/images/episodios/ep-2-imagem-principal.jpg`
  (capa do canal)
- `artigo/<id>/index.html` → `og:image` = `/artigo/<id>/og-image.jpg`

Referenciadas internamente (relativas, `images/...`): 83 caminhos em
`articles.json` (capa, vertical, avatar do autor, **48 `<img>` no corpo das
notícias**), `episodes.json`, `members.json`. Todos existem no disco.
Não há nenhuma imagem externa (de outro domínio) no corpo das notícias.

Arquivos de mídia **não referenciados** por nenhum JSON (sobras de uploads
substituídos): `images/episodios/ep-2-imagem-principal.png` (3,4 MB),
`images/noticias/noticia-7-imagem-principal.png`,
`images/noticias/noticia-7-imagem-vertical.png`. Não apagar sem decidir —
podem ter sido compartilhados.

O painel também prevê pastas que ainda não existem: `images/estudos/`,
`images/equipe/`, `images/home/`.

---

## 5. Notícias

Fonte de todas: **`data/articles.json`** (um único arquivo; o corpo é HTML no
campo `body`). As páginas `artigo/<id>/index.html` são só cascas geradas a
partir de `noticia.html`, sem o texto da notícia.

Ordem = ordem do array (a do site; não é reordenada por data).

| id | Data / hora (BRT) | Título | EN | URL |
|---|---|---|---|---|
| noticia-14 | 2026-10-31 21:29 | A Alquimia do Regolito: Revisão das Metodologias e Desafios da Agricultura Espacial | não | /artigo/noticia-14/ |
| noticia-13 | 2026-10-25 12:39 | Cultivando Alimento no Espaço: Estudo da Nature Revela Como Bactérias PGPR Podem Transformar Regolito em Solo Fértil | sim | /artigo/noticia-13/ |
| noticia-12 | 2026-08-31 00:50 | Estudo Revela Replicação Microbiana em Regolito Marciano com Extrema Restrição de Água | não | /artigo/noticia-12/ |
| noticia-11 | 2026-08-07 23:25 | Avaliação da fertilidade e desempenho produtivo de feijão-fava em regolito marciano | não | /artigo/noticia-11/ |
| noticia-10 | 2026-08-06 00:34 | Microtomografia por luz síncrotron: Nova tecnologia de imagem para visualização de micorrizas | não | /artigo/noticia-10/ |
| noticia-9 | 2026-08-03 17:47 | Antioxidantes Viabilizam Cultivo em Solo Lunar, mas Integridade do DNA é Ameaçada | não | /artigo/noticia-9/ |
| noticia-8 | 2026-08-01 08:08 | Estudo revela que simulantes de regolito espacial não são estéreis e propõe novos protocolos. | sim | /artigo/noticia-8/ |
| noticia-7 | 2026-07-29 23:22 | Fungos micorrízicos como peça chave no cultivo de grão-de-bico em regolito lunar | sim | /artigo/noticia-7/ |
| noticia-6 | 2026-07-29 23:00 | STELLA: Instrumento Open Science da NASA (Sensoriamento Remoto) | sim | /artigo/noticia-6/ |
| noticia-5 | 2026-07-27 16:09 | Brasil e Agricultura Espacial: Audiência Pública Debate o Futuro da Economia no Espaço | sim | /artigo/noticia-5/ |
| noticia-4 | 2026-07-26 05:07 | Ervilhas em Marte: Adubo de Insetos Pode Proporcionar a Agricultura no Planeta Vermelho | sim | /artigo/noticia-4/ |
| noticia-3 | 2026-07-24 18:09 | Cientista Brasileira Lidera Estudo de Vanguarda sobre Consórcio de Culturas em Solo Marciano | sim | /artigo/noticia-3/ |
| noticia-2 | 2026-07-23 14:00 | A Nova Era da Astrobotânica: Plantas e Microorganismos como Pilares da Exploração Espacial Sustentável | sim | /artigo/noticia-2/ |
| noticia-1 | 2026-07-22 23:09 | O 'cérebro' subterrâneo do planeta: hifas de fungos somam distância equivalente a 11 mil anos-luz | sim | /artigo/noticia-1/ |

Campos existentes nas notícias: `id, category, categoryEn, title, titleEn,
subtitle, subtitleEn, author, authorAvatar, date, time, readingTime,
readingTimeEn, body, bodyEn, image, imageCaption, imageCaptionEn,
imageVertical, featured, references`. `noticia-14` não tem `imageVertical`.

Observação: `noticia-1.body` contém um bloco `<style>` colado de editor de
texto (`<style type="text/css"><font size="2">p { … }</font></style>`) — é
HTML inválido e precisa ser preservado/tratado com cuidado na migração.

---

## 6. Como o rss.xml é gerado hoje

1. Alguém salva no `/admin` → commit direto em `data/articles.json` na `main`.
2. O push dispara `.github/workflows/generate-seo.yml` (gatilho por caminho:
   `data/*.json`, `noticia.html`, `estudo.html`, `scripts/*.py`; também
   manual via `workflow_dispatch`).
3. O workflow instala Pillow e roda, em ordem:
   - `scripts/generate_seo.py` → apaga e recria `artigo/` inteira
     (`index.html` + `og-image.jpg` redimensionada a 1200px) **e escreve
     `rss.xml`**;
   - `scripts/generate_estudos_seo.py` → `estudos/<cat>/<verbete>/`;
   - `scripts/generate_podcast_feed.py` → `podcast.xml`;
   - `scripts/generate_sitemap.py` → `sitemap.xml`.
4. O bot `github-actions[bot]` commita `artigo estudos rss.xml podcast.xml
   sitemap.xml` de volta na `main` (com até 3 tentativas de rebase). O
   Pages então republica.

**Formato do rss.xml**: RSS 2.0 + `atom:link`; título
"Astrobotânica — Notícias"; `<link>` `/noticias`; descrição =
`brand.footerTagline` do site.json; até 30 itens na ordem do array; cada
item com `title`, `link`/`guid` = `https://astrobotanica.com.br/artigo/<id>/`
(`isPermaLink="true"`), `pubDate` (data+hora BRT; sem hora → meia-noite
UTC), `category`, `description` (subtítulo ou primeiros 220 caracteres do
corpo) e `enclosure` da imagem de capa. `lastBuildDate` muda a cada
execução, por isso `.gitattributes` usa `merge=ours` para rss.xml e
podcast.xml. Feed só em português.

O `podcast.xml` segue o mesmo padrão, com namespace iTunes, `guid` =
`/episodio?id=<id>`, enclosure do MP3 com tamanho em bytes, categoria
Science › Natural Sciences e e-mail do dono.

Há um segundo workflow, `pageviews.yml` (diário, 06:00 UTC), que lê a API do
GoatCounter (secret `GOATCOUNTER_API_TOKEN`) e commita `data/pageviews.json`.

---

## 7. CNAME e configuração do Pages

- **`CNAME`** na raiz do repositório, conteúdo `astrobotanica.com.br`.
- **Configuração atual do Pages** (lida via API, sem alterar nada):
  `build_type: legacy`, fonte = branch `main`, pasta `/`, `cname:
  astrobotanica.com.br`, HTTPS forçado, certificado válido para
  `astrobotanica.com.br` e `www.astrobotanica.com.br` (expira 2026-12-19,
  renovação automática), sem 404 customizado.
- **Não existe** `.nojekyll`, `_config.yml` nem `404.html`. Como o build é
  "legacy", o Pages roda o Jekyll padrão sobre o repositório: hoje isso não
  causa problema porque não há arquivos/pastas começando com `_`.
- Outros arquivos relacionados à publicação: `robots.txt` (bloqueia
  `/admin/`, aponta o sitemap), `sitemap.xml`, `.gitattributes`
  (`merge=ours` nos feeds), `.github/workflows/*.yml`.
- Repositório: `github.com/myceliumBrain/astrobotanica-site`. Histórico: 399
  commits, sendo 72 do bot e 24 de um colaborador (EduardoDreyer).

---

## 8. Riscos numa migração para SSG

### Críticos
1. **O painel `/admin` grava direto na `main`** (`CONFIG.branch: "main"` em
   `admin/admin.js`) e espera o formato atual de `data/*.json` e as pastas
   `images/…`/`audio/`. Uma migração que mude formato de conteúdo, caminhos
   de mídia ou o lugar de onde o site é publicado quebra o painel — e os
   colaboradores podem continuar editando pela `main` durante todo o
   trabalho em `migracao-ssg`, criando divergência de conteúdo. Decidir
   antes: o painel continua? Os JSON continuam sendo a fonte?
2. **Workflow do bot commita na `main`** a cada edição. Se o SSG passar a
   publicar a partir de um artefato de build (Pages via Actions), isso
   exige mudar a configuração do Pages — o que, pelas regras, é manual e
   seu. Até lá, a `main` precisa continuar servível como está.
3. **CNAME**: com Pages via Actions, o CNAME precisa estar **dentro da
   pasta de saída** do build, ou o domínio cai.
4. **URLs com query string** (`/noticia?id=…`, `/episodio?id=…`,
   `/estudo?slug=…`): um SSG gera um arquivo por página e não enxerga
   query string. Para manter esses links é preciso manter uma página
   `noticia.html`/`episodio.html` que redirecione via JS (redirect
   servidor-side não é possível no Pages).
5. **GUIDs dos feeds**: os `guid` do `rss.xml` (`/artigo/<id>/`) e do
   `podcast.xml` (`/episodio?id=<id>`) não podem mudar, ou leitores e apps
   de podcast duplicam/re-notificam todos os itens. Se episódios ganharem
   URL nova (ex.: `/podcast/ep-01/`), o `guid` deve continuar o antigo
   (`isPermaLink="false"` ou manter o texto antigo).

### Altos
6. **Variantes `.html`**: `/podcast.html`, `/sobre.html` etc. respondem
   hoje; se o SSG gerar `podcast/index.html`, `/podcast.html` passa a dar
   404. Precisa gerar páginas de redirecionamento.
7. **Imagens relativas no corpo das notícias** (`src="images/…"`, 48
   ocorrências) só funcionam em `/artigo/<id>/` por causa do
   `<base href="/">`. Num template novo sem `<base>`, todas quebram. Não
   reescrever o conteúdo: resolver no template/build.
8. **Conteúdo é HTML bruto** inserido via `innerHTML`, inclusive o
   `<style>` inválido em `noticia-1`. Converter para Markdown seria
   reescrever conteúdo (proibido) e arrisca perder formatação — o mais
   seguro é migrar o HTML como está.
9. **i18n sem URL própria**: hoje PT/EN troca no cliente. Se o SSG gerar
   `/en/...`, são URLs novas (ok); se renderizar só PT no build, a troca
   precisa continuar existindo no cliente, ou perde-se a funcionalidade.
   As 5 notícias sem tradução e os episódios devem continuar caindo para PT.
10. **Ordem das notícias** é a do array, não a da data (o painel permite
    reordenar). Um SSG que ordene por data muda a Home, a lista e o RSS.
11. **Lógica da Home** (`selectHomeItems`, máximo de 6 destaques, card
    dividido + 4 pôsteres + banner + restante) precisa ser reproduzida
    exatamente.

### Médios
12. **og-image.jpg** de cada notícia é gerada com Pillow; os previews já
    compartilhados apontam para `/artigo/<id>/og-image.jpg` — manter o
    caminho.
13. **Jekyll do build legacy**: ao adicionar arquivos/pastas com `_`
    (comuns em SSGs: `_site`, `_includes`, `_data`) na `main` sem
    `.nojekyll`, o Pages pode ignorá-los ou tentar processá-los.
14. **Ambiente local**: Node não está instalado, então nem `tsc` roda hoje
    aqui. Um SSG em Node (Eleventy, Astro…) exige instalar Node; um em
    Python evita isso. A regra "rodar o build antes de cada commit"
    depende disso.
15. **"Mais acessadas"** depende de `data/pageviews.json` (atualizado pelo
    cron) e dos caminhos `/artigo/<id>/` no GoatCounter: mudar a URL das
    notícias zera o ranking.
16. **Mídia pesada no git** (~51 MB, MP3 de 15 MB): sem problema hoje, mas
    um build que copie tudo a cada execução fica lento; arquivos > 100 MB
    seriam recusados pelo GitHub.
17. **Arquivos órfãos** (3 imagens não referenciadas) e o arquivo
    `__pycache__` local: não apagar sem confirmação.
18. **Duplicação de nav/rodapé** em 9 HTMLs + `estudos/index.html` +
    templates dos geradores: hoje os geradores copiam o HTML de
    `noticia.html`/`estudo.html`; mexer nesses arquivos muda as páginas
    geradas.
19. **IDs inconsistentes** (`ep-01` vs `ep-2`, arquivos `episodio-01.mp3`
    vs `ep-2.mp3`): não "normalizar" — mudam URLs e GUIDs.
20. **Certificado HTTPS** expira em 2026-12-19 (renova sozinho desde que o
    CNAME/DNS continuem corretos — qualquer troca de domínio no meio da
    migração pode atrapalhar a renovação).
