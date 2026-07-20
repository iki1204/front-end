import {
  SESSION_EVENT,
  SESSION_STORAGE_KEY,
  hasActiveSession,
  normalizeTipoUsuario,
  parseStoredSession,
} from "./sessionUser";

type PriceListNumber = "1" | "2" | "3" | "4";
type PriceKey = `pvp${PriceListNumber}`;

type SecurePriceValue = {
  raw: number | null;
  formatted: string;
};

type AuthenticatedSecurePriceResponse = {
  authenticated: true;
  priceRaw: number | null;
  hasOffer: boolean;
  offerPriceRaw: number | null;
  originalPrice: string;
  price: string;
  offerPrice: string | null;
  isAdmin?: boolean;
  selectedPriceKey?: string;
  allPrices?: Record<PriceKey, SecurePriceValue>;
};

type SecurePriceResponse =
  | { authenticated: false }
  | AuthenticatedSecurePriceResponse;

type ResolvedCardPrice = {
  normalFormatted: string;
  offerFormatted: string | null;
  activeRaw: number | null;
};

const STORE_SELECTOR_ID = "store-admin-price-selector";
const STORE_PRICE_STORAGE_KEY = "tiendaAdminPriceList";
const VALID_PRICE_KEYS = new Set<PriceKey>(["pvp1", "pvp2", "pvp3", "pvp4"]);

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const secureResolvedPrices = new Map<string, number | null>();
const securePayloads = new Map<string, AuthenticatedSecurePriceResponse>();

let secureCartInterceptorBound = false;
let storeNavigationGuardsBound = false;
let initialized = false;
let selectedStorePriceKey: PriceKey | null = null;

const isTrue = (value: unknown): boolean =>
  value === true || value === 1 || String(value).trim().toLowerCase() === "true";

const normalizePriceKey = (value: unknown): PriceKey | null => {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim().toLowerCase();
  if (VALID_PRICE_KEYS.has(normalized as PriceKey)) return normalized as PriceKey;
  if (/^[1-4]$/.test(normalized)) return `pvp${normalized}` as PriceKey;

  return null;
};

const priceKeyToList = (key: PriceKey): PriceListNumber =>
  key.replace("pvp", "") as PriceListNumber;

const hasStoreSelector = () =>
  document.getElementById(STORE_SELECTOR_ID) instanceof HTMLElement;

const readStoredStorePriceKey = (): PriceKey | null => {
  if (!hasStoreSelector()) return null;

  const fromUrl = normalizePriceKey(
    new URLSearchParams(window.location.search).get("priceList"),
  );
  if (fromUrl) return fromUrl;

  try {
    return normalizePriceKey(localStorage.getItem(STORE_PRICE_STORAGE_KEY));
  } catch {
    return null;
  }
};

const getPriceDatasetKey = (priceKey: string) => {
  if (priceKey === "default") return "priceDefault";
  return `price${priceKey.charAt(0).toUpperCase()}${priceKey.slice(1)}`;
};

const resolvePriceValue = (element: HTMLElement, priceKey: string) => {
  const datasetKey = getPriceDatasetKey(priceKey);
  return element.dataset[datasetKey] ?? element.dataset.priceDefault ?? null;
};

const getSecureCardKey = (card: HTMLElement) => {
  const button = card.querySelector<HTMLElement>("[data-action='add-to-cart']");
  return button?.dataset.productId ?? card.dataset.priceSlug ?? null;
};

const isAvailablePrice = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const formatPrice = (value: number | null): string =>
  isAvailablePrice(value) ? currencyFormatter.format(value) : "Consultar";

const getOfferMultiplier = (
  payload: AuthenticatedSecurePriceResponse,
): number | null => {
  if (
    !payload.hasOffer ||
    !isAvailablePrice(payload.priceRaw) ||
    typeof payload.offerPriceRaw !== "number" ||
    !Number.isFinite(payload.offerPriceRaw) ||
    payload.offerPriceRaw < 0
  ) {
    return null;
  }

  return payload.offerPriceRaw / payload.priceRaw;
};

