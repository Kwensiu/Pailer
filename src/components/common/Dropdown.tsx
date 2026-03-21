import { JSX, Show, For, Component, createSignal, onCleanup, onMount } from 'solid-js';
import { Dynamic } from 'solid-js/web';

export interface DropdownItem {
  label: string | (() => string);
  onClick: () => void;
  disabled?: boolean | (() => boolean);
  icon?: Component<{ class?: string }>;
  class?: string;
  align?: 'start' | 'center' | 'end';
}

export interface DropdownProps {
  trigger: JSX.Element;
  items: DropdownItem[];
  position?: 'start' | 'end' | 'center';
  class?: string;
  contentClass?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Dropdown(props: DropdownProps) {
  const position = props.position || 'end';
  const [isOpen, setIsOpen] = createSignal(false);

  // Handle outside click to close dropdown
  const handleOutsideClick = (e: MouseEvent) => {
    const dropdown = e.target as HTMLElement;
    if (!dropdown.closest('.dropdown')) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleOutsideClick);
  });

  const getPositionClass = () => {
    switch (position) {
      case 'start':
        return 'dropdown-start';
      case 'center':
        return 'dropdown-center';
      case 'end':
      default:
        return 'dropdown-end';
    }
  };

  const getSizeClass = () => {
    switch (props.size) {
      case 'sm':
        return 'w-40';
      case 'md':
        return 'w-52';
      case 'lg':
        return 'w-64';
      default:
        return '';
    }
  };

  const getAlignClass = (align?: 'start' | 'center' | 'end') => {
    switch (align) {
      case 'start':
        return 'justify-start';
      case 'center':
        return 'justify-center';
      case 'end':
        return 'justify-end';
      default:
        return 'justify-start';
    }
  };

  const defaultContentClass = `p-2 border border-base-200 shadow ${getSizeClass()}`;

  const toggleDropdown = () => setIsOpen(!isOpen());
  const closeDropdown = () => setIsOpen(false);

  return (
    <div
      class={`dropdown custom-dropdown ${getPositionClass()} ${props.class || ''} ${isOpen() ? 'dropdown-open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        tabindex="0"
        role="button"
        class="cursor-pointer border-none bg-transparent p-0"
        onClick={(e) => {
          e.stopPropagation();
          toggleDropdown();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeDropdown();
          }
        }}
      >
        {props.trigger}
      </button>
      <ul
        tabindex="0"
        class={`dropdown-content menu bg-base-100 rounded-box ${props.contentClass || defaultContentClass}`}
        role="menu"
      >
        <For each={props.items}>
          {(item) => {
            const isDisabled =
              typeof item.disabled === 'function' ? item.disabled() : item.disabled;

            return (
              <li role="menuitem">
                <button
                  onClick={() => {
                    if (!isDisabled) {
                      item.onClick();
                      closeDropdown();
                    }
                  }}
                  disabled={isDisabled}
                  class={`btn btn-ghost btn-sm w-full rounded-xl ${item.class || ''} ${isDisabled ? 'btn-disabled' : ''} ${getAlignClass(item.align)}`}
                >
                  <div class="flex items-center gap-2">
                    <Show when={item.icon}>
                      <Dynamic component={item.icon} class="h-4 w-4" />
                    </Show>
                    <span>{typeof item.label === 'function' ? item.label() : item.label}</span>
                  </div>
                </button>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}
