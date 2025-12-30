const SESSION_STORAGE_KEY_tipo = "usuarioSesion";
const SESSION_EVENT_tipo = "usuarioSesion:cambio";

type SessionUser_tipo = {
  confirmed?: boolean | null;
  tipoUsuario?: number | string | null;
};

type SessionPayload_tipo = {
  jwt?: string | null;
  user?: SessionUser_tipo | null;
} | null;

const normalizeTipoUsuario1 = (tipoUsuario: SessionUser_tipo["tipoUsuario"]) => {
  if (tipoUsuario === null || tipoUsuario === undefined) return null;
  if (typeof tipoUsuario === "number") {
    return tipoUsuario >= 1 && tipoUsuario <= 4 ? `tipo${tipoUsuario}` : null;
  }
  if (typeof tipoUsuario === "string") {
    const normalized = tipoUsuario.trim().toLowerCase();
    if (!normalized || normalized === "null") return null;
    if (/^tipo[1-4]$/.test(normalized)) return normalized;
    if (/^[1-4]$/.test(normalized)) return `tipo${normalized}`;
  }
  return null;
};

const parseStoredSession1 = (): SessionPayload_tipo => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY_tipo);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo leer la sesión almacenada", error);
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

const hasActiveSession1 = (session: SessionPayload_tipo = parseStoredSession1()) => {
  const user = session?.user;
  return Boolean(session?.jwt && user && user.confirmed !== false && normalizeTipoUsuario1(user.tipoUsuario));
};

const refreshPriceDisplays = () => {
  const session = parseStoredSession1();
  const tipoUsuario = normalizeTipoUsuario1(session?.user?.tipoUsuario);
  const priceKey = hasActiveSession1(session) && tipoUsuario ? tipoUsuario : "default";

  document.querySelectorAll<HTMLElement>("[data-user-price]").forEach((element) => {
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
