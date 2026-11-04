# Plano — reformulação do painel /admin

Objetivo: tudo o que aparece no site pode ser editado pelo painel, num painel
organizado como o próprio site. A publicação passa a ter um fluxo
profissional: rascunho, prévia, envio para aprovação, status da publicação e
histórico com a opção de desfazer.

Decisões (2026-11-02):
- **Inglês**: continua manual, mas organizado. Cada conteúdo tem abas
  **PT | EN** e um aviso "falta traduzir". Não há tradução automática.
- **Recursos**: prévia, status da publicação, rascunhos, histórico e
  desfazer, e aprovação dos textos de colaboradores.
- **Condução**: por partes. Cada parte é um PR testado, e você revisa e faz o
  merge. O painel atual continua funcionando entre uma parte e outra.

Regras que valem para todas as partes: as do `CLAUDE.md`, em especial
nenhuma URL quebra e nenhum texto publicado é reescrito. Cada parte passa por
build, `verificar-urls.mjs`, `verificar-seo.mjs` e um teste do painel com a
API do GitHub simulada.

---

## Diagnóstico do painel atual

- **8 campos sem efeito**: o site novo não lê mais estes campos:
  `sobre.title`, `sobre.intro`, `sobre.metaDescription` e os "Selos"
  (`artigos.tag`, `estudos.tag`, `podcast.tag`, `sobre.tag`, `contato.tag`).
- **Fora do painel**:
  - o texto das páginas Sobre, Expediente, Política Editorial, Normas para
    Colaboradores e Privacidade (`src/content/paginas/*.md`);
  - os links institucionais do rodapé;
  - os campos editoriais das notícias (descrição para SEO, fonte/DOI, tipo de
    estudo, revisão técnica, tags, ORCID/Lattes, erratas).
- **Menu escondido**: o editor do menu está no meio de "Marca & navegação".
- **Organização**: a navegação segue a ordem em que as coisas foram criadas,
  não a estrutura do site. O inglês aparece como um campo "(EN)" embaixo de
  cada campo.
- **Cache**: um painel antigo aberto no navegador continua salvando no
  formato antigo, sem avisar (aconteceu no teste de 2026-11-02).
- **Identificadores de integrantes**: hoje são `integrante-pedro` e
  `novo-integrante`, em vez do nome.

---

## Estrutura nova do painel

```
Conteúdo      Notícias · Podcast · Estudos (verbetes e categorias) · Integrantes
Páginas       Início · Sobre · Contato · Expediente · Política Editorial ·
              Normas para Colaboradores · Privacidade · Notícias/Podcast/Estudos (textos de abertura)
Site          Menu · Rodapé (frase, copyright, links institucionais, redes sociais) · Marca
Publicação    Envios para aprovação (admin) · Meus envios (colaborador) · Atividade recente
Configurações Acessos (admin) · Minha conta
```

Toda tela de edição segue o mesmo padrão:
- abas **PT | EN**, com o selo "falta traduzir" quando o EN está vazio ou
  desatualizado;
- **Prévia** ao lado;
- **Histórico** do item;
- botões **Salvar rascunho** e **Publicar** (admin) ou **Enviar para
  publicação** (colaborador).

---

## Partes (um PR cada, nesta ordem)

### P1 — Estrutura e limpeza ✔ (2026-11-02)
- Nova navegação lateral (acima) e o padrão de tela com abas PT | EN.
- Remove os 8 campos sem efeito.
- Menu do site com uma tela própria em "Site → Menu".
- **Aviso de versão**: o painel confere se há uma versão mais nova publicada
  e pede para recarregar antes de salvar. Isso resolve o problema do cache.
- Feito: as abas PT | EN valem nas telas de Páginas e de Rodapé e marca. Nos
  cartões de notícia, episódio e verbete elas entram na P5, junto com a
  reforma desses cartões.

