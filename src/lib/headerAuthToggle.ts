import { SESSION_EVENT, SESSION_STORAGE_KEY, hasSessionToken, parseStoredSession } from "./sessionUser";

const initHeaderAuthToggle = () => {
  const loginCta = document.querySelector<HTMLElement>("[data-login-button]");
  const logoutCta = document.querySelector<HTMLElement>("[data-logout-cta]");
  const logoutAlert = document.querySelector<HTMLElement>("[data-logout-confirmation]");
  const logoutConfirmYes = logoutAlert?.querySelector<HTMLButtonElement>("[data-logout-confirm='yes']");
  const logoutConfirmNo = logoutAlert?.querySelector<HTMLButtonElement>("[data-logout-confirm='no']");

  const clearSession = () => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn("No se pudo limpiar la sesión", error);
    }
    window.dispatchEvent(new CustomEvent(SESSION_EVENT));
  };

  const refreshLoginCta = () => {
    if (!loginCta) return;
    const session = parseStoredSession();
    const isLoggedIn = hasSessionToken(session);

    if (session && !isLoggedIn) {
      clearSession();
    }

    loginCta.classList.toggle("hidden", isLoggedIn);
    loginCta.setAttribute("aria-hidden", isLoggedIn.toString());
    logoutCta?.classList.toggle("hidden", !isLoggedIn);
    logoutCta?.setAttribute("aria-hidden", (!isLoggedIn).toString());
  };

  const hideLogoutAlert = () => {
    logoutAlert?.classList.add("hidden");
    logoutCta?.setAttribute("aria-expanded", "false");
  };

  const showLogoutAlert = () => {
    if (!logoutAlert) return;
    logoutAlert.classList.remove("hidden");
    logoutCta?.setAttribute("aria-expanded", "true");
  };

  logoutCta?.addEventListener("click", (event) => {
    event.preventDefault();
    showLogoutAlert();
  });

  logoutConfirmYes?.addEventListener("click", () => {
    clearSession();
    hideLogoutAlert();
    refreshLoginCta();
    window.location.assign("/");
  });

  logoutConfirmNo?.addEventListener("click", () => {
    hideLogoutAlert();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY) {
      refreshLoginCta();
    }
  });

  window.addEventListener(SESSION_EVENT, refreshLoginCta);
  refreshLoginCta();
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeaderAuthToggle, { once: true });
  } else {
    initHeaderAuthToggle();
  }
}
