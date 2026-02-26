import { Download, RefreshCw, Github, BookOpen } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import pkgJson from '../../../../package.json';
import { t } from '../../../i18n';
import { invoke } from '@tauri-apps/api/core';

export interface AboutSectionRef {
  checkForUpdates: (manual: boolean) => Promise<void>;
}

export interface AboutSectionProps {
  ref: (ref: AboutSectionRef) => void;
  isScoopInstalled?: boolean;
}

export default function AboutSection(props: AboutSectionProps) {
  const [updateStatus, setUpdateStatus] = createSignal<
    'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error'
  >('idle');
  const [updateInfo, setUpdateInfo] = createSignal<Update | null>(null);
  const [updateError, setUpdateError] = createSignal<string | null>(null);
  const [downloadProgress, setDownloadProgress] = createSignal<{
    downloaded: number;
    total: number | null;
  }>({ downloaded: 0, total: null });

  const checkForUpdates = async (manual: boolean) => {
    try {
      // Don't check for updates if installed via Scoop
      if (props.isScoopInstalled) {
        if (manual) {
          await message(t('settings.about.updateViaScoop'), {
            title: t('settings.about.updatesViaScoop'),
            kind: 'info',
          });
        }
        return;
      }

      setUpdateStatus('checking');
      setUpdateError(null);

      console.log('Checking for updates...');

      // Try to check for updates using Tauri updater
      const update = await check();
      console.log('Update check completed', {
        updateAvailable: !!update?.available,
        version: update?.version,
      });

      if (update?.available) {
        setUpdateStatus('available');
        setUpdateInfo(update);
        console.log('Update found', {
          version: update.version,
          body: update.body,
        });

        // Only show dialog if user manually clicked "Check for updates"
        if (manual) {
          const versionText = update.version;
          const bodyText = update.body || t('settings.about.noReleaseNotes');

          const messageContent = t('settings.about.updateAvailableDialog', {
            version: versionText,
            body: bodyText,
          });

          const shouldInstall = await ask(messageContent, {
            title: t('settings.about.updateAvailable'),
            kind: 'info',
            okLabel: t('buttons.install'),
            cancelLabel: t('buttons.cancel'),
          });

          if (shouldInstall) {
            await installAvailableUpdate();
          }
        }
      } else {
        setUpdateStatus('idle');
        if (manual) {
          const currentVersion = await invoke<string>('get_current_version');
          await message(t('settings.about.latestVersion', { version: currentVersion }), {
            title: t('settings.about.noUpdatesAvailable'),
            kind: 'info',
          });
        }
        console.log('No updates available');
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setUpdateStatus('error');

      // Simple error message
      const errorMessage =
        error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200);
      setUpdateError(errorMessage);

      // Show error to user if manually checking
      if (manual) {
        await message(errorMessage, {
          title: t('settings.about.updateFailed'),
          kind: 'error',
        });
      }
    }
  };

  const installAvailableUpdate = async () => {
    try {
      const currentUpdateInfo = updateInfo();
      if (!currentUpdateInfo) {
        throw new Error('No update information available');
      }

      setUpdateStatus('downloading');
      setDownloadProgress({ downloaded: 0, total: null });
      console.log('Starting update download...', { version: currentUpdateInfo.version });

      await currentUpdateInfo.downloadAndInstall((progress) => {
        console.log('Update progress event:', progress.event, progress);

        if (progress.event === 'Started') {
          console.log('Download started', { contentLength: progress.data.contentLength });
          setDownloadProgress({
            downloaded: 0,
            total: progress.data.contentLength || null,
          });
        } else if (progress.event === 'Progress') {
          const newDownloaded = progress.data.chunkLength || 0;

          setDownloadProgress((prev) => {
            const updatedDownloaded = prev.downloaded + newDownloaded;
            return {
              downloaded: updatedDownloaded,
              total: prev.total,
            };
          });

          const currentProgress = downloadProgress();
          const percent = currentProgress.total
            ? Math.round(
                ((currentProgress.downloaded + newDownloaded) / currentProgress.total) * 100
              )
            : undefined;

          if (percent !== undefined) {
            console.log(
              `Download progress: ${percent}% (${currentProgress.downloaded + newDownloaded} bytes)`
            );
          }
        } else if (progress.event === 'Finished') {
          console.log('Download finished, starting installation...');
          setUpdateStatus('installing');
        }
      });

      console.log('Update installation completed successfully');

      const confirmed = await ask(t('settings.about.updateComplete'), {
        title: t('buttons.confirm'),
        kind: 'info',
        okLabel: t('settings.about.restartNow'),
        cancelLabel: t('buttons.later'),
      });

      if (confirmed) {
        console.log('User confirmed restart, relaunching application...');
        await relaunch();
      } else {
        console.log('User postponed restart');
        setUpdateStatus('idle');
      }
    } catch (error) {
      console.error('Failed to install update:', error);
      setUpdateStatus('error');

      const errorMessage =
        error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200);
      setUpdateError(errorMessage);
      console.error('Update installation error details:', errorMessage);
    }
  };

  props.ref({ checkForUpdates });

  return (
    <div class="card bg-base-200 overflow-hidden shadow-xl">
      {/* Hero Section */}
      <div class="bg-base-300 flex flex-col items-center space-y-4 p-8 text-center">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">Pailer</h2>
          <p class="text-base-content/60 font-medium">v{pkgJson.version}</p>
        </div>
        <p class="max-w-md leading-relaxed">{t('settings.about.description')}</p>
        <p class="text-base-content/60 mt-2 text-sm">{t('settings.about.customizedVersion')}</p>
        <p class="text-base-content/60 text-sm">{t('settings.about.pleaseReportIssues')}</p>
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
              {updateStatus() === 'idle' && !props.isScoopInstalled && (
                <button class="btn btn-sm btn-primary" onClick={() => checkForUpdates(true)}>
                  {t('settings.about.checkNow')}
                </button>
              )}
              {updateStatus() === 'checking' && (
                <div class="text-base-content/70 flex min-h-[36px] items-center justify-center py-1">
                  <span class="loading loading-spinner loading-sm mr-2"></span>
                  {t('settings.about.checkingForUpdates')}
                </div>
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
              {updateStatus() === 'available' && (
                <div class="animate-in fade-in slide-in-from-top-2 space-y-3">
                  <div class="alert alert-success shadow-sm">
                    <Download class="h-5 w-5" />
                    <div>
                      <h3 class="font-bold">{t('settings.about.updateAvailable')}</h3>
                      <div class="text-xs">
                        {t('settings.about.updateReady', {
                          version: updateInfo()?.version || 'unknown',
                        })}
                      </div>
                    </div>
                    <button class="btn btn-sm" onClick={installAvailableUpdate}>
                      {t('buttons.install')}
                    </button>
                  </div>
                  <Show when={updateInfo()?.body}>
                    <div class="bg-base-200 border-base-content/5 max-h-32 overflow-y-auto rounded-lg border p-3 text-xs">
                      <div class="mb-1 font-bold opacity-70">
                        {t('settings.about.releaseNotes')}
                      </div>
                      <div class="whitespace-pre-wrap opacity-80">{updateInfo()?.body || ''}</div>
                    </div>
                  </Show>
                </div>
              )}

              {updateStatus() === 'downloading' && (
                <div class="space-y-2">
                  <div class="flex justify-between text-xs font-medium">
                    <span>{t('settings.about.downloadingUpdate')}</span>
                    <span>
                      {downloadProgress().total
                        ? `${Math.round((downloadProgress().downloaded / (downloadProgress().total || 1)) * 100)}%`
                        : t('settings.about.downloadingNoSize')}
                    </span>
                  </div>
                  <progress
                    class="progress progress-primary w-full"
                    value={downloadProgress().downloaded}
                    max={downloadProgress().total || undefined}
                  />
                </div>
              )}

              {updateStatus() === 'installing' && (
                <div class="text-success flex items-center justify-center py-2 font-medium">
                  <span class="loading loading-spinner loading-sm mr-3"></span>
                  {t('settings.about.installingUpdate')}
                </div>
              )}

              {updateStatus() === 'error' && (
                <div class="alert alert-error rounded-lg shadow-sm">
                  <div class="flex-1">
                    <div class="text-xs font-bold">{t('settings.about.updateFailed')}</div>
                    <div class="text-xs opacity-80">{updateError()}</div>
                  </div>
                  <button class="btn btn-xs btn-outline" onClick={() => checkForUpdates(true)}>
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
            class="btn btn-outline hover:bg-base-content hover:text-base-100 transition-all"
            onClick={() => openUrl('https://github.com/Kwensiu/Pailer/').catch(console.error)}
          >
            <Github class="h-5 w-5" />
            {t('settings.about.myFork')}
          </button>
          <button
            class="btn btn-outline hover:bg-base-content hover:text-base-100 transition-all"
            onClick={() => openUrl('https://github.com/AmarBego/Rscoop').catch(console.error)}
          >
            <Github class="h-5 w-5" />
            {t('settings.about.upstream')}
          </button>

          <button
            class="btn btn-outline btn-info hover:text-info-content transition-all"
            onClick={() => openUrl('https://amarbego.github.io/Rscoop/').catch(console.error)}
          >
            <BookOpen class="h-5 w-5" />
            {t('settings.about.docs')}
          </button>
        </div>

        {/* Footer */}
        <div class="text-base-content/30 text-center text-xs">
          <p>Copyright © {new Date().getFullYear()} Kwensiu. MIT License.</p>
        </div>
      </div>
    </div>
  );
}
