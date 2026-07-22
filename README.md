# Astrobotânica — site do podcast

Site estático (HTML + CSS + TypeScript), multi-página. O foco principal do
site é divulgação científica em **Artigos**; em paralelo, o **Podcast** trata
dos mesmos temas em áudio. Todo o conteúdo é editado pelo painel em `/admin`.

## Estrutura

```
site/
├── index.html          → Home
├── artigos.html         → lista de artigos (conteúdo principal)
├── artigo.html           → detalhe de um artigo (?id=...)
├── podcast.html          → lista de episódios
├── episodio.html          → detalhe de um episódio (?id=ep-01), inclui a transcrição
├── sobre.html
├── contato.html
├── admin/                → painel de administração de conteúdo (ver abaixo)
├── css/style.css        → todo o visual (paleta, tipografia, layout)
├── data/
│   ├── episodes.json      → CONTEÚDO: episódios
│   ├── articles.json       → CONTEÚDO: artigos
│   ├── site.json            → todo o texto fixo do site em português (nav, rodapé, títulos, textos de cada página) — editável pelo painel
│   ├── site.en.json          → tradução em inglês do mesmo conteúdo (ver "Idioma" abaixo) — não editável pelo painel, só manualmente
│   └── auth.json            → acessos do painel (tokens criptografados, não em texto puro)
├── src/main.ts            → lógica do site: busca os JSON e preenche cada página
├── dist/main.js            → JavaScript compilado (gerado a partir de src/)
├── audio/                 → arquivos .mp3 dos episódios
├── robots.txt             → impede que buscadores indexem /admin
├── serve.py               → servidor local com URLs limpas (ver "Como visualizar localmente")
└── tsconfig.json
```

O conteúdo (episódios e artigos) vive em `data/*.json`, carregado pelo
navegador em tempo real via `fetch()`. Só é preciso rodar `npx tsc` se você
alterar a **lógica** do site em `src/main.ts` — editar o conteúdo (pelo
painel ou direto no JSON) nunca exige recompilar.

Todas as páginas carregam o mesmo `dist/main.js`; cada função de renderização
procura o elemento da sua página e não faz nada se ele não existir — por isso
não é preciso um script diferente por página.

Nav e rodapé são markup HTML repetido em cada página (sem servidor, sem
includes) — ao editar um, replique a mudança nas outras páginas.

**Importante**: como o conteúdo é buscado via `fetch()`, o site só funciona
servido por HTTP (veja "Como visualizar localmente" abaixo) — abrir o
`index.html` direto no navegador (duplo clique, `file://...`) não carrega os
JSON por causa de uma restrição de segurança do navegador.

### Textos fixos do site (`data/site.json`)

Todo o texto que não é um episódio nem um artigo — nome do site, itens de
menu, textos do rodapé, título/introdução de cada página, os 3 cartões da
página Sobre, o email de contato, etc. — vem de `data/site.json`, editável
pelo painel (seções "Marca & navegação" e "Páginas" — ver abaixo).

O mecanismo é genérico: qualquer elemento HTML com
`data-text="secao.chave"` é preenchido com o valor de `secao.chave` (via
i18next, ver "Idioma" abaixo) assim que a página carrega (função
`applyTranslations()` em `src/main.ts`). Para tornar mais um pedaço de texto
editável no futuro, são três passos: adicionar a chave em `data/site.json`
**e** `data/site.en.json` (mesma chave, valor traduzido) e o atributo
`data-text="..."` correspondente no HTML — não precisa de nenhuma lógica
nova.

## Idioma (pt/en)

O site alterna entre português e inglês via
[i18next](https://www.i18next.com/), carregado por CDN (`<script>` no
`<head>` de cada página, antes de `dist/main.js`) — não há pacote instalado
localmente nem passo de build para isso.

- **Fonte da tradução**: `data/site.json` (português, também usado pelo
  painel `/admin`) e `data/site.en.json` (inglês, mantido manualmente — o
  painel não edita esse arquivo). As duas chaves precisam ficar em sincronia;
  se uma chave existir só em português, o texto em inglês simplesmente não
  aparece (o `data-text` mantém o texto em português já presente no HTML).
- **Conteúdo de artigos/episódios** (título, corpo, transcrição etc., em
  `data/episodes.json`/`data/articles.json`) **não é traduzido** — só a
  interface fixa (menu, rodapé, títulos de página, mensagens de
  carregamento/vazio/erro).