const resolveCardPrice = (
  payload: AuthenticatedSecurePriceResponse,
  adminPriceKey: PriceKey | null,
): ResolvedCardPrice => {
  if (payload.isAdmin && payload.allPrices && adminPriceKey) {
    const chosen = payload.allPrices[adminPriceKey];
    const raw = isAvailablePrice(chosen?.raw) ? chosen.raw : null;
    const offerMultiplier = getOfferMultiplier(payload);
    const offerRaw =
      raw !== null && offerMultiplier !== null ? raw * offerMultiplier : null;

    return {
      normalFormatted: raw !== null ? chosen.formatted : "Consultar",
      offerFormatted: isAvailablePrice(offerRaw) ? formatPrice(offerRaw) : null,
      activeRaw: isAvailablePrice(offerRaw) ? offerRaw : raw,
    };
  }

  const activeRaw =
    payload.hasOffer && isAvailablePrice(payload.offerPriceRaw)
      ? payload.offerPriceRaw
      : isAvailablePrice(payload.priceRaw)
        ? payload.priceRaw
        : null;

  return {
    normalFormatted: payload.originalPrice || payload.price || "Consultar",
    offerFormatted:
      payload.hasOffer && payload.offerPrice ? payload.offerPrice : null,
    activeRaw,
  };
};

const setCardPriceText = (
  card: HTMLElement,
  normal: string,
  offer: string | null,
) => {
  const normalEl = card.querySelector<HTMLElement>("[data-user-price]");
  const offerEl = card.querySelector<HTMLElement>("[data-user-offer-price]");

  if (normalEl) {
    normalEl.textContent = normal;
    normalEl.classList.toggle("line-through", Boolean(offer));
  }

  if (offerEl) {
    if (offer) {
      offerEl.textContent = offer;
      offerEl.classList.remove("hidden");
    } else {
      offerEl.textContent = "";
      offerEl.classList.add("hidden");
    }
  }
};

const applyPayloadToCard = (
  card: HTMLElement,
  secureKey: string,
  payload: AuthenticatedSecurePriceResponse,
) => {
  const resolved = resolveCardPrice(payload, selectedStorePriceKey);

  setCardPriceText(
    card,
    resolved.normalFormatted,
    resolved.offerFormatted,
  );

  secureResolvedPrices.set(secureKey, resolved.activeRaw);

  if (selectedStorePriceKey && payload.isAdmin) {
    card.dataset.selectedPriceKey = selectedStorePriceKey;
  } else {
    delete card.dataset.selectedPriceKey;
  }
};

const applySelectedPriceToLoadedCards = () => {
  document
    .querySelectorAll<HTMLElement>("[data-secure-price-card][data-price-slug]")
    .forEach((card) => {
      const secureKey = getSecureCardKey(card);
      if (!secureKey) return;

      const payload = securePayloads.get(secureKey);
      if (payload) applyPayloadToCard(card, secureKey, payload);
    });
};

const updateStoreSelectorButtons = () => {
  const container = document.getElementById(STORE_SELECTOR_ID);
  if (!(container instanceof HTMLElement)) return;

  container
    .querySelectorAll<HTMLButtonElement>("[data-store-price-key]")
    .forEach((button) => {
      const key = normalizePriceKey(button.dataset.storePriceKey);
      const active = key !== null && key === selectedStorePriceKey;

      button.classList.toggle("bg-primary", active);
      button.classList.toggle("text-white", active);
      button.classList.toggle("shadow-sm", active);
      button.classList.toggle("bg-white", !active);
      button.classList.toggle("text-zinc-600", !active);
      button.classList.toggle("dark:bg-zinc-900", !active);
      button.classList.toggle("dark:text-zinc-300", !active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
};

const shouldPreservePriceList = (url: URL) =>
  url.origin === window.location.origin &&
  (url.pathname.startsWith("/tienda") || url.pathname.startsWith("/producto/"));

const addPriceListToUrlValue = (rawValue: string, priceList: PriceListNumber) => {
  if (!rawValue || rawValue.startsWith("#")) return rawValue;

  try {
    const url = new URL(rawValue, window.location.origin);
    if (!shouldPreservePriceList(url)) return rawValue;

    url.searchParams.set("priceList", priceList);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawValue;
  }
};

const ensureFormPriceList = (
  form: HTMLFormElement,
  priceList: PriceListNumber,
) => {
  const method = (form.getAttribute("method") ?? "get").toLowerCase();
  if (method !== "get") return;

  let input = form.querySelector<HTMLInputElement>("input[name='priceList']");
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = "priceList";
    input.dataset.storePriceList = "true";
    form.appendChild(input);
  }

  input.value = priceList;
};

const preserveStorePriceListInNavigation = (priceKey: PriceKey) => {
  const priceList = priceKeyToList(priceKey);

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) return;
    anchor.setAttribute("href", addPriceListToUrlValue(href, priceList));
  });

  document
    .querySelectorAll<HTMLOptionElement>("select option[value]")
    .forEach((option) => {
      option.value = addPriceListToUrlValue(option.value, priceList);
    });

  document
    .querySelectorAll<HTMLFormElement>("form")
    .forEach((form) => ensureFormPriceList(form, priceList));
};

