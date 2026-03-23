import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type Accessor,
  type Component,
  type JSX,
} from 'solid-js';
import { Portal, Dynamic } from 'solid-js/web';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { createMenuTabNavigation, clearTabbedState } from '../../hooks/index';

export interface DropdownItem {
  label: Accessor<string> | string;
  onClick: () => void;
  disabled?: Accessor<boolean> | boolean;
  icon?: Component<{ class?: string }>;
  class?: string;
  align?: 'start' | 'center' | 'end';
  closeOnSelect?: boolean;
}

export interface DropdownProps {
  items: DropdownItem[];
  position?: 'start' | 'end' | 'center';
  trigger: JSX.Element;
  class?: string;
  triggerClass?: string;
  triggerStyle?: JSX.CSSProperties | string;
  triggerDisabled?: boolean;
  contentClass?: string;
  onOpen?: () => void;
  onClose?: () => void;
  selectMode?: boolean;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';
const TABBED_ITEM_SELECTOR = '[data-dropdown-item="true"][data-tabbed]';

const getPlacement = (position?: 'start' | 'end' | 'center') => {
  switch (position) {
    case 'start':
      return 'bottom-start';
    case 'center':
      return 'bottom';
    case 'end':
    default:
      return 'bottom-end';
  }
};

const getAlignClass = (align?: 'start' | 'center' | 'end') => {
  switch (align) {
    case 'center':
      return 'justify-center';
    case 'end':
      return 'justify-end';
    case 'start':
    default:
      return 'justify-start';
  }
};

export default function Dropdown(props: DropdownProps) {
  const [open, setOpen] = createSignal(false);
  const [floatingStyle, setFloatingStyle] = createSignal<Record<string, string>>({
    position: 'fixed',
    left: '0px',
    top: '0px',
    visibility: 'hidden',
  });
  let triggerRef: HTMLButtonElement | undefined;
  let contentRef: HTMLDivElement | undefined;

  const close = () => {
    if (!open()) return;
    setOpen(false);
    props.onClose?.();
  };

  const openMenu = () => {
    if (props.triggerDisabled || open()) return;
    setOpen(true);
    props.onOpen?.();
  };

  const toggleMenu = () => {
    if (open()) {
      close();
      return;
    }
    openMenu();
  };

  const getItems = () => {
    return Array.from(contentRef?.querySelectorAll(ITEM_SELECTOR) ?? []) as HTMLButtonElement[];
  };

  const handleTabNav = createMenuTabNavigation({
    getItems,
  });

  const updatePosition = async () => {
    if (!triggerRef || !contentRef) return;

    const placement = getPlacement(props.position);
    const { x, y } = await computePosition(triggerRef, contentRef, {
      placement,
      strategy: 'fixed',
      middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    });

    setFloatingStyle({
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      visibility: 'visible',
    });
  };

  createEffect(() => {
    if (!open()) {
      clearTabbedState(contentRef, TABBED_ITEM_SELECTOR);
      setFloatingStyle((prev) => ({ ...prev, visibility: 'hidden' }));
      document.body.classList.remove('context-menu-open');
      return;
    }

    let cleanupAutoUpdate: (() => void) | undefined;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (contentRef?.contains(target) || triggerRef?.contains(target)) return;
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef?.focus();
      }
    };

    const handleScroll = () => close();
    const handleWindowBlur = () => close();
    const handleVisChange = () => {
      if (document.hidden) close();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisChange);
    document.body.classList.add('context-menu-open');

    requestAnimationFrame(() => {
      if (triggerRef && contentRef) {
        // Match menu width to trigger width on open (only for select mode)
        if (props.selectMode) {
          const width = triggerRef.getBoundingClientRect().width;
          contentRef.style.minWidth = `${width}px`;
          contentRef.style.width = 'max-content';
        }
        cleanupAutoUpdate = autoUpdate(triggerRef, contentRef, updatePosition);
      }
      const items = getItems();
      if (items.length > 0) {
        items[0].focus();
      }
    });

    onCleanup(() => {
      cleanupAutoUpdate?.();
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisChange);
      document.body.classList.remove('context-menu-open');
    });
  });

  return (
    <div class={`custom-dropdown-container relative inline-block ${props.class || ''}`}>
      <button
        ref={triggerRef}
        type="button"
        class={`dropdown-trigger ${props.triggerClass || ''}`}
        style={props.triggerStyle}
        disabled={props.triggerDisabled}
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={(e) => {
          e.stopPropagation();
          toggleMenu();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleMenu();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            openMenu();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          } else if (e.key === 'Tab' && open()) {
            e.preventDefault();
            const items = getItems();
            if (items.length > 0) {
              items[0].setAttribute('data-tabbed', 'true');
              items[0].focus();
            }
          }
        }}
      >
        {props.trigger}
      </button>
      <Show when={open()}>
        <Portal>
          <div
            ref={contentRef}
            data-dropdown-menu-content="true"
            data-context-menu-allow="true"
            class={`dropdown-menu-content flex flex-col ${props.contentClass || ''}`}
            style={floatingStyle()}
            role="menu"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                handleTabNav(e);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
                triggerRef?.focus();
              }
            }}
          >
            <For each={props.items}>
              {(item) => {
                const isDisabled =
                  typeof item.disabled === 'function' ? item.disabled() : item.disabled;

                return (
                  <button
                    type="button"
                    data-dropdown-item="true"
                    class={`dropdown-menu-item ${item.class || ''}`}
                    disabled={isDisabled}
                    role="menuitem"
                    aria-disabled={isDisabled ? 'true' : 'false'}
                    onClick={() => {
                      if (isDisabled) return;
                      item.onClick();
                      if (item.closeOnSelect !== false) {
                        close();
                      }
                    }}
                  >
                    <div class={`dropdown-menu-item-content ${getAlignClass(item.align)}`}>
                      <Show when={item.icon}>
                        <Dynamic component={item.icon} class="h-4 w-4" />
                      </Show>
                      <span>{typeof item.label === 'function' ? item.label() : item.label}</span>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </Portal>
      </Show>
    </div>
  );
}
