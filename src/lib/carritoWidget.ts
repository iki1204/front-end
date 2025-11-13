import {
  addItemToCart,
  clearCart,
  decrementCartItem,
  ensureCartInitialized,
  formatMoney,
  formatPrice,
  getCartItems,
  getCartTotal,
  incrementCartItem,
  removeCartItem,
  subscribeToCart,
} from "./carritoTienda";

const CART_WIDGET_ATTRIBUTE = "data-cart-widget";

let actionsBound = false;
const widgetCleanups = new Map<Element, () => void>();

const createElement = <T extends keyof HTMLElementTagNameMap>(tag: T) =>
  document.createElement(tag);

const handleAddToCart = (trigger: HTMLElement) => {
  const priceValue = trigger.dataset.productPrice ?? "";
  const parsedPrice = priceValue === "" ? null : Number.parseFloat(priceValue);

  addItemToCart({
    id: trigger.dataset.productId,
    name: trigger.dataset.productName,
    price: Number.isFinite(parsedPrice) ? Number(parsedPrice) : null,
    image: trigger.dataset.productImage,
    url: trigger.dataset.productUrl,
  });

  document.dispatchEvent(new CustomEvent("cart:open-request"));
};

const bindGlobalActions = () => {
  if (actionsBound || typeof window === "undefined") {
    return;
  }

  actionsBound = true;
  ensureCartInitialized();

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const addTrigger = target.closest<HTMLElement>("[data-action='add-to-cart']");
    if (addTrigger) {
      event.preventDefault();
      handleAddToCart(addTrigger);
      return;
    }

    const decrementTrigger = target.closest<HTMLElement>("[data-cart-decrement]");
    if (decrementTrigger?.dataset.cartDecrement) {
      event.preventDefault();
      decrementCartItem(decrementTrigger.dataset.cartDecrement);
      return;
    }

    const incrementTrigger = target.closest<HTMLElement>("[data-cart-increment]");
    if (incrementTrigger?.dataset.cartIncrement) {
      event.preventDefault();
      incrementCartItem(incrementTrigger.dataset.cartIncrement);
      return;
    }

    const removeTrigger = target.closest<HTMLElement>("[data-cart-remove]");
    if (removeTrigger?.dataset.cartRemove) {
      event.preventDefault();
      removeCartItem(removeTrigger.dataset.cartRemove);
    }
  });
};

const renderMiniCartItem = (item: ReturnType<typeof getCartItems>[number]) => {
  const listItem = createElement("li");
  listItem.className = "flex items-start gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800";

  const image = createElement("img");
  image.src = item.image;
  image.alt = item.name;
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 64;
  image.height = 64;
  image.className = "h-16 w-16 shrink-0 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800";

  const info = createElement("div");
  info.className = "flex-1";

  const name = createElement("a");
  name.href = item.url;
  name.className = "block text-sm font-semibold text-zinc-900 transition hover:text-primary dark:text-white";
  name.textContent = item.name;

  const priceText = createElement("p");
  priceText.className = "text-xs text-zinc-500 dark:text-zinc-400";
  priceText.textContent =
    typeof item.price === "number" ? `${formatPrice(item.price)} c/u` : "Precio a consultar";

  const controls = createElement("div");
  controls.className = "mt-3 flex flex-wrap items-center gap-2";

  const decrementButton = createElement("button");
  decrementButton.type = "button";
  decrementButton.dataset.cartDecrement = item.id;
  decrementButton.className =
    "flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-sm text-zinc-600 transition hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300";
  decrementButton.textContent = "−";
  decrementButton.setAttribute("aria-label", `Quitar una unidad de ${item.name}`);

  const quantityBadge = createElement("span");
  quantityBadge.className =
    "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-white";
  quantityBadge.textContent = `x${item.quantity}`;

  const incrementButton = createElement("button");
  incrementButton.type = "button";
  incrementButton.dataset.cartIncrement = item.id;
  incrementButton.className =
    "flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-sm text-zinc-600 transition hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300";
  incrementButton.textContent = "+";
  incrementButton.setAttribute("aria-label", `Agregar una unidad de ${item.name}`);

  const removeButton = createElement("button");
  removeButton.type = "button";
  removeButton.dataset.cartRemove = item.id;
  removeButton.className =
    "ml-auto rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-zinc-500 transition hover:text-red-500 dark:text-zinc-400";
  removeButton.textContent = "Eliminar";

  controls.append(decrementButton, quantityBadge, incrementButton, removeButton);
  info.append(name, priceText, controls);

  listItem.append(image, info);
  return listItem;
};

