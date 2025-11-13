import {
  destroyCartWidgets,
  destroyCheckoutPage,
  initCartActions as bindCartActions,
  initCartWidgets,
  initCheckoutPage,
} from "./carritoTienda";

export const initCartWidget = (root?: Document | HTMLElement) => {
  if (typeof window === "undefined") return;
  initCartWidgets(root ?? document);
};

export const initCartActions = () => {
  if (typeof window === "undefined") return;
  bindCartActions();
};

export { initCheckoutPage };

const handlePageLoad = () => {
  initCartWidgets();
  initCheckoutPage();
};

const handleBeforeSwap = () => {
  destroyCartWidgets();
  destroyCheckoutPage();
};

let listenersAttached = false;

const attachNavigationListeners = () => {
  if (listenersAttached || typeof window === "undefined") {
    return;
  }

  listenersAttached = true;
  document.addEventListener("astro:page-load", handlePageLoad);
  document.addEventListener("astro:before-swap", handleBeforeSwap);
};

const bootstrap = () => {
  initCartActions();
  initCartWidgets();
  initCheckoutPage();
  attachNavigationListeners();
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
        document.addEventListener(
      "DOMContentLoaded",
      () => {
        bootstrap();
      },
      { once: true },
    );
  } else {
    bootstrap();
  }

}