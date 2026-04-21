/**
 * precioSeguro.ts
 *
 * Fetches the product price from the authenticated server endpoint and updates
 * the UI. Prices are NEVER embedded in the HTML — they are only loaded here,
 * stored in a JS closure, and injected into the cart button at click-time.
 *
 * This replaces the insecure data-price-pvp* attribute pattern for the
 * product detail page ([slug].astro).
 */

import {
  SESSION_EVENT,
  SESSION_STORAGE_KEY,
  parseStoredSession,
} from "./sessionUser";

type PriceResponse = {
  authenticated: false;
} | {
  authenticated: true;
  price: string;
  priceRaw: number | null;
  hasOffer: boolean;
  offerPrice: string | null;
  offerPriceRaw: number | null;
  originalPrice: string;
  isAdmin?: boolean;
  selectedPriceKey?: string;
  allPrices?: {
    pvp1: { raw: number | null; formatted: string };
    pvp2: { raw: number | null; formatted: string };
    pvp3: { raw: number | null; formatted: string };
    pvp4: { raw: number | null; formatted: string };
  };
};

/** Price stored in closure — never written to the DOM until click-time. */
let _resolvedPriceRaw: number | null = null;

const setResolvedPrice = (raw: number | null) => {
  _resolvedPriceRaw = raw;
};

const updatePriceDisplays = (data: Extract<PriceResponse, { authenticated: true }>) => {
  // --- Regular price (no-offer mode) ---
  document.querySelectorAll<HTMLElement>("[data-product-price-display]").forEach((el) => {
    el.textContent = data.price;
    el.classList.remove("animate-pulse");
  });

  // --- Crossed-out original price (offer mode) ---
  document.querySelectorAll<HTMLElement>("[data-product-original-price-display]").forEach((el) => {
    el.textContent = data.originalPrice;
    el.classList.remove("animate-pulse");
  });

  // --- Offer price (offer mode) ---
  document.querySelectorAll<HTMLElement>("[data-product-offer-price-display]").forEach((el) => {
    el.textContent = data.hasOffer && data.offerPrice ? data.offerPrice : data.price;
    el.classList.remove("animate-pulse");
  });
};

const resetPriceDisplays = () => {
  const placeholders = [
    "[data-product-price-display]",
    "[data-product-original-price-display]",
    "[data-product-offer-price-display]",
  ];
  placeholders.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.textContent = "···";
      el.classList.add("animate-pulse");
    });
  });
  setResolvedPrice(null);
};

const renderAdminPriceSelector = (data: Extract<PriceResponse, { authenticated: true }>) => {
  const container = document.getElementById("admin-price-selector");
  if (!container) return;

  if (!data.isAdmin || !data.allPrices) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");

  // Avoid re-rendering if already built
  if (container.querySelector("select")) return;

  const allPrices = data.allPrices;
  const labels: Record<string, string> = {
    pvp1: "Precio 1 (PVP1)",
    pvp2: "Precio 2 (PVP2)",
    pvp3: "Precio 3 (PVP3)",
    pvp4: "Precio 4 (PVP4)",
  };

  const select = document.createElement("select");
  select.className =
    "rounded-xl border border-primary/30 bg-white dark:bg-zinc-900 dark:border-primary/40 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer";

  Object.entries(allPrices).forEach(([key]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${labels[key] ?? key}`;
    if (key === data.selectedPriceKey) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const chosen = allPrices[select.value as keyof typeof allPrices];
    if (!chosen) return;
    setResolvedPrice(chosen.raw);
    // Update price displays with selected price
    document.querySelectorAll<HTMLElement>("[data-product-price-display]").forEach((el) => {
      el.textContent = chosen.formatted;
      el.classList.remove("animate-pulse");
    });
    document.querySelectorAll<HTMLElement>("[data-product-offer-price-display]").forEach((el) => {
      el.textContent = chosen.formatted;
      el.classList.remove("animate-pulse");
    });
    document.querySelectorAll<HTMLElement>("[data-product-original-price-display]").forEach((el) => {
      el.textContent = chosen.formatted;
      el.classList.remove("animate-pulse");
    });
  });

  container.appendChild(select);
};

const fetchAndApplyPrice = async (slug: string) => {
  const session = parseStoredSession();

  // Solo se requiere JWT válido — el endpoint maneja tipoUsuario con fallback a pvp1
  if (!session?.jwt) {
    resetPriceDisplays();
    return;
  }

  try {
    const tipoUsuario = session?.user?.tipoUsuario ?? null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.jwt}`,
    };
    if (tipoUsuario !== null && tipoUsuario !== undefined) {
      headers["X-Tipo-Usuario"] = String(tipoUsuario);
    }
    const res = await fetch(`/api/precio/${encodeURIComponent(slug)}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      resetPriceDisplays();
      return;
    }

    const data: PriceResponse = await res.json();

    if (!data.authenticated) {
      resetPriceDisplays();
      return;
    }

    // Store the numeric price in the closure — NOT in the DOM
    const activeRaw = data.hasOffer && data.offerPriceRaw != null
      ? data.offerPriceRaw
      : data.priceRaw;

    setResolvedPrice(activeRaw);
    updatePriceDisplays(data);
    renderAdminPriceSelector(data);
  } catch {
    // Network error — leave placeholder visible
    resetPriceDisplays();
  }
};

/**
 * Intercepts click events on the add-to-cart button BEFORE the global cart
 * handler runs (capture phase), injecting the price from the closure.
 * The attribute is removed immediately after the click so it is never
 * permanently present in the DOM.
 */
const interceptCartButton = () => {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const btn = target.closest(
        "[data-action='add-to-cart'][data-price-slug]",
      ) as HTMLElement | null;

      if (!btn) return;

      if (_resolvedPriceRaw !== null) {
        btn.dataset.productPrice = String(_resolvedPriceRaw);
      } else {
        // No price resolved (guest or error) — remove the attribute so the
        // cart handler stores null price rather than a stale value.
        btn.removeAttribute("data-product-price");
      }
    },
    { capture: true },
  );
};

const initPrecioSeguro = () => {
  const cartBtn = document.querySelector<HTMLElement>(
    "[data-action='add-to-cart'][data-price-slug]",
  );
  const slug = cartBtn?.dataset.priceSlug;

  if (!slug) return;

  interceptCartButton();
  fetchAndApplyPrice(slug);

  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY) fetchAndApplyPrice(slug);
  });

  window.addEventListener(SESSION_EVENT, () => fetchAndApplyPrice(slug));
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPrecioSeguro, { once: true });
  } else {
    initPrecioSeguro();
  }
}
