import type { APIRoute } from "astro";
import { getProductoBySlug } from "../../../lib/api";

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL ?? "https://api.unicomec.com";

const priceFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatPrice = (value: number | null): string =>
  typeof value === "number" ? priceFormatter.format(value) : "Consultar";

const normalizeCollection = (collection: unknown[] = []) =>
  collection.map((item: any) => (item?.attributes ? { id: item.id, ...item.attributes } : item));

/**
 * Maps the tipoUsuario value (from Strapi's /api/users/me) to one of the
 * internal price keys used in the producto schema.
 * Handles both "pvp1" and legacy "tipo1" formats.
 */
const tipoToPriceKey = (tipo: string): "pvp1" | "pvp2" | "pvp3" | "pvp4" => {
  const map: Record<string, "pvp1" | "pvp2" | "pvp3" | "pvp4"> = {
    pvp1: "pvp1",
    tipo1: "pvp1",
    pvp2: "pvp2",
    tipo2: "pvp2",
    pvp3: "pvp3",
    tipo3: "pvp3",
    pvp4: "pvp4",
    tipo4: "pvp4",
  };
  return map[tipo] ?? "pvp3";
};

const normalizeTipoUsuario = (tipoUsuario: unknown): string | null => {
  if (tipoUsuario === null || tipoUsuario === undefined) return null;

  if (typeof tipoUsuario === "number") {
    return tipoUsuario >= 1 && tipoUsuario <= 4 ? `pvp${tipoUsuario}` : null;
  }

  if (typeof tipoUsuario === "string") {
    const normalized = tipoUsuario.trim().toLowerCase();
    if (!normalized || normalized === "null") return null;
    if (/^pvp[1-4]$/.test(normalized)) return normalized;
    if (/^tipo([1-4])$/.test(normalized))
      return `pvp${normalized.replace("tipo", "")}`;
    if (/^[1-4]$/.test(normalized)) return `pvp${normalized}`;
  }

  return null;
};

export const GET: APIRoute = async ({ params, request }) => {
  const noCacheHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };

  const { slug } = params;

  if (!slug) {
    return new Response(JSON.stringify({ error: "Slug requerido" }), {
      status: 400,
      headers: noCacheHeaders,
    });
  }

  // ── JWT validation via Strapi ───────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const token =
    authHeader?.startsWith("Bearer ") && authHeader.length > 7
      ? authHeader.slice(7).trim()
      : null;

  let tipoUsuario: "pvp1" | "pvp2" | "pvp3" | "pvp4" | null = null;
  let isAdmin = false;

  if (token) {
    try {
      const userRes = await fetch(`${STRAPI_URL}/api/users/me?populate=*`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        isAdmin = userData?.admin === true;
        const normalized = normalizeTipoUsuario(userData?.tipoUsuario);
        if (normalized) {
          tipoUsuario = tipoToPriceKey(normalized);
        }
      }
    } catch {
      // Invalid / expired token — treat as unauthenticated
    }
  }

  // If Strapi didn't return tipoUsuario, try the client-supplied header as fallback
  if (!tipoUsuario && token) {
    const clientTipo = request.headers.get("X-Tipo-Usuario");
    if (clientTipo) {
      const normalized = normalizeTipoUsuario(clientTipo);
      if (normalized) {
        tipoUsuario = tipoToPriceKey(normalized);
      }
    }
  }

  // Any authenticated user gets a price; fallback to pvp1 if no tipoUsuario assigned
  if (!tipoUsuario && token) {
    tipoUsuario = "pvp1";
  }

  if (!tipoUsuario) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: noCacheHeaders,
    });
  }

  // ── Fetch product and resolve price for this user tier ──────────────────────
  try {
    const productoResponse = await getProductoBySlug(slug);
    const producto = normalizeCollection((productoResponse?.data as unknown[]) ?? [])[0] as any;

    if (!producto) {
      return new Response(JSON.stringify({ error: "Producto no encontrado" }), {
        status: 404,
        headers: noCacheHeaders,
      });
    }

    const rawPricesByKey: Record<string, number | null> = {
      pvp1: typeof producto?.precio === "number" ? producto.precio : null,
      pvp2: typeof producto?.Precio2 === "number" ? producto.Precio2 : null,
      pvp3: typeof producto?.Precio3 === "number" ? producto.Precio3 : null,
      pvp4: typeof producto?.Precio4 === "number" ? producto.Precio4 : null,
    };

    // Return the price for the authenticated user's tier.
    // If the tier price is null or 0, fall back to the first non-zero price available.
    const tierRaw = rawPricesByKey[tipoUsuario] ?? null;
    const selectedRaw: number | null =
      typeof tierRaw === "number" && tierRaw > 0
        ? tierRaw
        : (Object.values(rawPricesByKey).find(
            (v): v is number => typeof v === "number" && v > 0,
          ) ?? null);

    const selectedPriceKey: string =
      typeof tierRaw === "number" && tierRaw > 0
        ? tipoUsuario
        : (Object.entries(rawPricesByKey).find(
            ([, v]) => typeof v === "number" && v > 0,
          )?.[0] ?? tipoUsuario);

    const porcentajeDescuento = Number(producto?.oferta?.Porcentaje_de_descuento ?? 0);
    const isOfertaActiva = producto?.oferta?.Activo === true;

    const offerRaw: number | null =
      isOfertaActiva && porcentajeDescuento > 0 && typeof selectedRaw === "number"
        ? selectedRaw * (1 - porcentajeDescuento / 100)
        : null;

    const hasOffer = offerRaw !== null;

    return new Response(
      JSON.stringify({
        authenticated: true,
        price: formatPrice(selectedRaw),
        priceRaw: selectedRaw,
        hasOffer,
        offerPrice: hasOffer ? formatPrice(offerRaw) : null,
        offerPriceRaw: offerRaw,
        originalPrice: formatPrice(selectedRaw),
        ...(isAdmin
          ? {
              isAdmin: true,
              selectedPriceKey,
              allPrices: {
                pvp1: { raw: rawPricesByKey.pvp1, formatted: formatPrice(rawPricesByKey.pvp1) },
                pvp2: { raw: rawPricesByKey.pvp2, formatted: formatPrice(rawPricesByKey.pvp2) },
                pvp3: { raw: rawPricesByKey.pvp3, formatted: formatPrice(rawPricesByKey.pvp3) },
                pvp4: { raw: rawPricesByKey.pvp4, formatted: formatPrice(rawPricesByKey.pvp4) },
              },
            }
          : {}),
      }),
      {
        status: 200,
        headers: noCacheHeaders,
      },
    );
  } catch {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: noCacheHeaders,
    });
  }
};
