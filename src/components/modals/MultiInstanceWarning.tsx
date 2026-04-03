import { createEffect, createSignal, Show } from 'solid-js';
import { TriangleAlert, X } from 'lucide-solid';
import { useOperations } from '../../stores/operations';
import { t } from '../../i18n';

// Multi-instance warning component
const MultiInstanceWarning = () => {
  const { dismissMultiInstanceWarning, checkMultiInstanceWarning } = useOperations();

  const [isClosed, setIsClosed] = createSignal(false);

  // Check if warning should be displayed
  const shouldShowWarning = () => {
    return checkMultiInstanceWarning() && !isClosed();
  };

  // Close warning for current warning cycle
  const handleClose = () => {
    setIsClosed(true);
  };

  // Permanently dismiss warning
  const handleDismiss = () => {
    setIsClosed(true);
    dismissMultiInstanceWarning();
  };

  // Reset temporary close state when warning condition clears
  createEffect(() => {
    if (!checkMultiInstanceWarning()) {
      setIsClosed(false);
    }
  });

  return (
    <Show when={shouldShowWarning()}>
      <div class="fixed right-4 bottom-4 z-50 max-w-sm">
        <div class="alert alert-warning border-warning bg-warning text-warning-content shadow-lg">
          <div class="flex items-start gap-3">
            <TriangleAlert class="mt-0.5 h-5 w-5 shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="mb-1 font-bold">{t('warnings.multiInstance.title')}</div>
              <div class="mb-3 text-sm">{t('warnings.multiInstance.message')}</div>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-outline" onClick={handleDismiss}>
                  {t('warnings.multiInstance.dontShowAgain')}
                </button>
                <button class="btn btn-sm btn-ghost" onClick={handleClose}>
                  {t('buttons.closeDialog')}
                </button>
              </div>
            </div>
            <button
              class="btn btn-sm btn-circle btn-ghost ml-2"
              onClick={handleClose}
              aria-label={t('buttons.close')}
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default MultiInstanceWarning;
