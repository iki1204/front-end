const STORAGE_KEY = "tienda-cart";
const PLACEHOLDER_IMAGE = "/images/placeholder.svg";
const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

type CartItem = {
  id: string;
  name: string;
  price: number | null;
  quantity: number;
  image: string;
  url: string;
};

type CartSubscriber = (items: CartItem[]) => void;
type QueryRoot = Document | HTMLElement;
type CartInput = Partial<Omit<CartItem, "id" | "quantity" | "price">> & {
  id?: string | number | null;
  quantity?: number | string | null;
  price?: number | string | null;
};

let loaded = false;
let cartItems: CartItem[] = [];
const subscribers = new Set<CartSubscriber>();
const widgetCleanups = new Map<HTMLElement, () => void>();
const checkoutCleanups = new Map<QueryRoot, () => void>();
let actionsBound = false;

const cloneItems = (): CartItem[] => cartItems.map((item) => ({ ...item }));

const sanitizeItem = (rawItem: CartInput = {}): CartItem | null => {
  const idCandidate = rawItem.id;
  const id =
    typeof idCandidate === "string"
      ? idCandidate.trim()
      : idCandidate !== undefined && idCandidate !== null
        ? String(idCandidate)
        : "";

  if (!id) return null;

  const quantityCandidate = Number(rawItem.quantity);
  const quantity = Number.isFinite(quantityCandidate) ? Math.max(1, Math.trunc(quantityCandidate)) : 1;

  const priceCandidate =
    typeof rawItem.price === "string" ? Number(rawItem.price) : typeof rawItem.price === "number" ? rawItem.price : null;
  const price = typeof priceCandidate === "number" && Number.isFinite(priceCandidate) ? priceCandidate : null;

  const name = typeof rawItem.name === "string" && rawItem.name.trim().length > 0 ? rawItem.name.trim() : "Producto";
  const image = typeof rawItem.image === "string" && rawItem.image.length > 0 ? rawItem.image : PLACEHOLDER_IMAGE;
  const url = typeof rawItem.url === "string" && rawItem.url.length > 0 ? rawItem.url : "#";

  return { id, name, price, quantity, image, url };
};

const loadCart = () => {
  if (loaded || typeof window === "undefined") return;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      cartItems = [];
    } else {
      const parsed = JSON.parse(saved);
      cartItems = Array.isArray(parsed)
        ? parsed
            .map((entry) => sanitizeItem(entry))
            .filter((value): value is CartItem => Boolean(value))
        : [];
    }
  } catch (error) {
    cartItems = [];
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    loaded = false;
    loadCart();
    notify();
  });

  loaded = true;
};

export const ensureCartInitialized = () => {
  loadCart();
};

const persistCart = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  } catch (error) {
    // ignore persistence errors
  }
};

const notify = () => {
  const snapshot = cloneItems();
  subscribers.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (error) {
      // ignore subscriber errors
    }
  });
};

const withUpdate = (updater: () => void) => {
  loadCart();
  updater();
  persistCart();
  notify();
};

export const formatMoney = (value: number | null | undefined): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Consultar";
  return currencyFormatter.format(Math.max(0, value));
};

export const formatPrice = (value: number | null | undefined): string => {
  return formatMoney(value);
};

export const subscribeToCart = (callback: CartSubscriber): (() => void) => {
  loadCart();
  subscribers.add(callback);
  callback(cloneItems());
  return () => subscribers.delete(callback);
};

export const getCartItems = (): CartItem[] => {
  loadCart();
  return cloneItems();
};

export const getCartTotal = (): number => {
  return getCartItems().reduce((sum, item) => {
    return sum + (typeof item.price === "number" ? item.price * item.quantity : 0);
  }, 0);
};

const findItemIndex = (id: string): number => cartItems.findIndex((item) => item.id === id);

export const addItemToCart = (rawItem: CartInput) => {
  const item = sanitizeItem(rawItem);
  if (!item) return;

  withUpdate(() => {
    const index = findItemIndex(item.id);
    if (index >= 0) {
      cartItems[index].quantity += item.quantity;
    } else {
      cartItems.push(item);
    }
  });
};