const setupWidget = (widget: Element) => {
  if (widgetCleanups.has(widget)) {
    return;
  }

  const panel = widget.querySelector<HTMLElement>("[data-cart-panel]");
  const toggleButton = widget.querySelector<HTMLButtonElement>("[data-cart-toggle]");
  const countElements = widget.querySelectorAll<HTMLElement>("[data-cart-count]");
  const cartList = widget.querySelector<HTMLUListElement>("[data-cart-list]");
  const cartEmpty = widget.querySelector<HTMLElement>("[data-cart-empty]");
  const cartFooter = widget.querySelector<HTMLElement>("[data-cart-footer]");
  const cartTotal = widget.querySelector<HTMLElement>("[data-cart-total]");
  const clearButton = widget.querySelector<HTMLButtonElement>("[data-cart-clear]");
  const closeButton = widget.querySelector<HTMLButtonElement>("[data-cart-close]");
  const checkoutButton = widget.querySelector<HTMLAnchorElement>("[data-cart-checkout]");

  if (!panel || !toggleButton) {
    return;
  }

  let isOpen = false;

  const openPanel = () => {
    if (isOpen) {
      return;
    }

    panel.classList.remove("hidden");
    toggleButton.setAttribute("aria-expanded", "true");
    widget.setAttribute("data-open", "true");
    isOpen = true;
  };

  const closePanel = () => {
    if (!isOpen) {
      return;
    }

    panel.classList.add("hidden");
    toggleButton.setAttribute("aria-expanded", "false");
    widget.removeAttribute("data-open");
    isOpen = false;
  };

  const togglePanel = () => {
    (isOpen ? closePanel : openPanel)();
  };

  const outsideClickHandler = (event: MouseEvent) => {
    if (!isOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (widget.contains(target)) {
      return;
    }

    closePanel();
  };

  const escapeHandler = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen) {
      closePanel();
    }
  };

  const openRequestHandler = () => {
    openPanel();
  };

  const handleToggleClick = (event: MouseEvent) => {
    event.preventDefault();
    togglePanel();
  };

  toggleButton.addEventListener("click", handleToggleClick);

  document.addEventListener("click", outsideClickHandler);
  document.addEventListener("keydown", escapeHandler);
  document.addEventListener("cart:open-request", openRequestHandler);

  const unsubscribe = subscribeToCart((items) => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce(
      (sum, item) => sum + (typeof item.price === "number" ? item.price * item.quantity : 0),
      0,
    );

    countElements.forEach((element) => {
      element.textContent = String(itemCount);
    });

    toggleButton.setAttribute(
      "aria-label",
      `Abrir carrito (${itemCount} ${itemCount === 1 ? "producto" : "productos"})`,
    );

    if (!cartList || !cartEmpty || !cartFooter || !cartTotal) {
      return;
    }

    if (items.length === 0) {
      cartEmpty.classList.remove("hidden");
      cartList.classList.add("hidden");
      cartFooter.classList.add("hidden");
      cartList.innerHTML = "";
      cartTotal.textContent = formatMoney(0);
      if (checkoutButton) {
        checkoutButton.classList.add("pointer-events-none", "opacity-50");
        checkoutButton.setAttribute("aria-disabled", "true");
      }
      return;
    }

    cartEmpty.classList.add("hidden");
    cartList.classList.remove("hidden");
    cartFooter.classList.remove("hidden");
    cartList.innerHTML = "";

    items.forEach((item) => {
      cartList.append(renderMiniCartItem(item));
    });

    cartTotal.textContent = formatMoney(total);
    if (checkoutButton) {
      checkoutButton.classList.remove("pointer-events-none", "opacity-50");
      checkoutButton.setAttribute("aria-disabled", "false");
    }
  });

  const handleClearClick = (event: MouseEvent) => {
    event.preventDefault();
    clearCart();
  };

  if (clearButton) {
    clearButton.addEventListener("click", handleClearClick);
  }

  const handleCloseClick = (event: MouseEvent) => {
    event.preventDefault();
    closePanel();
  };

  if (closeButton) {
    closeButton.addEventListener("click", handleCloseClick);
  }

  const cleanup = () => {
    unsubscribe();
    toggleButton.removeEventListener("click", handleToggleClick);
    if (clearButton) {
      clearButton.removeEventListener("click", handleClearClick);
    }
    if (closeButton) {
      closeButton.removeEventListener("click", handleCloseClick);
    }
    document.removeEventListener("click", outsideClickHandler);
    document.removeEventListener("keydown", escapeHandler);
    document.removeEventListener("cart:open-request", openRequestHandler);
    widgetCleanups.delete(widget);
  };

  widgetCleanups.set(widget, cleanup);
};

const teardownWidgets = () => {
  widgetCleanups.forEach((dispose) => dispose());
  widgetCleanups.clear();
};

export const initCartWidget = () => {
  if (typeof window === "undefined") {
    return;
  }

  ensureCartInitialized();
  teardownWidgets();

  const widgets = Array.from(document.querySelectorAll(`[${CART_WIDGET_ATTRIBUTE}]`));
  widgets.forEach((widget) => setupWidget(widget));
};

export const initCartActions = () => {
  bindGlobalActions();
};

