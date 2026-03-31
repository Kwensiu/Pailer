import type { JSX } from 'solid-js';

export interface ContextMenuItem {
  key?: string;
  label: string | (() => string);
  icon?: (props: { class?: string }) => JSX.Element;
  onClick: () => void;
  disabled?: boolean | (() => boolean);
  closeOnSelect?: boolean;
  class?: string;
  showWhen?: () => boolean;
  children?: ContextMenuItem[];
}
