import type { APIRoute } from "astro";
import { BodegaStockError, getBodegaStock } from "../../../lib/bodegaStock";

export const GET: APIRoute = async ({ params }) => {
  const { identifier } = params;

  if (!identifier) {
    return new Response(JSON.stringify({ error: "Identifier requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // maxAgeMs: 0 -> siempre consulta Contífico (dato fresco para la página del producto),
    // pero agrupa peticiones simultáneas y reintenta una vez ante 429/5xx.
    const data = await getBodegaStock(identifier, { maxAgeMs: 0 });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const status = e instanceof BodegaStockError ? e.status : 500;
    const message = e instanceof BodegaStockError ? e.message : "Error interno";
    console.warn(`[bodega-stock] ${identifier}: ${message}`);

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
