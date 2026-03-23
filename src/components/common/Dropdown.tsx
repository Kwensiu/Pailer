import {
  Show,
  For,
  createSignal,
  createEffect,
  onCleanup,
  type Accessor,
  type Component,
  type JSX,
} from 'solid-js';
import { DropdownMenu } from '@kobalte/core/dropdown-menu';
import { Dynamic } from 'solid-js/web';
import { createMenuTabNavigation, clearTabbedState } from '../../hooks/index';

export interface IconProps {
  class?: string;
}

export interface DropdownItem {
  label: Accessor<string> | string;
  onClick: () => void;
  icon?: Component<IconProps>;
  align?: 'start' | 'center' | 'end';
  class?: string;
  disabled?: Accessor<boolean> | boolean;
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
}

/**
 * WAI-ARIA Menu Button with custom focus management.
 * First Tab shows focus, subsequent Tabs navigate through items.
 * Uses data-tabbed attribute to track first Tab behavior.
 */
const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';
const DROPDOWN_ITEM = '[data-dropdown-item="true"]';
const TABBED_ITEM = `${DROPDOWN_ITEM}[data-tabbed]`;

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

export default function Dropdown(props: DropdownProps) {
  const [open, setOpen] = createSignal(false);
  let contentRef: HTMLDivElement | undefined;

  const getItems = () => {
    return Array.from(contentRef?.querySelectorAll(ITEM_SELECTOR) ?? []) as HTMLElement[];
  };

  const focusFirst = () => {
    const first = getItems()[0];
    if (!first) return false;
    first.focus();
    return true;
  };

  const handleTabNav = createMenuTabNavigation({
    getItems,
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      props.onOpen?.();
    } else {
      props.onClose?.();
    }
  };

  const handleScroll = () => {
    if (open()) {
      setOpen(false);
      props.onClose?.();
    }
  };

  createEffect(() => {
    if (open()) {
      document.addEventListener('scroll', handleScroll, true);
    } else {
      document.removeEventListener('scroll', handleScroll, true);
      clearTabbedState(contentRef, TABBED_ITEM);
    }

    onCleanup(() => {
      document.removeEventListener('scroll', handleScroll, true);
    });
  });

  return (
    <div
      class={`custom-dropdown-container relative inline-block ${props.class || ''}`}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <DropdownMenu
        open={open()}
        onOpenChange={handleOpenChange}
        placement={getPlacement(props.position)}
        modal={false}
      >
        <DropdownMenu.Trigger
          class={`dropdown-trigger ${props.triggerClass || ''}`}
          disabled={props.triggerDisabled}
          style={props.triggerStyle}
          tabIndex={props.triggerDisabled ? -1 : 0}
        >
          {props.trigger}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            ref={contentRef}
            data-dropdown-menu-content="true"
            data-context-menu-allow="true"
            class={`dropdown-menu-content ${props.contentClass || ''}`}
            onKeyDown={handleTabNav}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              requestAnimationFrame(() => {
                if (!focusFirst()) {
                  setTimeout(() => focusFirst(), 30);
                }
              });
            }}
          >
            <For each={props.items}>
              {(item) => {
                const isDisabled =
                  typeof item.disabled === 'function' ? item.disabled() : item.disabled;

                return (
                  <DropdownMenu.Item
                    data-dropdown-item="true"
                    class="dropdown-menu-item"
                    disabled={isDisabled}
                    closeOnSelect={item.closeOnSelect !== false}
                    onSelect={() => {
                      if (!isDisabled) {
                        item.onClick();
                      }
                    }}
                  >
                    <div
                      class={`dropdown-menu-item-content ${item.class || ''} ${getAlignClass(item.align)}`}
                    >
                      <Show when={item.icon}>
                        <Dynamic component={item.icon} class="h-4 w-4" />
                      </Show>
                      <span>{typeof item.label === 'function' ? item.label() : item.label}</span>
                    </div>
                  </DropdownMenu.Item>
                );
              }}
            </For>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  );
}