const persistStorePriceKey = (priceKey: PriceKey) => {
  const priceList = priceKeyToList(priceKey);

  try {
    localStorage.setItem(STORE_PRICE_STORAGE_KEY, priceList);
  } catch {
    // La selección continúa funcionando aunque localStorage no esté disponible.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("priceList", priceList);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

  preserveStorePriceListInNavigation(priceKey);
};

const selectStorePriceKey = (priceKey: PriceKey) => {
  selectedStorePriceKey = priceKey;
  persistStorePriceKey(priceKey);
  updateStoreSelectorButtons();
  applySelectedPriceToLoadedCards();
};

const renderStoreAdminSelector = (show: boolean) => {
  const container = document.getElementById(STORE_SELECTOR_ID);
  if (!(container instanceof HTMLElement)) return;

  if (!show) {
    container.classList.add("hidden");
    container.replaceChildren();
    return;
  }

  container.classList.remove("hidden");

  if (!container.dataset.priceSelectorBuilt) {
    container.dataset.priceSelectorBuilt = "true";
    container.innerHTML = `
      <span class="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Ver precios:
      </span>
      <div class="inline-flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800" role="group" aria-label="Lista de precios">
        ${(["pvp1", "pvp2", "pvp3", "pvp4"] as PriceKey[])
          .map(
            (key) => `
              <button
                type="button"
                data-store-price-key="${key}"
                class="inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg px-3 text-xs font-bold transition hover:bg-primary/10 hover:text-primary"
                title="Mostrar Precio ${priceKeyToList(key)} en todos los productos"
              >P${priceKeyToList(key)}</button>
            `,
          )
          .join("")}
      </div>
    `;

    container.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("[data-store-price-key]");
      const key = normalizePriceKey(button?.dataset.storePriceKey);
      if (key) selectStorePriceKey(key);
    });
  }

  updateStoreSelectorButtons();
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
      if (isAvailablePrice(priceRaw)) {
        button.dataset.productPrice = String(priceRaw);
      } else {
        button.removeAttribute("data-product-price");
      }
    },
    { capture: true },
  );

  secureCartInterceptorBound = true;
};

const bindStoreNavigationGuards = () => {
  if (storeNavigationGuardsBound) return;
  storeNavigationGuardsBound = true;

  document.addEventListener(
    "click",
    (event) => {
      if (!selectedStorePriceKey || !hasStoreSelector()) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      anchor.setAttribute(
        "href",
        addPriceListToUrlValue(href, priceKeyToList(selectedStorePriceKey)),
      );
    },
    { capture: true },
  );

  document.addEventListener(
    "submit",
    (event) => {
      if (!selectedStorePriceKey || !hasStoreSelector()) return;
      if (!(event.target instanceof HTMLFormElement)) return;

      ensureFormPriceList(
        event.target,
        priceKeyToList(selectedStorePriceKey),
      );
    },
    { capture: true },
  );
};

