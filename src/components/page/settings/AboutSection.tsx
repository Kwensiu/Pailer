import { Download, RefreshCw, Github, MessagesSquare, CircleDot } from 'lucide-solid';
import { createSignal } from 'solid-js';
import { openUrl } from '@tauri-apps/plugin-opener';
import pkgJson from '../../../../package.json';
import { t } from '../../../i18n';
import UpdateModal from './UpdateModal';
import { updateStore } from '../../../stores/updateStore';
import settingsStore from '../../../stores/settings';

export interface AboutSectionRef {
  checkForUpdates: (manual: boolean) => Promise<void>;
}

export interface AboutSectionProps {
  isScoopInstalled?: boolean;
}

export default function AboutSection(props: AboutSectionProps) {
  const { settings, setUpdateSettings } = settingsStore;

  // UpdateModal state
  const [showUpdateModal, setShowUpdateModal] = createSignal(false);

  // Simple event handlers that delegate to updateStore
  const handleCheckUpdates = async (manual: boolean) => {
    await updateStore.checkForUpdates(manual);
  };

  const handleInstallUpdate = async () => {
    setShowUpdateModal(false);
    await updateStore.installUpdate();
  };

  const handleCloseModal = () => {
    setShowUpdateModal(false);
    // Dismiss update notification for current session
    updateStore.dismissUpdate();
  };

  const handleModalClosed = () => {
    // Ensure modal state is closed
    setShowUpdateModal(false);
  };

  return (
    <div class="card bg-base-200 border-base-300 overflow-hidden border shadow-xs">
      {/* Hero Section */}
      <div class="bg-base-300 flex flex-col items-center space-y-2 p-8 text-center">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">Pailer</h2>
          <p class="text-base-content/60 font-medium">v{pkgJson.version}</p>
        </div>
        <p class="mt-2 max-w-md leading-relaxed">{t('settings.about.description')}</p>
        <p class="text-base-content/60 text-sm">{t('settings.about.customizedVersion')}</p>
      </div>

      <div class="card-body bg-base-100 space-y-4 p-6">
        {/* Update Section */}
        <div class="bg-base-200 border-base-content/5 rounded-xl border p-3 shadow-sm">
          <div class="flex min-h-[36px] items-center justify-between">
            <div class="flex items-center gap-2 font-semibold">
              <RefreshCw class="text-base-content/70 h-4 w-4" />
              {t('settings.about.updateStatus')}
            </div>
            <div class="flex items-center">
              {props.isScoopInstalled && (
                <span class="badge badge-sm badge-info badge-outline mr-2">
                  {t('settings.about.managedByScoop')}
                </span>
              )}
              {!props.isScoopInstalled && (
                <>
                  <div class="tooltip tooltip-left" data-tip={t('settings.about.checkNow')}>
                    <button
                      class="btn btn-circle btn-xs mr-2"
                      onClick={() => handleCheckUpdates(true)}
                      disabled={updateStore.getUpdateStatus() === 'checking'}
                    >
                      {updateStore.getUpdateStatus() === 'checking' ? (
                        <span class="loading loading-spinner loading-xs"></span>
                      ) : (
                        <RefreshCw class="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div class="tooltip tooltip-left" data-tip={t('settings.about.autoCheckTooltip')}>
                    <button
                      class={`btn btn-xs btn-ghost ${settings.update.autoCheckEnabled ? 'bg-base-100 dark:bg-green-400/50' : 'btn-soft text-black/40 dark:bg-black/30 dark:text-white/30'}`}
                      onClick={() =>
                        setUpdateSettings({ autoCheckEnabled: !settings.update.autoCheckEnabled })
                      }
                    >
                      {t('settings.about.autoCheck')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {props.isScoopInstalled ? (
            <div class="alert alert-info text-sm shadow-sm">
              <span>
                {t('settings.about.scoopUpdateInstruction', { code: 'scoop update pailer' })}
              </span>
            </div>
          ) : (
            <div class="space-y-4">
              {updateStore.getUpdateStatus() === 'available' && (
                <div class="animate-in fade-in slide-in-from-top-2 space-y-3 pt-2">
                  <div class="alert alert-success shadow-sm">
                    <Download class="h-5 w-5" />
                    <div>
                      <h3 class="font-bold">{t('settings.about.updateAvailable')}</h3>
                      <div class="text-xs">
                        {t('settings.about.updateReady', {
                          version: updateStore.getUpdateInfo()?.version || 'unknown',
                        })}
                      </div>
                    </div>
                    <button
                      class="btn btn-sm btn-soft bg-base-100"
                      onClick={() => setShowUpdateModal(true)}
                    >
                      {t('buttons.view')}
                    </button>
                  </div>
                </div>
              )}

              {updateStore.getUpdateStatus() === 'downloading' && (
                <div class="space-y-2">
                  <div class="flex justify-between text-xs font-medium">
                    <span>{t('settings.about.downloadingUpdate')}</span>
                    <span>
                      {updateStore.getDownloadProgress().total
                        ? `${Math.round((updateStore.getDownloadProgress().downloaded / (updateStore.getDownloadProgress().total || 1)) * 100)}%`
                        : t('settings.about.downloadingNoSize')}
                    </span>
                  </div>
                  <progress
                    class="progress progress-primary w-full"
                    value={updateStore.getDownloadProgress().downloaded}
                    max={updateStore.getDownloadProgress().total || undefined}
                  />
                </div>
              )}

              {updateStore.getUpdateStatus() === 'installing' && (
                <div class="text-success flex items-center justify-center py-2 font-medium">
                  <span class="loading loading-spinner loading-sm mr-3"></span>
                  {t('settings.about.installingUpdate')}
                </div>
              )}

              {updateStore.getUpdateStatus() === 'error' && (
                <div class="alert alert-error rounded-lg shadow-sm">
                  <div class="flex-1">
                    <div class="text-xs font-bold">{t('settings.about.updateFailed')}</div>
                    <div class="text-xs opacity-80">{updateStore.getUpdateError()}</div>
                  </div>
                  <button class="btn btn-xs btn-outline" onClick={() => handleCheckUpdates(true)}>
                    {t('settings.about.retry')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Links */}
        <div class="grid grid-cols-1 gap-4 p-1 sm:grid-cols-3">
          <button
            class="btn btn-outline btn-primary hover:bg-primary hover:text-base-100 transition-all"
            onClick={() => openUrl('https://github.com/Kwensiu/Pailer').catch(console.error)}
          >
            <Github class="h-5 w-5" />
            {t('settings.about.goToProject')}
          </button>
          <button
            class="btn btn-outline hover:bg-base-content hover:text-base-100 transition-all"
            onClick={() => openUrl('https://github.com/Kwensiu/Pailer/issues').catch(console.error)}
          >
            <CircleDot class="h-5 w-5" />
            {t('settings.about.submitIssue')}
          </button>

          <button
            class="btn btn-outline btn-info hover:text-info-content transition-all"
            onClick={() =>
              openUrl('https://github.com/Kwensiu/Pailer/discussions').catch(console.error)
            }
          >
            <MessagesSquare class="h-5 w-5" />
            {t('settings.about.joinDiscussion')}
          </button>
        </div>

        {/* Footer */}
        <div class="text-base-content/30 text-center text-xs">
          <p>Copyright © {new Date().getFullYear()} Kwensiu. MIT License.</p>
        </div>
      </div>

      {/* Update Modal */}
      <UpdateModal
        isOpen={showUpdateModal()}
        onClose={handleModalClosed}
        onCancel={handleCloseModal}
        updateInfo={updateStore.getUpdateInfo()!}
        onInstall={handleInstallUpdate}
        isDownloading={updateStore.getUpdateStatus() === 'downloading'}
        downloadProgress={updateStore.getDownloadProgress()}
        releaseNotesHtml={updateStore.getReleaseNotesHtml()}
      />
    </div>
  );
}
