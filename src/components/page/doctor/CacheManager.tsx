import { createSignal, For, Show, createMemo, createEffect, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Trash2, TriangleAlert, Inbox, Database, Settings, Info, RefreshCw } from 'lucide-solid';
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
    refresh: refreshCache,
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

    // Get cache contents
    const cacheContents = await invoke<CacheEntry[]>('list_cache_contents', {
      preserveVersioned: preserveVersioned(),
    });

    // Get cache directory path
    const cacheDirectory = `${scoopPath}\\cache`;

    return {
      contents: cacheContents,
      directory: cacheDirectory,
    };
  });

  // Computed values from cache data
  const cacheContents = () => cacheData()?.contents || [];
  const cacheDirectory = () => cacheData()?.directory || '';

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [useScoopCleanup, setUseScoopCleanup] = createTauriSignal(
    'cacheManager.useScoopCleanup',
    false
  );
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

  // Force refresh function that clears cache before refreshing
  const forceRefresh = () => {
    // Clear cache to bypass valid cache
    sessionStorage.removeItem('cacheData');
    return refreshCache();
  };

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

  onMount(() => {
    console.log('CacheManager mounted - forcing initial refresh');
    // Always trigger refresh on mount to ensure data is loaded
    refreshCache();

    // Listen for cache invalidation events
    const unsubscribe = onInvalidate(() => {
      forceRefresh();
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
    const selectedFiles = [...selectedItems()];
    if (selectedFiles.length === 0) return;

    const packageNames = [...new Set(selectedFiles.map((id) => id.split('#')[0]))].sort();

    setConfirmationDetails({
      title: t('doctor.cacheManager.confirmDeletion'),
      content: (
        <>
          <p>
            {t('doctor.cacheManager.deleteFiles', {
              count: selectedFiles.length,
              packageCount: packageNames.length,
            })}
          </p>
          <ul class="bg-base-100 max-h-40 list-inside list-disc overflow-y-auto rounded-md p-2">
            <For each={packageNames}>{(name) => <li>{name}</li>}</For>
          </ul>
          <p>{t('doctor.cacheManager.actionCannotBeUndone')}</p>
        </>
      ),
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const packageNames = Array.from(
            new Set(selectedFiles.map((id) => id.split('#')[0]))
          ).sort();

          if (useScoopCleanup()) {
            if (packageNames.length > 0) {
              await invoke('remove_cache_for_specific_packages', { packageNames });
            }
          } else {
            await invoke<[number, number]>('clear_cache', {
              files: selectedFiles,
              preserveVersioned: preserveVersioned(),
            });
          }

          // Cache cleared successfully

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

  const handleClearAll = () => {
    setConfirmationDetails({
      title: t('doctor.cacheManager.confirmDeletion'),
      content: <p>{t('doctor.cacheManager.deleteAll', { count: cacheContents().length })}</p>,
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const displayedPackages = [
            ...new Set(cacheContents().map((item: CacheEntry) => item.name)),
          ];

          if (useScoopCleanup()) {
            if (displayedPackages.length > 0) {
              await invoke('remove_cache_for_specific_packages', {
                packageNames: displayedPackages,
              });
            }
          } else {
            await invoke<[number, number]>('clear_cache', {
              files: null,
              preserveVersioned: preserveVersioned(),
            });
          }

          // All cache cleared successfully

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
        headerAction={
          <div class="flex items-center gap-2">
            <ResponsiveButton
              collapsedButtonWidth="3rem"
              breakpoint={771}
              menuItems={[
                {
                  label: () => `${t('buttons.removeSelected')} (${selectedItems().size})`,
                  onClick: handleClearSelected,
                  disabled: () => selectedItems().size === 0 || isLoading(),
                  class: 'btn-warning',
                  icon: Trash2,
                },
                {
                  label: () => t('buttons.removeAll'),
                  onClick: handleClearAll,
                  disabled: () => cacheContents().length === 0 || isLoading(),
                  class: 'btn-error',
                  icon: Trash2,
                },
              ]}
            >
              <>
                <button
                  class="btn btn-warning btn-sm"
                  onClick={handleClearSelected}
                  disabled={selectedItems().size === 0 || isLoading()}
                >
                  <Trash2 class="h-4 w-4" />
                  {t('buttons.removeSelected')} ({selectedItems().size})
                </button>
                <button
                  class="btn btn-error btn-sm"
                  onClick={handleClearAll}
                  disabled={cacheContents().length === 0 || isLoading()}
                >
                  <Trash2 class="h-4 w-4" />
                  {t('buttons.removeAll')}
                </button>
              </>
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
            <button
              class="btn btn-ghost btn-sm"
              onClick={forceRefresh}
              disabled={isLoading()}
              title="Refresh cache"
            >
              <RefreshCw class="h-5 w-5" />
            </button>
          </div>
        }
      >
        <input
          type="text"
          placeholder={t('doctor.cacheManager.filterPlaceholder')}
          class="input input-bordered mt-2 mb-4 w-full"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          disabled={isLoading() || !!error() || cacheContents().length === 0}
        />

        <div class="bg-base-list max-h-[60vh] overflow-y-auto rounded-lg">
          <Show when={error()}>
            <div role="alert" class="alert alert-error">
              <TriangleAlert />
              <span>{error()}</span>
            </div>
          </Show>

          <Show when={!isLoading() && cacheContents().length === 0 && !error()}>
            <div class="p-8 text-center">
              <Inbox class="text-base-content/30 mx-auto h-16 w-16" />
              <p class="mt-4 text-lg font-semibold">{t('doctor.cacheManager.cacheIsEmpty')}</p>
              <p class="text-base-content/60">{t('doctor.cacheManager.noCachedFiles')}</p>
            </div>
          </Show>

          <Show when={cacheContents().length > 0}>
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
        <div class="space-y-4">
          {/* Use Scoop Cleanup Option */}
          <div class="flex items-center justify-between">
            <label class="cursor-pointer text-sm font-medium" for="use-scoop-cleanup">
              {t('doctor.cacheManager.settings.useScoopCleanup')}
            </label>
            <input
              id="use-scoop-cleanup"
              type="checkbox"
              class="toggle toggle-primary"
              checked={useScoopCleanup()}
              onChange={(e) => setUseScoopCleanup(e.currentTarget.checked)}
            />
          </div>

          {/* Preserve Versioned Cache Option */}
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <label class="cursor-pointer text-sm font-medium" for="preserve-versioned">
                  {t('doctor.cacheManager.settings.preserveVersioned')}
                </label>
                <div
                  class="tooltip"
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
        confirmText={t('buttons.deleteDirectly')}
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