const refreshSecureCardPrices = async () => {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-secure-price-card][data-price-slug]",
    ),
  );
  if (cards.length === 0) {
    renderStoreAdminSelector(false);
    return;
  }

  bindSecureCartInterceptor();
  bindStoreNavigationGuards();

  const session = parseStoredSession();
  if (!session?.jwt) {
    renderStoreAdminSelector(false);
    selectedStorePriceKey = null;
    securePayloads.clear();

    cards.forEach((card) => {
      setCardPriceText(card, "Consultar", null);
      const secureKey = getSecureCardKey(card);
      if (secureKey) secureResolvedPrices.delete(secureKey);
    });
    return;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.jwt}`,
  };

  if (session?.user?.tipoUsuario !== undefined && session?.user?.tipoUsuario !== null) {
    headers["X-Tipo-Usuario"] = String(session.user.tipoUsuario);
  }

  securePayloads.clear();

  const results = await Promise.all(
    cards.map(async (card) => {
      const slug = card.dataset.priceSlug;
      const secureKey = getSecureCardKey(card);

      if (!slug || !secureKey) {
        setCardPriceText(card, "Consultar", null);
        return null;
      }

      try {
        const response = await fetch(`/api/precio/${encodeURIComponent(slug)}`, {
          headers,
          cache: "no-store",
        });

        if (!response.ok) {
          setCardPriceText(card, "Consultar", null);
          secureResolvedPrices.delete(secureKey);
          return null;
        }

        const payload = (await response.json()) as SecurePriceResponse;
        if (!payload.authenticated) {
          setCardPriceText(card, "Consultar", null);
          secureResolvedPrices.delete(secureKey);
          return null;
        }

        securePayloads.set(secureKey, payload);
        return { card, secureKey, payload };
      } catch {
        setCardPriceText(card, "Consultar", null);
        secureResolvedPrices.delete(secureKey);
        return null;
      }
    }),
  );

  const validResults = results.filter(
    (
      result,
    ): result is {
      card: HTMLElement;
      secureKey: string;
      payload: AuthenticatedSecurePriceResponse;
    } => Boolean(result),
  );

  const adminResult = validResults.find(
    ({ payload }) => payload.isAdmin === true && Boolean(payload.allPrices),
  );

  if (hasStoreSelector() && adminResult) {
    selectedStorePriceKey =
      readStoredStorePriceKey() ??
      normalizePriceKey(adminResult.payload.selectedPriceKey) ??
      "pvp1";

    renderStoreAdminSelector(true);
    persistStorePriceKey(selectedStorePriceKey);
  } else {
    selectedStorePriceKey = null;
    renderStoreAdminSelector(false);
  }

  validResults.forEach(({ card, secureKey, payload }) => {
    applyPayloadToCard(card, secureKey, payload);
  });
};

const refreshPriceDisplays = () => {
  const session = parseStoredSession();
  const tipoUsuario = normalizeTipoUsuario(session?.user?.tipoUsuario);
  const priceKey = hasActiveSession(session) && tipoUsuario ? tipoUsuario : "default";

  document.querySelectorAll<HTMLElement>("[data-user-price]").forEach((element) => {
    if (element.closest("[data-secure-price-card]")) return;
    const priceValue = resolvePriceValue(element, priceKey);
    if (priceValue !== null) element.textContent = priceValue;
  });

  document
    .querySelectorAll<HTMLElement>("[data-user-offer-price]")
    .forEach((element) => {
      if (element.closest("[data-secure-price-card]")) return;
      const priceValue = resolvePriceValue(element, priceKey);
      if (priceValue !== null) element.textContent = priceValue;
    });

  document
    .querySelectorAll<HTMLElement>("[data-user-price-target]")
    .forEach((element) => {
      if (element.closest("[data-secure-price-card]")) return;
      const target = element.dataset.userPriceTarget;
      if (!target) return;

      const priceValue = resolvePriceValue(element, priceKey);
      if (priceValue !== null) element.dataset[target] = priceValue;
    });

  void refreshSecureCardPrices();
};

const initPriceByUser = () => {
  refreshPriceDisplays();

  if (initialized) return;
  initialized = true;

  window.addEventListener("storage", (event) => {
    if (
      event.key === SESSION_STORAGE_KEY ||
      event.key === STORE_PRICE_STORAGE_KEY
    ) {
      refreshPriceDisplays();
    }
  });

  window.addEventListener(SESSION_EVENT, refreshPriceDisplays);
  document.addEventListener("astro:page-load", refreshPriceDisplays);
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPriceByUser, { once: true });
  } else {
    initPriceByUser();
  }
}
