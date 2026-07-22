import type { APIRoute } from "astro";
import { getCachedCatalogProducts } from "../../../lib/catalogCache";

export const GET: APIRoute = async ({ url }) => {
  try {
    const force = url.searchParams.get("refresh") === "1";
    const catalog = await getCachedCatalogProducts({ force });
    return Response.json(catalog, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error generando catálogo compacto:", error);

    return Response.json(
      {
        version: null,
        total: 0,
        products: [],
        error: "No se pudo cargar el catálogo",
      },
      { status: 500 },
    );
  }
};