export const incrementCartItem = (id: string) => {
  if (!id) return;
  withUpdate(() => {
    const index = findItemIndex(id);
    if (index >= 0) {
      cartItems[index].quantity += 1;
    }
  });
};

export const decrementCartItem = (id: string) => {
  if (!id) return;
  withUpdate(() => {
    const index = findItemIndex(id);
    if (index === -1) return;
    cartItems[index].quantity -= 1;
    if (cartItems[index].quantity <= 0) {
      cartItems.splice(index, 1);
    }
  });
};

export const removeCartItem = (id: string) => {
  if (!id) return;
  withUpdate(() => {
    cartItems = cartItems.filter((item) => item.id !== id);
  });
};

export const clearCart = () => {
  withUpdate(() => {
    cartItems = [];
  });
};

const renderMiniCartItem = (item: CartItem): HTMLLIElement => {
  const li = document.createElement("li");
  li.className = "flex items-start gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800";

  const image = document.createElement("img");
  image.src = item.image;
  console.log(item.image);
  image.alt = item.name;
  image.loading = "lazy";
  image.width = 64;
  image.height = 64;
  image.className = "h-16 w-16 shrink-0 rounded-xl object-fit bg-zinc-100 dark:bg-zinc-800";

  const info = document.createElement("div");
  info.className = "flex-1";

  const name = document.createElement("a");
  name.href = item.url;
  name.textContent = item.name;
  name.className = "block text-sm font-semibold text-zinc-900 transition hover:text-primary dark:text-white";

  const price = document.createElement("p");
  price.className = "text-xs text-zinc-500 dark:text-zinc-400";
  price.textContent = typeof item.price === "number" ? `${formatMoney(item.price)} c/u` : "Precio a consultar";

  const controls = document.createElement("div");
  controls.className = "mt-3 flex flex-wrap items-center gap-2";

  const decrement = document.createElement("button");
  decrement.type = "button";
  decrement.dataset.cartDecrement = item.id;
  decrement.className =
    "flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-sm text-zinc-600 transition hover:border-primary hover:text-primary dark:border-red-700 dark:text-zinc-300";
  decrement.textContent = "−";

  const quantity = document.createElement("span");
  quantity.className =
    "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-white";
  quantity.textContent = `x${item.quantity}`;

  const increment = document.createElement("button");
  increment.type = "button";
  increment.dataset.cartIncrement = item.id;
  increment.className =
    "flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-sm text-zinc-600 transition hover:border-primary hover:text-primary dark:border-red-700 dark:text-zinc-300";
  increment.textContent = "+";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.cartRemove = item.id;
  remove.className =
    "ml-auto rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-zinc-500 transition hover:text-red-500 dark:text-zinc-400";
  remove.textContent = "Eliminar";

  controls.append(decrement, quantity, increment, remove);
  info.append(name, price, controls);
  li.append(image, info);
  return li;
};

