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
│   ├── site.json            → todo o texto fixo do site (nav, rodapé, títulos, textos de cada página)
│   └── auth.json            → acessos do painel (tokens criptografados, não em texto puro)
├── src/main.ts            → lógica do site: busca os JSON e preenche cada página
├── dist/main.js            → JavaScript compilado (gerado a partir de src/)
├── audio/                 → arquivos .mp3 dos episódios
├── robots.txt             → impede que buscadores indexem /admin
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
pela aba **Textos** do painel (ou direto no JSON).

O mecanismo é genérico: qualquer elemento HTML com
`data-text="secao.chave"` é preenchido com `site.secao.chave` assim que a
página carrega (função `applySiteText()` em `src/main.ts`). Para tornar mais
um pedaço de texto editável no futuro, são dois passos: adicionar a chave em
`data/site.json` e o atributo `data-text="..."` correspondente no HTML — não
precisa de nenhuma lógica nova.

## Painel de administração (`/admin`)

É por ali que todo o conteúdo do site é adicionado, editado e removido —
tanto rodando localmente quanto no site já publicado. Não existe link para
`/admin` em nenhuma página pública; para acessar, digite a URL diretamente
(ex: `http://localhost:8000/admin/` ou `https://seu-dominio/admin/`).

**Como funciona**: o painel não tem servidor próprio. Ele lê e grava
`data/episodes.json`, `data/articles.json`, `data/site.json` e
`data/auth.json` fazendo chamadas diretas à API do GitHub — cada "Salvar",
"Excluir" ou mudança de acesso vira um commit de verdade no repositório
`myceliumBrain/astrobotanica-site`, branch `main`. A aba **Textos** reúne
todo o texto fixo do site (ver seção acima) num formulário só, com um único
botão "Salvar textos".

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
  ]
}
```

`category` aparece como etiqueta no cartão; `subtitle` é opcional.

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
  "transcript": [
    "Primeiro parágrafo da transcrição...",
    "Segundo parágrafo..."
  ]
}
```

`transcript` é opcional — se presente, o texto completo aparece na própria
página do episódio, abaixo do player. O painel só edita o JSON; o arquivo
`.mp3` em si precisa ser enviado à pasta `audio/` por fora (via git), tanto
editando manualmente quanto pelo painel.

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

Qualquer servidor estático simples funciona, por exemplo:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000` no navegador. Servir por HTTP (e não
abrir o arquivo direto) é obrigatório, pois o conteúdo é carregado via
`fetch()` a partir de `data/*.json`.

## Antes de publicar

- **Primeiro acesso do `/admin`**: veja a seção "Painel de administração"
  acima — é preciso configurar pelo menos um acesso (token + senha) antes de
  editar qualquer conteúdo pelo painel.
- **Contato**: `data/site.json` (`contato.email`) tem um valor de exemplo
  (`seu-email@substituir.com`) — troque pelo seu email real na aba Textos do
  painel, ou direto no JSON.
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
