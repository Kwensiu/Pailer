import { Show, createSignal, onCleanup, createEffect } from 'solid-js';
import { Trash2, Eye, EyeOff } from 'lucide-solid';
import { Shim } from './ShimManager';
import { t } from '../../../i18n';
import Modal from '../../common/Modal';

interface ShimDetailsModalProps {
  isOpen: boolean;
  shim: Shim;
  onClose: () => void;
  onRemove: (name: string) => void;
  onAlter: (name: string) => void;
  isOperationRunning: boolean;
}

function ShimDetailsModal(props: ShimDetailsModalProps) {
  // State for delete confirmation
  const [deleteConfirm, setDeleteConfirm] = createSignal(false);
  const [deleteTimer, setDeleteTimer] = createSignal<number | null>(null);

  // Cleanup timer on unmount
  onCleanup(() => {
    if (deleteTimer()) {
      window.clearTimeout(deleteTimer()!);
    }
  });

  // Reset confirmation when modal closes or shim changes
  createEffect(() => {
    if (!props.isOpen || !props.shim) {
      setDeleteConfirm(false);
      if (deleteTimer()) {
        window.clearTimeout(deleteTimer()!);
        setDeleteTimer(null);
      }
    }
  });

  const handleRemove = () => {
    if (deleteConfirm()) {
      // Execute delete
      if (deleteTimer()) {
        window.clearTimeout(deleteTimer()!);
        setDeleteTimer(null);
      }
      setDeleteConfirm(false);
      props.onRemove(props.shim.name);
    } else {
      // First click - show confirmation
      setDeleteConfirm(true);
      const timer = window.setTimeout(() => {
        setDeleteConfirm(false);
        setDeleteTimer(null);
      }, 3000);
      setDeleteTimer(timer);
    }
  };

  const handleAlter = () => {
    props.onAlter(props.shim.name);
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={props.shim.name}
      size="medium"
      animation="scale"
      footer={
        <>
          <button
            class="btn"
            classList={{
              'btn-error': !deleteConfirm(),
              'btn-warning': deleteConfirm(),
            }}
            onClick={handleRemove}
            disabled={props.isOperationRunning}
          >
            <Trash2 class="h-4 w-4" />{' '}
            {deleteConfirm() ? t('buttons.confirm') : t('doctor.shimDetails.remove')}
          </button>
          <button class="btn" onClick={handleAlter} disabled={props.isOperationRunning}>
            <Show
              when={!props.shim.isHidden}
              fallback={
                <>
                  <Eye class="h-4 w-4" /> {t('doctor.shimDetails.unhide')}
                </>
              }
            >
              <EyeOff class="h-4 w-4" /> {t('doctor.shimDetails.hide')}
            </Show>
          </button>
        </>
      }
    >
      <div class="space-y-3">
        <p class="text-sm break-all">
          <span class="text-base-content font-semibold">{t('doctor.shimDetails.source')}: </span>{' '}
          {props.shim.source}
        </p>
        <p class="text-sm break-all">
          <span class="text-base-content font-semibold">{t('doctor.shimDetails.path')}: </span>{' '}
          {props.shim.path}
        </p>
        <Show when={props.shim.args}>
          <p class="text-sm break-all">
            <span class="text-base-content font-semibold">
              {t('doctor.shimDetails.arguments')}:{' '}
            </span>
            <span class="bg-base-300 rounded px-1 font-mono">{props.shim.args}</span>
          </p>
        </Show>
      </div>
    </Modal>
  );
}

export default ShimDetailsModal;
