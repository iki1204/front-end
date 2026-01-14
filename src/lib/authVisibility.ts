import { SESSION_EVENT, SESSION_STORAGE_KEY, hasActiveSession } from "./sessionUser";

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
