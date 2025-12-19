import { setupTiendaSuggestions } from "./tiendaSuggestions";

let teardown: (() => void) | null = null;
let attached = false;

const bootstrap = () => {
  teardown?.();
  teardown = setupTiendaSuggestions();
};

const handleBeforeSwap = () => {
  teardown?.();
  teardown = null;
};

const attachListeners = () => {
  if (attached) return;
  attached = true;
  document.addEventListener("astro:page-load", bootstrap);
  document.addEventListener("astro:before-swap", handleBeforeSwap);
};

const init = () => {
  attachListeners();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
};

if (typeof window !== "undefined") {
  init();
}
