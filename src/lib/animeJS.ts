import { animate, stagger, splitText } from "animejs";

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







function presetGameAnimation(): void {

    const els = Array.from(
        document.querySelectorAll<HTMLElement>('[data-anime="split"]')
    );

    if (!els.length) return;

    for (const el of els) {
        if (el.dataset.animeHoverBound === "1") continue;

        const targets = getSplitTargets(el, "chars");
        if (!targets?.length) continue;

        const runHoverAnimation = () => {
            animate(targets, {
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
