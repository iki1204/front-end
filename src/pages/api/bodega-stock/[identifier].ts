import type { APIRoute } from "astro";

const CONTIFICO_URL = "https://api.contifico.com/sistema/api/v1";
const CONTIFICO_API_KEY = import.meta.env.CONTIFICO_API_KEY ?? "";

export const GET: APIRoute = async ({ params }) => {
  const { identifier } = params;

  if (!identifier) {
    return new Response(JSON.stringify({ error: "Identifier requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `${CONTIFICO_URL}/producto/${encodeURIComponent(identifier)}/stock`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: CONTIFICO_API_KEY,
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${res.status}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
