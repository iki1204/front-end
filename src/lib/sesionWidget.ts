import { postUsuarioLogin, postUsuarioRegister } from "./api";

const SESSION_STORAGE_KEY = "usuarioSesion";
const SESSION_EVENT = "usuarioSesion:cambio";

type FeedbackVariant = "neutral" | "success" | "error";

const VARIANT_CLASS_MAP: Record<FeedbackVariant, string[]> = {
  neutral: ["text-zinc-500", "dark:text-zinc-300"],
  success: ["text-emerald-600", "dark:text-emerald-400"],
  error: ["text-rose-600", "dark:text-rose-400"],
};

const VARIANT_CLASSES = Array.from(
  new Set(Object.values(VARIANT_CLASS_MAP).flatMap((classes) => classes)),
);

const setFeedbackMessage = (element: HTMLElement | null, message: string, variant: FeedbackVariant = "neutral") => {
  if (!element) return;
  element.textContent = message;
  element.dataset.variant = variant;
  element.classList.remove(...VARIANT_CLASSES);
  const classes = VARIANT_CLASS_MAP[variant] ?? VARIANT_CLASS_MAP.neutral;
  element.classList.add(...classes);
};

const setStatusMessage = (element: HTMLElement | null, message: string) => {
  if (!element) return;
  element.textContent = message;
};

const toggleLoadingState = (button: HTMLButtonElement | null, isLoading: boolean) => {
  if (!button) return;
  button.disabled = isLoading;
  button.dataset.loading = isLoading ? "true" : "false";
};

const toggleLoginFormAvailability = (
  form: HTMLFormElement | null,
  isDisabled: boolean,
  lockedBanner?: HTMLElement | null,
) => {
  if (!form) return;
  form.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach((element) => {
    element.disabled = isDisabled;
  });

  if (lockedBanner) {
    lockedBanner.classList.toggle("hidden", !isDisabled);
  }
};


const saveSession = (data: Record<string, unknown>) => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("No se pudo guardar la sesión del usuario", error);
  }
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
};

const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar la sesión del usuario", error);
  }
  
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
};
const hasActiveSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;

    const session = JSON.parse(raw);
    const user = session?.user;

    return Boolean(session?.jwt && user && user?.confirmed !== false);
  } catch (error) {
    return false;
  }
};

const handleLoginSubmit = async (event: SubmitEvent) => {
  event.preventDefault();

  const form = event.target as HTMLFormElement | null;
  if (!form) return;

  const submitButton = form.querySelector<HTMLButtonElement>("[data-login-submit]");
  const feedback = form.querySelector<HTMLElement>("[data-login-feedback]");
  const status = document.querySelector<HTMLElement>("[data-login-status]");
  const lockedBanner = document.querySelector<HTMLElement>("[data-login-locked]");

  if (hasActiveSession()) {
    toggleLoginFormAvailability(form, true, lockedBanner);
    setFeedbackMessage(feedback, "Ya tienes una sesión activa.", "success");
    setStatusMessage(status, "Sesión existente detectada");
    window.location.assign("/tienda");
    return;
  }

  const formData = new FormData(form);
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!identifier || !password) {
    setFeedbackMessage(feedback, "Por favor ingresa tu usuario y contraseña.", "error");
    return;
  }

  toggleLoadingState(submitButton, true);
  setFeedbackMessage(feedback, "Verificando Usuario...", "neutral");

  try {
    const response = await postUsuarioLogin({ identifier, password });
    const user = (response as any)?.user ?? {};
    const displayName = user?.nombre ?? user?.username ?? identifier;

    saveSession(response as Record<string, unknown>);
    setStatusMessage(status, `Sesión iniciada como ${displayName}`);
    setFeedbackMessage(feedback, "Inicio de sesión exitoso. Redirigiendo...", "success");

    window.location.assign("/tienda");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    setFeedbackMessage(feedback, message, "error");
    setStatusMessage(status, "Error al iniciar sesión. Intenta nuevamente.");
  } finally {
    toggleLoadingState(submitButton, false);
  }
};

const handleRegisterSubmit = async (event: SubmitEvent) => {
  event.preventDefault();
  
  const form = event.target as HTMLFormElement | null;
  if (!form) return;
  
  const registerButton = form.querySelector<HTMLButtonElement>("[data-register-submit]");
  const feedback = form.querySelector<HTMLElement>("[data-register-feedback]");
  const formContainer = document.querySelector<HTMLElement>("[data-register-form-container]");
  const successPanel = document.querySelector<HTMLElement>("[data-register-success]");

  const formData = new FormData(form);
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();


  if (!username || !password || !email) {
    setFeedbackMessage(feedback, "Completa los campos para registrarte.", "error");
    return;
  }

  if (!email.includes("@")) {
    setFeedbackMessage(feedback, "Ingresa un correo válido para crear tu cuenta.", "error");
    return;
  }

  toggleLoadingState(registerButton, true);
  setFeedbackMessage(feedback, "Creando tu cuenta...", "neutral");

  try {
    const response = await postUsuarioRegister({ username, email, password });
    setFeedbackMessage(feedback, "Registro exitoso. redirigiendo ...", "success");
    window.location.assign("/success-register");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo completar el registro.";
    setFeedbackMessage(feedback, message, "error");
  } finally {
    toggleLoadingState(registerButton, false);
  }
};

const initLogin = () => {
  if (typeof window === "undefined") return;

  const form = document.querySelector<HTMLFormElement>("[data-login-form]");
  if (!form) return;

  form.addEventListener("submit", handleLoginSubmit);

  const feedback = form.querySelector<HTMLElement>("[data-login-feedback]");
  const status = document.querySelector<HTMLElement>("[data-login-status]");
  const lockedBanner = document.querySelector<HTMLElement>("[data-login-locked]");

  if (feedback) {
    const initialVariant = (feedback.dataset.variant as FeedbackVariant) ?? "neutral";
    setFeedbackMessage(feedback, feedback.textContent ?? "", initialVariant);
  }

  const storedSessionRaw = typeof window !== "undefined" ? localStorage.getItem("SESSION_STORAGE_KEY") : null;
  if (storedSessionRaw) {
    try {
      const session = JSON.parse(storedSessionRaw);
      const user = session?.user ?? {};
      const displayName = user?.nombre ?? user?.username ?? user?.email;
      if (displayName) {
        setStatusMessage(status, `Sesión restaurada para ${displayName}`);
        setFeedbackMessage(feedback, "Tienes una sesión activa.", "success");
        toggleLoginFormAvailability(form, true, lockedBanner);
      }
    } catch (error) {
      clearSession();
    }
  }
};

const initRegister = () => {
  if (typeof window === "undefined") return;

  const form = document.querySelector<HTMLFormElement>("[data-register-form]");
  if (!form) return;

  form.addEventListener("submit", handleRegisterSubmit);

  const feedback = form.querySelector<HTMLElement>("[data-register-feedback]");

  if (feedback) {
    const initialVariant = (feedback.dataset.variant as FeedbackVariant) ?? "neutral";
    setFeedbackMessage(feedback, feedback.textContent ?? "", initialVariant);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLogin, { once: true });
} else {
  initLogin();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRegister, { once: true });
} else {
  initRegister();
}

