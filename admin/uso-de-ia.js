// ============================================================================
// uso-de-ia.js — declaração de uso de inteligência artificial em notícias,
// episódios e verbetes (campo `ia` de cada item; o site lê o mesmo formato
// em src/lib/ia.ts).
//
//   sem o campo           → "não informado": nada aparece no site
//   { usou: false }       → "Não foi utilizado I.A. …" no fim do conteúdo
//   { usou: true, … }     → ferramenta, elaboração, usos, revisão humana…
//
// As imagens do texto geradas por I.A. são marcadas no próprio <img>
// (atributo data-ia, pelo menu da imagem no editor); a foto de capa, por
// `ia.capa`.
// ============================================================================

export const USOS = [
  ["pesquisa", "Pesquisa de referências"],
  ["correcao", "Correção ortográfica"],
  ["elaboracao", "Elaboração do texto"],
  ["traducao", "Tradução"],
  ["resumo", "Resumo de artigos científicos"],
  ["transcricao", "Transcrição de áudio"],
  ["audio", "Voz sintética, edição de áudio ou trilha gerada por I.A."],
  ["imagens", "Geração de imagens ou ilustrações"],
  ["roteiro", "Roteiro"],
  ["dados", "Análise de dados ou gráficos"],
];

export const ELABORACOES = [
  ["autor", "Inteiramente pelo autor"],
  ["auxilio", "Com auxílio da I.A."],
  ["ia", "Inteiramente pela I.A."],
];

export const TEXTO_SEM_IA = "Não foi utilizado I.A. para a produção desse conteúdo.";

/** "nao-informado" | "nao" | "sim" — para o selo e o filtro da lista. */
export function statusDoUsoDeIa(ia) {
  if (!ia || typeof ia !== "object") return "nao-informado";
  return ia.usou ? "sim" : "nao";
}

export const ROTULO_DO_STATUS = {
  "nao-informado": "I.A.: não informado",
  nao: "Sem I.A.",
  sim: "Com I.A.",
};

/** O HTML tem alguma imagem marcada como gerada por I.A.? */
export function temImagemDeIa(...htmls) {
  return htmls.some((html) => /<img\b[^>]*\bdata-ia\b/i.test(html || ""));
}

/** Problemas que impedem publicar. `nome`: como o item aparece na mensagem.
 * `imagensDeIa`: o texto tem imagem marcada como gerada por I.A. */
export function problemasDoUsoDeIa(ia, nome, imagensDeIa = false) {
  const problemas = [];
  if (ia?.usou && !ia.ferramenta?.trim()) problemas.push(`${nome}: diga qual ferramenta de I.A. foi utilizada`);
  if ((imagensDeIa || ia?.capa) && !ia?.usou) {
    problemas.push(`${nome}: há imagem marcada como gerada por I.A., então marque "Sim" em "Utilizou alguma ferramenta de I.A.?"`);
  }
  return problemas;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let contador = 0;

function campoDeTexto(rotulo, valor, { placeholder, multilinha, obrigatorio } = {}) {
  const wrap = el("div", "field ia-campo");
  const id = `ia-campo-${++contador}`;
  const label = el("label", "", rotulo);
  label.htmlFor = id;
  if (obrigatorio) label.appendChild(el("span", "ia-obrigatorio", " (obrigatório)"));
  const input = document.createElement(multilinha ? "textarea" : "input");
  if (!multilinha) input.type = "text";
  else input.rows = 3;
  input.id = id;
  input.className = "input";
  input.value = valor || "";
  if (placeholder) input.placeholder = placeholder;
  wrap.append(label, input);
  return { wrap, input };
}

// Grupo de botões de escolha única (como rádio, mas com cara de botão).
// Clicar no escolhido de novo não desmarca; `valor()` devolve a chave.
function escolhaUnica(rotulo, opcoes, atual, aoMudar) {
  const wrap = el("div", "field ia-campo");
  const titulo = el("span", "ia-pergunta", rotulo);
  wrap.appendChild(titulo);
  const grupo = el("div", "ia-botoes");
  grupo.setAttribute("role", "radiogroup");
  grupo.setAttribute("aria-label", rotulo);
  let escolhido = atual ?? null;
  const botoes = opcoes.map(([chave, texto]) => {
    const b = el("button", "ia-botao", texto);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      escolhido = chave;
      atualizar();
      aoMudar?.(chave);
    });
    grupo.appendChild(b);
    return [chave, b];
  });
  function atualizar() {
    botoes.forEach(([chave, b]) => {
      const ativo = chave === escolhido;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-checked", String(ativo));
    });
  }
  atualizar();
  wrap.appendChild(grupo);
  return {
    wrap,
    valor: () => escolhido,
    definir: (chave) => {
      escolhido = chave;
      atualizar();
    },
  };
}

