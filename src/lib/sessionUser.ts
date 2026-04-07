export const SESSION_STORAGE_KEY = "usuarioSesion";
export const CART_STORAGE_KEY = "tienda-cart";
export const SESSION_EVENT = "usuarioSesion:cambio";

export type SessionUser = {
  confirmed?: boolean | null;
  tipoUsuario?: number | string | null;
  asesor?: number | string | null;
  [key: string]: unknown;
};

export type SessionPayload =
  | {
      jwt?: string | null;
      user?: SessionUser | null;
    }
  | null;

export const normalizeSessionPayload = (payload: unknown): SessionPayload => {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const nestedData = (data.data ?? {}) as Record<string, unknown>;
  const jwtCandidate = data.jwt ?? data.token ?? data.accessToken ?? nestedData.jwt ?? nestedData.token ?? nestedData.accessToken;
  const userCandidate = data.user ?? nestedData.user;

  const jwt = typeof jwtCandidate === "string" ? jwtCandidate : null;
  const user = (userCandidate as SessionUser | null | undefined) ?? null;

  if (!jwt && !user) return null;

  return { jwt, user };
};

export const normalizeTipoUsuario = (tipoUsuario: SessionUser["tipoUsuario"]) => {
  if (tipoUsuario === null || tipoUsuario === undefined) return null;
  if (typeof tipoUsuario === "number") {
    return tipoUsuario >= 1 && tipoUsuario <= 4 ? `tipo${tipoUsuario}` : null;
  }
  if (typeof tipoUsuario === "string") {
    const normalized = tipoUsuario.trim().toLowerCase();
    if (!normalized || normalized === "null") return null;
    if (/^pvp[1-4]$/.test(normalized)) return normalized;
    if (/^[1-4]$/.test(normalized)) return `tipo${normalized}`;
  }
  return null;
};

export const parseStoredSession = (): SessionPayload => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeSessionPayload(parsed);
  } catch (error) {
    console.warn("No se pudo leer la sesión almacenada", error);
    return null;
  }
};

export const clearStoredSession = () => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar la sesión almacenada", error);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT));
  }
};

export const hasSessionToken = (session: SessionPayload = parseStoredSession()) => {
  return Boolean(session?.jwt);
};

export const hasActiveSession = (session: SessionPayload = parseStoredSession()) => {
  const user = session?.user;
  return Boolean(session?.jwt && user && user.confirmed !== false && normalizeTipoUsuario(user?.tipoUsuario));
};
