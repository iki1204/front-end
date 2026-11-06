import { getCategorias, getGlobalData, getMarcas } from "./api";

// Datos que cambian poco: se reutilizan entre requests para que cada clic
// en un filtro de la tienda no vuelva a llamar a Strapi.
const TTL_MS = 5 * 60 * 1000;

type Entry = { fetchedAt: number; value: any };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<any>>();

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.fetchedAt < TTL_MS) {
    return Promise.resolve(entry.value);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = loader()
    .then((value) => {
      cache.set(key, { fetchedAt: Date.now(), value });
      return value;
    })
    .catch((error) => {
      // Si Strapi falla y hay una copia anterior, se usa esa en vez de romper la página.
      if (entry) return entry.value;
      throw error;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export const getCachedCategorias = () => cached("categorias", getCategorias);
export const getCachedMarcas = () => cached("marcas", getMarcas);
export const getCachedGlobalData = () => cached("global", getGlobalData);
