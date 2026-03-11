import { animate, stagger, splitText, svg } from "animejs";

type SplitMode = "chars" | "words" | "lines";

function getSplitTargets(
  el: HTMLElement,
  fallbackMode: SplitMode = "chars"
): HTMLElement[] | null {

  // Evita volver a dividir el mismo elemento
  if (el.dataset.animeSplitDone === "1") return null;
  el.dataset.animeSplitDone = "1";

  const mode = (
    (el.dataset.animeSplit as SplitMode) ?? fallbackMode
  ).toLowerCase() as SplitMode;

  const opts = {
    words: mode === "words",
    chars: mode === "chars",
    lines: mode === "lines",
  };

  const result = splitText(el, opts) as unknown as {
    chars?: HTMLElement[];
    words?: HTMLElement[];
    lines?: HTMLElement[];
  };

  const targets =
    mode === "chars"
      ? result.chars
    : mode === "words"
      ? result.words
      : result.lines;


  return targets ?? null;
}


function presetBorderTrace(): void {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>('[data-anime="border-trace"]')
  );

  if (!els.length) return;

  for (const el of els) {
    if (el.dataset.animeBorderBound === "1") continue;

    const svgEl = el.querySelector<SVGElement>("svg");
    const path = el.querySelector<SVGRectElement>(".anime-border-path");

    if (!svgEl || !path) continue;

    const syncBorderMetrics = () => {
      try {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
      } catch {
        // fallback silencioso
      }
    };

    syncBorderMetrics();

    let hoverAnimation: ReturnType<typeof animate> | null = null;
    let leaveAnimation: ReturnType<typeof animate> | null = null;

    const runEnterAnimation = () => {
      syncBorderMetrics();

      hoverAnimation?.pause?.();
      leaveAnimation?.pause?.();

      svgEl.style.opacity = "0.75";

      const length = path.getTotalLength();

      path.style.strokeDasharray = `${length}`;

      hoverAnimation = animate(path, {
        strokeDashoffset: [length, 0],
        duration: 1400,
        ease: "outExpo",
      });
    };

    const runLeaveAnimation = () => {
      hoverAnimation?.pause?.();
      leaveAnimation?.pause?.();

      const length = path.getTotalLength();

      leaveAnimation = animate(path, {
        strokeDashoffset: [Number(path.style.strokeDashoffset || 0), length],
        duration: 1300,
        ease: "inOutQuad",
      });
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncBorderMetrics())
        : null;

    resizeObserver?.observe(el);

    el.addEventListener("mouseenter", runEnterAnimation);
    el.addEventListener("mouseleave", runLeaveAnimation);

    el.dataset.animeBorderBound = "1";
  }
}




function presetGameAnimation(): void {
    const els = Array.from(
        document.querySelectorAll<HTMLElement>('[data-anime="split"]')
    );

    if (!els.length) return;

    for (const el of els) {
        if (el.dataset.animeHoverBound === "1") continue;

        const targets = getSplitTargets(el, "chars");
        if (!targets?.length) continue;

        for (const target of targets) {
            target.style.padding = "0";
        }


        const runHoverAnimation = () => {
            animate(targets, {
                y: [
                    { to: "-2.50rem", ease: "outExpo", duration: 600 },
                    { to: 0, ease: "outBounce", duration: 800, delay: 100 },
                ],
                rotate: {
                    from: "-1turn",
                    delay: 0,
                },
                delay: stagger(10),
                ease: "inOutCirc",
            });
        };

        el.addEventListener("mouseenter", runHoverAnimation);
        el.dataset.animeHoverBound = "1";
    }
}

function presetTextAnimation(): void {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-anime="text"]'));
    if (!els.length) return;

    const allTargets: HTMLElement[] = [];

    for (const el of els) {
        const targets = getSplitTargets(el, "chars");
        if (targets) allTargets.push(...targets);
    }

    if (!allTargets.length) return;
    
    animate(allTargets, {
        y: ['75%', '0%'],
        duration: 750,
        opacity: [0, 1],
        ease: 'out(3)',
        delay: stagger(50),
        alternate: true,
    });
    
}


function presetTypewriter(): void {
  
    const els = Array.from(
            document.querySelectorAll<HTMLElement>('[data-anime="typewriter"]')
        );

    const allTargets: HTMLElement[] = [];

    for (const el of els) {
        const targets = getSplitTargets(el, "words");
        if (targets) allTargets.push(...targets);
    }

    if (!allTargets.length) return;

    animate(allTargets, {
        translateX: [-30,0],
        opacity: [0,1],
        easing: "easeInExpo",
        duration: 1100,
        delay: (el, i) => 1500 + 30 * i,
    });


}



function init(): void {
  if (typeof window === "undefined") return;
  presetGameAnimation();
  presetTextAnimation();
  presetTypewriter();
  presetBorderTrace();
}





const run = () => init();

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  document.addEventListener("astro:after-swap", run);
}
