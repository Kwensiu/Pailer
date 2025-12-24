import { Show, createSignal, createEffect, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { X } from "lucide-solid";
import { t } from "../i18n";

interface FloatingConfirmationPanelProps {
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    children: any;
}

function FloatingConfirmationPanel(props: FloatingConfirmationPanelProps) {
    const [isVisible, setIsVisible] = createSignal(false);
    const [isClosing, setIsClosing] = createSignal(false);
    const [rendered, setRendered] = createSignal(false);

    // Create animation
    createEffect(() => {
        if (props.isOpen) {
            setRendered(true);
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    });

    createEffect(() => {
        if (isClosing()) {
            const timer = setTimeout(() => {
                setRendered(false);
                setIsClosing(false);
                // Call onCancel when closing is finished to ensure parent state is reset
                props.onCancel();
            }, 300);
            return () => clearTimeout(timer);
        }
    });

    const handleClose = () => {
        setIsClosing(true);
        setIsVisible(false);
    };

    const handleBackdropClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleClose();
        }
    };

    onMount(() => {
        document.addEventListener('keyup', handleKeyUp);
    });

    onCleanup(() => {
        document.removeEventListener('keyup', handleKeyUp);
    });

    return (
        <Portal>
            <Show when={rendered()}>
                <div class="fixed inset-0 flex items-center justify-center z-52 p-2">
                    <div
                        class="absolute inset-0 transition-all duration-300 ease-in-out"
                        classList={{
                            "opacity-0": !isVisible() || isClosing(),
                            "opacity-100": isVisible() && !isClosing(),
                        }}
                        style="background-color: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px);"
                        onClick={handleBackdropClick}
                    ></div>
                    <div
                        class="relative bg-base-200 rounded-xl shadow-2xl border border-base-300 w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300 ease-in-out"
                        classList={{
                            "scale-95 opacity-0": !isVisible() || isClosing(),
                            "scale-100 opacity-100": isVisible() && !isClosing(),
                        }}
                    >
                        <div class="flex justify-between items-center p-4 border-b border-base-300">
                            <h3 class="font-bold text-lg truncate">{props.title}</h3>
                            <button
                                class="btn btn-sm btn-circle btn-ghost hover:bg-base-300 transition-colors duration-200"
                                onClick={handleClose}
                            >
                                <X class="w-4 h-4" />
                            </button>
                        </div>
                        <div class="py-4 px-4 space-y-2 overflow-y-auto grow">
                            {props.children}
                        </div>
                        <div class="flex justify-end p-4 gap-2 border-t border-base-300">
                            <button class="btn" onClick={handleClose}>
                                {props.cancelText || t('buttons.cancel')}
                            </button>
                            <button class="btn btn-primary" onClick={() => {
                                setIsClosing(true);
                                setIsVisible(false);
                                const timer = setTimeout(() => {
                                    setRendered(false);
                                    setIsClosing(false);
                                    props.onConfirm();
                                }, 300);
                                return () => clearTimeout(timer);
                            }}>
                                {props.confirmText || t('buttons.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </Portal >
    );
}

export default FloatingConfirmationPanel;