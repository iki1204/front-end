import PureCounter from "@srexi/purecounterjs";

function init() {
  // inicia el contador en elementos con class="purecounter"
  new PureCounter();
}

// primera carga
init();

// si usas View Transitions / navegación SPA de Astro
document.addEventListener("astro:after-swap", () => {
  init();
});