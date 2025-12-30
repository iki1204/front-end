export const SESSION_STORAGE_KEY = "usuarioSesion";
export const SESSION_EVENT = "usuarioSesion:cambio";

export type SessionUser = {
  confirmed?: boolean | null;
  tipoUsuario?: number | string | null;
  [key: string]: unknown;
};

export type SessionPayload =
  | {
      jwt?: string | null;
      user?: SessionUser | null;
    }
  | null;

export const normalizeTipoUsuario = (tipoUsuario: SessionUser["tipoUsuario"]) => {
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

export const parseStoredSession = (): SessionPayload => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo leer la sesión almacenada", error);
    return null;
  }
};

export const hasSessionToken = (session: SessionPayload = parseStoredSession()) => {
  return Boolean(session?.jwt);
};

export const hasActiveSession = (session: SessionPayload = parseStoredSession()) => {
  const user = session?.user;
  return Boolean(session?.jwt && user && user.confirmed !== false && normalizeTipoUsuario(user?.tipoUsuario));
};
