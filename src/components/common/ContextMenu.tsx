import { Show, createEffect, onCleanup, type Accessor, type JSX } from 'solid-js';
import { createMenuTabNavigation, clearTabbedState } from '../../hooks/index';

export type ContextMenuPosition = { x: number; y: number };

const ROOT_SELECTOR = '[data-context-menu-root="true"]';
const ALLOW_SELECTOR = '[data-context-menu-allow="true"]';
const ITEM_SELECTOR = 'button[role="menuitem"]:not(:disabled)';
const TABBED_ITEM = 'button[role="menuitem"][data-tabbed]';

const isRootTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(ROOT_SELECTOR));
};

const isAllowedTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(ALLOW_SELECTOR));
};

export interface ContextMenuProps {
  isOpen: Accessor<boolean>;
  position: Accessor<ContextMenuPosition>;
  onClose: () => void;
  ariaLabel?: string;
  children: JSX.Element;
}

/**
 * WAI-ARIA Menu Pattern with custom focus management.
 * First Tab shows focus, subsequent Tabs navigate through items.
 * Uses data-tabbed attribute to track first Tab press state.
 */
export default function ContextMenu(props: ContextMenuProps) {
  const close = () => props.onClose();
  let menuRef: HTMLDivElement | undefined;

  const getItems = () => {
    return Array.from(menuRef?.querySelectorAll(ITEM_SELECTOR) ?? []) as HTMLButtonElement[];
  };

  const handleTabNav = createMenuTabNavigation({
    getItems,
  });

  const adjustPosition = (x: number, y: number) => {
    const menuWidth = 200;
    const menuHeight = 200;
    const padding = 8;

    const adjustedX = Math.min(x, window.innerWidth - menuWidth - padding);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - padding);
    return {
      x: Math.max(padding, adjustedX),
      y: Math.max(padding, adjustedY),
    };
  };

  const handleWindowBlur = () => close();
  const handleVisChange = () => {
    if (document.hidden) close();
  };

  createEffect(() => {
    if (props.isOpen()) {
      const handlePointerDown = (e: MouseEvent) => {
        if (isRootTarget(e.target)) return;
        if (isAllowedTarget(e.target)) {
          close();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        close();
      };

      const handleContextMenu = (e: MouseEvent) => {
        if (isAllowedTarget(e.target)) {
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

      window.addEventListener('blur', handleWindowBlur);
      document.addEventListener('visibilitychange', handleVisChange);
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('contextmenu', handleContextMenu, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('scroll', handleScroll, true);
      document.body.classList.add('context-menu-open');

      onCleanup(() => {
        window.removeEventListener('blur', handleWindowBlur);
        document.removeEventListener('visibilitychange', handleVisChange);
        document.removeEventListener('pointerdown', handlePointerDown, true);
        document.removeEventListener('contextmenu', handleContextMenu, true);
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('scroll', handleScroll, true);
        document.body.classList.remove('context-menu-open');
      });
    }
  });

  createEffect(() => {
    if (props.isOpen()) {
      const focusFirst = () => {
        const first = getItems()[0];
        if (first) {
          first.focus();
        }
      };

      focusFirst();
      setTimeout(focusFirst, 50);
    } else {
      clearTabbedState(menuRef, TABBED_ITEM);
    }
  });

  return (
    <Show when={props.isOpen()}>
      {(() => {
        const pos = adjustPosition(props.position().x, props.position().y);
        return (
          <div class="pointer-events-none fixed inset-0 z-9998">
            <div
              ref={menuRef}
              data-context-menu-root="true"
              class="bg-base-100 rounded-box border-base-200 pointer-events-auto fixed z-9999 min-w-[150px] border py-2 shadow-lg"
              style={`left: ${pos.x}px; top: ${pos.y}px;`}
              role="menu"
              aria-label={props.ariaLabel || 'Context menu'}
              aria-orientation="vertical"
              tabIndex={-1}
              onKeyDown={handleTabNav}
            >
              {props.children}
            </div>
          </div>
        );
      })()}
    </Show>
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
}

export function MenuItem(props: MenuItemProps) {
  const handleClick = () => {
    if (props.disabled) return;
    props.onSelect();
  };

  return (
    <button
      type="button"
      class={`hover:bg-base-200 flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-2 text-left text-sm ${
        props.class || ''
      } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      onClick={handleClick}
      disabled={props.disabled}
      role="menuitem"
      aria-disabled={props.disabled ? 'true' : 'false'}
      data-context-menuitem="true"
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
      <div class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm">
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
