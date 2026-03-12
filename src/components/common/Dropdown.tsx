import { JSX, Show, For, Component } from 'solid-js';
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
}

export function Dropdown(props: DropdownProps) {
  const position = props.position || 'end';

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

  return (
    <div
      class={`dropdown custom-dropdown ${getPositionClass()} ${props.class || ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <label tabindex="0">{props.trigger}</label>
      <ul
        tabindex="0"
        class={`dropdown-content menu bg-base-100 rounded-box ${props.contentClass || ''}`}
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
