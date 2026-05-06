export const registerNavigationPreloader = (
  selector = "a[data-nav-loading]",
  loadingText = "Cargando..."
): void => {
  const links = document.querySelectorAll<HTMLAnchorElement>(selector);

  links.forEach((link) => {
    if (link.dataset.loadingBound === "1") return;

    link.addEventListener("click", (event: MouseEvent) => {
      if (event.defaultPrevented || link.dataset.loadingActive === "1") return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      link.dataset.loadingActive = "1";
      link.classList.add("pointer-events-none", "opacity-90", "justify-center", "gap-2");
      link.setAttribute("aria-busy", "true");
      link.setAttribute("aria-live", "polite");
      link.innerHTML = `<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" aria-hidden="true"></span><span>${loadingText}</span>`;
    });

    link.dataset.loadingBound = "1";
  });
};