const renderCheckoutItem = (item: CartItem): HTMLLIElement => {
  const li = document.createElement("li");
  li.className =
    "flex flex-col gap-4 rounded-3xl border border-zinc-200 p-6 shadow-sm dark:border-red-800 dark:bg-zinc-900/40 sm:flex-row sm:items-start";

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800";
  const image = document.createElement("img");
  image.src = item.image;
  image.alt = item.name;
  image.loading = "lazy";
  image.className = "h-full w-full object-fit";
  imageWrapper.append(image);

  const info = document.createElement("div");
  info.className = "flex-1";
  const title = document.createElement("h3");
  title.className = "text-lg font-semibold text-zinc-900 dark:text-white";
  title.textContent = item.name;
  const price = document.createElement("p");
  price.className = "text-sm text-zinc-500 dark:text-zinc-400";
  price.textContent = typeof item.price === "number" ? `${formatMoney(item.price)} c/u` : "Precio a consultar";

  const controls = document.createElement("div");
  controls.className = "mt-4 flex flex-wrap items-center gap-3";
  const decrement = document.createElement("button");
  decrement.type = "button";
  decrement.dataset.cartDecrement = item.id;
  decrement.className =
    "cursor-pointer flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg text-zinc-600 transition hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300";
  decrement.textContent = "−";

  const quantity = document.createElement("span");
  quantity.className = "min-w-[3rem] text-center text-sm font-semibold text-zinc-700 dark:text-white";
  quantity.textContent = String(item.quantity);

  const increment = document.createElement("button");
  increment.type = "button";
  increment.dataset.cartIncrement = item.id;
  increment.className =
    "cursor-pointer flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg text-zinc-600 transition hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300";
  increment.textContent = "+";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.cartRemove = item.id;
  remove.className =
    "cursor-pointer ml-auto rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-zinc-500 transition hover:text-red-500 dark:text-zinc-400";
  remove.textContent = "Eliminar";

  const lineTotal = document.createElement("p");
  lineTotal.className = "pt-2 text-sm font-semibold text-zinc-900 dark:text-white";
  const subtotal = typeof item.price === "number" ? item.price * item.quantity : null;
  lineTotal.textContent = `Subtotal: ${subtotal === null ? "--" : formatMoney(subtotal)}`;

  controls.append(decrement, quantity, increment, remove);
  info.append(title, price, controls, lineTotal);
  li.append(imageWrapper, info);
  return li;
};