### P2 — Integrantes com identificador pelo nome ✔ (2026-11-02)
- O identificador passa a ser o nome completo sem acentos, por exemplo
  `eduardo-dreyer-simoes-saraiva`. É gerado do nome ao criar o integrante, e o
  admin pode ajustá-lo.
- A foto passa a se chamar `images/integrantes/<identificador>.<ext>`.
- Migração dos atuais:
  - `integrante-pedro` → `pedro-henrique-tenorio-alvarenga`;
  - `novo-integrante` → `eduardo-dreyer-simoes-saraiva`;
  - os `authorAvatar` das notícias passam a apontar para as fotos novas
    (campo técnico, o texto não muda).
- As fotos com o nome antigo **ficam** até a limpeza (Fase 13), para não
  quebrar quem tenha o link delas.
- Cada acesso do painel fica ligado a um integrante (`integrante` no
  `auth.json`). É isso que define a autoria na P7.
- Feito:
  - integrante novo: o id acompanha o nome completo enquanto ele é digitado
    (nome repetido ganha `-2`); só o admin ajusta à mão; trava depois de
    salvo;
  - a foto escolhida antes de o nome estar completo é renomeada para o id
    final antes do envio;
  - em "Acessos", cada acesso tem o seletor de integrante (também no
    formulário de novo acesso); um integrante só pode estar ligado a um
    acesso; "Minha conta" mostra o integrante de quem entrou.
  - Fotos antigas que ficam até a Fase 13: `images/integrantes/integrante-pedro.jpeg`
    e `images/integrantes/novo-integrante.jpg` (e as miniaturas delas).

### P3 — Páginas editáveis (primeira parte ✔ 2026-11-02)
- Feito:
  - "Páginas" na barra lateral segue o menu do site: cada item do menu é
    uma entrada; os que têm mais de uma tela (Notícias, Podcast, Estudos,
    Sobre) abrem com uma seta. O que não está no menu (Expediente, Normas…)
    fica em "Fora do menu";
  - texto das páginas (Sobre, Expediente, Política Editorial, Normas,
    Privacidade) editável, em PT e EN, com título, descrição e data. O corpo
    continua em Markdown (`admin/paginas-md.js`), e abrir e salvar sem mexer
    não muda nenhum arquivo;
  - item novo no menu com link `/slug` vira uma página: o painel mostra o
    editor, e salvar cria `src/content/paginas/pt/<slug>.md`, publicada em
    `/<slug>` e `/en/<slug>` por `src/pages/[pagina].astro`.
- Falta: reorganizar os itens de "Páginas" (próximo pedido).
- Sobre, Expediente, Política Editorial, Normas e Privacidade editáveis no
  painel: título, descrição (SEO), data de atualização e o texto completo, com
  o mesmo editor de texto das notícias, em PT e EN.
- O painel lê e grava os `.md` de `src/content/paginas/`, como já faz com as
  notícias.
- Textos de abertura das páginas Início, Notícias, Podcast, Estudos e Contato
  reunidos em "Páginas".

### Rodada de reorganização e editor (decidida em 2026-11-04)
Entra antes da P4. Decisões: uma tela para cada item no lugar dos cartões,
publicar item por item sem o botão geral, e editor próprio (sem biblioteca),
porque abrir e salvar sem mexer não pode alterar nenhum arquivo.

- **R1 — Barra do editor acompanha o texto.** ✅ Feito. A causa era o
  `overflow: hidden` do `.card-body`: um ancestral com overflow impede o
  `position: sticky` da barra.
- **R2a — Navegação e telas.** ✅ Feito.
  - Cada assunto num só lugar: os textos de Notícias, Podcast e Estudos ficam
    no topo da própria lista ("Textos da página"). "Páginas" é uma lista
    simples: Início, as páginas do menu e as que estão fora dele.
  - Uma tela para cada item: a lista mostra título, categoria, data, autor e
    "falta traduzir"; clicar abre o item numa tela inteira, com "← voltar".
  - Mesmo padrão em todas as telas: abas Português | English e ações sempre
    visíveis no rodapé.
