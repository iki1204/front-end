const SESSION_STORAGE_KEY = "usuarioSesion";
const SESSION_EVENT = "usuarioSesion:cambio";

type SessionUser = { confirmed?: boolean | null } | null;
type SessionPayload = {
  jwt?: string | null;
  user?: SessionUser;
} | null;

const parseStoredSession = (): SessionPayload => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo leer la sesión almacenada", error);
    return null;
  }
};

const hasActiveSession = (session: SessionPayload = parseStoredSession()) => {
  const user = session?.user;
  return Boolean(session?.jwt && user && user.confirmed !== false);
};

const refreshAuthVisibility = () => {
  const isLoggedIn = hasActiveSession();

  document.querySelectorAll<HTMLElement>("[data-auth-visible]").forEach((element) => {
    const mode = element.dataset.authVisible ?? "authenticated";
    const shouldShow = mode === "authenticated" ? isLoggedIn : !isLoggedIn;

    element.classList.toggle("hidden", !shouldShow);
    element.setAttribute("aria-hidden", (!shouldShow).toString());
  });
};

const initAuthVisibility = () => {
  refreshAuthVisibility();

  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY) {
      refreshAuthVisibility();
    }
  });

  window.addEventListener(SESSION_EVENT, refreshAuthVisibility);
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthVisibility, { once: true });
  } else {
    initAuthVisibility();
  }
}
