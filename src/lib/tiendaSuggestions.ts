type SetupOptions = {
  formId?: string;
  inputId?: string;
  containerId?: string;
  listId?: string;
  dataElementId?: string;
  maxResults?: number;
  minCharacters?: number;
};

type Suggestion = {
  value: string;
  normalized: string;
};

type Listener = {
  target: EventTarget;
  type: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

const DEFAULT_OPTIONS: Required<Omit<SetupOptions, "minCharacters">> & { minCharacters: number } = {
  formId: "storeSearchForm",
  inputId: "storeSearchInput",
  containerId: "searchSuggestionList",
  listId: "searchSuggestionItems",
  dataElementId: "tiendaSuggestionData",
  maxResults: 20,
  minCharacters: 1,
};

const normalizeEntries = (raw: unknown): Suggestion[] => {
  if (!Array.isArray(raw)) return [];

  const uniqueValues = new Set(
    raw
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  return Array.from(uniqueValues).map((value) => ({
    value,
    normalized: value.toLowerCase(),
  }));
};

const readSuggestionData = (elementId: string): Suggestion[] => {
  const dataNode = document.getElementById(elementId);
  if (!(dataNode instanceof HTMLScriptElement)) return [];

  try {
    const parsed = JSON.parse(dataNode.textContent ?? "[]");
    return normalizeEntries(parsed);
  } catch {
    return [];
  }
};

export const setupTiendaSuggestions = (options: SetupOptions = {}): (() => void) | null => {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  const config = { ...DEFAULT_OPTIONS, ...options };

  const form = document.getElementById(config.formId);
  const input = document.getElementById(config.inputId);
  const container = document.getElementById(config.containerId);
  const list = document.getElementById(config.listId);

  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !container || !list) {
    return null;
  }

  if (input.dataset.tiendaSuggestions === "ready") {
    return null;
  }
  input.dataset.tiendaSuggestions = "ready";

  const suggestions = readSuggestionData(config.dataElementId);
  let activeIndex = -1;

  const listeners: Listener[] = [];

  const toggleContainer = (shouldShow: boolean) => {
    container.classList.toggle("hidden", !shouldShow);
    input.setAttribute("aria-expanded", String(shouldShow));
  };

  const clearList = () => {
    list.innerHTML = "";
    activeIndex = -1;
    toggleContainer(false);
  };

  const highlightItem = (index: number) => {
    const items = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-suggestion-button]"));
    items.forEach((item, itemIndex) => {
      const isActive = itemIndex === index;
      item.classList.toggle("bg-zinc-100", isActive);
      item.classList.toggle("dark:bg-zinc-800", isActive);
      item.setAttribute("aria-selected", String(isActive));
      if (isActive) {
        item.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const submitWithValue = (value: string) => {
    input.value = value;
    form.requestSubmit();
  };

  const render = (matches: Suggestion[]) => {
    list.innerHTML = "";
    activeIndex = -1;

    matches.forEach((match) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.dataset.suggestionButton = "true";
      button.dataset.suggestionValue = match.value;
      button.className =
        "flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-800 transition hover:bg-zinc-50 hover:text-primary focus:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800";
      button.setAttribute("role", "option");

      button.innerHTML = `
        <span aria-hidden="true" class="text-zinc-400">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span>${match.value}</span>
      `;

      item.appendChild(button);
      list.appendChild(item);
    });

    toggleContainer(matches.length > 0);
  };

  const getMatches = (term: string): Suggestion[] => {
    const normalized = term.toLowerCase().trim();
    if (!normalized || normalized.length < config.minCharacters) return [];

    const tokens = normalized.split(/\s+/).filter(Boolean);

    return suggestions
      .filter((suggestion) => tokens.every((token) => suggestion.normalized.includes(token)))
      .slice(0, config.maxResults);
  };

  const handleInput = () => {
    const matches = getMatches(input.value);
    if (!matches.length) {
      clearList();
      return;
    }

    render(matches);
  };

  const handleFocus = () => {
    if (input.value.trim().length >= config.minCharacters) {
      const matches = getMatches(input.value);
      if (matches.length) {
        render(matches);
      }
    }
  };

  const handleBlur = () => {
    window.setTimeout(() => toggleContainer(false), 80);
  };

  const handleClickOutside = (event: Event) => {
    const target = event.target;
    if (target instanceof Node && !container.contains(target) && target !== input) {
      toggleContainer(false);
    }
  };

  const handleListClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>("[data-suggestion-button]");
    if (!button?.dataset.suggestionValue) return;

    submitWithValue(button.dataset.suggestionValue);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const items = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-suggestion-button]"));
    if (!items.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1 + items.length) % items.length;
      highlightItem(activeIndex);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlightItem(activeIndex);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0 && activeIndex < items.length) {
      event.preventDefault();
      const value = items[activeIndex].dataset.suggestionValue;
      if (value) {
        submitWithValue(value);
      }
      return;
    }

    if (event.key === "Escape") {
      clearList();
    }
  };

  const addListener = (
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler as EventListener, options);
    listeners.push({ target, type, handler, options });
  };

  addListener(input, "input", handleInput);
  addListener(input, "focus", handleFocus);
  addListener(input, "blur", handleBlur);
  addListener(input, "keydown", handleKeyDown);
  addListener(document, "pointerdown", handleClickOutside);
  addListener(list, "click", handleListClick);

  return () => {
    clearList();
    delete input.dataset.tiendaSuggestions;

    listeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler as EventListener, options);
    });
  };
};