export const initCheckoutPage = (root: ParentNode | Document = document) => {
  if (typeof window === "undefined") {
    return;
  }

  ensureCartInitialized();

  const container = root.querySelector<HTMLElement>("[data-checkout-root]");
  if (!container || container.hasAttribute("data-checkout-ready")) {
    return;
  }

  container.setAttribute("data-checkout-ready", "true");

  const list = container.querySelector<HTMLUListElement>("[data-checkout-list]");
  const empty = container.querySelector<HTMLElement>("[data-checkout-empty]");
  const subtotalElement = root.querySelector<HTMLElement>("[data-checkout-subtotal]");
  const itemCountElement = root.querySelector<HTMLElement>("[data-checkout-count]");
  const clearButton = root.querySelector<HTMLButtonElement>("[data-checkout-clear]");
  const proceedButton = root.querySelector<HTMLButtonElement>("[data-checkout-proceed]");

  const renderCheckoutItem = (item: ReturnType<typeof getCartItems>[number]) => {
    const listItem = createElement("li");
    listItem.className =
      "flex flex-col gap-4 rounded-3xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex-row sm:items-start";

    const imageWrapper = createElement("div");
    imageWrapper.className = "h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800";

    const image = createElement("img");
    image.src = item.image;
    image.alt = item.name;
    image.loading = "lazy";
    image.decoding = "async";
    image.className = "h-full w-full object-cover";

    imageWrapper.append(image);

    const info = createElement("div");
    info.className = "flex-1";

    const title = createElement("h3");
    title.className = "text-lg font-semibold text-zinc-900 dark:text-white";
    title.textContent = item.name;

    const price = createElement("p");
    price.className = "text-sm text-zinc-500 dark:text-zinc-400";
    price.textContent =
      typeof item.price === "number" ? `${formatPrice(item.price)} c/u` : "Precio a consultar";

    const controls = createElement("div");
    controls.className = "mt-4 flex flex-wrap items-center gap-3";

    const decrementButton = createElement("button");
    decrementButton.type = "button";
    decrementButton.dataset.cartDecrement = item.id;
    decrementButton.className =
      "flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg text-zinc-600 transition hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300";
    decrementButton.textContent = "−";
    decrementButton.setAttribute("aria-label", `Quitar una unidad de ${item.name}`);

    const quantity = createElement("span");
    quantity.className =
      "min-w-[3rem] text-center text-sm font-semibold text-zinc-700 dark:text-white";
    quantity.textContent = String(item.quantity);

    const incrementButton = createElement("button");
    incrementButton.type = "button";
    incrementButton.dataset.cartIncrement = item.id;
    incrementButton.className =
      "flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg text-zinc-600 transition hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-300";
    incrementButton.textContent = "+";
    incrementButton.setAttribute("aria-label", `Agregar una unidad de ${item.name}`);

    const removeButton = createElement("button");
    removeButton.type = "button";
    removeButton.dataset.cartRemove = item.id;
    removeButton.className =
      "ml-auto rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-zinc-500 transition hover:text-red-500 dark:text-zinc-400";
    removeButton.textContent = "Eliminar";

    controls.append(decrementButton, quantity, incrementButton, removeButton);

    const totalLine = createElement("p");
    totalLine.className = "text-sm font-semibold text-zinc-900 dark:text-white";
    const lineTotal =
      typeof item.price === "number" ? formatMoney(item.price * item.quantity) : "--";
    totalLine.textContent = `Subtotal: ${lineTotal}`;

    info.append(title, price, controls, totalLine);

    listItem.append(imageWrapper, info);

    return listItem;
  };

  const unsubscribe = subscribeToCart((items) => {
    const total = getCartTotal();
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    if (subtotalElement) {
      subtotalElement.textContent = formatMoney(total);
    }

    if (itemCountElement) {
      itemCountElement.textContent = `${count} ${count === 1 ? "artículo" : "artículos"}`;
    }

    if (!list || !empty) {
      return;
    }

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

    items.forEach((item) => {
      list.append(renderCheckoutItem(item));
    });

    if (proceedButton) {
      proceedButton.disabled = false;
      proceedButton.classList.remove("opacity-60", "cursor-not-allowed");
    }
  });

  const handleClearClick = (event: MouseEvent) => {
    event.preventDefault();
    clearCart();
  };

  if (clearButton) {
    clearButton.addEventListener("click", handleClearClick);
  }

  const cleanup = () => {
    unsubscribe();
    if (clearButton) {
      clearButton.removeEventListener("click", handleClearClick);
    }
    container.removeAttribute("data-checkout-ready");
  };

  const destroyEvent = () => {
    cleanup();
    document.removeEventListener("astro:before-swap", destroyEvent as EventListener);
  };

  document.addEventListener("astro:before-swap", destroyEvent as EventListener, { once: true });
};

const bootstrap = () => {
  initCartActions();
  initCartWidget();
};

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }

  document.addEventListener("astro:page-load", () => {
    initCartWidget();
  });
}