import { ShieldCheck, Download, RefreshCw, Github, Star } from "lucide-solid";
import { createSignal, Show, Component } from "solid-js";
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import pkgJson from "../../../../package.json";

// Define the types we need
interface UpdateEvent {
  event: 'Started' | 'Progress' | 'Finished';
  data: {
    contentLength?: number;
    chunkLength?: number;
  };
}

interface UpdateInfo {
  available: boolean;
  version?: string;
  body?: string;
  downloadAndInstall: (callback: (event: UpdateEvent) => void) => Promise<void>;
}

export interface AboutSectionRef {
  checkForUpdates: (manual: boolean) => Promise<void>;
}

export interface AboutSectionProps {
  ref: (ref: AboutSectionRef) => void;
  isScoopInstalled?: boolean;
}

const GitHubRepoCard: Component<{
  repoName: string;
  repoUrl: string;
  message?: string;
}> = (props) => {
  const handleOpenUrl = async () => {
    try {
      await openUrl(props.repoUrl);
    } catch (error) {
      console.error(`Failed to open GitHub URL:`, error);
      await message(`Could not open the URL. Please visit ${props.repoUrl} manually.`, {
        title: "Error Opening URL",
        kind: "error"
      });
    }
  };

  return (
    <div class="flex flex-col items-center space-y-2 mt-4 p-3 bg-base-300 rounded-lg border border-base-content/10">
      <div class="text-sm text-base-content/80 text-center">
        {props.repoName}
      </div>
      <div class="flex space-x-2">
        <button
          class="btn btn-xs btn-outline btn-primary hover:btn-primary transition-colors"
          onClick={handleOpenUrl}
        >
          <Github class="w-3 h-3 mr-1" />
          View on GitHub
        </button>
        <button
          class="btn btn-xs btn-outline btn-warning hover:btn-warning transition-colors"
          onClick={handleOpenUrl}
        >
          <Star class="w-3 h-3 mr-1" />
          Leave a Star
        </button>
      </div>
      <Show when={props.message}>
        <div class="text-xs text-base-content/60 text-center">
          {props.message}
        </div>
      </Show>
    </div>
  );
};

