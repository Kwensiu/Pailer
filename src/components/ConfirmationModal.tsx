import { Show, onCleanup, onMount } from "solid-js";

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    children: any;
}

function ConfirmationModal(props: ConfirmationModalProps) {
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
            <div class="modal modal-open" role="dialog">
                <div 
                    class="modal-box bg-base-200 transition-all duration-300 ease-out"
                    classList={{
                        "scale-90 opacity-0 translate-y-4": !props.isOpen,
                        "scale-100 opacity-100 translate-y-0": props.isOpen,
                    }}
                >
                    <button 
                        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 hover:bg-base-300 transition-colors duration-200"
                        onClick={props.onCancel}
                    >
                        ✕
                    </button>
                    <h3 class="font-bold text-lg">{props.title}</h3>
                    <div class="py-4 space-y-2">
                        {props.children}
                    </div>
                    <div class="modal-action">
                        <button class="btn" onClick={props.onCancel}>
                            {props.cancelText || "Cancel"}
                        </button>
                        <button class="btn btn-primary" onClick={props.onConfirm}>
                            {props.confirmText || "Confirm"}
                        </button>
                    </div>
                </div>
                <div 
                    class="modal-backdrop transition-all duration-300 ease-out"
                    classList={{
                        "opacity-0": !props.isOpen,
                        "opacity-100": props.isOpen,
                    }}
                    style="background-color: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px);"
                    onClick={props.onCancel}
                ></div>
            </div>
        </Show>
    );
}

export default ConfirmationModal;