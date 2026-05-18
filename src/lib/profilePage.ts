const API = import.meta.env.PUBLIC_STRAPI_URL;

import { hasActiveSession, parseStoredSession } from "./sessionUser";

type ProfileFieldTarget = HTMLElement & { dataset: DOMStringMap };

type UserRecord = Record<string, unknown>;

const FALLBACK_AVATAR = "/images/avatars/default.svg";

const KNOWN_USER_FIELDS = new Set([
  "id",
  "nombre",
  "username",
  "email",
  "tipoUsuario",
  "confirmed",
  "avatar",
  "imagen",
  "foto",
  "profileImage",
  "image",
  "picture",
  "createdAt",
  "updatedAt",
  "blocked",
  "documentId",
  "provider",
  "publishedAt",
  "password",
  "admin"
]);

const toDisplayString = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return null;
};


const setFieldText = (elements: ProfileFieldTarget[], value: string | null) => {
  if (elements.length === 0) return;
  elements.forEach((element) => {
    const row = element.closest<HTMLElement>("[data-profile-row]");
    const fallback = element.dataset.fallback ?? "No disponible";
    const output = value ?? fallback;
    element.textContent = output;
    row?.classList.toggle("hidden", !output);
  });
};

const renderExtraAttributes = (container: HTMLElement | null, user: UserRecord) => {
  if (!container) return;
  container.innerHTML = "";

  const entries = Object.entries(user)
    .filter(([key]) => !KNOWN_USER_FIELDS.has(key))
    .map(([key, value]) => ({ key, value }))
    .filter(({ value }) => toDisplayString(value) !== null);

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-sm text-gray-500 dark:text-gray-400";
    empty.textContent = "Sin atributos adicionales disponibles.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "space-y-2";

  entries.forEach(({ key, value }) => {
    const item = document.createElement("li");
    item.className = "flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white/70 px-4 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-200";
    const label = document.createElement("span");
    label.className = "font-semibold capitalize";
    label.textContent = key.replace(/_/g, " ");

    const detail = document.createElement("span");
    detail.className = "text-right text-gray-600 dark:text-gray-300";
    detail.textContent = toDisplayString(value) ?? "-";

    item.append(label, detail);
    list.appendChild(item);
  });

  container.appendChild(list);
};

const initProfilePage = () => {
  if (typeof window === "undefined") return;

  const session = parseStoredSession();
  const isActive = hasActiveSession(session);
  if (!isActive) return;

  const user = (session?.user ?? {}) as UserRecord;
  const nameField = Array.from(document.querySelectorAll<ProfileFieldTarget>("[data-profile-name]"));
  const usernameField = Array.from(document.querySelectorAll<ProfileFieldTarget>("[data-profile-username]"));
  const emailField = Array.from(document.querySelectorAll<ProfileFieldTarget>("[data-profile-email]"));
  const confirmedField = Array.from(document.querySelectorAll<ProfileFieldTarget>("[data-profile-confirmed]"));
  const idField = Array.from(document.querySelectorAll<ProfileFieldTarget>("[data-profile-id]"));
  const avatar = document.querySelector<HTMLImageElement>("[data-profile-avatar]");
  const extraContainer = document.querySelector<HTMLElement>("[data-profile-extra]");

  const displayName =
    toDisplayString(user.nombre) ?? toDisplayString(user.username) ?? toDisplayString(user.email);

  setFieldText(nameField, displayName);
  setFieldText(usernameField, toDisplayString(user.username));
  setFieldText(emailField, toDisplayString(user.email));
  setFieldText(confirmedField, toDisplayString(user.confirmed));
  setFieldText(idField, toDisplayString(user.id));

  if (avatar) {
    const imagenUrl = (user.imagen as Record<string, unknown>)?.url;
    const userImg = API + imagenUrl;
    avatar.src = userImg ?? FALLBACK_AVATAR;
    avatar.alt = displayName ? `Foto de ${displayName}` : "Foto de perfil";
  }

  renderExtraAttributes(extraContainer, user);
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProfilePage, { once: true });
  } else {
    initProfilePage();
  }
}