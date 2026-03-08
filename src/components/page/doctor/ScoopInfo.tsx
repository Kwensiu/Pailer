import { createSignal, onMount, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Settings, Edit } from 'lucide-solid';
import Card from '../../common/Card';
import Modal from '../../common/Modal';
import OpenPathButton from '../../common/OpenPathButton';
import { t } from '../../../i18n';
import settingsStore from '../../../stores/settings';
import { createSessionCache } from '../../../hooks/createSessionStorage';

interface ScoopConfig {
  [key: string]: any;
}

// Type for the actual data returned by Tauri
type ScoopConfigMap = Record<string, any>;

export interface ScoopInfoProps {
  onOpenDirectory?: () => void;
}

function ScoopInfo() {
  // Combined cache for both config and directory - simple and single source of truth
  const { data: scoopData, loading, error, refresh, updateData } = createSessionCache<{
    config: ScoopConfig | null;
    directory: string | null;
  }>(
    'scoopData',
    async () => {
      const config = await invoke<ScoopConfigMap | null>('get_scoop_config');
      let directory = null;
      
      if (config) {
        try {
          directory = await invoke<string>('get_scoop_config_directory');
        } catch (err) {
          console.warn('Failed to get config directory:', err);
        }
      }
      
      return { config, directory };
    }
  );
  const [isEditModalOpen, setIsEditModalOpen] = createSignal(false);
  const [editConfig, setEditConfig] = createSignal<string>('');
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  const { settings } = settingsStore;
  const isDark = () => settings.theme === 'dark';
  const codeBgColor = () => (isDark() ? '#282c34' : '#f0f4f9');

  const fetchScoopInfo = async (silent: boolean = false) => {
    if (!silent) {
      // Use hook's refresh for manual refresh
      refresh();
    }

    try {
      // Get configured Scoop path first
      const configuredPath = await invoke<string | null>('get_scoop_path');

      if (!configuredPath) {
        console.error('No Scoop path configured. Please configure it in settings.');
        return;
      }

      // Check if the configured path exists
      const pathExists = await invoke<boolean>('path_exists', { path: configuredPath });
      if (!pathExists) {
        // Update hook's data to null when path doesn't exist
        updateData({ config: null, directory: null });
        return;
      }

      // Config directory is now handled by its own cache
      console.log('Scoop config loaded via hook');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch scoop info:', errorMsg);
      // Hook handles error state automatically
    }
  };

  onMount(() => {
    // Both scoopConfig and configDirectory are now handled by their respective caches
    // No need to manually fetch anything
  });

  const openEditModal = () => {
    const config = scoopData()?.config;
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
      const newConfig = JSON.parse(editConfig());
      await invoke('update_scoop_config', { config: newConfig });

      // Update hook's data directly
      const currentData = scoopData() || { config: null, directory: null };
      updateData({ ...currentData, config: newConfig });

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
        onRefresh={() => fetchScoopInfo()}
        headerAction={
          <div class="flex items-center gap-2">
            <Show when={scoopData()?.config}>
              <button
                class="btn btn-ghost btn-sm"
                onClick={openEditModal}
                title={t('doctor.scoopInfo.editConfiguration')}
              >
                <Edit class="h-5 w-5" />
              </button>
            </Show>
            <OpenPathButton
              path={scoopData()?.directory || ''}
              validatePath={true}
              showErrorToast={true}
              tooltip={scoopData()?.directory ? t('doctor.scoopInfo.openConfigDirectory') : 'Loading configuration directory...'}
              size="sm"
              disabled={!scoopData()?.directory}
            />
          </div>
        }
      >
        {loading() ? (
          <div class="flex h-32 items-center justify-center">
            <div class="loading loading-spinner loading-md"></div>
          </div>
        ) : error() ? (
          <div class="status-alert status-alert-error">
            <span>{error()}</span>
          </div>
        ) : (
          <div class="space-y-4">
            <div>
              {scoopData()?.config ? (
                <div class="bg-base-list overflow-x-auto rounded-lg p-4 text-sm">
                  <For each={Object.entries(scoopData()!.config!)}>
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
