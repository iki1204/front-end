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


async function postAPI(endpoint: string, body: unknown = {}, params: QueryParams = "") {
  const query = buildQuery(params);

  const res = await fetch(`http://192.168.5.56:1337/api/auth/${endpoint}${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch (error) {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload === "string" ? payload : null) ||
      res.statusText;
    throw new Error(message || `Error posting to ${endpoint}`);
  }

  return payload;
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

export async function getUsuarios(params?: QueryParams) {
  return fetchAPI("users", params);
}

export async function postUsuarioLogin(data: Record<string, string>) {
  return postAPI("local", data);
}

export async function postUsuarioRegister(data: Record<string, string>) {
  return postAPI("local/register", data);
}


