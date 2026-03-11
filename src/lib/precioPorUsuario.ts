import {
  SESSION_EVENT,
  SESSION_STORAGE_KEY,
  hasActiveSession,
  normalizeTipoUsuario,
  parseStoredSession,
} from "./sessionUser";

const getPriceDatasetKey = (priceKey: string) => {
  if (priceKey === "default") return "priceDefault";
  return `price${priceKey.charAt(0).toUpperCase()}${priceKey.slice(1)}`;
};

const resolvePriceValue = (element: HTMLElement, priceKey: string) => {
  const datasetKey = getPriceDatasetKey(priceKey);
  return element.dataset[datasetKey] ?? element.dataset.priceDefault ?? null;
};

const refreshPriceDisplays = () => {
  const session = parseStoredSession();
  const tipoUsuario = normalizeTipoUsuario(session?.user?.tipoUsuario);
  const priceKey = hasActiveSession(session) && tipoUsuario ? tipoUsuario : "default";

  document.querySelectorAll<HTMLElement>("[data-user-price]").forEach((element) => {
    const priceValue = resolvePriceValue(element, priceKey);
    if (priceValue !== null) {
      element.textContent = priceValue;
    }
  });

  document.querySelectorAll<HTMLElement>("[data-user-offer-price]").forEach((element) => {
    const priceValue = resolvePriceValue(element, priceKey);
    if (priceValue !== null) {
      element.textContent = priceValue;
    }
  });

  document.querySelectorAll<HTMLElement>("[data-user-price-target]").forEach((element) => {
    const target = element.dataset.userPriceTarget;
    if (!target) return;
    const priceValue = resolvePriceValue(element, priceKey);
    if (priceValue !== null) {
      element.dataset[target] = priceValue;
    }
  });
};

const initPriceByUser = () => {
  refreshPriceDisplays();

  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY) {
      refreshPriceDisplays();
    }
  });

  window.addEventListener(SESSION_EVENT, refreshPriceDisplays);
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPriceByUser, { once: true });
  } else {
    initPriceByUser();
  }
}
