import { createSignal, For, Show, createMemo, createEffect, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Trash2, TriangleAlert, Folder, GalleryVerticalEnd } from 'lucide-solid';
import ConfirmationModal from '../../modals/ConfirmationModal';
import Card from '../../common/Card';
import OpenPathButton from '../../common/OpenPathButton';
import { ResponsiveButton } from '../../common/ResponsiveButton';
import { toast } from '../../common/ToastAlert';
import { t } from '../../../i18n';
import { createSessionStorage, invalidateCache } from '../../../hooks';

interface VersionedAppsData {
  apps: VersionedApp[];
  directory: string;
}

interface VersionedApp {
  name: string;
  currentVersion: string;
  localVersions: string[];
  bucket: string;
  isVersionedInstall?: boolean;
}

function VersionedAppsManager() {
  const [filter, setFilter] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [preserveVersionedInstalls, setPreserveVersionedInstalls] = createSignal(true);

  // Session cache for versioned apps data
  const {
    data: versionedAppsData,
    loading: dataLoading,
    error: dataError,
    refresh: refreshVersionedApps,
    onInvalidate,
  } = createSessionStorage<VersionedAppsData>('versionedAppsData', async () => {
    const scoopPath = await invoke<string | null>('get_scoop_path');
    if (!scoopPath) {
      throw new Error('No Scoop path configured. Please configure it in settings.');
    }

    const pathExists = await invoke<boolean>('path_exists', { path: scoopPath });
    if (!pathExists) {
      throw new Error(`Configured Scoop path does not exist: ${scoopPath}`);
    }

    const appsData = await invoke<VersionedApp[]>('get_versioned_apps');
    const appsDirectory = `${scoopPath}\\apps`;

    return {
      apps: appsData,
      directory: appsDirectory,
    };
  });

  const forceRefresh = () => {
    sessionStorage.removeItem('versionedAppsData');
    return refreshVersionedApps();
  };

  // Computed values from cache data
  const versionedApps = () => versionedAppsData()?.apps || [];
  const appsDirectory = () => versionedAppsData()?.directory || '';

  // Sync loading state with cache loading
  createEffect(() => {
    setIsLoading(dataLoading());
    setError(dataError());
  });

  // State for the confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = createSignal(false);
  const [confirmationDetails, setConfirmationDetails] = createSignal({
    title: '',
    content: null as any,
    type: 'default' as 'default' | 'version-management' | 'cleanup-all-versions',
    onConfirm: () => {},
    onDelete: () => {},
  });

  const filteredVersionedApps = createMemo(() => {
    const f = filter().toLowerCase();
    let apps = versionedApps();

    // Filter: only show apps with multiple versions or true versioned installations
    apps = apps.filter(
      (app: VersionedApp) => app.localVersions.length > 1 || app.isVersionedInstall
    );

    if (!f) return apps;
    return apps.filter(
      (app: VersionedApp) =>
        app.name.toLowerCase().includes(f) ||
        app.currentVersion.toLowerCase().includes(f) ||
        app.localVersions.some((v: string) => v.toLowerCase().includes(f))
    );
  });

  onMount(() => {
    console.log('VersionedAppsManager mounted - data should be preloaded');
    // Data is preloaded on app cold start, so we don't force refresh on mount
    // The createSessionCache will use the cached data if available
    // Only trigger refresh if cache is empty
    if (!versionedAppsData()) {
      console.log('VersionedAppsManager: no cached data, fetching...');
      refreshVersionedApps();
    } else {
      console.log('VersionedAppsManager: using cached data');
    }

    // Listen for cache invalidation events
    const unsubscribe = onInvalidate(() => {
      console.log('Version operation detected, forcing immediate refresh');
      forceRefresh();
    });

    return unsubscribe;
  });

  const handleSwitchVersion = (appName: string, targetVersion: string) => {
    setConfirmationDetails({
      title: t('doctor.versionedApps.selectAction'),
      type: 'version-management',
      content: (
        <div class="space-y-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <span class="text-lg font-semibold">{appName}</span>
            <span class="text-base-content/60">-</span>
            <span class="badge badge-soft badge-lg">{targetVersion}</span>
          </div>
        </div>
      ),
      onConfirm: async () => {
        setIsLoading(true);
        try {
          await invoke('switch_app_version', {
            appName: appName,
            targetVersion: targetVersion,
          });

          invalidateCache('versionedAppsData');

          // Force refresh to ensure UI updates immediately (consistent with delete behavior)
          await refreshVersionedApps();

          toast.success(
            t('doctor.versionedApps.switchVersionSuccess', { appName, version: targetVersion })
          );
        } catch (err) {
          console.error('Failed to switch app version:', err);
          const errorMsg =
            typeof err === 'string' ? err : 'An unknown error occurred while switching version.';

          toast.error(
            t('doctor.versionedApps.switchVersionError', {
              appName,
              version: targetVersion,
              error: errorMsg,
            })
          );
          setError(errorMsg);
          // EventBus auto-handles errors
        } finally {
          setIsLoading(false);
          setIsConfirmModalOpen(false);
        }
      },
      onDelete: async () => {
        setIsLoading(true);
        try {
          await invoke('delete_app_version', { appName: appName, version: targetVersion });

          invalidateCache('versionedAppsData');

          // Force refresh to ensure UI updates immediately
          await refreshVersionedApps();

          toast.success(
            t('doctor.versionedApps.deleteVersionSuccess', { appName, version: targetVersion })
          );
        } catch (err) {
          console.error('Failed to delete app version:', err);
          const errorMsg =
            typeof err === 'string' ? err : 'An unknown error occurred while deleting version.';

          toast.error(
            t('doctor.versionedApps.deleteVersionError', {
              appName,
              version: targetVersion,
              error: errorMsg,
            })
          );
          setError(errorMsg);
        } finally {
          setIsLoading(false);
          setIsConfirmModalOpen(false);
        }
      },
    });

    setIsConfirmModalOpen(true);
  };

  const handleCleanupOldVersions = async () => {
    setConfirmationDetails({
      title: t('doctor.versionedApps.confirmCleanupAllOldVersions'),
      type: 'cleanup-all-versions',
      content: (
        <div class="space-y-2">
          <p class="text-base-content/80">
            {t('doctor.versionedApps.cleanupAllOldVersionsWarning')}
          </p>

          <div class="bg-base-200/60 border-base-300/60 rounded-lg border p-3">
            <label class="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                class="checkbox checkbox-primary mt-0.5"
                checked={preserveVersionedInstalls()}
                onChange={(e) => setPreserveVersionedInstalls(e.currentTarget.checked)}
              />
              <div class="flex flex-col text-sm">
                <span class="font-medium">
                  {t('doctor.versionedApps.preserveVersionedInstalls')}
                </span>
                <span class="text-base-content/60">
                  {t('doctor.versionedApps.cleanupAllOldVersionsInfo')}
                </span>
              </div>
            </label>
          </div>
        </div>
      ),
      onConfirm: async () => {
        setIsLoading(true);
        try {
          await invoke('cleanup_all_apps_smart', {
            preserve_versioned: preserveVersionedInstalls(),
          });
          await refreshVersionedApps();
          toast.success(t('doctor.versionedApps.cleanupAllOldVersionsSuccess'));
        } catch (err) {
          console.error('Failed to cleanup old versions:', err);
          const errorMsg =
            typeof err === 'string'
              ? err
              : 'An unknown error occurred while cleaning up old versions.';
          toast.error(t('doctor.versionedApps.cleanupAllOldVersionsError', { error: errorMsg }));
          setError(errorMsg);
        } finally {
          setIsLoading(false);
          setIsConfirmModalOpen(false);
        }
      },
      onDelete: () => {},
    });

    setIsConfirmModalOpen(true);
  };

  return (
    <>
      <Card
        title={t('doctor.versionedApps.title')}
        icon={GalleryVerticalEnd}
        onRefresh={forceRefresh}
        headerAction={
          <div class="flex items-center gap-2">
            <ResponsiveButton
              collapsedButtonWidth="3rem"
              breakpoint={771}
              menuItems={[
                {
                  label: () => t('doctor.cleanup.cleanupOldVersions'),
                  onClick: handleCleanupOldVersions,
                  disabled: () => isLoading(),
                  class: 'btn-warning',
                  icon: Trash2,
                },
              ]}
            >
              <button
                class="btn btn-warning btn-sm"
                onClick={handleCleanupOldVersions}
                disabled={isLoading()}
              >
                <Trash2 class="h-4 w-4" />
                {t('doctor.cleanup.cleanupOldVersions')}
              </button>
            </ResponsiveButton>
            <div class="divider divider-horizontal m-1" />
            <Show when={appsDirectory()}>
              <OpenPathButton
                path={appsDirectory()}
                validatePath={true}
                showErrorToast={true}
                tooltip={t('doctor.versionedApps.openAppsDirectory')}
              />
            </Show>
          </div>
        }
      >
        <input
          type="text"
          placeholder={t('doctor.versionedApps.filterPlaceholder')}
          class="input input-bordered mt-2 mb-4 w-full"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          disabled={isLoading() || !!error() || versionedApps().length === 0}
        />

        <div class="bg-base-list max-h-[60vh] overflow-y-auto rounded-lg">
          <Show when={error()}>
            <div role="alert" class="alert alert-error">
              <TriangleAlert />
              <span>{error()}</span>
            </div>
          </Show>

          <Show when={!isLoading() && versionedApps().length === 0 && !error()}>
            <div class="p-8 text-center">
              <Folder class="text-base-content/30 mx-auto h-16 w-16" />
              <p class="mt-4 text-lg font-semibold">{t('doctor.versionedApps.noVersionedApps')}</p>
              <p class="text-base-content/60">{t('doctor.versionedApps.noVersionedAppsDesc')}</p>
            </div>
          </Show>

          <Show when={versionedApps().length > 0}>
            <div class="overflow-x-auto">
              <table class="table-sm table">
                <thead>
                  <tr>
                    <th>{t('doctor.versionedApps.name')}</th>
                    <th>{t('doctor.versionedApps.bucket')}</th>
                    <th style="width: 120px;">{t('doctor.versionedApps.currentVersion')}</th>
                    <th>{t('doctor.versionedApps.localVersions')}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filteredVersionedApps()}>
                    {(app) => (
                      <tr class="hover">
                        <td>
                          <span class="font-medium">{app.name}</span>
                        </td>
                        <td>
                          <span class="badge badge-ghost badge-sm">{app.bucket}</span>
                        </td>
                        <td style="width: 120px;">
                          <span class="badge badge-primary badge-sm">{app.currentVersion}</span>
                        </td>
                        <td>
                          <div class="flex flex-wrap gap-1">
                            <For
                              each={app.localVersions
                                .filter((v: string) => v !== app.currentVersion)
                                .sort((a: string, b: string) => b.localeCompare(a))}
                            >
                              {(version) => (
                                <button
                                  class="btn btn-outline btn-xs"
                                  onClick={() => handleSwitchVersion(app.name, version)}
                                  disabled={isLoading()}
                                >
                                  {version}
                                </button>
                              )}
                            </For>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Card>

      <ConfirmationModal
        isOpen={isConfirmModalOpen()}
        title={confirmationDetails().title}
        confirmText={t('buttons.confirm')}
        type={confirmationDetails().type || 'default'}
        onConfirm={() => {
          confirmationDetails().onConfirm();
          setIsConfirmModalOpen(false);
        }}
        onCancel={() => setIsConfirmModalOpen(false)}
        onDelete={() => {
          confirmationDetails().onDelete();
          setIsConfirmModalOpen(false);
        }}
      >
        {confirmationDetails().content}
      </ConfirmationModal>
    </>
  );
}

export default VersionedAppsManager;
