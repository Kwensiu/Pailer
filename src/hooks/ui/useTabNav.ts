export interface MenuTabNavOptions {
  getItems: () => HTMLElement[];
}

/**
 * Shared menu Tab navigation logic
 * Implements special "first Tab shows focus, subsequent Tab navigates" behavior
 */
export function createMenuTabNavigation(options: MenuTabNavOptions) {
  const { getItems } = options;

  return (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

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

    // First Tab only shows focus, doesn't navigate
    if (idx === 0 && !e.shiftKey) {
      const isFirst = !current.hasAttribute('data-tabbed');
      current.setAttribute('data-tabbed', 'true');
      if (isFirst) return;
    }

    // Calculate next item index
    const nextIdx = e.shiftKey
      ? idx <= 0
        ? items.length - 1
        : idx - 1
      : idx >= items.length - 1
        ? 0
        : idx + 1;

    items[nextIdx]?.focus();
  };
}

/**
 * Utility function to clear tabbed state
 */
export function clearTabbedState(container: Element | undefined, selector: string) {
  const tabbed = container?.querySelectorAll(selector);
  tabbed?.forEach((item) => item.removeAttribute('data-tabbed'));
}
