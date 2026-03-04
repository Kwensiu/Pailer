import { createSignal } from 'solid-js';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { processMarkdown } from '../utils/markdown';
import { toast } from '../components/common/ToastAlert';
import { t } from '../i18n';

// Update status types
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error';

// Update store state
class UpdateStore {
  // Core state
  private updateInfo = createSignal<Update | null>();
  private updateStatus = createSignal<UpdateStatus>('idle');
  private updateError = createSignal<string | null>(null);
  private downloadProgress = createSignal<{ downloaded: number; total: number | null }>({
    downloaded: 0,
    total: null,
  });
  private releaseNotesHtml = createSignal<string>('');
  private dismissed = createSignal<boolean>(false);

  // Cache management - using sessionStorage directly since we control the logic
  private cacheKey = 'pailer-update-cache';
  private dismissedKey = 'pailer-update-dismissed';

  // Public getters
  public getUpdateInfo = this.updateInfo[0];
  public getUpdateStatus = this.updateStatus[0];
  public getUpdateError = this.updateError[0];
  public getDownloadProgress = this.downloadProgress[0];
  public getReleaseNotesHtml = this.releaseNotesHtml[0];
  public isDismissed = this.dismissed[0];

  constructor() {
    // Initialize from cache on creation
    this.syncWithCache();
  }

