import { createSignal, onMount, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Settings, Folder, Edit } from 'lucide-solid';
import Card from '../../common/Card';
import Modal from '../../common/Modal';
import { t } from '../../../i18n';
import { createLocalStorageSignal } from '../../../hooks/createLocalStorageSignal';
import settingsStore from '../../../stores/settings';

interface ScoopConfig {
  [key: string]: any;
}

// Type for the actual data returned by Tauri
type ScoopConfigMap = Record<string, any>;

export interface ScoopInfoProps {
  onOpenDirectory?: () => void;
}

function ScoopInfo(props: ScoopInfoProps) {
  const [scoopPath, setScoopPath] = createSignal<string | null>(null);
  // Use localStorage to persist config data
  const [scoopConfig, setScoopConfig] = createLocalStorageSignal<ScoopConfig | null>(
    'scoopConfig',
    null
  );
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = createSignal(false);
  const [editConfig, setEditConfig] = createSignal<string>('');
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  const { settings } = settingsStore;
  const isDark = () => settings.theme === 'dark';
  const codeBgColor = () => (isDark() ? '#282c34' : '#f0f4f9');

  const fetchScoopInfo = async (silent: boolean = false) => {
    if (!silent) {
      setIsLoading(true);
    } else {
      // For silent mode, if currently loading, set to false first
      if (isLoading()) {
        setIsLoading(false);
      }
    }
    setError(null);

    try {
      // Get Scoop path
      const path = await invoke<string | null>('get_scoop_path');
      setScoopPath(path);

      // Get Scoop configuration
      const config = await invoke<ScoopConfigMap | null>('get_scoop_config');

      // Update config
      setScoopConfig(config);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch scoop info:', errorMsg);
      setError('Could not load Scoop information.');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  onMount(() => {
    // Enable automatic silent refresh to avoid flickering
    fetchScoopInfo(true);
  });

  const openEditModal = () => {
    const config = scoopConfig();
    if (config) {
      setEditConfig(JSON.stringify(config, null, 2));
      setSaveError(null);
      setIsEditModalOpen(true);
    }
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditConfig('');
    setSaveError(null);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const config = JSON.parse(editConfig());
      await invoke('update_scoop_config', { config });

      // Refresh the config after saving
      await fetchScoopInfo(true); // Silent refresh

      closeEditModal();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to save scoop config:', errorMsg);
      setSaveError('Failed to save configuration: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card
        title={t('doctor.scoopInfo.title')}
        icon={Settings}
        headerAction={
          <div class="flex items-center gap-2">
            <Show when={scoopConfig()}>
              <button
                class="btn btn-ghost btn-sm"
                onClick={openEditModal}
                title={t('doctor.scoopInfo.editConfiguration')}
              >
                <Edit class="h-5 w-5" />
              </button>
            </Show>
            <Show when={props.onOpenDirectory && scoopPath()}>
              <button
                class="btn btn-ghost btn-sm"
                onClick={props.onOpenDirectory}
                title={t('doctor.scoopInfo.openScoopDirectory')}
              >
                <Folder class="h-5 w-5" />
              </button>
            </Show>

            <button
              class="btn btn-ghost btn-sm"
              onClick={() => fetchScoopInfo()}
              disabled={isLoading()}
            >
              <RefreshCw class="h-5 w-5" classList={{ 'animate-spin': isLoading() }} />
            </button>
          </div>
        }
      >
        {isLoading() ? (
          <div class="flex h-32 items-center justify-center">
            <div class="loading loading-spinner loading-md"></div>
          </div>
        ) : error() ? (
          <div class="alert alert-error">
            <span>{error()}</span>
          </div>
        ) : (
          <div class="space-y-4">
            <div>
              {scoopConfig() ? (
                <div class="bg-base-300 overflow-x-auto rounded-lg p-4 text-sm">
                  <For each={Object.entries(scoopConfig()!)}>
                    {([key, value]) => (
                      <div class="border-base-100 flex border-b py-1 last:border-0">
                        <span class="text-primary mr-2 min-w-[150px] font-mono font-bold">
                          {key}:
                        </span>
                        <span class="font-mono">
                          {typeof value === 'object'
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              ) : (
                <p class="ml-2">{t('doctor.scoopInfo.noConfigurationFound')}</p>
              )}
            </div>
          </div>
        )}
      </Card>
      {/* --- Editer Modal --- */}
      <Modal
        isOpen={isEditModalOpen()}
        onClose={closeEditModal}
        title={t('doctor.scoopInfo.editScoopConfiguration')}
        animation="scale"
        footer={
          <div class="flex justify-end gap-2">
            <button class="btn btn-error" onClick={closeEditModal}>
              {t('doctor.scoopInfo.cancel')}
            </button>
            <button class="btn btn-primary" onClick={saveConfig} disabled={isSaving()}>
              {isSaving() ? t('doctor.scoopInfo.saving') : t('doctor.scoopInfo.save')}
            </button>
          </div>
        }
        class="max-w-2xl"
      >
        <div
          class="border-base-content/10 group relative overflow-hidden rounded-xl border shadow-inner"
          style={{ 'background-color': codeBgColor() }}
        >
          <textarea
            class="h-64 w-full resize-none border-none bg-transparent! p-4 font-mono text-sm leading-relaxed outline-none"
            value={editConfig()}
            onInput={(e) => setEditConfig(e.target.value)}
          />
        </div>
        <Show when={saveError()}>
          <div class="alert alert-error mt-4">
            <span>{saveError()}</span>
          </div>
        </Show>
      </Modal>
    </>
  );
}

export default ScoopInfo;
