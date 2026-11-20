// Interatividade que sobra no cliente (o conteúdo já vem no HTML):
// menu overlay no celular e cabeçalho que recua ao rolar. Mesma lógica de
// setupNavOverlay()/setupHeaderAutoHide() do src/main.ts antigo.

function setupNavOverlay(): void {
  const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
  const overlay = document.getElementById("nav-overlay");
  if (!toggle || !overlay) return;

  const closeBtn = overlay.querySelector<HTMLButtonElement>(".nav-overlay-close");
  const voltarBtn = overlay.querySelector<HTMLButtonElement>(".nav-overlay-voltar");
  const camadas = Array.from(overlay.querySelectorAll<HTMLElement>(".nav-camada"));
  const abridores = Array.from(overlay.querySelectorAll<HTMLButtonElement>(".nav-camada-abrir"));

  // Camadas: "principal" (grupos e links soltos) ou a lista de um grupo
  // ("conteudo", "institucional"), com a seta ← para voltar.
  function mostrarCamada(nome: string): void {
    camadas.forEach((c) => (c.hidden = c.dataset.camada !== nome));
    const naPrincipal = nome === "principal";
    if (voltarBtn) voltarBtn.hidden = naPrincipal;
    abridores.forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.abre === nome)));
    const camada = camadas.find((c) => c.dataset.camada === nome);
    camada?.classList.remove("nav-camada--entra");
    void camada?.offsetWidth; // reinicia a animação de entrada
    camada?.classList.add("nav-camada--entra");
  }
  abridores.forEach((b) =>
    b.addEventListener("click", () => {
      mostrarCamada(b.dataset.abre!);
      voltarBtn?.focus();
    })
  );
  voltarBtn?.addEventListener("click", () => {
    const grupo = camadas.find((c) => !c.hidden)?.dataset.camada;
    mostrarCamada("principal");
    abridores.find((b) => b.dataset.abre === grupo)?.focus();
  });

  function open(): void {
    mostrarCamada("principal");
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
