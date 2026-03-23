import { Show, createEffect, onCleanup, type Accessor, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { computePosition, flip, shift } from '@floating-ui/dom';
import { createMenuFocusManagement, clearTabbedState } from '../../hooks/index';

export type ContextMenuPosition = { x: number; y: number };

const ROOT_SELECTOR = '[data-context-menu-root="true"]';
const ALLOW_SELECTOR = '[data-context-menu-allow="true"]';
const TABBED_ITEM_SELECTOR = '[role="menuitem"][data-tabbed]';

const isWithinSelector = (target: EventTarget | null, selector: string) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(selector));
};

export interface ContextMenuProps {
  isOpen: Accessor<boolean>;
  position: Accessor<ContextMenuPosition>;
  onClose: () => void;
  ariaLabel?: string;
  children: JSX.Element | ((context: { onClose: () => void }) => JSX.Element);
}

export default function ContextMenu(props: ContextMenuProps) {
  const close = () => props.onClose();
  let contentRef: HTMLDivElement | undefined;

  const { handleTabNav } = createMenuFocusManagement(() => contentRef);

  const updatePosition = async () => {
    if (!contentRef) return;

    const position = props.position();
    const virtualReference = {
      getBoundingClientRect: () => ({
        x: position.x,
        y: position.y,
        left: position.x,
        top: position.y,
        right: position.x,
        bottom: position.y,
        width: 0,
        height: 0,
      }),
    };

    const { x, y } = await computePosition(virtualReference, contentRef, {
      placement: 'right-start',
      strategy: 'fixed',
      middleware: [flip({ padding: 8 }), shift({ padding: 8 })],
    });

    contentRef.style.left = `${x}px`;
    contentRef.style.top = `${y}px`;
  };

  createEffect(() => {
    if (props.isOpen()) {
      requestAnimationFrame(() => {
        updatePosition();
        const items = Array.from(
          contentRef?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? []
        ) as HTMLElement[];
        if (items.length > 0) {
          items[0].focus();
        }
      });
    } else {
      clearTabbedState(contentRef, TABBED_ITEM_SELECTOR);
    }
  });

  createEffect(() => {
    if (!props.isOpen()) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (isWithinSelector(e.target, ROOT_SELECTOR)) return;
      if (isWithinSelector(e.target, ALLOW_SELECTOR)) {
        close();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      close();
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isWithinSelector(e.target, ALLOW_SELECTOR)) {
        close();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    const handleScroll = () => close();
    const handleWindowBlur = () => close();
    const handleVisChange = () => {
      if (document.hidden) close();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisChange);
    document.body.classList.add('context-menu-open');

    onCleanup(() => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisChange);
      document.body.classList.remove('context-menu-open');
    });
  });

  return (
    <Show when={props.isOpen()}>
      <Portal>
        <div class="pointer-events-none fixed inset-0 z-9998">
          <div
            ref={contentRef}
            data-context-menu-root="true"
            class="bg-base-100 rounded-box border-base-200 pointer-events-auto fixed z-9999 min-w-[150px] border py-2 shadow-lg"
            role="menu"
            aria-label={props.ariaLabel || 'Context menu'}
            aria-orientation="vertical"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                handleTabNav(e);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
          >
            {typeof props.children === 'function'
              ? props.children({ onClose: close })
              : props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
  closeOnSelect?: boolean;
  onClose?: () => void;
}

export function MenuItem(props: MenuItemProps) {
  return (
    <button
      type="button"
      class={`hover:bg-base-200 flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2 text-left text-sm ${
        props.class || ''
      } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      onClick={() => {
        if (!props.disabled) {
          props.onSelect();
          if (props.closeOnSelect !== false) {
            props.onClose?.();
          }
        }
      }}
      disabled={props.disabled}
      role="menuitem"
      aria-disabled={props.disabled ? 'true' : 'false'}
    >
      {props.children}
    </button>
  );
}

export interface SubMenuProps {
  trigger: JSX.Element;
  children: JSX.Element;
}

export function SubMenu(props: SubMenuProps) {
  return (
    <div class="group relative">
      <div
        class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
        role="presentation"
      >
        {props.trigger}
        <span class="ml-auto text-xs">▶</span>
      </div>
      <div class="bg-base-100 border-base-200 absolute top-0 left-full hidden min-w-[150px] border py-2 shadow-lg group-hover:block">
        {props.children}
      </div>
    </div>
  );
}

export function Separator() {
  return <div class="border-base-200 my-1 border-t" />;
}