export default function AboutSection(props: AboutSectionProps) {
  const [updateStatus, setUpdateStatus] = createSignal<'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = createSignal<string | null>(null);
  const [downloadProgress, setDownloadProgress] = createSignal<{ downloaded: number; total: number | null }>({ downloaded: 0, total: null });

  const checkForUpdates = async (manual: boolean) => {
    try {
      // Don't check for updates if installed via Scoop
      if (props.isScoopInstalled) {
        if (manual) {
          await message("This app was installed via Scoop. Please use Scoop to update this application instead.", {
            title: "Updates via Scoop",
            kind: "info"
          });
        }
        return;
      }

      setUpdateStatus('checking');
      setUpdateError(null);

      const update = await check();

      if (update?.available) {
        setUpdateStatus('available');
        setUpdateInfo(update);

        // Only show dialog if user manually clicked "Check for updates"
        if (manual) {
          const shouldInstall = await ask(
            `Update to ${update.version} is available!\n\nRelease notes: ${update.body || 'No release notes provided'}`,
            {
              title: "Update Available",
              kind: "info",
              okLabel: "Install Now",
              cancelLabel: "Later"
            }
          );

          if (shouldInstall) {
            await installAvailableUpdate();
          }
        }
      } else {
        setUpdateStatus('idle');
        if (manual) {
          await message("You're already using the latest version!", {
            title: "No Updates Available",
            kind: "info"
          });
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setUpdateStatus('error');
      setUpdateError(error instanceof Error ? error.message : String(error));
    }
  };

  const installAvailableUpdate = async () => {
    try {
      const currentUpdateInfo = updateInfo();
      if (!currentUpdateInfo) {
        throw new Error("No update information available");
      }

      setUpdateStatus('downloading');
      setDownloadProgress({ downloaded: 0, total: null });

      // Download and install the update with progress reporting
      await currentUpdateInfo.downloadAndInstall((event: UpdateEvent) => {
        switch (event.event) {
          case 'Started':
            setDownloadProgress({
              downloaded: 0,
              total: event.data.contentLength || null
            });
            break;
          case 'Progress':
            setDownloadProgress(prev => ({
              downloaded: prev.downloaded + (event.data.chunkLength || 0),
              total: prev.total
            }));
            break;
          case 'Finished':
            setUpdateStatus('installing');
            break;
        }
      });

      // Restart the app after successful installation
      await ask(
        "Update has been installed successfully. The application needs to restart to apply the changes.",
        {
          title: "Update Complete",
          kind: "info",
          okLabel: "Restart Now"
        }
      );

      await relaunch();
    } catch (error) {
      console.error('Failed to install update:', error);
      setUpdateStatus('error');
      setUpdateError(error instanceof Error ? error.message : String(error));
    }
  };

  props.ref({ checkForUpdates });

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="flex justify-between items-center">
          <h2 class="card-title text-xl">
            <ShieldCheck class="w-6 h-6 mr-2 text-secondary" />
            Rscoop-Fork
          </h2>
          <span class="badge badge-outline badge-info">v{pkgJson.version}</span>
        </div>
        <p class="text-sm text-base-content/60 mt-2">
          A modern, powerful GUI for Scoop on Windows.
        </p>
        <p class="text-sm text-base-content/60 mt-2">
        You are using a fork version. To submit an issue, please head to the forked repository.
        </p>

        {/* Original Developer Credit */}
        <GitHubRepoCard 
          repoName="Rscoop"
          repoUrl="https://github.com/AmarBego/Rscoop"
          message="If you find this useful, please consider giving it a star! ⭐"
        />

        {/* Fork Developer Credit */}
        <GitHubRepoCard 
          repoName="Rscoop-Fork"
          repoUrl="https://github.com/Kwensiu/Rscoop"
          message="This is a fork version maintained by Kwensiu."
        />

        <div class="flex flex-col space-y-2 mt-4">
          {props.isScoopInstalled && (
            <div class="alert alert-info text-sm">
              <span>This app was installed via Scoop. Use <code>scoop update rscoop</code> to update.</span>
            </div>
          )}

          {!props.isScoopInstalled && updateStatus() === 'idle' && (
            <button
              class="btn btn-sm btn-outline btn-accent w-full"
              onClick={() => checkForUpdates(true)}
            >
              <RefreshCw class="w-4 h-4 mr-1" />
              Check for updates
            </button>
          )}

          {updateStatus() === 'checking' && (
            <button class="btn btn-sm btn-outline w-full" disabled>
              <span class="loading loading-spinner loading-xs mr-1"></span>
              Checking for updates...
            </button>
          )}

          {updateStatus() === 'available' && (
            <div class="space-y-3">
              <div class="text-center text-sm text-success font-medium">
                Update available: v{updateInfo()?.version}
              </div>
              <Show when={updateInfo()?.body}>
                <div class="text-xs text-base-content/80 max-h-32 overflow-y-auto p-3 bg-base-300 rounded border-l-4 border-success">
                  <div class="font-semibold text-success mb-2">Release Notes:</div>
                  <div class="whitespace-pre-wrap leading-relaxed">{updateInfo()?.body}</div>
                </div>
              </Show>
              <button
                class="btn btn-sm btn-success w-full"
                onClick={installAvailableUpdate}
              >
                <Download class="w-4 h-4 mr-1" />
                Install update
              </button>
            </div>
          )}

          {updateStatus() === 'downloading' && (
            <div class="space-y-2">
              <button class="btn btn-sm btn-outline btn-info w-full" disabled>
                <span class="loading loading-spinner loading-xs mr-1"></span>
                Downloading update...
              </button>
              <progress
                class="progress progress-info w-full"
                value={downloadProgress().downloaded}
                max={downloadProgress().total || 100}
              />
              <div class="text-xs text-center">
                {downloadProgress().total
                  ? `${Math.round(downloadProgress().downloaded / 1024)} KB of ${Math.round((downloadProgress().total || 0) / 1024)} KB`
                  : `${Math.round(downloadProgress().downloaded / 1024)} KB downloaded`}
              </div>
            </div>
          )}

          {updateStatus() === 'installing' && (
            <button class="btn btn-sm btn-outline btn-success w-full" disabled>
              <span class="loading loading-spinner loading-xs mr-1"></span>
              Installing update...
            </button>
          )}

          {updateStatus() === 'error' && (
            <div class="space-y-1">
              <div class="text-error text-center text-xs">{updateError()}</div>
              <button
                class="btn btn-sm btn-outline btn-error w-full"
                onClick={() => checkForUpdates(true)}
              >
                <RefreshCw class="w-4 h-4 mr-1" />
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}