- **Seletor**: botões "PT"/"EN" dentro do menu overlay (`.lang-switch`, ver
  `setupLangSwitch()` em `src/main.ts`). A escolha fica em
  `localStorage.lang`; sem escolha salva, usa o idioma do navegador.
- **Sem CDN disponível**: se o script do i18next não carregar (offline,
  bloqueado), `initI18n()` instala um tradutor mínimo local em cima de
  `data/site.json` — o site continua funcionando em português, só sem a
  troca de idioma.

## Painel de administração (`/admin`)

É por ali que todo o conteúdo do site é adicionado, editado e removido —
tanto rodando localmente quanto no site já publicado. Não existe link para
`/admin` em nenhuma página pública; para acessar, digite a URL diretamente
(ex: `http://localhost:8000/admin/` ou `https://seu-dominio/admin/`).

**Layout**: barra lateral com o conteúdo agrupado —

- **Conteúdo**: Artigos, Episódios (listas com card por item, expansível)
- **Geral**: Marca & navegação (nome do site, menu, rodapé, textos de
  "em breve" das plataformas)
- **Páginas**: um item por página (Home, Podcast, Episódio, Artigos, Artigo,
  Sobre, Contato) com os textos fixos daquela página
- **Sistema**: Acessos

**Como funciona**: o painel não tem servidor próprio, e edita em memória —
`data/episodes.json`, `data/articles.json` e `data/site.json` só são
gravados no GitHub quando você clica em **"Salvar no GitHub"**, no topo da
tela. Reordenar (setas ▲▼), adicionar e remover artigo/episódio já contam
como alteração na hora. Já **editar campos de um card** (texto, checkbox,
upload de áudio/imagem) não conta como nada até você clicar em **"Salvar
alterações"**, no fim daquele card — só esse clique sincroniza o que está
escrito na tela pra dentro da alteração pendente (é aí que aparece
"alterações pendentes" no topo). Antes disso, digitar/marcar/escolher um
arquivo fica só ali no navegador, sem efeito nenhum; ao trocar de card ou
fechar a aba sem clicar em "Salvar alterações", o que não foi confirmado
se perde. Um upload de áudio/imagem funciona igual: escolher o arquivo só
o deixa pronto pra confirmar — o arquivo em si só é de fato enviado ao
GitHub junto com o resto, no clique em "Salvar no GitHub" (o status ao
lado do campo mostra essa fila: "selecionado" → "na fila" → enviado). O
botão do topo fica habilitado enquanto houver alteração pendente, e o
status ao lado mostra "alterações pendentes" / "salvando…" / "salvo ✓". Um
clique nele salva de uma vez tudo o que está pendente (JSON e arquivos),
cada JSON como um commit no repositório `myceliumBrain/astrobotanica-site`,
branch `main`. **Acessos** é a exceção: adicionar/revogar ali já commita na
hora, sem esperar nenhum desses botões.

A ordem dos artigos e episódios nas listas (setas ▲▼) é a mesma ordem em que
eles aparecem no site público — não há mais reordenação automática por data.
Um item novo entra no topo da lista por padrão (então, por exemplo, ao
cadastrar o episódio 2 ele já nasce acima do episódio 1, sem precisar mexer
nas setas).

**Destaque na Home**: cada artigo/episódio tem uma checkbox "Destacar na
Home". A Home mostra no máximo 6 artigos e 6 episódios, escolhidos assim:
primeiro entram todos os marcados (até o limite de 6); as vagas que sobrarem
são preenchidas pelos não marcados mais próximos do topo da lista — ou seja,
os mais recentes. Isso significa que um item não marcado só sai da Home
quando surgem marcados/itens novos suficientes para empurrá-lo pra fora das
6 primeiras vagas; marcar a checkbox fixa o item na Home independente da
posição dele na lista. O painel trava em 6 marcados por seção (desabilita as
checkboxes restantes até você desmarcar alguma), pra não ficar ambíguo qual
sairia se houvesse mais de 6.

Cada pessoa usa **seu próprio token de acesso pessoal do GitHub** — nunca um
token compartilhado, e nunca em texto puro. O token é criptografado no
próprio navegador (AES-GCM 256 bits, chave derivada da senha escolhida via
PBKDF2/100.000 iterações) e o resultado — que sozinho não serve pra nada sem
a senha — é o que fica salvo em `data/auth.json`, versionado no repositório
junto com o resto do conteúdo.

