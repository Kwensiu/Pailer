import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen } from 'lucide-solid';
import { open } from '@tauri-apps/plugin-dialog';
import Modal from '../common/Modal';
import { toast } from '../common/ToastAlert';
import { t } from '../../i18n';

interface ScoopConfigWizardProps {
  isOpen: boolean;
  onConfigured: () => void;
}

export default function ScoopConfigWizard(props: ScoopConfigWizardProps) {
  const [scoopPath, setScoopPath] = createSignal('');
  const [validating, setValidating] = createSignal(false);
  const [validationResult, setValidationResult] = createSignal<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [customScoopDir, setCustomScoopDir] = createSignal('E:\\Scoop');
  const [customGlobalDir, setCustomGlobalDir] = createSignal('E:\\GlobalScoopApps');

  // Show validation result as toast
  const showValidationResult = (valid: boolean, message: string) => {
    let displayMessage: string;

    // Check if message is an i18n key (starts with 'scoopConfigWizard.')
    if (message.startsWith('scoopConfigWizard.')) {
      // Handle special case for missing directories with parameters
      if (message.includes('validationMissingDirectories|')) {
        const [key, directories] = message.split('|');
        displayMessage = t(key, { directories });
      } else {
        displayMessage = t(message);
      }
    } else {
      displayMessage = message;
    }

    if (valid) {
      toast.success(displayMessage, { duration: 3000 });
    } else {
      toast.error(displayMessage, { duration: 5000 });
    }
    setValidationResult({ valid, message: displayMessage });
  };

  // Helper function to safely convert error to string
  const errorToString = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  };

  // Simple path validation for security
  const validatePathForCommand = (path: string): string => {
    if (!path?.trim() || path.includes('..')) {
      throw new Error('Invalid path');
    }
    return path.trim();
  };

  // Generate PowerShell commands with custom paths
  const generateInstallCommands = () => {
    const baseCommand = `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`;

    const defaultCommand = `${baseCommand}
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression`;

    try {
      const sanitizedScoopDir = validatePathForCommand(customScoopDir());
      const sanitizedGlobalDir = validatePathForCommand(customGlobalDir());

      const customCommand = `${baseCommand}
irm get.scoop.sh -outfile 'install.ps1'
.\\install.ps1 -ScoopDir '${sanitizedScoopDir}' -ScoopGlobalDir '${sanitizedGlobalDir}'`;

      return {
        default: defaultCommand,
        custom: customCommand,
      };
    } catch (error) {
      // If path validation fails, return default command only
      console.warn('Invalid custom paths, falling back to default installation:', error);
      return {
        default: defaultCommand,
        custom: '# Invalid custom paths - use default installation above',
      };
    }
  };
  const [autoDetecting, setAutoDetecting] = createSignal(false);

  const autoDetect = async () => {
    setAutoDetecting(true);
    setValidationResult(null);
    try {
      const detected = await invoke<string>('auto_detect_scoop_path');
      setScoopPath(detected);
      showValidationResult(true, t('scoopConfigWizard.autoDetectedSuccess', { path: detected }));
    } catch (error) {
      showValidationResult(false, t('scoopConfigWizard.autoDetectFailed'));
      console.error('Auto detect failed:', error);
    } finally {
      setAutoDetecting(false);
    }
  };

  const browsePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('scoopConfigWizard.selectDirectory'),
      });

      if (selected && typeof selected === 'string') {
        setScoopPath(selected);
        setValidationResult(null);
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error);
    }
  };

  const validatePath = async () => {
    if (!scoopPath()) {
      showValidationResult(false, t('scoopConfigWizard.enterPath'));
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const result = await invoke<{ valid: boolean; message: string }>('validate_scoop_directory', {
        path: scoopPath(),
      });
      showValidationResult(result.valid, result.message);
    } catch (error) {
      showValidationResult(
        false,
        t('scoopConfigWizard.validationFailed', { error: errorToString(error) })
      );
    } finally {
      setValidating(false);
    }
  };

  const savePath = async () => {
    const currentResult = validationResult();
    if (!currentResult?.valid) {
      await validatePath();
      const updatedResult = validationResult();
      if (!updatedResult?.valid) return;
    }

    try {
      await invoke('set_scoop_path', { path: scoopPath() });
      props.onConfigured();
    } catch (error) {
      showValidationResult(
        false,
        t('scoopConfigWizard.saveFailed', { error: errorToString(error) })
      );
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={() => {}}
      title={t('scoopConfigWizard.title')}
      size="medium"
      animation="scale"
      showCloseButton={false}
      preventBackdropClose={true}
      footer={
        <button
          class="btn btn-primary w-full"
          onClick={savePath}
          disabled={!validationResult()?.valid}
        >
          {t('scoopConfigWizard.saveAndContinue')}
        </button>
      }
    >
      <div class="space-y-6">
        <div class="bg-base-100 border-base-200 rounded-2xl border p-2 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="rounded-xl p-2">
              <img src="/icon.png" alt="Pailer Logo" class="h-16 w-16" />
            </div>
            <div class="flex-1 p-2">
              <h3 class="text-base-content mb-1 text-lg font-semibold">
                {t('scoopConfigWizard.welcomeTitle')}
              </h3>
              <p class="text-base-content/60 text-sm leading-relaxed">
                {t('scoopConfigWizard.welcomeDescription')}
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">
              <span class="label-text mb-2 font-semibold">{t('scoopConfigWizard.pathLabel')}</span>
            </label>
            <div class="join w-full">
              <input
                type="text"
                class="input input-bordered join-item flex-1 rounded-l-xl"
                placeholder={t('scoopConfigWizard.pathPlaceholder')}
                value={scoopPath()}
                onInput={(e) => {
                  setScoopPath(e.currentTarget.value);
                  setValidationResult(null);
                }}
              />
              <button
                class="btn btn-info join-item"
                onClick={browsePath}
                style="border-left: none !important; border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important;"
              >
                <FolderOpen size={16} />
                {t('scoopConfigWizard.browse')}
              </button>
            </div>
          </div>

          <div class="join w-full gap-4">
            <button
              class="btn btn-outline join-item flex-1"
              onClick={autoDetect}
              disabled={autoDetecting()}
            >
              {autoDetecting() ? (
                <>
                  <span class="loading loading-spinner loading-sm"></span>
                  {t('scoopConfigWizard.detecting')}
                </>
              ) : (
                t('scoopConfigWizard.autoDetect')
              )}
            </button>
            <button
              class="btn btn-primary join-item flex-1"
              onClick={validatePath}
              disabled={validating() || !scoopPath()}
            >
              {validating() ? (
                <>
                  <span class="loading loading-spinner loading-sm"></span>
                  {t('scoopConfigWizard.validating')}
                </>
              ) : (
                t('scoopConfigWizard.validatePath')
              )}
            </button>
          </div>

          <div class="divider">{t('scoopConfigWizard.notInstalled')}</div>

          <div class="space-y-6">
            <div class="text-center">
              <p class="text-base-content mx-auto max-w-md text-sm leading-relaxed">
                {t('scoopConfigWizard.scoopDescription')}
              </p>
            </div>

            <div class="bg-base-100 border-base-300 rounded-xl border p-6">
              <div class="mb-4 flex items-center gap-2">
                <div class="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                  <svg
                    class="text-primary h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    ></path>
                  </svg>
                </div>
                <h3 class="text-base-content font-medium">
                  {t('scoopConfigWizard.powershellInstructions')}
                </h3>
              </div>

              <div class="space-y-4">
                <div class="bg-base-200/50 border-base-300/50 rounded-lg border p-4">
                  <div class="mb-3 flex items-center gap-2">
                    <div class="bg-success h-2 w-2 rounded-full"></div>
                    <span class="text-base-content/80 text-sm font-medium">
                      {t('scoopConfigWizard.officialInstallation')}
                    </span>
                  </div>
                  <div class="bg-base-300/70 border-base-300/50 group relative rounded-lg border p-3">
                    <button
                      class="btn btn-xs btn-ghost text-base-content/60 hover:text-base-content hover:bg-base-200/80 absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={async () => {
                        try {
                          const commands = generateInstallCommands();
                          await navigator.clipboard.writeText(commands.default);
                          // Show success feedback with toast
                          toast.success(t('scoopConfigWizard.copied'), {
                            duration: 2000,
                          });
                        } catch (err) {
                          console.error('Failed to copy to clipboard:', err);
                        }
                      }}
                    >
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        ></path>
                      </svg>
                    </button>
                    <pre class="text-base-content/80 pr-8 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                      {generateInstallCommands().default}
                    </pre>
                  </div>
                </div>

                <div class="bg-base-200/50 border-base-300/50 rounded-lg border p-4">
                  <div class="mb-3 flex items-center gap-2">
                    <div class="bg-warning h-2 w-2 rounded-full"></div>
                    <span class="text-base-content/80 text-sm font-medium">
                      {t('scoopConfigWizard.customInstallation')}
                    </span>
                  </div>

                  {/* Custom Path Inputs */}
                  <div class="mb-3 space-y-2">
                    <div class="flex items-center gap-2">
                      <label class="label min-w-[100px]">
                        <span class="label-text text-xs font-medium">
                          {t('scoopConfigWizard.scoopDirectory')}
                        </span>
                      </label>
                      <input
                        type="text"
                        class="input input-bordered input-xs flex-1"
                        placeholder="E:\Scoop"
                        value={customScoopDir()}
                        onInput={(e) => setCustomScoopDir(e.currentTarget.value)}
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="label min-w-[100px]">
                        <span class="label-text text-xs font-medium">
                          {t('scoopConfigWizard.globalAppsDirectory')}
                        </span>
                      </label>
                      <input
                        type="text"
                        class="input input-bordered input-xs flex-1"
                        placeholder="E:\GlobalScoopApps"
                        value={customGlobalDir()}
                        onInput={(e) => setCustomGlobalDir(e.currentTarget.value)}
                      />
                    </div>
                  </div>

                  <div class="bg-base-300/70 border-base-300/50 group relative rounded-lg border p-3">
                    <button
                      class="btn btn-xs btn-ghost text-base-content/60 hover:text-base-content hover:bg-base-200/80 absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={async () => {
                        try {
                          const commands = generateInstallCommands();
                          await navigator.clipboard.writeText(commands.custom);
                          // Show success feedback with toast
                          toast.success(t('scoopConfigWizard.copied'), {
                            duration: 2000,
                          });
                        } catch (err) {
                          console.error('Failed to copy to clipboard:', err);
                        }
                      }}
                    >
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        ></path>
                      </svg>
                    </button>
                    <pre class="text-base-content/80 pr-8 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                      {generateInstallCommands().custom}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div class="text-center">
              <p class="text-base-content/60 text-sm">
                {t('scoopConfigWizard.visitWebsiteText')}
                <a
                  href="https://scoop.sh"
                  target="_blank"
                  class="link link-primary hover:text-primary-focus text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    invoke('open_url', { url: 'https://scoop.sh' }).catch(console.error);
                  }}
                >
                  scoop.sh
                </a>
                {t('scoopConfigWizard.learnMore')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
