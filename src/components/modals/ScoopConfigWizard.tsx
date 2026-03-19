import { createSignal, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, CheckCircle, FolderOpen } from 'lucide-solid';
import { open } from '@tauri-apps/plugin-dialog';
import Modal from '../common/Modal';
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
  const [autoDetecting, setAutoDetecting] = createSignal(false);

  const autoDetect = async () => {
    setAutoDetecting(true);
    setValidationResult(null);
    try {
      const detected = await invoke<string>('auto_detect_scoop_path');
      setScoopPath(detected);
      setValidationResult({
        valid: true,
        message: t('scoopConfigWizard.autoDetectedSuccess', { path: detected }),
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        message: t('scoopConfigWizard.autoDetectFailed'),
      });
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
      setValidationResult({
        valid: false,
        message: t('scoopConfigWizard.enterPath'),
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const result = await invoke<{ valid: boolean; message: string }>('validate_scoop_directory', {
        path: scoopPath(),
      });
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        valid: false,
        message: t('scoopConfigWizard.validationFailed', { error }),
      });
    } finally {
      setValidating(false);
    }
  };

  const savePath = async () => {
    if (!validationResult()?.valid) {
      await validatePath();
      if (!validationResult()?.valid) return;
    }

    try {
      await invoke('set_scoop_path', { path: scoopPath() });
      props.onConfigured();
    } catch (error) {
      setValidationResult({
        valid: false,
        message: t('scoopConfigWizard.saveFailed', { error }),
      });
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
        <div class="alert status-alert-info">
          <AlertCircle size={20} />
          <div>
            <p class="font-semibold">{t('scoopConfigWizard.notDetected')}</p>
            <p class="text-sm">{t('scoopConfigWizard.configureDescription')}</p>
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
                class="input input-bordered join-item flex-1"
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

          <Show when={validationResult()}>
            {(result) => (
              <div class={`alert ${result().valid ? 'alert-success' : 'status-alert-error'}`}>
                {result().valid ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span>{result().message}</span>
              </div>
            )}
          </Show>

          <div class="divider">{t('scoopConfigWizard.commonLocations')}</div>

          <div class="space-y-2">
            <p class="text-base-content/70 text-sm">{t('scoopConfigWizard.typicalLocations')}</p>
            <ul class="text-base-content/70 list-inside list-disc space-y-1 text-sm">
              <li>
                <code class="bg-base-200 rounded px-1 py-0.5 text-xs">
                  C:\Users\{'{YourName}'}\scoop
                </code>{' '}
                ({t('scoopConfigWizard.userInstallation')})
              </li>
              <li>
                <code class="bg-base-200 rounded px-1 py-0.5 text-xs">C:\ProgramData\scoop</code> (
                {t('scoopConfigWizard.globalInstallation')})
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}