/**
 * Bloco "Uso de inteligência artificial" da tela de um item.
 * - `ia`: o valor salvo (ou undefined = não informado).
 * - `capa`: o item tem foto de capa → mostra "A foto de capa foi gerada por I.A.".
 * - `imagensNoTexto`: o item tem editor de texto com imagens → mostra a dica
 *   de como marcar uma imagem do texto.
 * O elemento devolvido tem `.ler()`, que devolve o campo `ia` a gravar
 * (ou undefined), e dispara "input" quando algo muda (para o aviso de
 * alterações não publicadas da tela).
 */
export function campoUsoDeIa(ia, { capa = false, imagensNoTexto = false } = {}) {
  const raiz = el("div", "field full campo-ia");
  raiz.dataset.iaBloco = "";
  raiz.appendChild(el("h2", "previa-secao", "Uso de inteligência artificial"));
  raiz.appendChild(
    el("span", "field-hint", "Aparece no fim do conteúdo, nas duas línguas, e como um selo no topo e nas listas. Sem resposta, fica \"não informado\" e nada aparece no site.")
  );

  const avisar = () => raiz.dispatchEvent(new Event("input", { bubbles: true }));
  raiz.addEventListener("change", (e) => {
    if (e.target !== raiz) avisar();
  });

  let usou = ia ? Boolean(ia.usou) : null;
  const pergunta = escolhaUnica(
    "Utilizou alguma ferramenta de I.A. para produção do conteúdo?",
    [["sim", "Sim"], ["nao", "Não"]],
    usou === null ? null : usou ? "sim" : "nao",
    (v) => {
      usou = v === "sim";
      mostrar();
      avisar();
    }
  );
  raiz.appendChild(pergunta.wrap);

  const estado = el("p", "ia-estado");
  const limpar = el("button", "ia-limpar", "apagar resposta (voltar a \"não informado\")");
  limpar.type = "button";
  limpar.addEventListener("click", () => {
    usou = null;
    pergunta.definir(null);
    mostrar();
    avisar();
  });

  const previaNao = el("p", "ia-previa");
  previaNao.append("No fim da página vai aparecer: ", el("em", "", `"${TEXTO_SEM_IA}"`));

  // ── Detalhes (só com "Sim") ──
  const detalhes = el("div", "ia-detalhes");
  const ferramenta = campoDeTexto("1) Qual ferramenta foi utilizada?", ia?.ferramenta, { placeholder: "Ex.: ChatGPT, Claude, Gemini, NotebookLM", obrigatorio: true });
  const versao = campoDeTexto("Versão e data de uso (opcional)", ia?.versao, { placeholder: "Ex.: Claude Opus 5.5, nov/2026" });
  versao.wrap.appendChild(el("span", "field-hint", "Os modelos mudam rápido; a versão ajuda o leitor a entender o que foi usado."));

  const usosWrap = el("div", "field ia-campo");
  const caixas = {};
  const elaboracao = escolhaUnica("2) Como o texto foi elaborado?", ELABORACOES, ia?.elaboracao, () => travarElaboracao());
  usosWrap.appendChild(el("span", "ia-pergunta", "3) Como foi feito o uso da I.A.? (marque todas que valem)"));
  const lista = el("div", "ia-usos");
  const marcados = new Set(ia?.usos || []);
  USOS.forEach(([chave, texto]) => {
    const linha = el("label", "checkbox-row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = marcados.has(chave);
    linha.append(cb, document.createTextNode(texto));
    lista.appendChild(linha);
    caixas[chave] = cb;
  });
  usosWrap.appendChild(lista);
  const outro = campoDeTexto("Outro uso (opcional)", ia?.outroUso, { placeholder: "Descreva, se não estiver na lista" });

  // "Inteiramente pela I.A." já diz que a I.A. elaborou o texto.
  function travarElaboracao() {
    const cb = caixas.elaboracao;
    const travar = elaboracao.valor() === "ia";
    if (travar) cb.checked = true;
    cb.disabled = travar;
    cb.parentElement.title = travar ? "Marcado porque o texto foi elaborado inteiramente pela I.A." : "";
  }
  travarElaboracao();

  let revisado = ia?.revisado === undefined ? null : ia.revisado ? "sim" : "nao";
  const revisao = escolhaUnica("4) O conteúdo foi revisado e checado por uma pessoa?", [["sim", "Sim"], ["nao", "Não"]], revisado, (v) => {
    revisado = v;
    revisor.wrap.hidden = v !== "sim";
  });
  const revisor = campoDeTexto("Quem revisou?", ia?.revisor, { placeholder: "Nome de quem revisou e checou" });
  revisor.wrap.hidden = revisado !== "sim";

  const observacoes = campoDeTexto("Observações (opcional)", ia?.observacoes, { multilinha: true, placeholder: "Detalhe o que foi feito, se quiser. Ex.: a I.A. sugeriu artigos, todos lidos e conferidos pelo autor." });

  detalhes.append(ferramenta.wrap, versao.wrap, elaboracao.wrap, usosWrap, outro.wrap, revisao.wrap, revisor.wrap, observacoes.wrap);

  let capaCb = null;
  if (capa || imagensNoTexto) {
    const imagens = el("div", "field ia-campo");
    imagens.appendChild(el("span", "ia-pergunta", "Imagens geradas por I.A."));
    if (capa) {
      const linha = el("label", "checkbox-row");
      capaCb = document.createElement("input");
      capaCb.type = "checkbox";
      capaCb.checked = Boolean(ia?.capa);
      linha.append(capaCb, document.createTextNode("A foto de capa foi gerada por I.A."));
      imagens.appendChild(linha);
    }
    if (imagensNoTexto) {
      imagens.appendChild(el("span", "field-hint", "Para uma imagem do texto: clique nela e escolha \"Gerada por I.A.\". Ela ganha um aviso logo abaixo, no site."));
    }
    detalhes.appendChild(imagens);
  }

  raiz.append(estado, previaNao, detalhes);

  function mostrar() {
    detalhes.hidden = usou !== true;
    previaNao.hidden = usou !== false;
    estado.textContent = usou === null ? "Ainda não informado." : "";
    estado.hidden = usou !== null;
    if (usou !== null) {
      estado.hidden = false;
      estado.appendChild(limpar);
    }
  }
  mostrar();

  raiz.ler = () => {
    if (usou === null) return undefined;
    if (!usou) return { usou: false };
    const v = { usou: true, ferramenta: ferramenta.input.value.trim() };
    const ver = versao.input.value.trim();
    if (ver) v.versao = ver;
    if (elaboracao.valor()) v.elaboracao = elaboracao.valor();
    const usos = USOS.map(([chave]) => chave).filter((chave) => caixas[chave].checked);
    if (capaCb?.checked && !usos.includes("imagens")) usos.splice(USOS.findIndex(([c]) => c === "imagens"), 0, "imagens");
    v.usos = USOS.map(([c]) => c).filter((c) => usos.includes(c));
    const out = outro.input.value.trim();
    if (out) v.outroUso = out;
    if (revisado) v.revisado = revisado === "sim";
    const rev = revisor.input.value.trim();
    if (revisado === "sim" && rev) v.revisor = rev;
    const obs = observacoes.input.value.trim();
    if (obs) v.observacoes = obs;
    if (capaCb?.checked) v.capa = true;
    return v;
  };
  return raiz;
}
