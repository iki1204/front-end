import type { APIRoute } from "astro";
import { getProductos } from "../../lib/api";

const MAX_RESULTS = 10;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.toLowerCase().trim() ?? "";

  if (!query) {
    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const params = new URLSearchParams({
    "pagination[page]": "1",
    "pagination[pageSize]": String(MAX_RESULTS),
    sort: "nombre:asc",
  });

  terms.forEach((term, index) => {
    params.set(`filters[$and][${index}][$or][0][nombre][$containsi]`, term);
    params.set(`filters[$and][${index}][$or][1][codigo][$containsi]`, term);
  });

  try {
    const response = await getProductos(params);
    const items =
      (response?.data ?? []).map((producto: any) => {
        const attributes = producto?.attributes ?? producto ?? {};
        const nombre = attributes.nombre ?? "Producto sin nombre";
        const codigo = attributes.codigo ?? "";
        return {
          label: codigo ? `${nombre} • ${codigo}` : nombre,
          search: codigo ? `${nombre} ${codigo}` : nombre,
        };
      }) ?? [];

    return new Response(JSON.stringify(items), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? "Error al buscar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

