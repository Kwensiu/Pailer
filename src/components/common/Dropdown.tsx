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

type DropdownTriggerProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  Partial<Record<`data-${string}`, string | number | boolean | undefined>>;

export interface DropdownProps {
  items?: DropdownItem[];
  children?: JSX.Element;
  position?: 'start' | 'end' | 'center';
  trigger: JSX.Element;
  class?: string;
  triggerClass?: string;
  triggerStyle?: JSX.CSSProperties | string;
  triggerProps?: DropdownTriggerProps;
  triggerAriaLabel?: string;
  triggerDisabled?: boolean;
  contentClass?: string;
  onOpen?: () => void;
  onClose?: () => void;
  selectMode?: boolean;
  variant?: 'menu' | 'panel';
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';
const TABBED_ITEM_SELECTOR = '[data-dropdown-item="true"][data-tabbed]';
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  const isPanelVariant = () => props.variant === 'panel';
  const hasMenuItems = () => (props.items?.length ?? 0) > 0 && !isPanelVariant();

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

  const getFocusableElements = () => {
    return Array.from(contentRef?.querySelectorAll(FOCUSABLE_SELECTOR) ?? []) as HTMLElement[];
  };

  const focusInitialContent = () => {
    if (hasMenuItems()) {
      const items = getItems();
      if (items.length > 0) {
        items[0].focus();
        return;
      }
    }

    const firstFocusable = getFocusableElements()[0];
    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }

    contentRef?.focus();
  };

  const focusMenuItem = (index: number) => {
    const items = getItems();
    if (items.length === 0) return;

    const nextIndex = ((index % items.length) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const handleMenuArrowNav = (e: KeyboardEvent) => {
    if (!hasMenuItems()) return;

    const items = getItems();
    if (items.length === 0) return;

    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      focusMenuItem(resolvedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      focusMenuItem(resolvedIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      focusMenuItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      focusMenuItem(items.length - 1);
    }
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
        if (props.selectMode && hasMenuItems()) {
          const width = triggerRef.getBoundingClientRect().width;
          contentRef.style.minWidth = `${width}px`;
          contentRef.style.width = 'max-content';
        }
        cleanupAutoUpdate = autoUpdate(triggerRef, contentRef, updatePosition);
      }
      focusInitialContent();
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
        {...props.triggerProps}
        ref={triggerRef}
        type="button"
        class={`dropdown-trigger ${props.triggerClass || ''}`}
        style={props.triggerStyle}
        disabled={props.triggerDisabled}
        aria-label={props.triggerAriaLabel}
        aria-haspopup={hasMenuItems() ? 'menu' : undefined}
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
          } else if (e.key === 'Tab' && open() && hasMenuItems()) {
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
          {/* Menu-style dropdown keeps list navigation behavior, panel-style dropdown allows custom nested content. */}
          <div
            ref={contentRef}
            data-dropdown-menu-content="true"
            data-context-menu-allow="true"
            class={`${
              isPanelVariant() ? 'dropdown-panel-content' : 'dropdown-menu-content'
            } flex flex-col ${props.contentClass || ''}`}
            style={floatingStyle()}
            role={isPanelVariant() ? undefined : 'menu'}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
                triggerRef?.focus();
                return;
              }

              if (!hasMenuItems()) {
                return;
              }

              if (e.key === 'Tab') {
                handleTabNav(e);
              } else {
                handleMenuArrowNav(e);
              }
            }}
          >
            <Show when={hasMenuItems()} fallback={props.children}>
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
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  );
}