Primeiro acesso (quando `data/auth.json` ainda não tem nenhum registro):

1. Gere um token fine-grained em
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new),
   com acesso restrito ao repositório `astrobotanica-site` e permissão
   `Contents: Read and write`.
2. Abra `/admin`, cole esse token, escolha uma senha e um nome. Isso
   criptografa o token com essa senha e faz o primeiro commit em
   `data/auth.json`.

Nos acessos seguintes, a tela de login pede só a senha — ela é testada
contra todos os registros salvos até uma bater (decifrar com sucesso), e o
token daquele registro é o que passa a ser usado na sessão.

Para dar acesso a outra pessoa, use a aba **Acessos** dentro do painel: ela
cola o próprio token dela, você (ou ela) escolhe uma senha, e um novo
registro criptografado é adicionado — sem que ninguém precise saber a senha
de mais ninguém. "Revogar" ali remove o registro de `data/auth.json`, mas
**não** revoga o token no GitHub — se algum token vazou de verdade, revogue
também em github.com/settings/tokens.

**O token decifrado nunca é salvo** em `localStorage`/`sessionStorage` —
fica só na memória da aba enquanto ela estiver aberta. Fechar a aba ou
recarregar a página desconecta; é preciso digitar a senha de novo.

**Requisito técnico**: a criptografia usa a Web Crypto API do navegador
(`crypto.subtle`), que só fica disponível em contexto seguro — `https://`
ou `http://localhost`. Funciona local (`python3 -m http.server`) e em
qualquer hospedagem publicada com HTTPS (GitHub Pages, Netlify, Vercel,
Cloudflare Pages já servem assim por padrão); não funciona em HTTP puro.

Há também um limite de tentativas de senha (5 tentativas, depois 15 min de
espera) guardado em `localStorage` — é só um freio de UX, não uma trava de
segurança real (a proteção de verdade é a criptografia em si).

**Depois de editar pelo painel**: as mudanças vão direto para o GitHub, não
para os arquivos na sua máquina. Se você também edita localmente, rode
`git pull` antes de mexer em `data/*.json` na sua cópia local, para não
sobrescrever o que foi editado pelo painel.

**Editar o JSON manualmente também continua funcionando** — o painel é uma
conveniência, não o único jeito. Veja os formatos abaixo se preferir editar
`data/episodes.json`/`data/articles.json` direto (ou fazer edições em lote).

### Formato de um artigo

```json
{
  "id": "artigo-01",
  "category": "Fisiologia vegetal",
  "title": "Título do artigo",
  "subtitle": "Subtítulo opcional",
  "excerpt": "Resumo curto usado na listagem.",
  "date": "2026-08-10",
  "readingTime": "6 min",
  "body": [
    "Primeiro parágrafo...",
    "Segundo parágrafo..."
  ],
  "featured": true
}
```

`category` aparece como etiqueta no cartão; `subtitle` é opcional. `image`
também é opcional (caminho de uma imagem de capa, ex:
`images/artigos/nome-do-arquivo.jpg`) — sem ela, o cartão mostra só um
retângulo vazio no lugar do pôster. Assim como o `.mp3` dos episódios, o
arquivo de imagem em si precisa ser enviado à pasta `images/artigos/` por
fora (via git); o painel só grava o caminho no JSON. `featured` é opcional
(padrão ausente/`false`) — ver "Destaque na Home" acima.

### Formato de um episódio

```json
{
  "id": "ep-02",
  "number": 2,
  "title": "Título do episódio",
  "description": "Uma ou duas frases resumindo o episódio.",
  "date": "2026-08-10",
  "duration": "28:40",
  "audioSrc": "audio/episodio-02.mp3",
  "image": "images/episodios/ep-02.jpg",
  "featured": true,
  "transcript": [
    "Primeiro parágrafo da transcrição...",
    "Segundo parágrafo..."
  ]
}
```

`transcript` é opcional — a transcrição some recolhida por padrão (só as
primeiras linhas, com "▼ Ver transcrição completa" pra abrir o resto).
`image` também é opcional: um banner (16:9, mostrado a metade da altura)
no topo da página do episódio, com a etiqueta/título/data sobrepostos nele.