const setupWidget = (widget: HTMLElement) => {
  if (widgetCleanups.has(widget)) return;

  const panel = widget.querySelector<HTMLElement>("[data-cart-panel]");
  const toggle = widget.querySelector<HTMLButtonElement>("[data-cart-toggle]");
  const counts = widget.querySelectorAll<HTMLElement>("[data-cart-count]");
  const list = widget.querySelector<HTMLUListElement>("[data-cart-list]");
  const empty = widget.querySelector<HTMLElement>("[data-cart-empty]");
  const footer = widget.querySelector<HTMLElement>("[data-cart-footer]");
  const total = widget.querySelector<HTMLElement>("[data-cart-total]");
  const clearButton = widget.querySelector<HTMLButtonElement>("[data-cart-clear]");
  const closeButton = widget.querySelector<HTMLButtonElement>("[data-cart-close]");
  const checkoutButton = widget.querySelector<HTMLAnchorElement>("[data-cart-checkout]");

  if (!panel || !toggle) return;


  const hoverSupported =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
      : true;

  const hoverOpen = widget.hasAttribute("data-hover-open") && hoverSupported;

  const isPointerInsideWidget = () => {
    return widget.matches(":hover") || panel.matches(":hover");
  };

  const triggerButtonAnimation = () => {
    toggle.classList.remove("cart-widget-bump");
    // Force reflow to allow the animation to restart.
    void toggle.offsetWidth;
    toggle.classList.add("cart-widget-bump");
  };

  let isOpen = false;
  let isPinnedOpen = false;

  const openPanel = () => {
    if (isOpen) return;
    panel.classList.remove("hidden");
    toggle.setAttribute("aria-expanded", "true");
    widget.setAttribute("data-open", "true");
    isOpen = true;
  };
  const closePanel = () => {
    if (!isOpen) return;
    panel.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
    widget.removeAttribute("data-open");
    isOpen = false;
    isPinnedOpen = false;
    isPinnedOpen = false;
  };
  let hoverCloseTimeout: number | null = null;
  let hoverEnter: (() => void) | null = null;
  let hoverLeave: (() => void) | null = null;
  const clearHoverTimeout = () => {
    if (hoverCloseTimeout !== null) {
      window.clearTimeout(hoverCloseTimeout);
      hoverCloseTimeout = null;
    }
  };
  const scheduleHoverClose = () => {
    if (isPinnedOpen) return;
    clearHoverTimeout();
    hoverCloseTimeout = window.setTimeout(() => {
      hoverCloseTimeout = null;
      if (isPointerInsideWidget()) {
        scheduleHoverClose();
        return;
      }
      closePanel();
    }, 220);
  };
  
  const togglePanel = (event?: Event) => {
    event?.preventDefault();
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
      isPinnedOpen = true;
      clearHoverTimeout();
    }
  };

  const outsideHandler = (event: MouseEvent) => {
    if (!isOpen) return;
    if (isPointerInsideWidget()) return;
    const target = event.target;
    if (target instanceof Element && widget.contains(target)) return;
    const composedPath = typeof event.composedPath === "function" ? event.composedPath() : undefined;
    if (composedPath && composedPath.includes(widget)) return;  
    closePanel();
  };

  const escHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape") closePanel();
  };

  const openRequestHandler = () => openPanel();

  toggle.addEventListener("click", togglePanel);
  document.addEventListener("click", outsideHandler);
  document.addEventListener("keydown", escHandler);
  document.addEventListener("cart:open-request", openRequestHandler as EventListener);

  if (hoverOpen) {
    hoverEnter = () => {
      clearHoverTimeout();
      openPanel();
    };
    hoverLeave = () => {
      scheduleHoverClose();
    };
    widget.addEventListener("mouseenter", hoverEnter);
    widget.addEventListener("mouseleave", hoverLeave);
    panel.addEventListener("mouseenter", hoverEnter);
    panel.addEventListener("mouseleave", hoverLeave);
  }

  let previousCount = getCartItems().reduce((sum, item) => sum + item.quantity, 0);

  const unsubscribe = subscribeToCart((items) => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    if (count > previousCount) {
      triggerButtonAnimation();
    }
    previousCount = count;
    counts.forEach((node) => {
      node.textContent = String(count);
    });

    if (!list || !empty || !footer || !total) return;

    if (items.length === 0) {
      empty.classList.remove("hidden");
      list.classList.add("hidden");
      footer.classList.add("hidden");
      list.innerHTML = "";
      total.textContent = formatMoney(0);
      if (checkoutButton) {
        checkoutButton.classList.add("pointer-events-none", "opacity-50");
        checkoutButton.setAttribute("aria-disabled", "true");
      }
      return;
    }

    empty.classList.add("hidden");
    list.classList.remove("hidden");
    footer.classList.remove("hidden");
    list.innerHTML = "";
    items.forEach((item) => list.append(renderMiniCartItem(item)));
    total.textContent = formatMoney(getCartTotal());
    if (checkoutButton) {
      checkoutButton.classList.remove("pointer-events-none", "opacity-50");
      checkoutButton.setAttribute("aria-disabled", "false");
    }
  });

  const clearHandler = (event: Event) => {
    event.preventDefault();
    clearCart();
  };

  const closeHandler = (event: Event) => {
    event.preventDefault();
    closePanel();
  };

  clearButton?.addEventListener("click", clearHandler);
  closeButton?.addEventListener("click", closeHandler);

  widgetCleanups.set(widget, () => {
    unsubscribe();
    toggle.removeEventListener("click", togglePanel);
    document.removeEventListener("click", outsideHandler);
    document.removeEventListener("keydown", escHandler);
    document.removeEventListener("cart:open-request", openRequestHandler as EventListener);
    if (hoverOpen) {
      if (hoverEnter) {
        widget.removeEventListener("mouseenter", hoverEnter);
        panel.removeEventListener("mouseenter", hoverEnter);
      }
      if (hoverLeave) {
        widget.removeEventListener("mouseleave", hoverLeave);
        panel.removeEventListener("mouseleave", hoverLeave);
      }
      clearHoverTimeout();
    }
    clearButton?.removeEventListener("click", clearHandler);
    closeButton?.removeEventListener("click", closeHandler);
  });
};

