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

### P1 — Estrutura e limpeza
- Nova navegação lateral (acima) e o padrão de tela com abas PT | EN.
- Remove os 8 campos sem efeito.
- Menu do site com uma tela própria em "Site → Menu".
- **Aviso de versão**: o painel confere se há uma versão mais nova publicada
  e pede para recarregar antes de salvar. Isso resolve o problema do cache.

### P2 — Integrantes com identificador pelo nome
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

### P3 — Páginas editáveis
- Sobre, Expediente, Política Editorial, Normas e Privacidade editáveis no
  painel: título, descrição (SEO), data de atualização e o texto completo, com
  o mesmo editor de texto das notícias, em PT e EN.
- O painel lê e grava os `.md` de `src/content/paginas/`, como já faz com as
  notícias.
- Textos de abertura das páginas Início, Notícias, Podcast, Estudos e Contato
  reunidos em "Páginas".

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
- Para a P7: decidir como os colaboradores entram (ver acima) e criar a regra
  na `main`.
- Conteúdo: o preenchimento dos textos continua para o fim, como combinado.
