// Interatividade que sobra no cliente (o conteúdo já vem no HTML):
// menu overlay no celular e cabeçalho que recua ao rolar. Mesma lógica de
// setupNavOverlay()/setupHeaderAutoHide() do src/main.ts antigo.

function setupNavOverlay(): void {
  const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
  const overlay = document.getElementById("nav-overlay");
  if (!toggle || !overlay) return;

  const closeBtn = overlay.querySelector<HTMLButtonElement>(".nav-overlay-close");
  const voltarBtn = overlay.querySelector<HTMLButtonElement>(".nav-overlay-voltar");
  const versoes = Array.from(overlay.querySelectorAll<HTMLElement>(".nav-overlay-idioma"));
  // Idioma da página: o menu sempre abre nele.
  const idiomaDaPagina = versoes.find((v) => !v.hidden)?.dataset.idioma ?? "pt";
  const versaoAtual = () => versoes.find((v) => !v.hidden) ?? versoes[0];
  const camadas = () => Array.from(versaoAtual()?.querySelectorAll<HTMLElement>(".nav-camada") ?? []);
  const abridores = () => Array.from(versaoAtual()?.querySelectorAll<HTMLButtonElement>(".nav-camada-abrir") ?? []);

  // Camadas: "principal" (grupos e links soltos) ou a lista de um grupo
  // ("conteudo", "institucional"), com a seta ← para voltar.
  function mostrarCamada(nome: string): void {
    camadas().forEach((c) => (c.hidden = c.dataset.camada !== nome));
    if (voltarBtn) voltarBtn.hidden = nome === "principal";
    abridores().forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.abre === nome)));
    const camada = camadas().find((c) => c.dataset.camada === nome);
    camada?.classList.remove("nav-camada--entra");
    void camada?.offsetWidth; // reinicia a animação de entrada
    camada?.classList.add("nav-camada--entra");
  }

  // Bandeiras do menu: trocam o idioma dos itens ali mesmo, sem sair da
  // página nem fechar o menu; tocar num item leva à página naquele idioma.
  function mostrarIdioma(idioma: string): void {
    versoes.forEach((v) => (v.hidden = v.dataset.idioma !== idioma));
    mostrarCamada("principal");
  }

  overlay.addEventListener("click", (event) => {
    const alvo = event.target as Element;
    const abrir = alvo.closest<HTMLButtonElement>(".nav-camada-abrir");
    if (abrir) {
      mostrarCamada(abrir.dataset.abre!);
      voltarBtn?.focus();
      return;
    }
    const bandeira = alvo.closest<HTMLButtonElement>("[data-troca-idioma]");
    if (bandeira) {
      mostrarIdioma(bandeira.dataset.trocaIdioma!);
      versaoAtual()?.querySelector<HTMLButtonElement>(`[data-troca-idioma="${bandeira.dataset.trocaIdioma}"]`)?.focus();
    }
  });
  voltarBtn?.addEventListener("click", () => {
    const grupo = camadas().find((c) => !c.hidden)?.dataset.camada;
    mostrarCamada("principal");
    abridores().find((b) => b.dataset.abre === grupo)?.focus();
  });

  function open(): void {
    mostrarIdioma(idiomaDaPagina);
    overlay!.classList.add("is-open");
    toggle!.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-open");
  }

  function close(): void {
    overlay!.classList.remove("is-open");
    toggle!.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    if (isOpen) close();
    else open();
  });

  closeBtn?.addEventListener("click", close);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  // Esc: numa lista, volta para a primeira camada; nela, fecha o menu.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
    if (voltarBtn && !voltarBtn.hidden) voltarBtn.click();
    else close();
  });
}

function setupHeaderAutoHide(): void {
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!header) return;

  const scrollMargin = 12; // ignora tremores pequenos (ex: bounce do iOS)
  let lastY = window.scrollY;
  let ticking = false;

  function update(): void {
    const currentY = window.scrollY;
    const delta = currentY - lastY;
    if (Math.abs(delta) > scrollMargin) {
      const scrollingDown = delta > 0 && currentY > header!.offsetHeight;
      header!.classList.toggle("site-header--hidden", scrollingDown);
      lastY = currentY;
    }
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );
}

