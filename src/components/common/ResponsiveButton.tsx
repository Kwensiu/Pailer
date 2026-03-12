import { createSignal, onMount, onCleanup, JSX, Show } from 'solid-js';
import { ChevronDown } from 'lucide-solid';
import { Dropdown } from './Dropdown';

interface ResponsiveButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  children: JSX.Element | JSX.Element[];
  menuItems?: Array<{
    label: string | (() => string);
    onClick: () => void;
    disabled?: boolean | (() => boolean);
    class?: string;
    icon?: any;
  }>;
  collapsedButtonWidth?: string;
  breakpoint?: number;
}

export function ResponsiveButton(props: ResponsiveButtonProps) {
  const [isSmallScreen, setIsSmallScreen] = createSignal(false);
  const { children, menuItems, class: buttonClass, collapsedButtonWidth, breakpoint = 768 } = props;

  const checkScreenSize = () => {
    setIsSmallScreen(window.innerWidth < breakpoint);
  };

  onMount(() => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', checkScreenSize);
  });

  const isDisabled = () => {
    if (isSmallScreen() && menuItems) {
      return menuItems.every((item) => {
        const disabled = typeof item.disabled === 'function' ? item.disabled() : item.disabled;
        return disabled;
      });
    }
    return props.disabled;
  };

  return (
    <div class="responsive-button-container">
      <Show
        when={isSmallScreen() && menuItems}
        fallback={
          <div class="flex items-center gap-2">
            {Array.isArray(children) ? children : [children]}
          </div>
        }
      >
        <Dropdown
          position="center"
          trigger={
            <label
              tabindex="0"
              class={`btn btn-sm ${buttonClass || ''} ${isDisabled() ? 'btn-disabled cursor-not-allowed' : ''}`}
              style={collapsedButtonWidth ? { width: collapsedButtonWidth } : {}}
            >
              <ChevronDown class="h-4 w-4" />
            </label>
          }
          items={menuItems || []}
        />
      </Show>
    </div>
  );
}
