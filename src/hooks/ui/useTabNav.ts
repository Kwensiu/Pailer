export interface MenuTabNavOptions {
  getItems: () => HTMLElement[];
  focusFirst?: () => boolean;
}

/**
 * Shared menu Tab navigation logic
 * Implements special "first Tab shows focus, subsequent Tab navigates" behavior
 */
export function createMenuTabNavigation(options: MenuTabNavOptions) {
  const { getItems } = options;

  const handleKeyNav = (e: KeyboardEvent) => {
    const keys = ['Tab', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;

    e.preventDefault();
    e.stopPropagation();

    const items = getItems();
    if (items.length === 0) return;

    const target = e.target as HTMLElement | null;

    // If target is not a menu item, focus the first item
    if (target?.getAttribute('role') !== 'menuitem') {
      const first = items[0];
      first.setAttribute('data-tabbed', 'true');
      first.focus();
      return;
    }

    const current = target;
    const idx = items.findIndex((item) => item === current);

    // If current item not found, focus the first item
    if (idx === -1) {
      const first = items[0];
      first.setAttribute('data-tabbed', 'true');
      first.focus();
      return;
    }

    // Handle Tab key: first Tab only shows focus, doesn't navigate
    if (e.key === 'Tab' && idx === 0 && !e.shiftKey) {
      const isFirst = !current.hasAttribute('data-tabbed');
      current.setAttribute('data-tabbed', 'true');
      if (isFirst) return;
    }

    // Calculate next item index
    let nextIdx: number;
    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      nextIdx = idx <= 0 ? items.length - 1 : idx - 1;
    } else if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      nextIdx = idx >= items.length - 1 ? 0 : idx + 1;
    } else {
      return;
    }

    items[nextIdx]?.focus();
  };

  return handleKeyNav;
}

/**
 * Creates focus management utilities for menu components
 * @param contentRef - Reference to the menu content element
 * @param itemSelector - CSS selector for menu items
 * @returns Object with getItems, focusFirst, and handleTabNav functions
 */
export function createMenuFocusManagement(
  contentRef: () => HTMLDivElement | undefined,
  itemSelector: string = '[role="menuitem"]:not([disabled])'
) {
  const getItems = () => {
    return Array.from(contentRef()?.querySelectorAll(itemSelector) ?? []) as HTMLElement[];
  };

  const focusFirst = () => {
    const first = getItems()[0];
    if (!first) return false;
    first.focus();
    return true;
  };

  const handleKeyNav = createMenuTabNavigation({
    getItems,
  });

  return {
    getItems,
    focusFirst,
    handleKeyNav,
  };
}

/**
 * Utility function to clear tabbed state
 */
export function clearTabbedState(container: Element | undefined, selector: string) {
  const tabbed = container?.querySelectorAll(selector);
  tabbed?.forEach((item) => item.removeAttribute('data-tabbed'));
}
