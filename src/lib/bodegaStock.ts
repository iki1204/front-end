const CONTIFICO_URL = "https://api.contifico.com/sistema/api/v1";
const CONTIFICO_API_KEY = import.meta.env.CONTIFICO_API_KEY ?? "";

const FETCH_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 3000;
export const BODEGA_CACHE_TTL_MS = 2 * 60 * 1000;

export class BodegaStockError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const cache = new Map<string, { fetchedAt: number; rows: any[] }>();
const inFlight = new Map<string, Promise<any[]>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (status: number) => status === 429 || status >= 500;

const getRetryDelay = (res: Response | null) => {
  const retryAfter = Number(res?.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS);
  }
  return RETRY_DELAY_MS;
};

type Attempt = { rows: any[]; res: Response; error: null } | { rows: null; res: Response | null; error: BodegaStockError };

async function requestOnce(identifier: string): Promise<Attempt> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${CONTIFICO_URL}/producto/${encodeURIComponent(identifier)}/stock`, {
      headers: { Authorization: CONTIFICO_API_KEY },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { rows: null, res, error: new BodegaStockError(res.status, `HTTP ${res.status}`) };
    }

    const data = await res.json();
    return { rows: Array.isArray(data) ? data : [], res, error: null };
  } catch (e: any) {
    const message = e?.name === "AbortError" ? "Timeout" : "Error de red o JSON inválido";
    return { rows: null, res: null, error: new BodegaStockError(503, message) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestWithRetry(identifier: string): Promise<any[]> {
  const first = await requestOnce(identifier);
  if (first.error === null) return first.rows;
  if (!isRetryable(first.error.status)) throw first.error;

  await sleep(getRetryDelay(first.res));

  const second = await requestOnce(identifier);
  if (second.error === null) return second.rows;
  throw second.error;
}

/**
 * Stock por bodega desde Contífico.
 * - Reutiliza la respuesta si tiene menos de `maxAgeMs` (0 = siempre consulta).
 * - Agrupa peticiones simultáneas del mismo producto en una sola.
 * - Reintenta una vez ante 429/5xx/timeout; si vuelve a fallar lanza BodegaStockError.
 */
export function getBodegaStock(identifier: string, { maxAgeMs = BODEGA_CACHE_TTL_MS } = {}): Promise<any[]> {
  const key = String(identifier);
  const cached = cache.get(key);
  if (maxAgeMs > 0 && cached && Date.now() - cached.fetchedAt < maxAgeMs) {
    return Promise.resolve(cached.rows);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = requestWithRetry(key)
    .then((rows) => {
      cache.set(key, { fetchedAt: Date.now(), rows });
      rememberBodegaNames(rows);
      return rows;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

// ---------------------------------------------------------------------------
// Nombres de bodega conocidos (para las opciones del filtro sin bloquear la página)
// ---------------------------------------------------------------------------

const knownBodegaNames = new Set<string>();

function rememberBodegaNames(rows: any[]) {
  rows.forEach((row) => {
    const nombre = String(row?.bodega_nombre ?? "").trim();
    if (nombre) knownBodegaNames.add(nombre);
  });
}

/** Todas las bodegas vistas hasta ahora en cualquier respuesta de Contífico. */
export const getKnownBodegaNames = (): string[] => Array.from(knownBodegaNames);

// ---------------------------------------------------------------------------
// Precarga en segundo plano: llena la caché sin que nadie espere la respuesta.
// ---------------------------------------------------------------------------

const WARM_CONCURRENCY = 2;
const warmQueue: string[] = [];
const queued = new Set<string>();
let warmWorkers = 0;

async function runWarmWorker() {
  warmWorkers += 1;
  try {
    while (warmQueue.length > 0) {
      const key = warmQueue.shift() as string;
      queued.delete(key);
      try {
        await getBodegaStock(key);
      } catch {
        // Se ignora: se volverá a intentar en la próxima visita.
      }
    }
  } finally {
    warmWorkers -= 1;
  }
}

/** Encola productos cuyo stock por bodega no esté en caché. No bloquea. */
export function warmBodegaStock(identifiers: Array<string | null | undefined>) {
  for (const id of identifiers) {
    if (!id) continue;
    const key = String(id);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < BODEGA_CACHE_TTL_MS) continue;
    if (queued.has(key) || inFlight.has(key)) continue;
    queued.add(key);
    warmQueue.push(key);
  }

  while (warmWorkers < WARM_CONCURRENCY && warmQueue.length > 0) {
    void runWarmWorker();
  }
}
