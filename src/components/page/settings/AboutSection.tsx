import { Download, RefreshCw, Github, MessagesSquare, CircleDot } from 'lucide-solid';
import { createSignal, createEffect } from 'solid-js';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import pkgJson from '../../../../package.json';
import { t } from '../../../i18n';
import { invoke } from '@tauri-apps/api/core';
import UpdateModal from './UpdateModal';
import { createSessionCache } from '../../../hooks/useSessionStorage';
import { processMarkdown } from '../../../utils/markdown';
import { createTauriSignal } from '../../../hooks/createTauriSignal';

export interface AboutSectionRef {
  checkForUpdates: (manual: boolean) => Promise<void>;
}

export interface AboutSectionProps {
  ref?: (ref: AboutSectionRef) => void;
  isScoopInstalled?: boolean;
}

export default function AboutSection(props: AboutSectionProps) {
  const [updateStatus, setUpdateStatus] = createSignal<
    'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error'
  >('idle');
  const [updateError, setUpdateError] = createSignal<string | null>(null);
  const [downloadProgress, setDownloadProgress] = createSignal<{
    downloaded: number;
    total: number | null;
  }>({ downloaded: 0, total: null });

  // Processed release notes HTML
  const [releaseNotesHtml, setReleaseNotesHtml] = createSignal<string>('');
  const [hasFetchedReleaseNotes, setHasFetchedReleaseNotes] = createSignal(false);

  // UpdateModal state
  const [showUpdateModal, setShowUpdateModal] = createSignal(false);

  // Auto check setting (default: enabled)
  const autoCheckEnabled = createTauriSignal('auto-check-updates', true);

  // Enhanced session cache that includes release notes
  const updateCache = createSessionCache<Update | null>('pailer-update-cache', async () => {
    // Delay check to ensure autoCheckEnabled state is fully loaded
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (autoCheckEnabled[0]()) {
      return await check();
    }
    return null;
  });

  // Sync cache data with local state - simplified approach
  const updateInfo = () => {
    const cachedData = updateCache.data();
    return cachedData;
  };

  // Watch for update info changes and fetch release notes if body is empty (only after manual check)
  createEffect(async () => {
    const currentUpdateInfo = updateInfo();
    // Only fetch release notes if:
    // 1. We have update info
    // 2. The body is empty
    // 3. We haven't fetched release notes before for this update
    // 4. The update status is 'available' (meaning user just checked)
    if (
      currentUpdateInfo &&
      !currentUpdateInfo.body &&
      !hasFetchedReleaseNotes() &&
      updateStatus() === 'available'
    ) {
      setHasFetchedReleaseNotes(true); // Mark as attempted immediately to prevent race conditions

      try {
        // Try both with and without 'v' prefix
        const version = currentUpdateInfo.version;
        const possibleTags = [`v${version}`, version];

        let releaseData = null;
        for (const tag of possibleTags) {
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(
              `https://api.github.com/repos/Kwensiu/Pailer/releases/tags/${tag}`,
              {
                signal: controller.signal,
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  'User-Agent': 'Pailer-Update-Checker',
                },
              }
            );

            // Ensure timeout cleanup in all paths
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            if (response.ok) {
              const data = await response.json();
              // Validate response structure
              if (data && typeof data === 'object' && 'body' in data) {
                releaseData = data;
                break;
              } else {
                console.warn(`Invalid response structure for tag ${tag}`);
              }
            } else if (response.status === 404) {
              // Tag not found, continue to next
              continue;
            } else if (response.status === 403) {
              console.warn(`GitHub API rate limited for tag ${tag}`);
              break; // Stop trying other tags if rate limited
            } else {
              console.warn(`GitHub API error ${response.status} for tag ${tag}`);
            }
          } catch (fetchError) {
            // Ensure timeout cleanup in exception cases
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            if (fetchError instanceof Error) {
              if (fetchError.name === 'AbortError') {
                console.warn(`Request timeout for tag ${tag}`);
              } else {
                console.warn(
                  `Network error fetching release notes for tag ${tag}:`,
                  fetchError.message
                );
              }
            } else {
              console.warn(`Unknown error fetching release notes for tag ${tag}:`, fetchError);
            }
            continue;
          }
        }

        if (releaseData && releaseData.body) {
          const releaseNotes = releaseData.body;

          // Update the cached data with release notes
          const updatedInfo = { ...currentUpdateInfo, body: releaseNotes };

          // Update session storage
          try {
            sessionStorage.setItem('pailer-update-info', JSON.stringify(updatedInfo));
            // Process markdown to HTML and store
            const processedHtml = await processMarkdown(releaseNotes);
            setReleaseNotesHtml(processedHtml);
          } catch (storageError) {
            console.error('Failed to save updated release notes to session storage:', storageError);
          }
        }
      } catch (error) {
        console.error('Failed to fetch release notes:', error);
        // Don't reset hasFetchedReleaseNotes on error to prevent infinite retries
      }
    } else if (currentUpdateInfo?.body) {
      // If we already have release notes, process them
      const processedHtml = await processMarkdown(currentUpdateInfo.body);
      setReleaseNotesHtml(processedHtml);
    }
  });

  // Monitor updateStatus changes and sync with cache data
  createEffect(() => {
    const currentStatus = updateStatus();
    const cachedData = updateCache.data();

    // If we have cached update data but status is not 'available', sync it
    if (cachedData?.available && currentStatus !== 'available') {
      setUpdateStatus('available');
    }

    // If status is 'available' but no cached data, reset to idle
    if (currentStatus === 'available' && !cachedData) {
      setUpdateStatus('idle');
    }
  });

  const checkForUpdates = async (manual: boolean) => {
    console.log('🔍 [AboutSection] checkForUpdates called', {
      manual,
      isScoopInstalled: props.isScoopInstalled,
    });

    // Reset release notes fetch flag for manual checks to get latest notes
    if (manual) {
      setHasFetchedReleaseNotes(false);
      setReleaseNotesHtml(''); // Clear release notes
      // Clear update cache to ensure re-detection
      updateCache.clearCache();
    }
    try {
      setUpdateStatus('checking');

      if (props.isScoopInstalled) {
        // For Scoop-managed installations, just show that updates are handled by Scoop
        setUpdateStatus('idle');
        return;
      }

      const update = await check();

      if (update?.available) {
        setUpdateStatus('available');

        // Use updateData to update cache
        updateCache.updateData(update);

        // Only show dialog for manual checks
        if (manual) {
          // This should show update available message, not "already latest version"
          // Remove incorrect "already latest version" message display
        }
      } else {
        if (manual) {
          const currentVersion = await invoke<string>('get_current_version');
          await message(t('settings.about.latestVersion', { version: currentVersion }), {
            title: t('settings.about.noUpdatesAvailable'),
            kind: 'info',
          });
        }
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

      await currentUpdateInfo.downloadAndInstall((progress: any) => {
        if (progress.event === 'Started') {
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
        } else if (progress.event === 'Finished') {
          setUpdateStatus('installing');
        }
      });

      const confirmed = await ask(t('settings.about.updateComplete'), {
        title: t('buttons.confirm'),
        kind: 'info',
        okLabel: t('settings.about.restartNow'),
        cancelLabel: t('buttons.later'),
      });

      if (confirmed) {
        await relaunch();
      } else {
        setUpdateStatus('idle');
      }
    } catch (error) {
      console.error('Failed to install update:', error);
      setUpdateStatus('error');

      const errorMessage =
        error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200);
      setUpdateError(errorMessage);
    }
  };

  // UpdateModal handlers
  const handleUpdateInstall = async () => {
    setShowUpdateModal(false);
    await installAvailableUpdate();
  };

  const handleCloseModal = () => {
    setShowUpdateModal(false);
    // Don't reset update status - keep the update notification visible
  };

  // This will be called by Modal when animation completes (X button or ESC)
  const handleModalClosed = () => {
    // Ensure modal state is closed (fixes the bug where X button doesn't properly close modal)
    setShowUpdateModal(false);
  };

  // Expose ref if provided
  if (props.ref) {
    props.ref({ checkForUpdates });
  }

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
                  <div class="tooltip tooltip-right" data-tip={t('settings.about.checkNow')}>
                    <button
                      class="btn btn-circle btn-xs mr-2"
                      onClick={() => checkForUpdates(true)}
                      disabled={updateStatus() === 'checking' || updateCache.loading()}
                    >
                      {updateStatus() === 'checking' || updateCache.loading() ? (
                        <span class="loading loading-spinner loading-xs"></span>
                      ) : (
                        <RefreshCw class="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-right"
                    data-tip={t('settings.about.autoCheckTooltip')}
                  >
                    <button
                      class={`btn btn-xs btn-ghost ${autoCheckEnabled[0]() ? 'bg-base-100 dark:bg-green-400/50' : 'btn-soft text-black/40 dark:bg-black/30 dark:text-white/30'}`}
                      onClick={() => autoCheckEnabled[1]((prev) => !prev)}
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
              {updateStatus() === 'available' && (
                <div class="animate-in fade-in slide-in-from-top-2 space-y-3 pt-2">
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
                    <button
                      class="btn btn-sm btn-soft bg-base-100"
                      onClick={() => setShowUpdateModal(true)}
                    >
                      {t('buttons.view')}
                    </button>
                  </div>
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
        updateInfo={updateInfo()!}
        onInstall={handleUpdateInstall}
        isDownloading={updateStatus() === 'downloading'}
        downloadProgress={downloadProgress()}
        releaseNotesHtml={releaseNotesHtml()}
      />
    </div>
  );
}
