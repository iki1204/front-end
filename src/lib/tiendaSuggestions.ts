type SetupOptions = {
  formId?: string;
  inputId?: string;
  containerId?: string;
  listId?: string;
  dataElementId?: string;
  maxResults?: number;
};

const DEFAULT_OPTIONS: Required<SetupOptions> = {
  formId: "storeSearchForm",
  inputId: "storeSearchInput",
  containerId: "searchSuggestionList",
  listId: "searchSuggestionItems",
  dataElementId: "tiendaSuggestionData",
  maxResults: 50,
};

type SuggestionEntry = {
  raw: string;
  normalized: string;
};

type Teardown = () => void;

const readSuggestionValues = (dataElementId: string): string[] => {
  const dataNode = document.getElementById(dataElementId);
  if (!(dataNode instanceof HTMLScriptElement)) return [];

  try {
    const parsed = JSON.parse(dataNode.textContent ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildSuggestionPool = (values: string[]): SuggestionEntry[] => {
  const unique = new Set(
    values
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim())
  );

  return Array.from(unique).map((value) => ({
    raw: value,
    normalized: value.toLowerCase(),
  }));
};

export const setupTiendaSuggestions = (options: SetupOptions = {}): Teardown | null => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const config = { ...DEFAULT_OPTIONS, ...options };

  const form = document.getElementById(config.formId);
  const input = document.getElementById(config.inputId);
  const suggestionContainer = document.getElementById(config.containerId);
  const suggestionList = document.getElementById(config.listId);

  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement) ||
    !suggestionContainer ||
    !suggestionList
  ) {
    return;
  }

  if (input.dataset.suggestionsInitialized === "true") {
    return;
  }
  input.dataset.suggestionsInitialized = "true";


  const suggestionPool = buildSuggestionPool(readSuggestionValues(config.dataElementId));

  let lastValue = input.value;

  const submitForm = () => {
    form.requestSubmit();
  };

  const toggleDropdown = (shouldShow: boolean) => {
    suggestionContainer.classList.toggle("hidden", !shouldShow);
    input.setAttribute("aria-expanded", String(shouldShow));
  };

  const clearSuggestions = () => {
    suggestionList.innerHTML = "";
    toggleDropdown(false);
  };

  const renderSuggestions = (matches: SuggestionEntry[]) => {
    suggestionList.innerHTML = "";

    matches.forEach((match) => {
      const listItem = document.createElement("li");
      const button = document.createElement("button");
      const iconWrapper = document.createElement("span");
      const label = document.createElement("span");

      button.type = "button";
      button.dataset.suggestionValue = match.raw;
      button.className =
        "flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-800 transition hover:bg-zinc-50 hover:text-primary dark:text-white dark:hover:bg-zinc-800";

      iconWrapper.innerHTML = `
        <svg aria-hidden="true" focusable="false" class="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>`;

      label.textContent = match.raw;

      button.appendChild(iconWrapper);
      button.appendChild(label);

      button.addEventListener("click", () => {
        input.value = match.raw;
        toggleDropdown(false);
        submitForm();
      });

      listItem.appendChild(button);
      suggestionList.appendChild(listItem);
    });

    toggleDropdown(matches.length > 0);
  };

  const filterSuggestions = () => {
    if (!suggestionPool.length) {
      clearSuggestions();
      return;
    }

    const term = input.value.trim().toLowerCase();

    if (!term) {
      clearSuggestions();
      return;
    }

    const parts = term.split(/\s+/).filter(Boolean);

    const matches = suggestionPool
      .filter((entry) => parts.every((part) => entry.normalized.includes(part)))
      .slice(0, config.maxResults);

    renderSuggestions(matches);
  };

  const listeners: Array<{
    target: EventTarget;
    type: string;
    handler: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  }> = [];

  const addListener = (
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler as EventListener, options);
    listeners.push({ target, type, handler, options });
  };

  const handleInput = () => {
    filterSuggestions();

    if (lastValue && input.value.trim() === "") {
      toggleDropdown(false);
      submitForm();
    }

    lastValue = input.value;
  };

  const handleFocus = () => {
    if (input.value.trim() !== "") {
      filterSuggestions();
    }
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      const isInsideDropdown = active instanceof Node && suggestionContainer.contains(active);
      const isInputFocused = active === input;

      if (!isInsideDropdown && !isInputFocused) {
        toggleDropdown(false);
      }
    }, 50);
  };

  const handleDocumentMouseDown = (event: Event) => {
    const target = event.target;

    if (target instanceof Node && !suggestionContainer.contains(target) && !input.contains(target)) {
      toggleDropdown(false);
    }
  };

  const handleSearch = () => {
    if (input.value.trim() === "") {
      toggleDropdown(false);
      submitForm();
    }
  };

  addListener(input, "input", handleInput);
  addListener(input, "focus", handleFocus);
  addListener(input, "blur", handleBlur);
  addListener(document, "mousedown", handleDocumentMouseDown);
  addListener(input, "search", handleSearch);

  filterSuggestions();
  
return () => {
    clearSuggestions();
    input.removeAttribute("data-suggestions-initialized");

    listeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler as EventListener, options);
    });
  };
};
 