- **R2b — Publicar em um passo.** ✅ Feito. Sai o "Salvar no GitHub" do topo;
  cada tela tem **Publicar**, que grava só aquela parte. Sair de uma tela com
  alterações pergunta e descarta; remover publica na hora; a ordem da lista é
  publicada pela barra que aparece no rodapé da lista (com "Desfazer"). O
  topo mostra só o estado.
- **R3a — Atalhos do editor.** ✅ Feito. Ctrl+B, Ctrl+I, Ctrl+K (link); no
  começo da linha, "## " vira subtítulo; nas páginas de texto, "## " seção,
  "### " subseção, "- " lista e "1. " lista numerada; Backspace no começo de
  um título volta a texto; "/" numa linha vazia abre o menu de blocos.
  Notícias e verbetes não têm lista: o CSS do site (`.article-body`) não
  estiliza listas, então elas apareceriam sem marcador.
- **R3b — Formatação no próprio texto.** ✅ Feito. Menu flutuante ao
  selecionar (negrito, itálico, link, subtítulo/seção), com o endereço do
  link digitado no próprio menu. A barra lateral saiu; em cima do texto fica
  só "+ Inserir" (o mesmo menu do "/") e "Imagem". Saiu também o "Tamanho da
  fonte" (o subtítulo cumpre esse papel); textos antigos com tamanho
  continuam como estão. *Revisto na R4/E1: o texto pequeno voltou, porque é
  assim que as legendas das figuras são escritas.*

### Rodada R4 — painel com a cara do site (decidida em 2026-11-04)
Quem usa o painel são cientistas sem nenhuma noção de programação. O painel
tem de parecer a página do site, com cara de "lugar de editar".

- **E1 — Legendas e imagens.** ✅ Feito. "Imagem" põe a figura numa linha
  própria com a linha de legenda logo abaixo, em texto pequeno
  (`<font size="2">`, o formato das legendas já publicadas). Clicar na imagem
  mostra Trocar / Legenda / Remover. "Texto pequeno" no menu da seleção. Um
  só tamanho de texto normal: `size="3"` e `size="4"` aparecem no tamanho
  normal no site.
- **E2 — Visual do site.** ✅ Feito. Tema claro com as cores e fontes do site,
  faixa "modo de edição", "Ver o site" e, no celular, o botão "Menu".
- **E3 — Notícia editada no formato da página.** ✅ Feito. Categoria, título,
  subtítulo, "Por: … · Publicado em …", capa com legenda e texto, na ordem e
  com a letra da página publicada; autor, data, destaque, foto em pé e
  endereço em "Detalhes da publicação", ao lado.
- **E4 — Tela inicial.** ✅ Feito. "Olá! O que você quer fazer?", com o botão
  grande "Escrever uma notícia nova" e atalhos para cada parte; listas com
  miniatura, categoria, data e autor.
- **E5 — Mesmo formato nas outras telas.** ✅ Feito. Episódio, verbete e
  integrante com o conteúdo à esquerda e os detalhes ao lado; categoria e
  páginas de texto com título e texto no estilo do site; menu com o nome das
  colunas. Sem termos técnicos ("slug", "id", "SEO", "(EN)"). Campo de foto
  com arquivo mostra só "Remover", com a dica de como trocar.

### P4 — Rodapé e marca
- Links institucionais do rodapé editáveis: adicionar, remover, reordenar,
  esconder, com nome PT/EN e link. Funciona como o menu.
- Frase, copyright e redes sociais na mesma tela.

### P5 — Notícias completas e rascunhos
- Campos editoriais no painel:
  - descrição para SEO;
  - fonte original (citação, DOI, link);
  - tipo de estudo;
  - revisão técnica;
  - tags;
  - erratas.
