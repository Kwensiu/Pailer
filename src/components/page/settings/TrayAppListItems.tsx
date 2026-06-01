import { Show } from 'solid-js';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-solid';
import { t } from '../../../i18n';

export interface ScoopApp {
  name: string;
  display_name: string;
  icon_data_url?: string | null;
}

export interface DragOverlay {
  app: ScoopApp;
  width: number;
  height: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

export type SelectedTrayRow =
  | {
      type: 'app';
      app: ScoopApp;
      originalIndex: number;
    }
  | {
      type: 'placeholder';
    };

const APP_ROW_CLASS =
  'bg-base-100 border-base-300 hover:border-primary/30 hover:bg-base-100/80 mb-2 flex min-h-12 items-center gap-2 rounded-md border px-2 py-1.5 transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out hover:shadow-sm';

function TrayAppBadge(props: { app: ScoopApp; tone: 'primary' | 'secondary' }) {
  return (
    <Show
      when={props.app.icon_data_url}
      fallback={
        <div
          class={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold ${
            props.tone === 'primary'
              ? 'bg-primary text-primary-content'
              : 'bg-secondary text-secondary-content'
          }`}
        >
          {props.app.display_name.charAt(0).toUpperCase()}
        </div>
      }
    >
      <img
        src={props.app.icon_data_url ?? undefined}
        alt=""
        class="h-7 w-7 shrink-0 rounded object-contain"
        loading="lazy"
      />
    </Show>
  );
}

export function AvailableTrayAppRow(props: { app: ScoopApp; onAdd: (app: ScoopApp) => void }) {
  return (
    <div
      class="hover:bg-base-100 flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5"
      onDblClick={() => props.onAdd(props.app)}
    >
      <TrayAppBadge app={props.app} tone="primary" />
      <span class="min-w-0 flex-1 truncate text-sm">{props.app.display_name}</span>
      <button
        type="button"
        class="btn btn-square btn-ghost btn-sm"
        title={t('settings.trayApps.addToTray')}
        aria-label={t('settings.trayApps.addToTray')}
        onClick={() => props.onAdd(props.app)}
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>
  );
}

export function SelectedTrayAppRow(props: {
  row: Extract<SelectedTrayRow, { type: 'app' }>;
  selectedCount: number;
  registerElement: (appName: string, element: HTMLDivElement) => void;
  onStartDrag: (appName: string, e: PointerEvent) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (appName: string) => void;
}) {
  const app = () => props.row.app;
  const index = () => props.row.originalIndex;

  return (
    <div
      class={APP_ROW_CLASS}
      data-tray-app-name={app().name}
      ref={(element) => props.registerElement(app().name, element)}
    >
      <span
        class="text-base-content/40 hover:text-base-content/70 grid h-8 w-5 shrink-0 cursor-grab touch-none place-items-center select-none active:cursor-grabbing"
        onPointerDown={(e) => props.onStartDrag(app().name, e)}
      >
        <GripVertical class="h-4 w-4" />
      </span>
      <TrayAppBadge app={app()} tone="secondary" />
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{app().display_name}</span>
      <button
        type="button"
        class="btn btn-square btn-ghost btn-xs"
        onClick={() => props.onMoveUp(index())}
        disabled={index() === 0}
      >
        <ChevronUp class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="btn btn-square btn-ghost btn-xs"
        onClick={() => props.onMoveDown(index())}
        disabled={index() === props.selectedCount - 1}
      >
        <ChevronDown class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="btn btn-square btn-ghost btn-sm text-error"
        title={t('settings.trayApps.removeFromTray')}
        aria-label={t('settings.trayApps.removeFromTray')}
        onClick={() => props.onRemove(app().name)}
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  );
}

export function SelectedTrayPlaceholder() {
  return (
    <div class="border-primary/30 bg-primary/5 mb-2 min-h-12 rounded-md border border-dashed transition-all duration-150 ease-out" />
  );
}

export function DragOverlayPreview(props: { overlay: DragOverlay }) {
  return (
    <div
      class="bg-base-100 border-primary/40 pointer-events-none fixed z-[9999] flex items-center gap-2 rounded-md border px-2 py-1.5 opacity-95 shadow-lg"
      style={{
        left: '0',
        top: '0',
        width: `${props.overlay.width}px`,
        height: `${props.overlay.height}px`,
        transform: `translate3d(${props.overlay.x}px, ${props.overlay.y}px, 0)`,
      }}
    >
      <span class="text-base-content/50 grid h-8 w-5 shrink-0 place-items-center">
        <GripVertical class="h-4 w-4" />
      </span>
      <TrayAppBadge app={props.overlay.app} tone="secondary" />
      <span class="min-w-0 flex-1 truncate text-sm font-medium">
        {props.overlay.app.display_name}
      </span>
    </div>
  );
}
