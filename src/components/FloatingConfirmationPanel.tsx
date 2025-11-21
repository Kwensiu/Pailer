import { Show, onCleanup, onMount } from "solid-js";

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
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            props.onCancel();
        }
    };

    onMount(() => {
        document.addEventListener('keyup', handleKeyUp);
    });

    onCleanup(() => {
        document.removeEventListener('keyup', handleKeyUp);
    });

    return (
        <Show when={props.isOpen}>
            <div class="fixed inset-0 flex items-center justify-center z-50 p-2">
                <div 
                    class="absolute inset-0 transition-all duration-300 ease-out"
                    classList={{
                        "opacity-0": !props.isOpen,
                        "opacity-100": props.isOpen,
                    }}
                    style="background-color: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px);"
                    onClick={props.onCancel}
                ></div>
                <div 
                    class="relative bg-base-200 rounded-xl shadow-2xl border border-base-300 w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300 ease-out"
                    classList={{
                        "scale-90 opacity-0 translate-y-4": !props.isOpen,
                        "scale-100 opacity-100 translate-y-0": props.isOpen,
                    }}
                >
                    <div class="flex justify-between items-center p-4 border-b border-base-300">
                        <h3 class="font-bold text-lg truncate">{props.title}</h3>
                        <button 
                            class="btn btn-sm btn-circle btn-ghost hover:bg-base-300 transition-colors duration-200"
                            onClick={props.onCancel}
                        >
                            ✕
                        </button>
                    </div>
                    <div class="py-4 px-4 space-y-2 overflow-y-auto flex-grow">
                        {props.children}
                    </div>
                    <div class="flex justify-end p-4 gap-2 border-t border-base-300">
                        <button class="btn" onClick={props.onCancel}>
                            {props.cancelText || "Cancel"}
                        </button>
                        <button class="btn btn-primary" onClick={props.onConfirm}>
                            {props.confirmText || "Confirm"}
                        </button>
                    </div>
                </div>
            </div>
        </Show>
    );
}

export default FloatingConfirmationPanel;