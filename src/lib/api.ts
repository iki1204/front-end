const API_URL = import.meta.env.PUBLIC_STRAPI_URL + "/api";
const API_TOKEN = import.meta.env.PUBLIC_STRAPI_API_TOKEN; 

async function fetchAPI(endpoint: string, params: string = "") {
  const res = await fetch(`${API_URL}/${endpoint}${params}`, {
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
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

export async function getProductos() {
  return fetchAPI("productos");
}

export async function getCategorias() {
  return fetchAPI("categorias");
}