import type { APIRoute } from "astro";
import { getSearchSuggestions } from "../../lib/search-suggestions";

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q") ?? "";
  const suggestions = await getSearchSuggestions(query);

  return new Response(JSON.stringify(suggestions), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
