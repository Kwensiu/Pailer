import { createSignal, Show, createEffect, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { FolderCog, Save, CircleCheckBig, AlertTriangle, Folder } from 'lucide-solid';
import Card from '../../common/Card';
import { t } from '../../../i18n';
import settingsStore from '../../../stores/settings';

export interface ScoopConfigurationProps {
  onOpenDirectory?: () => void;
}

export default function ScoopConfiguration(props: ScoopConfigurationProps) {
  const { settings, setScoopPath } = settingsStore;
  const [currentPath, setCurrentPath] = createSignal(settings.scoopPath || '');
  const [isDetecting, setIsDetecting] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [pathError, setPathError] = createSignal<string | null>(null);
  const [pathSuccessMessage, setPathSuccessMessage] = createSignal<string | null>(null);
  const [isValidPath, setIsValidPath] = createSignal(true);
  const [validationResult, setValidationResult] = createSignal<{
    isValid: boolean;
    message: string;
  } | null>(null);

  createEffect(() => setCurrentPath(settings.scoopPath || ''));

  // Auto-detect path (if empty and not manually configured)
  onMount(async () => {
    if (!currentPath().trim() && !settings.scoopPathManuallyConfigured) {
      try {
        const detectedPath = await invoke<string>('detect_scoop_path');
        if (detectedPath && detectedPath.trim()) {
          setCurrentPath(detectedPath);
          setIsValidPath(validatePath(detectedPath));
          // Auto-save the detected path
          await setScoopPath(detectedPath);
          setPathSuccessMessage(t('settings.scoopConfiguration.detectSuccess'));
          setTimeout(() => setPathSuccessMessage(null), 5000);
        }
      } catch (err) {
        console.log('Auto-detection skipped or failed:', err);
        // Do not display error, silently skip on first launch
      }
    }
  });

  const handleSavePath = async () => {
    setIsSaving(true);
    setPathError(null);
    setPathSuccessMessage(null);
    setValidationResult(null);
    try {
      await setScoopPath(currentPath());
      setPathSuccessMessage(t('settings.scoopConfiguration.saveSuccess'));

      // Auto-validate the saved path
      if (currentPath().trim()) {
        try {
          // First check if directory exists
          const directoryExists = await invoke<boolean>('check_directory_exists', {
            path: currentPath(),
          });
          if (!directoryExists) {
            setValidationResult({
              isValid: false,
              message: t('settings.scoopConfiguration.directoryNotFound'),
            });
          } else {
            // Directory exists, check if it's a valid Scoop directory
            const isValid = await invoke<boolean>('validate_scoop_directory', {
              path: currentPath(),
            });
            if (isValid) {
              setPathSuccessMessage(t('settings.scoopConfiguration.validDirectory'));
            } else {
              setValidationResult({
                isValid: false,
                message: t('settings.scoopConfiguration.invalidDirectory'),
              });
            }
          }
        } catch (err) {
          console.log('Path validation failed:', err);
          // Do not display validation error, only log it
        }
      }

      setTimeout(() => {
        setPathSuccessMessage(null);
        setValidationResult(null);
      }, 5000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to save scoop path:', errorMsg);
      setPathError(t('settings.scoopConfiguration.saveError') + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const detectScoopPath = async () => {
    setIsDetecting(true);
    setPathError(null);
    try {
      const detectedPath = await invoke<string>('detect_scoop_path');
      setCurrentPath(detectedPath);
      setIsValidPath(validatePath(detectedPath));

      // Directly save the detected path
      await setScoopPath(detectedPath);

      setPathSuccessMessage(t('settings.scoopConfiguration.detectSuccess'));
      setValidationResult(null);
      setTimeout(() => setPathSuccessMessage(null), 5000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to detect scoop path:', errorMsg);
      setPathError(t('settings.scoopConfiguration.detectError'));
    } finally {
      setIsDetecting(false);
    }
  };

  // Validate path format
  const validatePath = (path: string) => {
    // Simple validation to check if path contains invalid characters
    const invalidChars = /[<>|"?*]/;
    const isValid = !invalidChars.test(path) && path.length > 0;
    setIsValidPath(isValid);
    return isValid;
  };

  // Validate when path changes
  const handlePathChange = (value: string) => {
    setCurrentPath(value);
    if (value.trim() !== '') {
      validatePath(value);
    } else {
      setIsValidPath(false); // Empty path is considered invalid
    }
    // Clear previous validation result when path changes
    setValidationResult(null);
  };

  return (
    <Card
      title={t('settings.scoopConfiguration.title')}
      icon={FolderCog}
      description={t('settings.scoopConfiguration.description')}
      headerAction={
        <div class="flex items-center gap-2">
          <Show when={props.onOpenDirectory}>
            <button
              class="btn btn-ghost btn-sm"
              onClick={props.onOpenDirectory}
              title="Open Scoop Directory"
            >
              <Folder class="h-5 w-5" />
            </button>
          </Show>
        </div>
      }
    >
      <label class="label">
        <span class="label-text flex items-center font-semibold">
          {t('settings.scoopConfiguration.pathLabel')}
        </span>
      </label>

      <div class="form-control w-full max-w-lg">
        <div class="join w-full">
          <input
            type="text"
            placeholder={t('settings.scoopConfiguration.pathPlaceholder')}
            class={`input input-bordered join-item w-full ${!isValidPath() ? 'input-warning' : ''}`}
            value={currentPath()}
            onInput={(e) => handlePathChange(e.currentTarget.value)}
            disabled={isDetecting() || isSaving()}
          />
          <button
            class="btn btn-info join-item"
            onClick={handleSavePath}
            disabled={isDetecting() || isSaving() || !isValidPath()}
          >
            <Save class="mr-1 h-4 w-4" />
            {t('settings.scoopConfiguration.save')}
          </button>
          <button
            class={`btn join-item ${isDetecting() ? 'btn-primary' : 'btn-primary'}`}
            onClick={detectScoopPath}
            disabled={isDetecting() || isSaving()}
          >
            {t('settings.scoopConfiguration.auto')}
          </button>
        </div>

        <div class="text-base-content/70 mt-2 text-sm">
          {t('settings.scoopConfiguration.autoDetectDescription')}
        </div>

        <div
          class={`overflow-hidden transition-all duration-300 ease-in-out ${
            validationResult() ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div
            class={`mt-4 flex items-center gap-2 rounded-lg p-3 text-sm ${
              validationResult()?.isValid
                ? 'bg-success/10 text-success border-success/20 border'
                : 'bg-warning/10 text-warning border-warning/20 border'
            }`}
          >
            {validationResult()?.isValid ? (
              <CircleCheckBig class="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle class="h-5 w-5 shrink-0" />
            )}
            <span>{validationResult()?.message}</span>
          </div>
        </div>

        <div
          class={`overflow-hidden transition-all duration-300 ease-in-out ${
            pathError() ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div class="alert alert-error mt-4 text-sm">{pathError()}</div>
        </div>

        <div
          class={`overflow-hidden transition-all duration-300 ease-in-out ${
            pathSuccessMessage() ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div class="bg-success/10 text-success border-success/20 mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm">
            <CircleCheckBig class="h-5 w-5 shrink-0" />
            <span>{pathSuccessMessage()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
