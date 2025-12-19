import { setupTiendaSuggestions } from "./tiendaSuggestions";

let teardown: (() => void) | null = null;
let listenersAttached = false;

const bootstrap = () => {
  teardown?.();
  teardown = setupTiendaSuggestions();
};

const handleBeforeSwap = () => {
  teardown?.();
  teardown = null;
};

const attachNavigationListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  document.addEventListener("astro:page-load", bootstrap);
  document.addEventListener("astro:before-swap", handleBeforeSwap);
};

if (typeof window !== "undefined") {
  attachNavigationListeners();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
}