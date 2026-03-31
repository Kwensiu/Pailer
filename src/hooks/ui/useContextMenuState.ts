import { createMemo, createSignal } from 'solid-js';

export type ContextMenuPosition = { x: number; y: number };

interface UseContextMenuStateOptions<T> {
  getKey?: (target: T) => string;
}

export function useContextMenuState<T>(options?: UseContextMenuStateOptions<T>) {
  const [target, setTarget] = createSignal<T | null>(null);
  const [position, setPosition] = createSignal<ContextMenuPosition>({ x: 0, y: 0 });

  const isOpen = createMemo(() => target() !== null);

  const open = (nextTarget: T, x: number, y: number) => {
    setTarget(() => nextTarget);
    setPosition({ x, y });
  };

  const close = () => {
    setTarget(null);
  };

  const isActive = (key: string) => {
    const getKey = options?.getKey;
    if (!getKey) return false;
    const current = target();
    return current ? getKey(current) === key : false;
  };

  return {
    target,
    position,
    isOpen,
    open,
    close,
    isActive,
  };
}
