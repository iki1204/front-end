import { animate, stagger, splitText } from "animejs";

type SplitMode = "chars" | "words" | "lines";

function getSplitTargets(
  el: HTMLElement
): HTMLElement[] | null {

  // Evita volver a dividir el mismo elemento
  if (el.dataset.animeSplitDone === "1") return null;
  el.dataset.animeSplitDone = "1";

  const mode = (
    (el.dataset.animeSplit as SplitMode) ?? "chars"
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

    if (mode === "words" && targets?.length) {
    targets.forEach((w) => {
        w.style.setProperty("display", "inline-block", "important");
        w.style.setProperty("white-space", "nowrap", "important");
        w.style.setProperty("word-break", "normal", "important");
        w.style.setProperty("overflow-wrap", "normal", "important");
        w.style.setProperty("hyphens", "none", "important");
    });

    // También fuerza el contenedor
    el.style.setProperty("word-break", "normal", "important");
    el.style.setProperty("overflow-wrap", "normal", "important");
    el.style.setProperty("hyphens", "none", "important");
    }

  return targets ?? null;
}







function presetGameAnimation(): void {

    const els = Array.from(
        document.querySelectorAll<HTMLElement>('[data-anime="split"]')
    );

    const allTargets: HTMLElement[] = [];

    for (const el of els) {
        const targets = getSplitTargets(el);
        if (targets) allTargets.push(...targets);
    }

    if (!allTargets.length) return;

    animate(allTargets, {
      y: [
        { to: "-2.75rem", ease: "outExpo", duration: 600 },
        { to: 0, ease: "outBounce", duration: 800, delay: 100 },
      ],
      rotate: {
        from: "-1turn",
        delay: 0,
      },
      delay: stagger(50),
      ease: "inOutCirc",
      loopDelay: 1000,
      loop: true,
    });
}

function presetTextAnimation(): void {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-anime="text"]'));
    if (!els.length) return;

    const allTargets: HTMLElement[] = [];

    for (const el of els) {
        const targets = getSplitTargets(el);
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
        const targets = getSplitTargets(el);
        if (targets) allTargets.push(...targets);
    }

    if (!allTargets.length) return;

    animate(allTargets, {
        translateX: [0,30],
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
