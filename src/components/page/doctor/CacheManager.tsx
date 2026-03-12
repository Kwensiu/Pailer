import { createSignal, onMount, For, Show, createMemo, createEffect } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Trash2, TriangleAlert, Inbox, Database, Settings, Info, RefreshCw } from 'lucide-solid';
import { formatBytes } from '../../../utils/format';
import ConfirmationModal from '../../modals/ConfirmationModal';
import OptionsModal from '../../modals/OptionsModal';
import Card from '../../common/Card';
import OpenPathButton from '../../common/OpenPathButton';
import { ResponsiveButton } from '../../common/ResponsiveButton';
import { t } from '../../../i18n';
import { createTauriSignal } from '../../../hooks/createTauriSignal';

const CACHE_DIR = 'cache';

interface CacheEntry {
  name: string;
  version: string;
  length: number;
  fileName: string;
}

// A unique identifier for a cache entry
type CacheIdentifier = string;

function getCacheIdentifier(entry: CacheEntry): CacheIdentifier {
  // Using the full filename for uniqueness
  return entry.fileName;
}

function CacheManager() {
  const [cacheContents, setCacheContents] = createSignal<CacheEntry[]>([]);
  const [selectedItems, setSelectedItems] = createSignal<Set<CacheIdentifier>>(new Set());
  const [filter, setFilter] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [cacheDirectory, setCacheDirectory] = createSignal<string>('');

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
      (s) => s.name.toLowerCase().includes(f) || s.version.toLowerCase().includes(f)
    );
  });

  const isAllSelected = createMemo(() => {
    const contents = filteredCacheContents();
    if (contents.length === 0) return false;
    return contents.every((item) => selectedItems().has(getCacheIdentifier(item)));
  });

  const getScoopSubPath = (subPath: string) => {
    return async () => {
      try {
        const scoopPath = await invoke<string>('get_scoop_path');
        if (!scoopPath) {
          throw new Error('Scoop path not configured');
        }
        return `${scoopPath}\\${subPath}`;
      } catch (error) {
        console.error(`Failed to get scoop ${subPath} path:`, error);
        throw error;
      }
    };
  };

  const fetchCacheDirectory = async () => {
    try {
      const getPath = getScoopSubPath(CACHE_DIR);
      const path = await getPath();
      setCacheDirectory(path);
    } catch (error) {
      console.error('Failed to fetch cache directory:', error);
    }
  };

  const fetchCacheContents = async () => {
    setIsLoading(true);
    setError(null);
    setSelectedItems(new Set<CacheIdentifier>());

    try {
      // 检查Scoop路径是否存在
      const scoopPath = await invoke<string | null>('get_scoop_path');
      if (!scoopPath) {
        setError('No Scoop path configured. Please configure it in settings.');
        setCacheDirectory('');
        return;
      }

      const pathExists = await invoke<boolean>('path_exists', { path: scoopPath });
      if (!pathExists) {
        setError(`Configured Scoop path does not exist: ${scoopPath}`);
        setCacheDirectory('');
        return;
      }

      // 获取缓存内容
      const cacheData = await invoke<CacheEntry[]>('list_cache_contents', {
        preserveVersioned: preserveVersioned(),
      });
      setCacheContents(cacheData);

      // 获取缓存目录路径
      await fetchCacheDirectory();
    } catch (err) {
      console.error('Failed to fetch cache contents:', err);
      setError(
        typeof err === 'string' ? err : 'An unknown error occurred while fetching cache contents.'
      );
      setCacheDirectory('');
    } finally {
      setIsLoading(false);
    }
  };

  onMount(fetchCacheContents);

  // 监听preserveVersioned变化以重新获取缓存
  createEffect(() => {
    const currentPreserveVersioned = preserveVersioned();
    // 使用setTimeout避免在组件挂载时立即触发
    setTimeout(() => {
      if (preserveVersioned() === currentPreserveVersioned) {
        fetchCacheContents();
      }
    }, 0);
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
    const currentIdentifiers = new Set(currentItems.map(getCacheIdentifier));

    // If all currently visible items are selected, unselect them.
    // Otherwise, select all currently visible items.
    const allVisibleSelected = currentItems.every((item) =>
      selectedItems().has(getCacheIdentifier(item))
    );

    if (allVisibleSelected && currentItems.length > 0) {
      // Unselect only the visible items
      setSelectedItems((prev) => {
        const next = new Set(prev);
        currentIdentifiers.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all visible items, adding to any existing selection
      setSelectedItems((prev) => new Set([...prev, ...currentIdentifiers]));
    }
  };

  const handleClearSelected = () => {
    const selectedFiles = [...selectedItems()];
    if (selectedFiles.length === 0) return;

    const packageNames = Array.from(new Set(selectedFiles.map((id) => id.split('#')[0]))).sort();

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
          if (useScoopCleanup()) {
            // Extract package names from selected files (list is already filtered)
            const packageNames = Array.from(
              new Set(selectedFiles.map((id) => id.split('#')[0]))
            ).sort();

            if (packageNames.length > 0) {
              await invoke('remove_cache_for_specific_packages', { packageNames });
            }
            await fetchCacheContents();
          } else {
            // Use direct file deletion
            const [success, failure] = await invoke<[number, number]>('clear_cache', {
              files: selectedFiles,
              preserveVersioned: preserveVersioned(),
            });
            if (failure > 0) {
              setError(t('doctor.cacheManager.deletePartialSuccess', { success, failure }));
            } else {
              await fetchCacheContents();
            }
          }
        } catch (err) {
          console.error('Failed to clear selected cache items:', err);
          setError(
            typeof err === 'string' ? err : 'An unknown error occurred while clearing cache.'
          );
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
          if (useScoopCleanup()) {
            // Get package names from current displayed list (already filtered)
            const displayedPackages = [...new Set(cacheContents().map((item) => item.name))];

            if (displayedPackages.length > 0) {
              await invoke('remove_cache_for_specific_packages', {
                packageNames: displayedPackages,
              });
            }
            await fetchCacheContents();
          } else {
            // Use direct file deletion
            const [success, failure] = await invoke<[number, number]>('clear_cache', {
              files: null,
              preserveVersioned: preserveVersioned(),
            });
            if (failure > 0) {
              setError(t('doctor.cacheManager.deletePartialSuccess', { success, failure }));
            } else {
              await fetchCacheContents();
            }
          }
        } catch (err) {
          console.error('Failed to clear all cache items:', err);
          setError(
            typeof err === 'string' ? err : 'An unknown error occurred while clearing cache.'
          );
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
              onClick={fetchCacheContents}
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
