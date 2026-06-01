import { createSignal, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import { Portal } from 'solid-js/web';
import { invoke } from '@tauri-apps/api/core';
import { Monitor, Settings, Search, RotateCcw } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import SettingsToggle from '../../common/SettingsToggle';
import Modal from '../../common/Modal';
import Card from '../../common/Card';
import { t } from '../../../i18n';
import {
  AvailableTrayAppRow,
  DragOverlayPreview,
  SelectedTrayAppRow,
  SelectedTrayPlaceholder,
  type DragOverlay,
  type ScoopApp,
  type SelectedTrayRow,
} from './TrayAppListItems';

function TraySettings() {
  const { settings, setWindowSettings } = settingsStore;
  const [isSaving, setIsSaving] = createSignal(false);
  const [availableApps, setAvailableApps] = createSignal<ScoopApp[]>([]);
  const [selectedApps, setSelectedApps] = createSignal<ScoopApp[]>([]);
  const [isLoadingApps, setIsLoadingApps] = createSignal(false);
  const [isTrayAppsModalOpen, setIsTrayAppsModalOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [draggedAppName, setDraggedAppName] = createSignal<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = createSignal<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = createSignal<number | null>(null);
  const [dragOverlay, setDragOverlay] = createSignal<DragOverlay | null>(null);
  const [saveTimeoutId, setSaveTimeoutId] = createSignal<number | null>(null);
  const selectedRowElements = new Map<string, HTMLDivElement>();

  const getAvailableApps = createMemo(() => {
    const selectedNames = new Set(selectedApps().map((app) => app.name));
    const query = searchQuery().trim().toLowerCase();

    return availableApps()
      .filter((app) => !selectedNames.has(app.name))
      .filter((app) => {
        if (!query) {
          return true;
        }

        return (
          app.display_name.toLowerCase().includes(query) || app.name.toLowerCase().includes(query)
        );
      });
  });

  const getSelectedTrayRows = createMemo<SelectedTrayRow[]>(() => {
    const appName = draggedAppName();
    const fromIndex = dragFromIndex();
    const targetIndex = dragTargetIndex();
    const apps = selectedApps();

    if (!appName || fromIndex === null || targetIndex === null) {
      return apps.map((app, originalIndex) => ({
        type: 'app',
        app,
        originalIndex,
      }));
    }

    const rows: SelectedTrayRow[] = apps
      .map((app, originalIndex) => ({
        type: 'app' as const,
        app,
        originalIndex,
      }))
      .filter((row) => row.app.name !== appName);

    rows.splice(Math.min(targetIndex, rows.length), 0, { type: 'placeholder' });
    return rows;
  });

  const applyTrayAppIcons = (icons: Record<string, string>) => {
    if (Object.keys(icons).length === 0) {
      return;
    }

    const withIcons = (apps: ScoopApp[]) =>
      apps.map((app) => ({
        ...app,
        icon_data_url: icons[app.name] ?? app.icon_data_url,
      }));

    setAvailableApps((apps) => withIcons(apps));
    setSelectedApps((apps) => withIcons(apps));
  };

  const loadTrayAppIcons = async (apps: ScoopApp[]) => {
    if (apps.length === 0) {
      return;
    }

    try {
      const icons = await invoke<Record<string, string>>('get_scoop_app_shortcut_icons', {
        appNames: apps.map((app) => app.name),
        size: 32,
      });
      applyTrayAppIcons(icons);
    } catch (error) {
      console.debug('Failed to load tray app icons:', error);
    }
  };

  // Load settings from the persistent store on mount
  onMount(async () => {
    try {
      const closeToTray = await invoke<boolean>('get_config_value', {
        key: 'window.closeToTray',
      });
      const firstTrayNotificationShown = await invoke<boolean>('get_config_value', {
        key: 'window.firstTrayNotificationShown',
      });

      if (closeToTray !== null || firstTrayNotificationShown !== null) {
        setWindowSettings({
          closeToTray: closeToTray ?? true,
          firstTrayNotificationShown: firstTrayNotificationShown ?? false,
        });
      }
    } catch (error) {
      console.error('Failed to load window settings:', error);
    }

    // Load tray apps
    loadTrayApps();
  });

  const loadTrayApps = async () => {
    setIsLoadingApps(true);
    try {
      // Get all available Scoop apps with type validation
      const appsData = await invoke('get_scoop_app_shortcuts');
      let apps: ScoopApp[] = [];
      if (Array.isArray(appsData)) {
        apps = appsData
          .filter(
            (item: any) =>
              item &&
              typeof item === 'object' &&
              typeof item.name === 'string' &&
              typeof item.display_name === 'string' &&
              item.name.trim() &&
              item.display_name.trim()
          )
          .map((item: any) => ({
            name: item.name.trim(),
            display_name: item.display_name.trim(),
            icon_data_url:
              typeof item.icon_data_url === 'string' && item.icon_data_url.trim()
                ? item.icon_data_url
                : null,
          }));
      } else {
        console.warn('get_scoop_app_shortcuts returned non-array:', appsData);
      }
      setAvailableApps(apps);

      // Get currently configured tray apps with type validation
      const configuredAppNames = await invoke('get_config_value', {
        key: 'tray.appsList',
      });

      if (
        Array.isArray(configuredAppNames) &&
        configuredAppNames.every((name) => typeof name === 'string')
      ) {
        const validNames = configuredAppNames.filter(
          (name) => typeof name === 'string' && name.trim()
        );
        const appMap = new Map(apps.map((app) => [app.name, app]));
        const selected = validNames
          .map((name) => appMap.get(name))
          .filter((app): app is ScoopApp => !!app);
        setSelectedApps(selected);
      } else if (configuredAppNames !== null && configuredAppNames !== undefined) {
        console.warn('Invalid tray.appsList configuration:', configuredAppNames);
      }

      void loadTrayAppIcons(apps);
    } catch (error) {
      console.error('Failed to load tray apps:', error);
    } finally {
      setIsLoadingApps(false);
    }
  };

  const handleCloseToTrayChange = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      await invoke('set_config_value', {
        key: 'window.closeToTray',
        value: enabled,
      });
      await setWindowSettings({ closeToTray: enabled });
    } catch (error) {
      console.error('Failed to save close to tray setting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrayAppsEnabledChange = async (enabled: boolean) => {
    try {
      await invoke('set_config_value', {
        key: 'settings.window.trayAppsEnabled',
        value: enabled,
      });
      await setWindowSettings({ trayAppsEnabled: enabled });
    } catch (error) {
      console.error('Failed to save tray apps enabled setting:', error);
    }
  };

  const addApp = (app: ScoopApp) => {
    if (!selectedApps().find((a) => a.name === app.name)) {
      const newSelected = [...selectedApps(), app];
      setSelectedApps(newSelected);
      saveSelectedApps(newSelected);
    }
  };

  const removeApp = (appName: string) => {
    const newSelected = selectedApps().filter((app) => app.name !== appName);
    setSelectedApps(newSelected);
    saveSelectedApps(newSelected);
  };

  const moveAppUp = (index: number) => {
    if (index > 0) {
      const apps = [...selectedApps()];
      [apps[index - 1], apps[index]] = [apps[index], apps[index - 1]];
      setSelectedApps(apps);
      saveSelectedApps(apps);
    }
  };

  const moveAppDown = (index: number) => {
    const apps = [...selectedApps()];
    if (index < apps.length - 1) {
      [apps[index], apps[index + 1]] = [apps[index + 1], apps[index]];
      setSelectedApps(apps);
      saveSelectedApps(apps);
    }
  };

  const resetSelectedApps = () => {
    setSelectedApps([]);
    saveSelectedApps([]);
  };

  const reorderSelectedApps = (fromIndex: number, toIndex: number, persist = true) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }

    const apps = [...selectedApps()];
    if (fromIndex >= apps.length || toIndex >= apps.length) {
      return;
    }

    const [moved] = apps.splice(fromIndex, 1);
    apps.splice(toIndex, 0, moved);
    setSelectedApps(apps);
    if (persist) {
      saveSelectedApps(apps);
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    const appName = draggedAppName();
    if (!appName) {
      return;
    }

    e.preventDefault();
    setDragOverlay((overlay) =>
      overlay
        ? {
            ...overlay,
            x: e.clientX - overlay.offsetX,
            y: e.clientY - overlay.offsetY,
          }
        : overlay
    );

    const rowEntries = selectedApps()
      .filter((app) => app.name !== appName)
      .map((app, index) => ({
        insertionIndex: index,
        element: selectedRowElements.get(app.name),
      }))
      .filter(
        (entry): entry is { insertionIndex: number; element: HTMLDivElement } => !!entry.element
      );

    if (rowEntries.length === 0) {
      return;
    }

    let nextTargetIndex = rowEntries.length;
    for (const entry of rowEntries) {
      const rect = entry.element.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        nextTargetIndex = entry.insertionIndex;
        break;
      }
    }
    setDragTargetIndex(nextTargetIndex);
  };

  const finishSelectedDrag = (commit: boolean) => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);

    const fromIndex = dragFromIndex();
    const targetIndex = dragTargetIndex();
    if (commit && fromIndex !== null && targetIndex !== null && fromIndex !== targetIndex) {
      reorderSelectedApps(fromIndex, targetIndex);
    }
    setDraggedAppName(null);
    setDragFromIndex(null);
    setDragTargetIndex(null);
    setDragOverlay(null);
  };

  const handlePointerUp = () => {
    finishSelectedDrag(true);
  };

  const startSelectedDrag = (appName: string, e: PointerEvent) => {
    if (e.button !== 0) {
      return;
    }

    e.preventDefault();
    const app = selectedApps().find((item) => item.name === appName);
    const fromIndex = selectedApps().findIndex((item) => item.name === appName);
    const rowElement = selectedRowElements.get(appName);
    if (!app || fromIndex < 0 || !rowElement) {
      return;
    }

    const rect = rowElement.getBoundingClientRect();
    setDraggedAppName(appName);
    setDragFromIndex(fromIndex);
    setDragTargetIndex(fromIndex);
    setDragOverlay({
      app,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const registerSelectedRowElement = (appName: string, element: HTMLDivElement) => {
    selectedRowElements.set(appName, element);
  };

  onCleanup(() => {
    finishSelectedDrag(false);
  });

  const saveSelectedApps = async (apps: ScoopApp[]) => {
    // Clear any pending save operation
    const currentTimeoutId = saveTimeoutId();
    if (currentTimeoutId !== null) {
      clearTimeout(currentTimeoutId);
      setSaveTimeoutId(null);
    }

    // Debounce saves to prevent rapid consecutive calls
    const timeoutId = setTimeout(async () => {
      setSaveTimeoutId(null);

      // Use current state at save time for proper rollback
      const currentStateAtSave = [...selectedApps()];

      try {
        const appNames = apps.map((app) => app.name);
        await invoke('set_config_value', {
          key: 'tray.appsList',
          value: appNames,
        });
        // Success - state is already updated in UI
      } catch (error) {
        console.error('Failed to save selected apps:', error);
        // Revert UI state to what it was when save started
        setSelectedApps(currentStateAtSave);
        // FIXME: Replace alert with proper error notification
        alert(`Failed to save tray apps: ${error}`);
      }
    }, 300); // 300ms debounce

    setSaveTimeoutId(timeoutId as any);
  };

  return (
    <>
      <Card
        title={t('settings.windowBehavior.title')}
        icon={Monitor}
        description={t('settings.windowBehavior.description')}
        headerAction={
          <SettingsToggle
            checked={settings.window.closeToTray}
            onChange={(checked) => handleCloseToTrayChange(checked)}
            disabled={isSaving()}
            showStatusLabel={true}
          />
        }
        conditionalContent={{
          condition: settings.window.closeToTray,
          children: (
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <h4 class="text-base-content font-medium">
                  {t('settings.trayApps.manageContextMenu')}
                </h4>
                <p class="text-base-content/70 text-sm">
                  {t('settings.trayApps.manageTrayAppsDescription')}
                </p>
              </div>
              <button class="btn btn-outline btn-sm" onClick={() => setIsTrayAppsModalOpen(true)}>
                <Settings size={16} />
                {t('settings.trayApps.configure')}
              </button>
            </div>
          ),
        }}
      />
      <Modal
        isOpen={isTrayAppsModalOpen()}
        onClose={() => setIsTrayAppsModalOpen(false)}
        title={t('settings.trayApps.title')}
        size="large"
        animation="scale"
      >
        <div class="flex h-[min(34rem,calc(90vh-7rem))] min-h-0 flex-col gap-4 overflow-hidden">
          <div class="border-base-300 bg-base-200/70 flex min-h-12 shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div class="min-w-0">
              <div class="text-base-content text-sm font-medium">
                {t('settings.trayApps.enableTrayApps')}
              </div>
              <div class="text-base-content/60 truncate text-xs">
                {t('settings.trayApps.enableTrayAppsDescription')}
              </div>
            </div>
            <SettingsToggle
              checked={settings.window.trayAppsEnabled}
              onChange={(checked) => handleTrayAppsEnabledChange(checked)}
              disabled={false}
              showStatusLabel={false}
            />
          </div>

          {/* Apps Management Section */}
          <div
            class={`min-h-0 overflow-hidden transition-all duration-300 ease-in-out ${
              settings.window.trayAppsEnabled ? 'flex-1 opacity-100' : 'max-h-0 opacity-0'
            }`}
            aria-hidden={!settings.window.trayAppsEnabled}
            inert={!settings.window.trayAppsEnabled}
          >
            <div class="grid h-full min-h-0 grid-cols-1 grid-rows-2 gap-4 overflow-hidden lg:grid-cols-2 lg:grid-rows-1">
              <Show when={!isLoadingApps()} fallback={<div>{t('loading')}</div>}>
                <section class="border-base-300 bg-base-200 flex min-h-0 flex-col overflow-hidden rounded-lg border">
                  <div class="border-base-300 flex min-h-16 items-start justify-between gap-3 border-b p-3">
                    <div class="min-w-0">
                      <h5 class="text-base-content text-sm font-semibold">
                        {t('settings.trayApps.availableApps')}
                      </h5>
                      <p class="text-base-content/60 truncate text-xs">
                        {t('settings.trayApps.availableAppsDescription')}
                      </p>
                    </div>
                    <label class="input input-bordered bg-base-100 flex h-9 max-w-56 min-w-0 flex-1 items-center gap-2 sm:w-56 sm:flex-none">
                      <Search class="text-base-content/50 h-4 w-4 shrink-0" />
                      <input
                        type="text"
                        class="min-w-0 grow"
                        placeholder={t('settings.trayApps.searchPlaceholder')}
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <div class="min-h-0 flex-1 overflow-y-auto p-2">
                    <For each={getAvailableApps()}>
                      {(app) => <AvailableTrayAppRow app={app} onAdd={addApp} />}
                    </For>
                    <Show when={getAvailableApps().length === 0}>
                      <p class="text-base-content/50 bg-base-100 rounded-lg border p-3 text-sm">
                        {searchQuery()
                          ? t('settings.trayApps.noSearchResults')
                          : t('settings.trayApps.noAvailableApps')}
                      </p>
                    </Show>
                  </div>
                </section>

                <section class="border-base-300 bg-base-200 flex min-h-0 flex-col overflow-hidden rounded-lg border">
                  <div class="border-base-300 flex min-h-16 items-center justify-between gap-3 border-b p-3">
                    <div class="min-w-0">
                      <h5 class="text-base-content text-sm font-semibold">
                        {t('settings.trayApps.selectedApps')}
                      </h5>
                      <p class="text-base-content/60 truncate text-xs">
                        {t('settings.trayApps.dragToReorder')}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm shrink-0"
                      disabled={selectedApps().length === 0}
                      onClick={resetSelectedApps}
                    >
                      <RotateCcw class="h-4 w-4" />
                      {t('settings.trayApps.reset')}
                    </button>
                  </div>
                  <div class="min-h-0 flex-1 overflow-y-auto p-2">
                    <Show
                      when={selectedApps().length > 0}
                      fallback={
                        <div class="text-base-content/50 flex min-h-40 items-center justify-center text-sm">
                          {t('settings.trayApps.noSelectedApps')}
                        </div>
                      }
                    >
                      <For each={getSelectedTrayRows()}>
                        {(row) =>
                          row.type === 'placeholder' ? (
                            <SelectedTrayPlaceholder />
                          ) : (
                            <SelectedTrayAppRow
                              row={row}
                              selectedCount={selectedApps().length}
                              registerElement={registerSelectedRowElement}
                              onStartDrag={startSelectedDrag}
                              onMoveUp={moveAppUp}
                              onMoveDown={moveAppDown}
                              onRemove={removeApp}
                            />
                          )
                        }
                      </For>
                    </Show>
                  </div>
                </section>
              </Show>
            </div>
          </div>
        </div>
      </Modal>
      <Portal>
        <Show when={dragOverlay()}>{(overlay) => <DragOverlayPreview overlay={overlay()} />}</Show>
      </Portal>
    </>
  );
}

export default TraySettings;