setupHeaderAutoHide();
setupNavOverlay();

// Listas do menu ("Conteúdo", "Institucional"): <details> abre e fecha
// sozinho (funciona sem JavaScript); aqui só fecham ao clicar fora, com Esc
// e quando outra é aberta.
function setupNavGrupos(): void {
  const grupos = Array.from(document.querySelectorAll<HTMLDetailsElement>(".nav-grupo"));
  if (!grupos.length) return;
  grupos.forEach((g) =>
    g.addEventListener("toggle", () => {
      if (g.open) grupos.forEach((outro) => outro !== g && (outro.open = false));
    })
  );
  document.addEventListener("click", (e) => {
    grupos.forEach((g) => g.open && !g.contains(e.target as Node) && (g.open = false));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    grupos.forEach((g) => {
      if (!g.open) return;
      g.open = false;
      g.querySelector("summary")?.focus();
    });
  });
}

setupNavGrupos();

// Filtro de notícias por categoria (ver FiltroCategorias.astro): esconde as
// notícias de outras categorias. Na página inicial, uma categoria escolhida
// troca o arranjo de sempre ([data-filtro-todos]) por uma grade só com as
// notícias dela ([data-filtro-grade]); o destaque de cima nunca muda. A
// escolha vai para o endereço (?categoria=...), para dar para compartilhar.
function setupFiltroCategorias(): void {
  document.querySelectorAll<HTMLDetailsElement>(".filtro-categorias").forEach((filtro) => {
    const alvo = document.getElementById(filtro.dataset.filtroAlvo ?? "");
    if (!alvo) return;
    filtro.hidden = false;
    const todos = alvo.querySelector<HTMLElement>("[data-filtro-todos]");
    const grade = alvo.querySelector<HTMLElement>("[data-filtro-grade]");
    const vazio = alvo.querySelector<HTMLElement>("[data-filtro-vazio]");
    const atual = filtro.querySelector<HTMLElement>(".filtro-categorias-atual");
    const botoes = Array.from(filtro.querySelectorAll<HTMLButtonElement>("[data-filtro]"));

    function aplicar(pedido: string, atualizarEndereco = true): void {
      const botao = botoes.find((b) => b.dataset.filtro === pedido) ?? botoes[0];
      const slug = botao.dataset.filtro ?? "";
      botoes.forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
      if (atual) atual.textContent = botao.textContent?.trim() ?? "";
      filtro.classList.toggle("is-ativo", slug !== "");
      if (todos && grade) {
        todos.hidden = slug !== "";
        grade.hidden = slug === "";
      }
      let visiveis = 0;
      (grade ?? alvo).querySelectorAll<HTMLElement>("[data-categoria]").forEach((cartao) => {
        const mostra = slug === "" || cartao.dataset.categoria === slug;
        cartao.hidden = !mostra;
        if (mostra) visiveis++;
      });
      if (vazio) vazio.hidden = visiveis > 0;
      if (atualizarEndereco) {
        const url = new URL(location.href);
        if (slug) url.searchParams.set("categoria", slug);
        else url.searchParams.delete("categoria");
        history.replaceState(history.state, "", url);
      }
    }

    botoes.forEach((b) =>
      b.addEventListener("click", () => {
        aplicar(b.dataset.filtro ?? "");
        filtro.open = false;
        filtro.querySelector("summary")?.focus({ focusVisible: false } as FocusOptions);
      })
    );
    document.addEventListener("click", (e) => {
      if (filtro.open && !filtro.contains(e.target as Node)) filtro.open = false;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && filtro.open) {
        filtro.open = false;
        filtro.querySelector("summary")?.focus();
      }
    });

    const inicial = new URLSearchParams(location.search).get("categoria");
    if (inicial) aplicar(inicial, false);
  });
}

setupFiltroCategorias();