- ORCID/Lattes passam a vir do cadastro do integrante.
- **Rascunho**: `rascunho: true` no `.md`. O build ignora a notícia: ela não
  aparece em página, lista, RSS ou sitemap. Ao publicar, o campo sai.
- Os episódios e os verbetes também ganham rascunho.

### P6 — Status da publicação
- Depois de salvar, uma barra mostra "Publicando… → No ar" (ou "Falhou", com
  o motivo), lendo o workflow "Publicar o site" pela API do GitHub. Quando
  termina, mostra o link para a página atualizada.
- Mostra também se outra publicação está em andamento.

### P7 — Aprovação dos textos de colaboradores
- **Colaborador** (ex.: Eduardo):
  - vê e edita **só** o que é de autoria dele (notícias, episódios e verbetes
    em que ele é o autor), além de criar conteúdo novo;
  - não vê as telas de Páginas, Site e Configurações;
  - **não publica**: "Enviar para publicação" grava as mudanças numa branch
    própria (`envio/<integrante>/<data>`) e abre um pull request;
  - em "Meus envios" acompanha o status (aguardando, devolvido com
    comentário, publicado).
- **Admin**:
  - em "Envios para aprovação" vê cada envio com a prévia e o que mudou;
  - **Aprovar e publicar** faz o merge, e a publicação segue sozinha;
  - **Devolver para revisão** manda um comentário, e o envio volta para o
    colaborador;
  - o painel avisa se um envio mexe em algo que não é do autor.
- **Segurança de verdade** (não só esconder botões no painel): depende de
  duas coisas fora do código, que você faz no GitHub:
  1. cada colaborador entra com um token da **própria conta do GitHub**,
     como colaborador do repositório com permissão de escrita;
  2. uma **regra na `main`** (Settings → Rules → Rulesets): mudanças só por
     pull request, e só você (admin) pode mandar direto. Sem isso, um token
     com escrita consegue publicar pela API, ignorando o painel.

  Eu preparo o passo a passo; a configuração é sua.

> ⚠️ **IMPORTANTE — LEMBRAR (decisão de 2026-11-02).** Por enquanto a
> restrição dos colaboradores é **só de organização**: o painel esconde os
> botões e as telas, mas **não impede** a publicação. O token do Eduardo é da
> conta dele no GitHub e tem permissão de escrita, então, fora do painel (pela
> API ou pelo site do GitHub), ele ainda consegue alterar a `main` e
> publicar. Para a restrição valer de verdade, falta **criar a regra na
> `main`** (Settings → Rules → Rulesets → New branch ruleset: alvo `main`,
> "Require a pull request before merging", com o papel *Admin* em "Bypass
> list"). Como os tokens dos colaboradores já são das contas deles, nada mais
> precisa mudar no painel quando a regra for criada.

### P8 — Histórico e desfazer
- Cada item (notícia, episódio, página…) tem "Histórico": as últimas
  alterações (quem, quando, o que mudou), lidas dos commits do arquivo.
- **Restaurar esta versão** cria um commit novo com a versão antiga. Nada é
  apagado do histórico.
- Em "Publicação → Atividade recente" aparecem as últimas alterações do site
  inteiro.

### P9 — Prévia
- A prévia ao lado do editor usa o CSS do site e a mesma marcação das
  páginas, para notícia, episódio, verbete e páginas institucionais, em PT e
  EN.
- **Limite**: é uma reprodução fiel do layout, não o build real. O build real
  só existe depois da publicação, e aí a P6 dá o link.

---

## O que depende de você
- Revisar e fazer o merge de cada PR.
- Para a P7: criar a regra na `main` quando quiser que a restrição dos
  colaboradores valha de verdade (ver o aviso na P7). Os colaboradores já
  entram com tokens das próprias contas.
- Conteúdo: o preenchimento dos textos continua para o fim, como combinado.
