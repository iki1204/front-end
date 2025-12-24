export type SuggestionItem = { value: string; label: string };

const API_URL = import.meta.env.VITE_STRAPI_URL;
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN;
const SUGGESTIONS_LIMIT = 8;

const normalizeWithAttributes = (item: any) =>
  item?.attributes ? { id: item.id, ...item.attributes } : item;

export async function getSearchSuggestions(query: string): Promise<SuggestionItem[]> {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const params = new URLSearchParams({
    "pagination[page]": "1",
    "pagination[pageSize]": String(SUGGESTIONS_LIMIT),
    sort: "nombre:asc",
  });

  terms.forEach((term, index) => {
    params.set(`filters[$and][${index}][$or][0][nombre][$containsi]`, term);
    params.set(`filters[$and][${index}][$or][1][codigo][$containsi]`, term);
  });

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/productos?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error(error);
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const productos = (payload?.data ?? []).map(normalizeWithAttributes);
  const suggestions: SuggestionItem[] = [];
  const seen = new Set<string>();

  productos.forEach((producto: any) => {
    const nombre = producto?.nombre ?? "Producto sin nombre";
    const codigo = producto?.codigo ?? "";
    const value = codigo ? `${nombre} ${codigo}` : nombre;

    if (seen.has(value)) return;
    seen.add(value);

    suggestions.push({
      label: codigo ? `${nombre} • ${codigo}` : nombre,
      value,
    });
  });

  return suggestions;
}
