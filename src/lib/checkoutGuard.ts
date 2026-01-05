const SESSION_STORAGE_KEY = "usuarioSesion";

type SessionUser = { confirmed?: boolean | null } | null;

type SessionPayload = {
  jwt?: string | null;
  user?: SessionUser;
} | null;

const parseStoredSession = (): SessionPayload => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionPayload;
  } catch (error) {
    console.warn("No se pudo leer la sesión almacenada", error);
    return null;
  }
};

const hasActiveSession = (session: SessionPayload = parseStoredSession()) => {
  const user = session?.user;
  return Boolean(session?.jwt && user && user.confirmed !== false);
};

const redirectIfGuest = () => {
  if (!hasActiveSession()) {
    window.location.replace("/acceso-denegado");
  }
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", redirectIfGuest, { once: true });
  } else {
    redirectIfGuest();
  }
}
