export const slugifyProductValue = (value: unknown): string => {
  const normalized = typeof value === "string" ? value.trim() : value != null ? String(value) : "";
  if (!normalized) return "";

  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

export const resolveProductSlug = (producto: Record<string, unknown> | null | undefined): string => {
  const explicitSlug = slugifyProductValue(producto?.slug);
  if (explicitSlug) return explicitSlug;

  const idNombreSlug = slugifyProductValue(producto?.ID_Nombre);
  if (idNombreSlug) return idNombreSlug;

  const idSlug = slugifyProductValue(producto?.id);
  return idSlug || "producto";
};