  // Sync with sessionStorage cache
  private syncWithCache() {
    try {
      const cached = sessionStorage.getItem(this.cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.data && parsed.timestamp) {
          // Check if cache is still valid (24 hours)
          const cacheAge = Date.now() - parsed.timestamp;
          if (cacheAge < 24 * 60 * 60 * 1000) {
            this.updateInfo[1](parsed.data);
            this.updateStatus[1]('available');
            // Restore release notes if cached
            if (parsed.releaseNotesHtml) {
              this.releaseNotesHtml[1](parsed.releaseNotesHtml);
            }
          } else {
            // Cache expired, remove it
            sessionStorage.removeItem(this.cacheKey);
          }
        }
      }

      // Sync dismissed state
      const dismissedValue = sessionStorage.getItem(this.dismissedKey);
      this.dismissed[1](dismissedValue === 'true');
    } catch (e) {
      console.warn('Failed to sync with update cache:', e);
    }
  }

  // Fetch release notes from GitHub and process to HTML
  private async fetchReleaseNotes(version: string): Promise<string> {
    const possibleTags = [`v${version}`, version];
    const TIMEOUT_MS = 10000; // 10 second timeout

    for (const tag of possibleTags) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

        clearTimeout(timeoutId);

        if (response.ok) {
          const release = await response.json();
          // Validate response structure
          if (release && typeof release === 'object' && 'body' in release) {
            const markdown = release.body || 'No release notes available.';
            // Process markdown to HTML
            const html = await processMarkdown(markdown);
            return html;
          } else {
            console.warn(`Invalid response structure for tag ${tag}`);
            continue;
          }
        } else if (response.status === 404) {
          console.log(`Release tag ${tag} not found, trying next format...`);
          continue; // Try next tag format
        } else if (response.status === 403) {
          console.warn(`GitHub API rate limited for tag ${tag}`);
          toast.warning(t('settings.about.githubRateLimited'));
          return '<p>GitHub API rate limited. Please try again later.</p>';
        } else if (response.status >= 500) {
          console.warn(`GitHub API server error ${response.status} for tag ${tag}`);
          toast.warning(t('settings.about.githubServerError'));
          return '<p>GitHub API temporarily unavailable. Please try again later.</p>';
        } else {
          console.warn(`GitHub API error ${response.status} for tag ${tag}`);
          continue;
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.warn(`Request timeout for tag ${tag}`);
            toast.warning(t('settings.about.githubTimeout'));
            return '<p>Request timed out. Please check your internet connection.</p>';
          } else {
            console.warn(`Network error fetching release notes for tag ${tag}:`, error.message);
            continue;
          }
        } else {
          console.warn(`Unknown error fetching release notes for tag ${tag}:`, error);
          continue;
        }
      }
    }

    // If all attempts failed
    console.warn('Failed to fetch release notes for all tag formats');
    toast.warning(t('settings.about.releaseNotesFailed'));
    return '<p>Failed to load release notes. Please check your internet connection.</p>';
  }

  // Check for updates (both automatic and manual)
  public async checkForUpdates(manual: boolean = false): Promise<void> {
    console.log('🔍 [UpdateStore] checkForUpdates called', { manual });

    // Reset state for manual checks
    if (manual) {
      this.releaseNotesHtml[1]('');
      // Clear update cache
      sessionStorage.removeItem(this.cacheKey);
    }

    try {
      this.updateStatus[1]('checking');

      // Skip if installed via Scoop
      const isScoopInstalled = await invoke<boolean>('is_scoop_installation');
      if (isScoopInstalled) {
        this.updateStatus[1]('idle');
        return;
      }

      const update = await check();
      console.log('🔍 [UpdateStore] check() returned:', update);

      if (update?.available) {
        this.updateStatus[1]('available');
        this.updateInfo[1](update);

        // Reset dismissed state for new updates
        this.resetDismissed();

        // Fetch release notes for available updates
        const notes = await this.fetchReleaseNotes(update.version);
        this.releaseNotesHtml[1](notes);

        // Cache the update info with release notes
        sessionStorage.setItem(
          this.cacheKey,
          JSON.stringify({
            data: update,
            releaseNotesHtml: notes,
            timestamp: Date.now(),
          })
        );

        if (manual) {
          // Show success message for manual checks
          toast.success(t('settings.about.updateAvailable'));
        }
      } else {
        if (manual) {
          // Show no update message for manual checks
          const currentVersion = await invoke<string>('get_current_version');
          toast.info(t('settings.about.latestVersion', { version: currentVersion }));
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      this.updateStatus[1]('error');

      const errorMessage =
        error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200);
      this.updateError[1](errorMessage);

      if (manual) {
        toast.error(t('settings.about.updateFailed'));
      }
    }
  }

  // Install available update
  public async installUpdate(): Promise<void> {
    const currentUpdate = this.updateInfo[0]();
    if (!currentUpdate) {
      throw new Error('No update information available');
    }

    try {
      this.updateStatus[1]('downloading');
      this.downloadProgress[1]({ downloaded: 0, total: null });

      await currentUpdate.downloadAndInstall((progress: any) => {
        if (progress.event === 'Started') {
          this.downloadProgress[1]({
            downloaded: 0,
            total: progress.data.contentLength || null,
          });
        } else if (progress.event === 'Progress') {
          const newDownloaded = progress.data.chunkLength || 0;
          this.downloadProgress[1]((prev) => ({
            downloaded: prev.downloaded + newDownloaded,
            total: prev.total,
          }));
        } else if (progress.event === 'Finished') {
          this.updateStatus[1]('installing');
        }
      });

      // Note: On Windows, the installer handles app restart automatically
      this.updateStatus[1]('idle');
    } catch (error) {
      console.error('Failed to install update:', error);
      this.updateStatus[1]('error');

      const errorMessage =
        error instanceof Error ? error.message.substring(0, 200) : String(error).substring(0, 200);
      this.updateError[1](errorMessage);

      toast.error(t('settings.about.updateFailed'));
    }
  }

  // Dismiss update notification for current session
  public dismissUpdate() {
    this.dismissed[1](true);
    sessionStorage.setItem(this.dismissedKey, 'true');
  }

  // Reset dismissed state (called on new updates)
  private resetDismissed() {
    this.dismissed[1](false);
    sessionStorage.removeItem(this.dismissedKey);
  }
}

// Export singleton instance
export const updateStore = new UpdateStore();
