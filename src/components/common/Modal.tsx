import { Show, JSX, onMount, onCleanup, createEffect, createSignal } from "solid-js";
import { Portal } from "solid-js/web";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | JSX.Element;
    size?: "small" | "medium" | "large" | "full";
    showCloseButton?: boolean;
    children: JSX.Element;
    footer?: JSX.Element;
    headerAction?: JSX.Element;
    class?: string;
    preventBackdropClose?: boolean;
    zIndex?: string;

    editButton?: boolean; // Add: Edit botton
    initialContent?: string; // Test
    animation?: 'none' | 'scale';
    animationDuration?: number;
}

export default function Modal(props: ModalProps) {
    const getSizeClass = () => {
        switch (props.size) {
            case "small": return "max-w-md";
            case "medium": return "max-w-2xl";
            case "large": return "max-w-5xl";
            case "full": return "w-11/12 max-w-7xl";
            default: return "max-w-2xl";
        }
    };

    // Animation state management
    const [isVisible, setIsVisible] = createSignal(false);
    const [isClosing, setIsClosing] = createSignal(false);
    const [rendered, setRendered] = createSignal(false);

    // Animation effects
    createEffect(() => {
        if (props.isOpen) {
            setRendered(true);
            setIsVisible(false);
            setIsClosing(false);
            // Use requestAnimationFrame to ensure DOM is updated before starting animation
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else if (rendered()) {
            // Trigger close animation when isOpen becomes false externally
            setIsClosing(true);
        }
    });

    createEffect(() => {
        if (isClosing()) {
            const timer = setTimeout(() => {
                setRendered(false);
                setIsClosing(false);
            }, props.animationDuration || 300);
            return () => clearTimeout(timer);
        }
    });

    const handleClose = () => {
        if (isClosing()) return;
        setIsClosing(true);
        setIsVisible(false);
        // Delay actual close to allow animation
        setTimeout(() => {
            props.onClose();
        }, props.animationDuration || 300);
    };

    // Handle ESC key to close modal
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && props.isOpen) {
            handleClose();
        }
    };

    onMount(() => {
        document.addEventListener("keydown", handleKeyDown);
    });

    onCleanup(() => {
        document.removeEventListener("keydown", handleKeyDown);
    });

    // Prevent body scroll when modal is open
    createEffect(() => {
        if (rendered()) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    });

    // Handle data-modal-close clicks
    const [modalBoxRef, setModalBoxRef] = createSignal<HTMLDivElement>();
    createEffect(() => {
        const box = modalBoxRef();
        if (box) {
            const handleClick = (e: Event) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-modal-close]')) {
                    e.preventDefault();
                    handleClose();
                }
            };
            box.addEventListener('click', handleClick);
            onCleanup(() => box.removeEventListener('click', handleClick));
        }
    });

    const handleBackdropClick = () => {
        if (!props.preventBackdropClose) {
            handleClose();
        }
    };

    // Get animation classes
    const getAnimationClasses = () => {
        if (props.animation === 'scale') {
            return {
                modalBox: `transition-all duration-300 ease-in-out ${
                    !isVisible() || isClosing()
                        ? "scale-95 opacity-0"
                        : "scale-100 opacity-100"
                }`,
                backdrop: `transition-all duration-300 ease-in-out !bg-black/30 ${
                    !isVisible() || isClosing()
                        ? "!opacity-0"
                        : "!opacity-100"
                }`
            };
        }
        return { modalBox: "", backdrop: "" };
    };

    return (
        <Portal>
            <Show when={rendered()}>
                <div class={`modal modal-open ${props.zIndex || 'z-50'}`} role="dialog">
                    <div class={`modal-box bg-base-300 shadow-2xl border border-base-300 p-0 overflow-hidden flex flex-col max-h-[90vh] ${getSizeClass()} ${props.class ?? ""} ${getAnimationClasses().modalBox}`} ref={setModalBoxRef}>
                        {/* Header */}
                        <div class="flex justify-between items-center p-4 border-b border-base-200 bg-base-400">
                            <h3 class="font-bold text-lg">{props.title}</h3>
                            <div class="flex items-center gap-2">
                                <Show when={props.headerAction}>
                                    {props.headerAction}
                                </Show>
                                <Show when={props.showCloseButton !== false}>
                                    <button
                                        class="btn btn-sm btn-circle btn-ghost"
                                        onClick={handleClose}
                                        aria-label="Close"
                                    >
                                        ✕
                                    </button>
                                </Show>
                            </div>
                        </div>

                        {/* Content */}
                        <div class="p-6 overflow-y-auto flex-1">
                            {props.children}
                        </div>

                        {/* Footer */}
                        <Show when={props.footer}>
                            <div class="modal-action p-4 border-t border-base-300 bg-base-300 shrink-0 mt-0">
                                {props.footer}
                            </div>
                        </Show>
                    </div>
                    <div class={`modal-backdrop backdrop-blur-[3px] ${getAnimationClasses().backdrop}`} onClick={handleBackdropClick}></div>
                </div>
            </Show>
        </Portal>
    );
}
