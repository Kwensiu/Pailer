import { Show, createEffect, createSignal, onCleanup, Accessor, JSX } from 'solid-js';

export type ContextMenuPosition = { x: number; y: number };

export interface ContextMenuProps {
  isOpen: Accessor<boolean>;
  position: Accessor<ContextMenuPosition>;
  onClose: () => void;
  ariaLabel?: string;
  children: JSX.Element;
}

export default function ContextMenu(props: ContextMenuProps) {
  const [focusedIndex, setFocusedIndex] = createSignal(0);
  let menuEl: HTMLDivElement | undefined;

  const getFocusableItems = () => {
    const items = menuEl?.querySelectorAll('[data-context-menuitem="true"]');
    if (!items) return [];
    return Array.from(items).filter(
      (el) => el.getAttribute('aria-disabled') !== 'true'
    ) as HTMLElement[];
  };

  const focusFirst = () => {
    requestAnimationFrame(() => {
      const items = getFocusableItems();
      if (items.length === 0) return;
      setFocusedIndex(0);
      items[0].focus();
    });
  };

  const close = () => props.onClose();

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = getFocusableItems();
    if (items.length === 0) return;

    const active = document.activeElement as Element | null;
    const activeIndex = active ? items.findIndex((el) => el === active) : -1;
    const currentIndex =
      activeIndex >= 0 ? activeIndex : Math.min(focusedIndex(), items.length - 1);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = (currentIndex + 1) % items.length;
        setFocusedIndex(next);
        items[next].focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
        setFocusedIndex(prev);
        items[prev].focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        items[0].focus();
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        items[items.length - 1].focus();
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        items[currentIndex].click();
        break;
      }
    }
  };

  createEffect(() => {
    if (props.isOpen()) focusFirst();
  });

  createEffect(() => {
    if (!props.isOpen()) return;

    const handleWindowBlur = () => close();
    const handleVisibilityChange = () => {
      if (document.hidden) close();
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    onCleanup(() => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  });

  return (
    <Show when={props.isOpen()}>
      <>
        <div
          class="fixed inset-0 z-9998 bg-transparent"
          onClick={close}
          onContextMenu={(e) => {
            e.preventDefault();
            close();
          }}
          onKeyDown={handleKeyDown}
        />
        <div
          ref={menuEl}
          class="bg-base-100 rounded-box border-base-200 fixed z-9999 min-w-[150px] border py-2 shadow-lg"
          style={`left: ${props.position().x}px; top: ${props.position().y}px;`}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label={props.ariaLabel || 'Context menu'}
          aria-orientation="vertical"
          onKeyDown={handleKeyDown}
        >
          {props.children}
        </div>
      </>
    </Show>
  );
}

export interface ContextMenuItemProps {
  onSelect: () => void;
  disabled?: boolean;
  class?: string;
  ariaLabel?: string;
  children: JSX.Element;
}

export function handleContextMenuKeydown(
  e: KeyboardEvent,
  callback: (x: number, y: number) => void
) {
  if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    callback(x, y);
  }
}

export function ContextMenuItem(props: ContextMenuItemProps) {
  const handleClick = () => {
    if (props.disabled) return;
    props.onSelect();
  };

  return (
    <div
      class={`hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm ${
        props.class || ''
      } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      onClick={handleClick}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={props.disabled ? 'true' : 'false'}
      aria-label={props.ariaLabel}
      data-context-menuitem="true"
    >
      {props.children}
    </div>
  );
}
