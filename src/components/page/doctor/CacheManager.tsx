import { createSignal, For, Show, createMemo, createEffect, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import {
  Trash2,
  TriangleAlert,
  Inbox,
  Database,
  Settings,
  Info,
  SquareTerminal,
} from 'lucide-solid';
import { formatBytes } from '../../../utils/format';
import ConfirmationModal from '../../modals/ConfirmationModal';
import OptionsModal from '../../modals/OptionsModal';
import Card from '../../common/Card';
import OpenPathButton from '../../common/OpenPathButton';
import { ResponsiveButton } from '../../common/ResponsiveButton';
import { t } from '../../../i18n';
import { createSessionStorage, createTauriSignal, invalidateCache } from '../../../hooks';

interface CacheEntry {
  name: string;
  version: string;
  length: number;
  fileName: string;
  isVersionedInstall: boolean;
  isSafeToDelete: boolean;
}

// A unique identifier for a cache entry
type CacheIdentifier = string;

interface CacheData {
  contents: CacheEntry[];
  directory: string;
}

function getCacheIdentifier(entry: CacheEntry): CacheIdentifier {
  // Using the full filename for uniqueness
  return entry.fileName;
}

function CacheManager() {
  const [selectedItems, setSelectedItems] = createSignal<Set<string>>(new Set());
  const [filter, setFilter] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Session cache for cache data
  const {
    data: cacheData,
    loading: cacheLoading,
    error: cacheError,
    forceRefresh,
    onInvalidate,
  } = createSessionStorage<CacheData>('cacheData', async () => {
    const scoopPath = await invoke<string | null>('get_scoop_path');
    if (!scoopPath) {
      throw new Error('No Scoop path configured. Please configure it in settings.');
    }

    const pathExists = await invoke<boolean>('path_exists', { path: scoopPath });
    if (!pathExists) {
      throw new Error(`Configured Scoop path does not exist: ${scoopPath}`);
    }

    const cacheContents = await invoke<CacheEntry[]>('list_cache_contents', {
      // Use the actual setting value - this controls what's shown in the list
      // When true: hides cache files that match locally installed versions
      // When false: shows all cache files
      preserveVersioned: preserveVersioned(),
    });

    const cacheDirectory = `${scoopPath}\\cache`;

    return {
      contents: cacheContents,
      directory: cacheDirectory,
    };
  });

  // Computed values from cache data
  const cacheContents = () => cacheData()?.contents || [];
  const cacheDirectory = () => cacheData()?.directory || '';
  const isInitialLoading = () => isLoading() && cacheContents().length === 0;

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [preserveVersioned, setPreserveVersioned] = createTauriSignal(
    'cacheManager.preserveVersioned',
    true
  );

  // State for the confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = createSignal(false);
  const [confirmationDetails, setConfirmationDetails] = createSignal({
    title: '',
    content: null as any,
    onConfirm: () => {},
    type: 'default' as 'default' | 'destructive',
  });

  const filteredCacheContents = createMemo(() => {
    const f = filter().toLowerCase();
    if (!f) return cacheContents();
    return cacheContents().filter(
      (s: CacheEntry) => s.name.toLowerCase().includes(f) || s.version.toLowerCase().includes(f)
    );
  });

  // Sync loading state with cache loading
  createEffect(() => {
    setIsLoading(cacheLoading());
    setError(cacheError());
  });

  const isAllSelected = createMemo(() => {
    const contents = filteredCacheContents();
    if (contents.length === 0) return false;
    return contents.every((item: CacheEntry) => selectedItems().has(getCacheIdentifier(item)));
  });

  const selectedFiles = createMemo<string[]>(() => {
    const selected = selectedItems();
    return cacheContents()
      .map((item: CacheEntry) => getCacheIdentifier(item))
      .filter((id: string) => selected.has(id));
  });

  const selectedPackageNames = createMemo<string[]>(() => {
    const selected = new Set<string>(selectedFiles());
    const packageNames = [
      ...new Set<string>(
        cacheContents()
          .filter((item: CacheEntry) => selected.has(item.fileName))
          .map((item: CacheEntry) => item.name)
      ),
    ];
    packageNames.sort();
    return packageNames;
  });

  const hasSelectedFiles = createMemo(() => selectedFiles().length > 0);

  const allDeleteCount = createMemo(() => {
    if (!preserveVersioned()) {
      return cacheContents().length;
    }

    return cacheContents().filter((item: CacheEntry) => !item.isVersionedInstall).length;
  });

  const primaryDeleteLabel = createMemo(() =>
    hasSelectedFiles()
      ? `${t('buttons.removeSelected')}(${selectedFiles().length})`
      : t('buttons.removeAll')
  );

  const primaryDeleteClass = createMemo(() =>
    hasSelectedFiles() ? 'btn btn-warning btn-sm' : 'btn btn-error btn-sm'
  );

  const primaryDeleteMenuClass = createMemo(() =>
    hasSelectedFiles() ? 'btn-warning' : 'btn-error'
  );

  // Listen for settings changes that affect cache content
  let lastPreserveVersioned = preserveVersioned();
  createEffect(() => {
    const current = preserveVersioned();
    // Only refresh if the setting actually changed
    if (current !== lastPreserveVersioned) {
      lastPreserveVersioned = current;
      // Use setTimeout to avoid triggering during component initialization
      setTimeout(() => {
        forceRefresh();
      }, 0);
    }
  });

  createEffect(() => {
    const validIdentifiers = new Set(
      cacheContents().map((item: CacheEntry) => getCacheIdentifier(item))
    );
    setSelectedItems((prev) => {
      const next = new Set([...prev].filter((id: string) => validIdentifiers.has(id)));
      return next.size === prev.size ? prev : next;
    });
  });

  onMount(() => {
    // Listen for cache invalidation events
    const unsubscribe = onInvalidate(() => {
      forceRefresh();
    });

    // Also refresh cache when preserveVersioned setting changes
    createEffect(() => {
      const currentValue = preserveVersioned();
      // Only refresh if the value actually changed (not on first mount)
      if (currentValue !== lastPreserveVersioned) {
        lastPreserveVersioned = currentValue;
        // Skip refresh on initial mount
        if (lastPreserveVersioned !== undefined) {
          forceRefresh();
        }
      }
    });

    return unsubscribe;
  });

  const toggleSelection = (identifier: CacheIdentifier) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const currentItems = filteredCacheContents();
    const currentIdentifiers = currentItems.map(getCacheIdentifier) as string[];

    const allVisibleSelected = currentItems.every((item: CacheEntry) =>
      selectedItems().has(getCacheIdentifier(item))
    );

    if (allVisibleSelected && currentItems.length > 0) {
      setSelectedItems((prev: Set<string>) => {
        const next = new Set(prev);
        currentIdentifiers.forEach((id: string) => next.delete(id));
        return next;
      });
    } else {
      setSelectedItems((prev: Set<string>) => new Set([...prev, ...currentIdentifiers]));
    }
  };

  const handleClearSelected = () => {
    if (isLoading()) return;
    const filesToDelete = selectedFiles();
    if (filesToDelete.length === 0) return;

    const packageNames = selectedPackageNames();

    setConfirmationDetails({
      title: t('doctor.cacheManager.confirmDeletion'),
      type: 'destructive',
      content: (
        <div class="space-y-2">
          <p class="text-base-content/80">
            {t('doctor.cacheManager.deleteFiles', { count: filesToDelete.length })}
          </p>
          <div class="bg-base-200/60 border-base-300/60 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <span class="font-medium">
              {t('doctor.cacheManager.selectedPackages', { count: packageNames.length })}
            </span>
            <ul class="text-base-content/80 max-h-40 list-inside list-disc overflow-y-auto">
              <For each={packageNames}>{(name: string) => <li>{name}</li>}</For>
            </ul>
          </div>
        </div>
      ),
      onConfirm: async () => {
        setIsLoading(true);
        try {
          await invoke<[number, number]>('clear_cache', {
            files: filesToDelete,
            preserveVersioned: false,
          });

          invalidateCache('cacheData');
        } catch (err) {
          console.error('Failed to clear selected cache items:', err);
          setError(
            typeof err === 'string' ? err : 'An unknown error occurred while clearing cache.'
          );
          // EventBus auto-handles errors
        } finally {
          setIsLoading(false);
        }
      },
    });

    setIsConfirmModalOpen(true);
  };

  const handleClearWithScoop = () => {
    if (isLoading()) return;
    const packageNames = selectedPackageNames();
    if (packageNames.length === 0) return;

    setConfirmationDetails({
      title: t('doctor.cacheManager.confirmScoopCacheRm'),
      type: 'destructive',
      content: (
        <div class="space-y-2">
          <p class="text-base-content/80">
            {t('doctor.cacheManager.scoopCacheRmDescription', {
              packageCount: packageNames.length,
            })}
          </p>
          <div class="bg-base-200/60 border-base-300/60 rounded-lg border p-3 text-sm">
            <ul class="text-base-content/80 max-h-40 list-inside list-disc overflow-y-auto">
              <For each={packageNames}>{(name: string) => <li>{name}</li>}</For>
            </ul>
          </div>
          <div class="status-alert status-alert-warning mt-2 rounded-lg! p-2!">
            <span>{t('doctor.cacheManager.scoopCacheRmWarning')}</span>
          </div>
        </div>
      ),
      onConfirm: async () => {
        setIsLoading(true);
        try {
          await invoke('remove_cache_for_specific_packages', { packageNames });

          invalidateCache('cacheData');
        } catch (err) {
          console.error('Failed to clear cache with scoop cache rm:', err);
          setError(
            typeof err === 'string'
              ? err
              : 'An unknown error occurred while clearing cache with scoop cache rm.'
          );
        } finally {
          setIsLoading(false);
        }
      },
    });

    setIsConfirmModalOpen(true);
  };

  const handlePrimaryDelete = () => {
    if (isLoading()) return;
    if (hasSelectedFiles()) {
      handleClearSelected();
      return;
    }

    handleClearAll();
  };

  const handleClearAll = () => {
    if (isLoading()) return;
    if (allDeleteCount() === 0) return;
    setConfirmationDetails({
      title: t('doctor.cacheManager.confirmDeletion'),
      type: 'destructive',
      content: (
        <div class="space-y-2">
          <p class="text-base-content/80">
            {t('doctor.cacheManager.deleteAll', { count: allDeleteCount() })}
          </p>

          <div class="bg-base-200/60 border-base-300/60 rounded-lg border p-3">
            <label class="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm"
                checked={preserveVersioned()}
                onChange={(e) => setPreserveVersioned(e.currentTarget.checked)}
              />
              <div class="flex flex-col text-sm">
                <span class="font-medium">
                  {t('doctor.cacheManager.settings.preserveVersioned')}
                </span>
              </div>
            </label>
          </div>
        </div>
      ),
      onConfirm: async () => {
        setIsLoading(true);
        try {
          await invoke<[number, number]>('clear_cache', {
            files: null,
            preserveVersioned: preserveVersioned(),
          });

          invalidateCache('cacheData');
        } catch (err) {
          console.error('Failed to clear all cache items:', err);
          setError(
            typeof err === 'string' ? err : 'An unknown error occurred while clearing cache.'
          );
          // EventBus auto-handles errors
        } finally {
          setIsLoading(false);
          setIsConfirmModalOpen(false);
        }
      },
    });

    setIsConfirmModalOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  return (
    <>
      <Card
        title={
          <div class="flex items-center gap-2">
            {t('doctor.cacheManager.title')}
            <button
              class="btn btn-ghost btn-sm btn-circle"
              onClick={() => setIsSettingsOpen(true)}
              title={t('doctor.cacheManager.settings.title')}
            >
              <Settings class="h-4 w-4" />
            </button>
          </div>
        }
        icon={Database}
        onRefresh={forceRefresh}
        loading={isLoading()}
        showLoadingPlaceholder={isLoading() && !error()}
        dimContentWhenBusy={true}
        lockContentWhenBusy={false}
        headerAction={
          <div class="flex items-center gap-2">
            <ResponsiveButton
              collapsedButtonWidth="3rem"
              breakpoint={771}
              menuItems={[
                {
                  label: () => t('doctor.cacheManager.confirmScoopCacheRm'),
                  onClick: handleClearWithScoop,
                  disabled: () => !hasSelectedFiles() || isInitialLoading(),
                  class: 'btn-warning',
                  icon: SquareTerminal,
                },
                {
                  label: () => primaryDeleteLabel(),
                  onClick: handlePrimaryDelete,
                  disabled: () =>
                    (hasSelectedFiles() ? false : allDeleteCount() === 0) || isInitialLoading(),
                  class: primaryDeleteMenuClass(),
                  icon: Trash2,
                },
              ]}
            >
              <button
                class="btn btn-warning btn-square btn-sm"
                onClick={handleClearWithScoop}
                disabled={!hasSelectedFiles() || isInitialLoading()}
                title={t('doctor.cacheManager.confirmScoopCacheRm')}
              >
                <SquareTerminal class="h-4 w-4" />
              </button>
              <button
                class={primaryDeleteClass()}
                onClick={handlePrimaryDelete}
                disabled={
                  (hasSelectedFiles() ? false : allDeleteCount() === 0) || isInitialLoading()
                }
              >
                <Trash2 class="h-4 w-4" />
                {primaryDeleteLabel()}
              </button>
            </ResponsiveButton>
            <div class="divider divider-horizontal m-1" />
            <Show when={cacheDirectory()}>
              <OpenPathButton
                path={cacheDirectory()}
                validatePath={true}
                showErrorToast={true}
                tooltip={t('doctor.cacheManager.openCacheDirectory')}
              />
            </Show>
          </div>
        }
      >
        <input
          type="text"
          placeholder={t('doctor.cacheManager.filterPlaceholder')}
          class="input input-bordered mt-2 mb-4 w-full"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          disabled={isInitialLoading() || !!error() || cacheContents().length === 0}
        />

        <div class="bg-base-list max-h-[60vh] overflow-y-auto rounded-lg">
          <Show when={error()}>
            <div role="alert" class="alert alert-error">
              <TriangleAlert />
              <span>{error()}</span>
            </div>
          </Show>

          <Show when={!error() && !isLoading() && cacheContents().length === 0}>
            <div class="p-8 text-center">
              <Inbox class="text-base-content/30 mx-auto h-16 w-16" />
              <p class="mt-4 text-lg font-semibold">{t('doctor.cacheManager.cacheIsEmpty')}</p>
              <p class="text-base-content/60">{t('doctor.cacheManager.noCachedFiles')}</p>
            </div>
          </Show>

          <Show when={!error() && cacheContents().length > 0}>
            <div class="overflow-x-auto">
              <table class="table-sm table">
                <thead>
                  <tr>
                    <th>
                      <label>
                        <input
                          type="checkbox"
                          class="checkbox checkbox-primary"
                          checked={isAllSelected()}
                          onChange={toggleSelectAll}
                        />
                      </label>
                    </th>
                    <th>{t('doctor.cacheManager.name')}</th>
                    <th>{t('doctor.cacheManager.version')}</th>
                    <th>{t('doctor.cacheManager.size')}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filteredCacheContents()}>
                    {(item) => {
                      const id = getCacheIdentifier(item);
                      return (
                        <tr class="hover">
                          <td>
                            <label>
                              <input
                                type="checkbox"
                                class="checkbox checkbox-primary"
                                checked={selectedItems().has(id)}
                                onChange={() => toggleSelection(id)}
                              />
                            </label>
                          </td>
                          <td>{item.name}</td>
                          <td>{item.version}</td>
                          <td>{formatBytes(item.length)}</td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Card>

      <OptionsModal
        isOpen={isSettingsOpen()}
        title={t('doctor.cacheManager.settings.title')}
        onClose={handleSettingsClose}
      >
        <div class="space-y-2">
          {/* Preserve Versioned Cache Option */}
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <label class="cursor-pointer text-sm font-medium" for="preserve-versioned">
                  {t('doctor.cacheManager.settings.preserveVersioned')}
                </label>
                <div
                  class="tooltip tooltip-right"
                  data-tip={t('doctor.cacheManager.settings.preserveVersionedDescription')}
                >
                  <Info class="text-base-content/50 h-4 w-4 cursor-help" />
                </div>
              </div>
            </div>
            <input
              id="preserve-versioned"
              type="checkbox"
              class="toggle toggle-primary"
              checked={preserveVersioned()}
              onChange={(e) => setPreserveVersioned(e.currentTarget.checked)}
            />
          </div>
        </div>
      </OptionsModal>

      <ConfirmationModal
        isOpen={isConfirmModalOpen()}
        title={confirmationDetails().title}
        type={confirmationDetails().type}
        confirmText={t('buttons.delete')}
        onConfirm={() => {
          confirmationDetails().onConfirm();
          setIsConfirmModalOpen(false);
        }}
        onCancel={() => setIsConfirmModalOpen(false)}
      >
        {confirmationDetails().content}
      </ConfirmationModal>
    </>
  );
}

export default CacheManager;
