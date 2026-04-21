import { SESSION_EVENT, SESSION_STORAGE_KEY, parseStoredSession } from "./sessionUser";

const getUserAdmin = (): boolean => {
  const session = parseStoredSession();
  return session?.user?.admin === true;
};

/**
 * Un usuario está autenticado si tiene JWT y su cuenta está confirmada.
 * No se requiere tipoUsuario — los usuarios admin tampoco lo tienen.
 */
const isUserLoggedIn = (): boolean => {
  const session = parseStoredSession();
  return Boolean(session?.jwt && session?.user && session.user.confirmed !== false);
};

const refreshAuthVisibility = () => {
  const isLoggedIn = isUserLoggedIn();
  const isAdmin = getUserAdmin();

  document.querySelectorAll<HTMLElement>("[data-auth-visible]").forEach((element) => {
    const mode = element.dataset.authVisible ?? "authenticated";
    const shouldShow = mode === "authenticated" ? isLoggedIn : !isLoggedIn;

    element.classList.toggle("hidden", !shouldShow);
    element.setAttribute("aria-hidden", (!shouldShow).toString());
  });

  document.querySelectorAll<HTMLElement>("[data-admin-visible]").forEach((element) => {
    const shouldShow = isLoggedIn && isAdmin;

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
