import { createSignal, onMount, onCleanup, For, createEffect } from 'solid-js';
import { CircleCheckBig, AlertTriangle, AlertCircle, Info } from 'lucide-solid';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number; // 自动关闭时间(ms)，0表示不自动关闭
  persistent?: boolean; // 是否持久化（不自动关闭）
  icon?: any; // 自定义图标组件
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

function ToastItem(props: ToastProps) {
  const [isVisible, setIsVisible] = createSignal(false);

  onMount(() => {
    // 入场动画
    const showTimer = setTimeout(() => setIsVisible(true), 10);

    // 自动关闭
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;
    if (props.message.duration !== 0 && !props.message.persistent) {
      const duration = props.message.duration || 3000;
      autoCloseTimer = setTimeout(() => handleClose(), duration);
    }

    // 清理定时器
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
        return <AlertCircle class="h-5 w-5 shrink-0" />;
      case 'warning':
        return <AlertTriangle class="h-5 w-5 shrink-0" />;
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

// 生成唯一 ID 的计数器
let toastIdCounter = 0;

// 全局Toast管理
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