Diferente dos artigos, o `.mp3` e a imagem de um episódio **podem ser
enviados direto pelo painel** — o campo de cada um tem um botão de envio de
arquivo; o caminho ao lado é só leitura (mostra o que está salvo, não dá
pra digitar nele). Escolher um arquivo não envia nada ainda — só fica
"selecionado" até você clicar em "Salvar alterações" do card (vira "na
fila"), e só é de fato commitado para `audio/` ou `images/episodios/` (via
Git Data API do GitHub, já que a Contents API não serve para arquivos
grandes) quando você clica em "Salvar no GitHub".

## Como recompilar depois de editar `src/main.ts`

Só é necessário se você mudar a **lógica** do site (não o conteúdo). O
navegador só lê `dist/main.js`, então é preciso recompilar o TypeScript toda
vez que `src/main.ts` mudar:

```bash
npx tsc
```

(na primeira vez, se o TypeScript não estiver instalado, o `npx` baixa
automaticamente — é preciso estar conectado à internet nesse passo).

## Como visualizar localmente

Os links do site são "limpos" (`/podcast`, não `/podcast.html`) — o GitHub
Pages resolve isso automaticamente (uma requisição para `/podcast` serve
`podcast.html` sem redirecionar), mas o `python3 -m http.server` padrão não
sabe fazer esse mapeamento. Por isso, use o script incluído:

```bash
python3 serve.py 8000
```

Ele funciona como o `http.server` normal, só que também resolve `/podcast` →
`podcast.html` (e assim por diante) — os links do site funcionam localmente
do mesmo jeito que no ar. Depois acesse `http://localhost:8000` no
navegador. Servir por HTTP (e não abrir o arquivo direto) é obrigatório de
qualquer forma, pois o conteúdo é carregado via `fetch()` a partir de
`data/*.json`.

## Antes de publicar

- **Primeiro acesso do `/admin`**: veja a seção "Painel de administração"
  acima — é preciso configurar pelo menos um acesso (token + senha) antes de
  editar qualquer conteúdo pelo painel.
- **Contato**: `data/site.json` (`contato.email`) tem um valor de exemplo
  (`seu-email@substituir.com`) — troque pelo seu email real em Páginas →
  Contato, no painel, ou direto no JSON. Atualize também `contato.email` em
  `data/site.en.json` (não é editável pelo painel).
- **Assinatura do podcast**: os textos de Spotify/Apple Podcasts/RSS em
  `data/site.json` (`platforms.*`) estão como "em breve" até existirem links
  reais. Trocar o texto ali já atualiza rodapé, Podcast e Contato ao mesmo
  tempo — mas eles continuam sendo `<span>`, não links; se quiser que virem
  links de verdade quando publicar em algum desses serviços, essa parte
  ainda precisa de uma edição no HTML (`podcast.html` e o rodapé de cada
  página), não só no texto.

## Publicar

Como é um site 100% estático, pode subir a pasta inteira (menos `src/` e
`tsconfig.json`, que são só para desenvolvimento) para qualquer serviço de
hospedagem estática: GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc. —
desde que o serviço sirva os arquivos por HTTP (todos esses servem).

## Personalização rápida

- **Cores/tipografia**: todas as variáveis estão no topo de `css/style.css`,
  no bloco `:root` (paleta verde pastel, Barlow/Barlow Condensed/IBM Plex Mono).
- **Nome do podcast / tagline**: procure por "Astrobotânica" em cada `.html`.

## Layout

- **Cabeçalho**: logo centralizada, botão hambúrguer à esquerda (abre o menu
  em overlay/gaveta lateral, classes `.nav-toggle` / `.nav-overlay` /
  `.nav-overlay-panel`) e alternador de tema claro/escuro à direita
  (`.theme-toggle`) — classes em `css/style.css`, lógica em
  `setupNavOverlay()`/`setupThemeToggle()` em `src/main.ts`. O seletor de
  idioma (PT/EN) fica dentro do próprio menu overlay.
- **Tema claro/escuro**: paleta alternativa em `:root[data-theme="dark"]`
  (`css/style.css`), aplicada automaticamente pelo `prefers-color-scheme` do
  sistema ou pela escolha salva em `localStorage.theme`; um script inline no
  `<head>` de cada página aplica isso antes da primeira pintura, evitando
  flash do tema errado.
- **Grade de artigos**: cartões de altura uniforme (pôster + título + data),
  usada igual na Home, em `/artigos` e em "Continue lendo" — classes
  `.article-grid` / `.article-card` em `css/style.css`, geradas por
  `buildArticleCard()` em `src/main.ts`.
