import AOS from "aos";

function init() {
  AOS.init({
    duration: 800,
    easing: "ease-in-out-quart",
    once: true,
    offset: 50,
  });
}

// primera carga
init();

// cuando Astro navega sin recargar (View Transitions)
document.addEventListener("astro:after-swap", () => {
  init();
  AOS.refreshHard(); // importante para recalcular posiciones
});

