const API_URL = import.meta.env.VITE_STRAPI_URL + "/api";
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN;

type QueryParams =
  | string
  | URLSearchParams
  | Record<string, string | number | boolean | null | undefined>;

function buildQuery(params: QueryParams = "") {
  if (!params) {
    return "";
  }

  if (typeof params === "string") {
    if (!params.length) {
      return "";
    }

    return params.startsWith("?") ? params : `?${params}`;
  }

  if (params instanceof URLSearchParams) {
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function fetchAPI(endpoint: string, params: QueryParams = "") {
  const query = buildQuery(params);

  const res = await fetch(`${API_URL}/${endpoint}${query}`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Error fetching ${endpoint}: ${res.statusText}`);
  }

  const data = await res.json();

  return data;
}

export async function getGlobalData() {
  return fetchAPI("global");
}

export async function getPageData(slug: string) {
  return fetchAPI(`paginas`);
}

export async function getProductos(params?: QueryParams) {
  return fetchAPI("productos", params);
}

export async function getCategorias() {
  return fetchAPI("categorias");
}

export async function getMarcas() {
  return fetchAPI("marcas");
}

export async function getProductoBySlug(slug: string) {
  const params = new URLSearchParams({
    "filters[ID_Nombre][$eq]": slug,
    populate: "*",
  });

  return fetchAPI("productos", `?${params.toString()}`);
}
