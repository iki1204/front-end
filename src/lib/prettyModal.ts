import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(Flip, CustomEase);

type OpenOrigin = HTMLElement | Event | null | undefined;

export class PrettyModal {
    constructor() {
        this.injectStyles();
    }

    open(dialogId: string, originArg?: OpenOrigin): void {
        const dialog = document.getElementById(dialogId);
        if (!(dialog instanceof HTMLDialogElement)) return;

        const origin = this.resolveOrigin(originArg)
            ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

        const randomId = Math.random().toString(16).slice(2);
        dialog.dataset.flipId = randomId;

        let originState: ReturnType<typeof Flip.getState> | null = null;
        if (origin) {
            origin.dataset.flipId = randomId;
            originState = Flip.getState(origin);
        }

        dialog.showModal();

        if (!originState) {
            gsap.fromTo(
                dialog,
                { opacity: 0, filter: "blur(8px)" },
                {
                    opacity: 1,
                    filter: "blur(0px)",
                    duration: 0.5,
                    ease: "power2.out",
                }
            );
            return;
        }

        Flip.from(originState, {
            targets: dialog,
            scale: true,
            ease: CustomEase.create("custom", "M0,0 C0.305,0.206 0.116,0.567 0.3,0.8 0.394,0.921 0.491,1 1,1"),
            toggleClass: "pretty-modal-opening",
            duration: 0.7,
        });
    }

    close(dialogId: string): void {
        const dialog = document.getElementById(dialogId);
        if (!(dialog instanceof HTMLDialogElement)) return;

        const originId = dialog.dataset.flipId;
        const originCandidate = originId
            ? document.querySelector<HTMLElement>(`[data-flip-id="${originId}"]`)
            : null;
        const origin = originCandidate === dialog ? null : originCandidate;

        const finalizeClose = (): void => {
            dialog.removeAttribute("style");
            if (dialog.open) dialog.close();
            delete dialog.dataset.flipId;
            if (origin) delete origin.dataset.flipId;
        };

        if (!origin) {
            gsap.to(dialog, {
                opacity: 0,
                filter: "blur(32px)",
                duration: 0.5,
                ease: "power2.in",
                onComplete: finalizeClose,
            });
            return;
        }

        const originState = Flip.getState(origin);

        Flip.to(originState, {
            targets: dialog,
            scale: true,
            ease: CustomEase.create("custom", "M0,0 C0.305,0.206 0.116,0.567 0.3,0.8 0.394,0.921 0.491,1 1,1"),
            onComplete: finalizeClose,
            toggleClass: "pretty-modal-closing",
            duration: 0.7,
        });
    }

    private resolveOrigin(originArg?: OpenOrigin): HTMLElement | null {
        if (originArg instanceof HTMLElement) return originArg;

        if (originArg instanceof Event) {
            const current = originArg.currentTarget;
            return current instanceof HTMLElement ? current : null;
        }

        return null;
    }

    private injectStyles(): void {
        // Evitar inyectar múltiples veces
        if (document.getElementById("pretty-modal-styles")) return;

        const styles = `
            .pretty-modal-opening {
                animation: pretty-modal-opening 500ms cubic-bezier(.56,.27,0,1);
            }

            @keyframes pretty-modal-opening {
                from { opacity: 0; filter: blur(8px); }
                to { opacity: 1; filter: blur(0px); }
            }

            .pretty-modal-closing {
                animation:
                    pretty-modal-closing-border-radius 500ms cubic-bezier(.56,.27,0,1),
                    pretty-modal-closing-blur 500ms cubic-bezier(.37,.35,0,1),
                    pretty-modal-closing-fade 700ms cubic-bezier(.56,.27,0,1);
            }

            @keyframes pretty-modal-closing-border-radius {
                to { border-radius: 400px; }
            }

            @keyframes pretty-modal-closing-blur {
                0% { filter: blur(0); }
                100% { filter: blur(32px); }
            }

            @keyframes pretty-modal-closing-fade {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;

        const styleSheet = document.createElement("style");
        styleSheet.id = "pretty-modal-styles";
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}