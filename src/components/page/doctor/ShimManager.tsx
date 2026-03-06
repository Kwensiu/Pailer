import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { TriangleAlert, Inbox, Link, EyeOff, Plus, BookText, Layers2 } from 'lucide-solid';
import ShimDetailsModal from './ShimDetailsModal';
import AddShimModal from './AddShimModal';
import Card from '../../common/Card';
import OpenPathButton from '../../common/OpenPathButton';
import { t } from '../../../i18n';

const SHIMS_DIR = 'shims';

export interface Shim {
  name: string;
  path: string;
  source: string;
  shimType: string;
  args?: string;
  isHidden: boolean;
}

function ShimManager() {
  const [allShims, setAllShims] = createSignal<Shim[]>([]);
  const [filter, setFilter] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(true);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedShim, setSelectedShim] = createSignal<Shim | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = createSignal(false);
  const [shimsDirectory, setShimsDirectory] = createSignal<string>('');

  const filteredShims = createMemo(() => {
    const f = filter().toLowerCase();
    if (!f) return allShims();
    return allShims().filter(
      (s) => s.name.toLowerCase().includes(f) || s.source.toLowerCase().includes(f)
    );
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

  const fetchShimsDirectory = async () => {
    try {
      const getPath = getScoopSubPath(SHIMS_DIR);
      const path = await getPath();
      setShimsDirectory(path);
    } catch (error) {
      console.error('Failed to fetch shims directory:', error);
    }
  };

  const fetchShims = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 检查Scoop路径是否存在
      const scoopPath = await invoke<string | null>('get_scoop_path');
      if (!scoopPath) {
        setError('No Scoop path configured. Please configure it in settings.');
        setShimsDirectory('');
        return;
      }

      const pathExists = await invoke<boolean>('path_exists', { path: scoopPath });
      if (!pathExists) {
        setError(`Configured Scoop path does not exist: ${scoopPath}`);
        setShimsDirectory('');
        return;
      }

      // 获取shim列表
      const result = await invoke<Shim[]>('list_shims');
      setAllShims(result.sort((a, b) => a.name.localeCompare(b.name)));

      // 获取shim目录路径
      await fetchShimsDirectory();
    } catch (err) {
      console.error('Failed to fetch shims:', err);
      setError(typeof err === 'string' ? err : 'An unknown error occurred while fetching shims.');
      setShimsDirectory('');
    } finally {
      setIsLoading(false);
    }
  };

  onMount(fetchShims);

  const handleAddShim = async (name: string, path: string, args: string) => {
    setIsProcessing(true);
    try {
      await invoke('add_shim', { args: { name, path, args } });
      await fetchShims();
      setIsAddModalOpen(false);
    } catch (err) {
      console.error(`Failed to add shim ${name}:`, err);
      // Optionally, set an error message to display to the user
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveShim = async (shimName: string) => {
    setIsProcessing(true);
    try {
      await invoke('remove_shim', { shimName });
      await fetchShims();
      setSelectedShim(null);
    } catch (err) {
      console.error(`Failed to remove shim ${shimName}:`, err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAlterShim = async (shimName: string) => {
    setIsProcessing(true);
    try {
      await invoke('alter_shim', { shimName });
      await fetchShims();

      const currentlySelected = selectedShim();
      if (currentlySelected && currentlySelected.name === shimName) {
        const newShims = allShims();
        const updatedShim = newShims.find((s) => s.name === shimName);
        setSelectedShim(updatedShim || null);
      } else {
        setSelectedShim(null);
      }
    } catch (err) {
      console.error(`Failed to alter shim ${shimName}:`, err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card
      title={t('doctor.shimManager.title')}
      icon={Layers2}
      onRefresh={fetchShims}
      headerAction={
        <div class="flex items-center gap-2">
          <Show when={allShims().length > 0}>
            <button
              class="btn btn-ghost btn-sm"
              onClick={() => setIsAddModalOpen(true)}
              disabled={isLoading() || isProcessing()}
            >
              <Plus class="h-4 w-4" /> {t('doctor.shimManager.addShim')}
            </button>
            <div class="divider divider-horizontal m-1" />
          </Show>
          <Show when={shimsDirectory()}>
            <OpenPathButton
              path={shimsDirectory()}
              validatePath={true}
              showErrorToast={true}
              tooltip={t('doctor.shimManager.openShimDirectory')}
            />
          </Show>
        </div>
      }
      description=""
    >
      <input
        type="text"
        placeholder={t('doctor.shimManager.filterPlaceholder')}
        class="input input-bordered mt-2 mb-4 w-full"
        value={filter()}
        onInput={(e) => setFilter(e.currentTarget.value)}
        disabled={isLoading() || !!error() || allShims().length === 0}
      />

      <div class="bg-base-list max-h-[60vh] overflow-y-auto rounded-lg">
        <Show when={error()}>
          <div role="alert" class="alert alert-error">
            <TriangleAlert />
            <span>{error()}</span>
          </div>
        </Show>

        <Show when={!isLoading() && allShims().length === 0 && !error()}>
          <div class="p-8 text-center">
            <Inbox class="text-base-content/30 mx-auto h-16 w-16" />
            <p class="mt-4 text-lg font-semibold">{t('doctor.shimManager.noShimsFound')}</p>
          </div>
        </Show>

        <Show when={filteredShims().length > 0}>
          <div class="overflow-x-auto">
            {/* TODO: sticky header, cant figure it out for the life of me */}
            <table class="table-sm table">
              <thead>
                <tr>
                  <th>{t('doctor.shimManager.name')}</th>
                  <th>{t('doctor.shimManager.sourcePackage')}</th>
                  <th>{t('doctor.shimManager.attributes')}</th>
                </tr>
              </thead>
              <tbody>
                <For each={filteredShims()}>
                  {(item) => (
                    <tr class="hover cursor-pointer" onClick={() => setSelectedShim(item)}>
                      <td class="font-mono text-sm">{item.name}</td>
                      <td>
                        <div class="flex items-center gap-2">
                          <Link class="text-base-content/60 h-4 w-4" />
                          {item.source}
                        </div>
                      </td>
                      <td>
                        <div class="flex gap-2">
                          <Show when={item.isHidden}>
                            <div class="badge badge-ghost gap-1">
                              <EyeOff class="h-3 w-3" />
                              {t('doctor.shimManager.hidden')}
                            </div>
                          </Show>
                          <Show when={item.args}>
                            <div class="badge badge-accent gap-1">
                              <BookText class="h-3 w-3" />
                              {t('doctor.shimManager.args')}
                            </div>
                          </Show>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        <ShimDetailsModal
          isOpen={!!selectedShim()}
          shim={selectedShim()!}
          onClose={() => setSelectedShim(null)}
          onRemove={handleRemoveShim}
          onAlter={handleAlterShim}
          isOperationRunning={isProcessing()}
        />

        <AddShimModal
          isOpen={isAddModalOpen()}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddShim}
          isOperationRunning={isProcessing()}
        />
      </div>
    </Card>
  );
}

export default ShimManager;
