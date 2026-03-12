import { createSignal, onMount, onCleanup, For, createEffect, JSX } from 'solid-js';
import { CircleCheckBig, TriangleAlert, CircleAlert, Info } from 'lucide-solid';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  persistent?: boolean;
  icon?: JSX.Element;
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

function ToastItem(props: ToastProps) {
  const [isVisible, setIsVisible] = createSignal(false);

  onMount(() => {
    // Entrance animation
    const showTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto close
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;
    if (props.message.duration !== 0 && !props.message.persistent) {
      const duration = props.message.duration || 3000;
      autoCloseTimer = setTimeout(() => handleClose(), duration);
    }

    // Clean up timers
    onCleanup(() => {
      clearTimeout(showTimer);
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
    });
  });

  createEffect(() => {
    if (!isVisible()) {
      const timer = setTimeout(() => props.onClose(props.message.id), 300);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const handleClose = () => {
    setIsVisible(false);
  };

  const getIcon = () => {
    if (props.message.icon) {
      return props.message.icon;
    }
    switch (props.message.type) {
      case 'success':
        return <CircleCheckBig class="h-5 w-5 shrink-0" />;
      case 'error':
        return <CircleAlert class="h-5 w-5 shrink-0" />;
      case 'warning':
        return <TriangleAlert class="h-5 w-5 shrink-0" />;
      case 'info':
        return <Info class="h-5 w-5 shrink-0" />;
    }
  };

  return (
    <div
      class={`status-alert status-alert-${props.message.type} transform shadow-lg transition-all duration-300 ${
        isVisible() ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
    >
      {getIcon()}
      <span>{props.message.message}</span>
      <button class="btn btn-ghost btn-xs btn-circle ml-auto" onClick={handleClose}>
        ×
      </button>
    </div>
  );
}

// Generate unique ID counter
let toastIdCounter = 0;

// Global Toast management
const [toasts, setToasts] = createSignal<ToastMessage[]>([]);

export const toast = {
  success: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => {
    const id = `toast-${Date.now()}-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { id, type: 'success', message, ...options }]);
    return id;
  },
  error: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => {
    const id = `toast-${Date.now()}-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { id, type: 'error', message, persistent: true, ...options }]);
    return id;
  },
  warning: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => {
    const id = `toast-${Date.now()}-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { id, type: 'warning', message, ...options }]);
    return id;
  },
  info: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => {
    const id = `toast-${Date.now()}-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { id, type: 'info', message, ...options }]);
    return id;
  },
  dismiss: (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  },
  clear: () => {
    setToasts([]);
  },
};

export default function ToastContainer() {
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <div class="pointer-events-none fixed bottom-4 left-1/2 z-999 flex -translate-x-1/2 flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div class="pointer-events-auto font-medium">
            <ToastItem message={toast} onClose={removeToast} />
          </div>
        )}
      </For>
    </div>
  );
}
