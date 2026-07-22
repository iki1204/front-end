import { getProductos } from "./api";

const PAGE_SIZE = 100;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedCatalog: { version: string; expiresAt: number; products: any[] } | null = null;
let pendingCatalog: Promise<{ version: string; total: number; products: any[] }> | null = null;

const normalizeItem = (item: any) =>
  item?.attributes
    ? {
        id: item.id,
        ...item.attributes,
      }
    : item;

const normalizeCollection = (items: any[] = []) => items.map(normalizeItem);

const normalizeRelation = (relation: any) => {
  const data = relation?.data ?? relation;
  if (!data) return null;
  if (Array.isArray(data)) return data.map(normalizeItem);
  return normalizeItem(data);
};

const STRAPI_URL = (import.meta.env.VITE_STRAPI_URL ?? "https://api.unicomec.com").replace(/\/$/, "");

const buildMediaURL = (path: unknown): string | null => {
  if (typeof path !== "string" || path.trim() === "") return null;
  const cleanPath = path.trim();
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) return cleanPath;
  return `${STRAPI_URL}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
};

const getImgURL = (imageValue: any): string | null => {
  if (!imageValue) return null;
  const firstImage = Array.isArray(imageValue)
    ? imageValue.find((image) => image?.url || image?.formats?.small?.url || image?.formats?.medium?.url || image?.formats?.thumbnail?.url)
    : imageValue;
  if (!firstImage) return null;
  const image = firstImage?.data?.attributes ?? firstImage?.data ?? firstImage?.attributes ?? firstImage;
  const path = image?.formats?.small?.url ?? image?.formats?.medium?.url ?? image?.formats?.thumbnail?.url ?? image?.formats?.large?.url ?? image?.url ?? null;
  return buildMediaURL(path);
};

const getRelationId = (relation: any, possibleFields: string[]): string | null => {
  const data = normalizeRelation(relation);
  if (!data || Array.isArray(data)) return null;
  for (const field of possibleFields) {
    const value = data?.[field];
    if (value !== undefined && value !== null) return String(value);
  }
  return data?.id ? String(data.id) : null;
};

export const normalizeCatalogText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

async function getAllProducts(): Promise<any[]> {
  const products: any[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const params = new URLSearchParams({
      "pagination[page]": String(page),
      "pagination[pageSize]": String(PAGE_SIZE),
      sort: "nombre:asc",
    });
    const response = await getProductos(params);
    products.push(...normalizeCollection(response?.data ?? []));
    pageCount = response?.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount);
  return products;
}

const compactProduct = (product: any) => {
  const nombre = String(product?.nombre ?? "").trim();
  const codigo = String(product?.codigo ?? "").trim();
  const descripcion = String(product?.descripcion ?? "").trim();
  const categoryId = String(product?.ID_Categoria ?? getRelationId(product?.categoria, ["ID_Categoria", "id"]) ?? "") || null;
  const brandId = String(product?.ID_Marca ?? getRelationId(product?.marca, ["ID_Marca", "id"]) ?? "") || null;
  const price = Number(product?.precio ?? 0);
  const stock = Number(product?.cantidad_stock ?? 0);
  const imageUrl = getImgURL(product?.imagen);
  const datasheets = normalizeRelation(product?.datasheet ?? product?.datasheets);
  const hasDatasheet = Array.isArray(datasheets) ? datasheets.length > 0 : Boolean(datasheets);
  const slugRaw = product?.ID_Nombre ?? product?.slug ?? product?.id;

  return {
    ...product,
    id: String(product?.id ?? slugRaw ?? ""),
    slug: String(slugRaw ?? ""),
    ID_Nombre: String(product?.ID_Nombre ?? slugRaw ?? ""),
    identifier: String(product?.identifier ?? ""),
    nombre,
    codigo,
    precio: Number.isFinite(price) ? price : 0,
    cantidad_stock: Number.isFinite(stock) ? stock : 0,
    stock: Number.isFinite(stock) ? stock : 0,
    categoriaId: categoryId,
    marcaId: brandId,
    imagenUrl: imageUrl,
    tieneImagen: Boolean(imageUrl),
    tieneDatasheet: hasDatasheet,
    tieneDescripcion: descripcion.length > 0,
    searchIndex: normalizeCatalogText([nombre, codigo, product?.identifier].filter(Boolean).join(" ")),
  };
};

export async function getCachedCatalogProducts(options: { force?: boolean } = {}) {
  const now = Date.now();
  if (!options.force && cachedCatalog && cachedCatalog.expiresAt > now) {
    return { version: cachedCatalog.version, total: cachedCatalog.products.length, products: cachedCatalog.products };
  }
  if (!options.force && pendingCatalog) return pendingCatalog;

  pendingCatalog = (async () => {
    const products = (await getAllProducts()).map(compactProduct);
    const version = new Date().toISOString();
    cachedCatalog = { version, expiresAt: Date.now() + CACHE_TTL_MS, products };
    return { version, total: products.length, products };
  })().finally(() => {
    pendingCatalog = null;
  });

  return pendingCatalog;
}