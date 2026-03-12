import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Trash2, TriangleAlert, Folder, GitBranch } from 'lucide-solid';
import ConfirmationModal from '../../modals/ConfirmationModal';
import Card from '../../common/Card';
import OpenPathButton from '../../common/OpenPathButton';
import { ResponsiveButton } from '../../common/ResponsiveButton';
import { toast } from '../../common/ToastAlert';
import { t } from '../../../i18n';

interface VersionedApp {
  name: string;
  currentVersion: string;
  localVersions: string[];
  bucket: string;
  isVersionedInstall?: boolean;
}

function VersionedAppsManager() {
  const [versionedApps, setVersionedApps] = createSignal<VersionedApp[]>([]);
  const [filter, setFilter] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [appsDirectory, setAppsDirectory] = createSignal<string>('');
  const [preserveVersionedInstalls, setPreserveVersionedInstalls] = createSignal(true);

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

    // 过滤：只显示有多个版本的，或者是真正的版本化安装
    apps = apps.filter((app) => app.localVersions.length > 1 || app.isVersionedInstall);

    if (!f) return apps;
    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(f) ||
        app.currentVersion.toLowerCase().includes(f) ||
        app.localVersions.some((v) => v.toLowerCase().includes(f))
    );
  });

  const fetchVersionedApps = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 检查Scoop路径是否存在
      const scoopPath = await invoke<string | null>('get_scoop_path');
      if (!scoopPath) {
        setError('No Scoop path configured. Please configure it in settings.');
        setAppsDirectory('');
        return;
      }

      const pathExists = await invoke<boolean>('path_exists', { path: scoopPath });
      if (!pathExists) {
        setError(`Configured Scoop path does not exist: ${scoopPath}`);
        setAppsDirectory('');
        return;
      }

      // 获取版本化安装的应用
      const appsData = await invoke<VersionedApp[]>('get_versioned_apps');
      setVersionedApps(appsData);
      setAppsDirectory(`${scoopPath}\\apps`);
    } catch (err) {
      console.error('Failed to fetch versioned apps:', err);
      setError(
        typeof err === 'string' ? err : 'An unknown error occurred while fetching versioned apps.'
      );
      setAppsDirectory('');
    } finally {
      setIsLoading(false);
    }
  };

  onMount(fetchVersionedApps);

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
          await fetchVersionedApps();
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
        } finally {
          setIsLoading(false);
          setIsConfirmModalOpen(false);
        }
      },
      onDelete: async () => {
        setIsLoading(true);
        try {
          await invoke('delete_app_version', { appName: appName, version: targetVersion });
          await fetchVersionedApps();
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
        <div class="space-y-4">
          <p>{t('doctor.versionedApps.cleanupAllOldVersionsWarning')}</p>
          <div class="form-control">
            <label class="label cursor-pointer">
              <input
                type="checkbox"
                class="checkbox checkbox-primary"
                checked={preserveVersionedInstalls()}
                onChange={(e) => setPreserveVersionedInstalls(e.currentTarget.checked)}
              />
              <span class="label-text">{t('doctor.versionedApps.preserveVersionedInstalls')}</span>
            </label>
          </div>
          <div class="status-alert status-alert-info">
            <TriangleAlert class="h-4 w-4" />
            <span>{t('doctor.versionedApps.cleanupAllOldVersionsInfo')}</span>
          </div>
        </div>
      ),
      onConfirm: async () => {
        setIsLoading(true);
        try {
          await invoke('cleanup_all_apps_smart', {
            preserve_versioned: preserveVersionedInstalls(),
          });
          await fetchVersionedApps();
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
        icon={GitBranch}
        onRefresh={fetchVersionedApps}
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
                                .filter((v) => v !== app.currentVersion)
                                .sort((a, b) => b.localeCompare(a))}
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