const setupCheckout = (root: QueryRoot) => {
  if (checkoutCleanups.has(root)) return;
  const container = root.querySelector("[data-checkout-root]") as HTMLElement | null;
  if (!container) return;
  const list = container.querySelector<HTMLUListElement>("[data-checkout-list]");
  const empty = container.querySelector<HTMLElement>("[data-checkout-empty]");
  const subtotal = root.querySelector<HTMLElement>("[data-checkout-subtotal]");
  const count = root.querySelector<HTMLElement>("[data-checkout-count]");
  const clearButton = root.querySelector<HTMLButtonElement>("[data-checkout-clear]");
  const proceedButton = root.querySelector<HTMLButtonElement>("[data-checkout-proceed]");

  const unsubscribe = subscribeToCart((items) => {
    const total = getCartTotal();
    if (subtotal) subtotal.textContent = formatMoney(total);
    if (count) {
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      count.textContent = `${itemCount} ${itemCount === 1 ? "artículo" : "artículos"}`;
    }

    if (!list || !empty) return;
    if (items.length === 0) {
      empty.classList.remove("hidden");
      list.classList.add("hidden");
      list.innerHTML = "";
      if (proceedButton) {
        proceedButton.disabled = true;
        proceedButton.classList.add("opacity-60", "cursor-not-allowed");
      }
      return;
    }

    empty.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = "";
    items.forEach((item) => list.append(renderCheckoutItem(item)));
    if (proceedButton) {
      proceedButton.disabled = false;
      proceedButton.classList.remove("opacity-60", "cursor-not-allowed");
    }
  });

  const clearHandler = (event: Event) => {
    event.preventDefault();
    clearCart();
  };

  clearButton?.addEventListener("click", clearHandler);

  checkoutCleanups.set(root, () => {
    unsubscribe();
    clearButton?.removeEventListener("click", clearHandler);
  });
};

const destroyWidgets = () => {
  widgetCleanups.forEach((cleanup) => cleanup());
  widgetCleanups.clear();
};

const destroyCheckout = () => {
  checkoutCleanups.forEach((cleanup) => cleanup());
  checkoutCleanups.clear();
};

const bindGlobalActions = () => {
  if (actionsBound || typeof window === "undefined") return;
  actionsBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target) return;

    const addTrigger = target.closest("[data-action='add-to-cart']") as HTMLElement | null;
    if (addTrigger) {
      event.preventDefault();
      const priceValue = addTrigger.dataset.productPrice ?? "";
      const parsedPrice = priceValue === "" ? null : Number(priceValue);
      addItemToCart({
        id: addTrigger.dataset.productId,
        name: addTrigger.dataset.productName,
        price: Number.isFinite(parsedPrice ?? NaN) ? parsedPrice : null,
        image: addTrigger.dataset.productImage,
        url: addTrigger.dataset.productUrl,
      });
      document.dispatchEvent(new CustomEvent("cart:open-request"));
      return;
    }

    const decrementTrigger = target.closest("[data-cart-decrement]") as HTMLElement | null;
    if (decrementTrigger?.dataset.cartDecrement) {
      event.preventDefault();
      decrementCartItem(decrementTrigger.dataset.cartDecrement);
      return;
    }

    const incrementTrigger = target.closest("[data-cart-increment]") as HTMLElement | null;
    if (incrementTrigger?.dataset.cartIncrement) {
      event.preventDefault();
      incrementCartItem(incrementTrigger.dataset.cartIncrement);
      return;
    }

    const removeTrigger = target.closest("[data-cart-remove]") as HTMLElement | null;
    if (removeTrigger?.dataset.cartRemove) {
      event.preventDefault();
      removeCartItem(removeTrigger.dataset.cartRemove);
    }
  });
};

export const initCartActions = () => {
  bindGlobalActions();
};


export const initCartWidgets = (root: Document | HTMLElement = document) => {
  if (typeof window === "undefined") return;
  loadCart();
  const widgets = root.querySelectorAll("[data-cart-widget]");
  widgets.forEach((node) => {
    if (node instanceof HTMLElement) {
      setupWidget(node);
    }
  });
};

export const initCheckoutPage = (root: Document | HTMLElement = document) => {
  if (typeof window === "undefined") return;
  loadCart();
  setupCheckout(root);
};

export const destroyCartWidgets = () => {
  destroyWidgets();
};

export const destroyCheckoutPage = () => {
  destroyCheckout();
};