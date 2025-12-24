type SuggestionItem = { value: string; label: string };

export function mountSearchSuggestions() {
  const input = document.querySelector<HTMLInputElement>('input[name="search"]');
  const box = document.getElementById("search-suggestions-ui");
  const container = input?.closest<HTMLElement>("[data-search-suggestions-container]") ?? input?.parentElement;

  if (!input || !box || !container) return;

  let controller: AbortController | null = null;

  const hideBox = () => {
    box.classList.add("hidden");
    box.innerHTML = "";
  };

  const showBox = () => {
    box.classList.remove("hidden");
  };

  input.addEventListener("input", async () => {
    const q = input.value.trim();

    if (q.length < 2) {
      hideBox();
      return;
    }

    if (controller) controller.abort();
    controller = new AbortController();

    try {
      const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });

      const items = (await res.json()) as SuggestionItem[];

      if (!items.length) {
        hideBox();
        return;
      }

      box.innerHTML = `
        <div class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Sugerencias de búsqueda
        </div>
        <ul class="max-h-64 overflow-y-auto divide-y divide-zinc-100 text-sm dark:divide-red-900/60">
          ${items
            .map(
              (item) => `
              <li>
                <a class="flex px-4 py-3 transition hover:bg-primary/5 hover:text-primary dark:hover:bg-red-900/30"
                   href="?search=${encodeURIComponent(item.value)}&page=1">
                  <span class="text-left leading-snug">${item.label}</span>
                </a>
              </li>`
            )
            .join("")}
        </ul>
      `;
      showBox();
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error(err);
    }
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target as Node)) {
      hideBox();
    }
  });
}
