import { For } from 'solid-js';
import type { ContextMenuItem } from './types';
import { MenuItem, SubMenu, useSubMenuManager } from './main';

interface ContextMenuRendererProps {
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenuRenderer(props: ContextMenuRendererProps) {
  const subMenuManager = useSubMenuManager();

  const renderItem = (item: ContextMenuItem, isTopLevel: boolean = true) => {
    const shouldShow = item.showWhen ? item.showWhen() : true;
    if (!shouldShow) return null;

    const label = typeof item.label === 'function' ? item.label() : item.label;
    const disabled = typeof item.disabled === 'function' ? item.disabled() : item.disabled;
    const children =
      item.children
        ?.map((child) => renderItem(child, false))
        .filter((child): child is NonNullable<ReturnType<typeof renderItem>> => child != null) ??
      [];
    const hasChildren = children.length > 0;

    if (hasChildren) {
      return (
        <SubMenu
          trigger={
            <div class="flex items-center gap-2">
              {item.icon && item.icon({ class: 'h-4 w-4' })}
              <span>{label}</span>
            </div>
          }
        >
          <For each={children}>{(child) => child}</For>
        </SubMenu>
      );
    }

    return (
      <MenuItem
        onSelect={item.onClick}
        onClose={props.onClose}
        closeOnSelect={item.closeOnSelect}
        disabled={disabled}
        class={item.class}
        onMouseEnter={isTopLevel ? () => subMenuManager?.requestClose() : undefined}
      >
        <div class="flex items-center gap-2">
          {item.icon && item.icon({ class: 'h-4 w-4' })}
          <span>{label}</span>
        </div>
      </MenuItem>
    );
  };

  return <For each={props.items}>{(item) => renderItem(item, true)}</For>;
}
