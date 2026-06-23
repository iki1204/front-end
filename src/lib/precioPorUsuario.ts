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

type SecurePriceResponse = {
  authenticated: false;
} | {
  authenticated: true;
  priceRaw: number | null;
  hasOffer: boolean;
  offerPriceRaw: number | null;
  originalPrice: string;
  price: string;
  offerPrice: string | null;
};

let secureCartInterceptorBound = false;
const secureResolvedPrices = new Map<string, number | null>();

const getSecureCardKey = (card: HTMLElement) => {
  const button = card.querySelector<HTMLElement>("[data-action='add-to-cart']");
  return button?.dataset.productId ?? card.dataset.priceSlug ?? null;
};

const setCardPriceText = (card: HTMLElement, normal: string, offer: string | null) => {
  const normalEl = card.querySelector<HTMLElement>("[data-user-price]");
  const offerEl = card.querySelector<HTMLElement>("[data-user-offer-price]");

  if (normalEl) {
    normalEl.textContent = normal;
  }

  if (offerEl) {
    offerEl.textContent = offer ?? normal;
  }
};

const bindSecureCartInterceptor = () => {
  if (secureCartInterceptorBound) return;

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const button = target.closest(
        "[data-action='add-to-cart'][data-price-slug]",
      ) as HTMLElement | null;

      if (!button) return;

      const secureKey = button.dataset.productId ?? button.dataset.priceSlug ?? null;
      if (!secureKey) {
        button.removeAttribute("data-product-price");
        return;
      }

      const priceRaw = secureResolvedPrices.get(secureKey);
      if (typeof priceRaw === "number" && Number.isFinite(priceRaw)) {
        button.dataset.productPrice = String(priceRaw);
      } else {
        button.removeAttribute("data-product-price");
      }
    },
    { capture: true },
  );

  secureCartInterceptorBound = true;
};

const refreshSecureCardPrices = async () => {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-secure-price-card][data-price-slug]"));
  if (cards.length === 0) return;

  bindSecureCartInterceptor();

  const session = parseStoredSession();
  if (!session?.jwt) {
    cards.forEach((card) => {
      setCardPriceText(card, "Consultar", null);
      const secureKey = getSecureCardKey(card);
      if (secureKey) {
        secureResolvedPrices.delete(secureKey);
      }
    });
    return;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.jwt}`,
  };

  if (session?.user?.tipoUsuario !== undefined && session?.user?.tipoUsuario !== null) {
    headers["X-Tipo-Usuario"] = String(session.user.tipoUsuario);
  }

  await Promise.all(
    cards.map(async (card) => {
      const slug = card.dataset.priceSlug;
      const secureKey = getSecureCardKey(card);

      if (!slug || !secureKey) {
        setCardPriceText(card, "Consultar", null);
        return;
      }

      try {
        const response = await fetch(`/api/precio/${encodeURIComponent(slug)}`, {
          headers,
          cache: "no-store",
        });

        if (!response.ok) {
          setCardPriceText(card, "Consultar", null);
          secureResolvedPrices.delete(secureKey);
          return;
        }

        const payload = (await response.json()) as SecurePriceResponse;

        if (!payload.authenticated) {
          setCardPriceText(card, "Consultar", null);
          secureResolvedPrices.delete(secureKey);
          return;
        }

        const activeRaw =
          payload.hasOffer && typeof payload.offerPriceRaw === "number"
            ? payload.offerPriceRaw
            : payload.priceRaw;

        secureResolvedPrices.set(
          secureKey,
          typeof activeRaw === "number" && Number.isFinite(activeRaw) ? activeRaw : null,
        );

        setCardPriceText(card, payload.originalPrice, payload.hasOffer ? payload.offerPrice : null);
      } catch {
        setCardPriceText(card, "Consultar", null);
        secureResolvedPrices.delete(secureKey);
      }
    }),
  );
};

const refreshPriceDisplays = () => {
  const session = parseStoredSession();
  const tipoUsuario = normalizeTipoUsuario(session?.user?.tipoUsuario);
  const priceKey = hasActiveSession(session) && tipoUsuario ? tipoUsuario : "default";

  document.querySelectorAll<HTMLElement>("[data-user-price]").forEach((element) => {
    if (element.closest("[data-secure-price-card]")) return;
    const priceValue = resolvePriceValue(element, priceKey);
    if (priceValue !== null) {
      element.textContent = priceValue;
    }
  });

  document.querySelectorAll<HTMLElement>("[data-user-offer-price]").forEach((element) => {
    if (element.closest("[data-secure-price-card]")) return;
    const priceValue = resolvePriceValue(element, priceKey);
    if (priceValue !== null) {
      element.textContent = priceValue;
    }
  });

  document.querySelectorAll<HTMLElement>("[data-user-price-target]").forEach((element) => {
    if (element.closest("[data-secure-price-card]")) return;
    const target = element.dataset.userPriceTarget;
    if (!target) return;
    const priceValue = resolvePriceValue(element, priceKey);
    if (priceValue !== null) {
      element.dataset[target] = priceValue;
    }
  });

  void refreshSecureCardPrices();
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
