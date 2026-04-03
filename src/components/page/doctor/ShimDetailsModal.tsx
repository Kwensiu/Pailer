import { Show, createSignal, onCleanup, createEffect } from 'solid-js';
import { Trash2, Eye, EyeOff, Check } from 'lucide-solid';
import { invoke } from '@tauri-apps/api/core';
import { Shim } from './ShimManager';
import { t } from '../../../i18n';
import Modal from '../../common/Modal';

interface ShimDetailsModalProps {
  isOpen: boolean;
  shim: Shim;
  onClose: () => void;
  onRemove: (name: string) => void;
  onAlter: (name: string) => void;
  onUpdated: () => void;
  isOperationRunning: boolean;
}

function ShimDetailsModal(props: ShimDetailsModalProps) {
  // State for delete confirmation
  const [deleteConfirm, setDeleteConfirm] = createSignal(false);
  const [deleteTimer, setDeleteTimer] = createSignal<number | null>(null);

  // State for editing args
  const [editedArgs, setEditedArgs] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);

  // Cleanup timer on unmount
  onCleanup(() => {
    if (deleteTimer()) {
      window.clearTimeout(deleteTimer()!);
    }
  });

  // Reset state when modal closes or shim changes
  createEffect(() => {
    if (!props.isOpen || !props.shim) {
      setDeleteConfirm(false);
      if (deleteTimer()) {
        window.clearTimeout(deleteTimer()!);
        setDeleteTimer(null);
      }
    }
    // Sync editedArgs with shim.args
    if (props.shim) {
      setEditedArgs(props.shim.args || '');
    }
  });

  const handleRemove = () => {
    if (deleteConfirm()) {
      if (deleteTimer()) {
        window.clearTimeout(deleteTimer()!);
        setDeleteTimer(null);
      }
      setDeleteConfirm(false);
      props.onRemove(props.shim.name);
    } else {
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

  const saveArgs = async () => {
    setIsSaving(true);
    try {
      const newArgs = editedArgs().trim();
      await invoke('update_shim_args', {
        shimName: props.shim.name,
        args: newArgs || null,
      });
      props.onUpdated();
    } catch (err) {
      console.error('Failed to update shim args:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      size="small"
      hideHeader={true}
      noAutoFocus={true}
      animation="scale"
    >
      <div class="space-y-4">
        {/* Title */}
        <h3 class="text-lg font-bold">{props.shim.name}</h3>

        {/* Content */}
        <div class="space-y-3">
          <p class="text-sm break-all">
            <span class="text-base-content font-semibold">{t('doctor.shimDetails.source')}: </span>{' '}
            {props.shim.source}
          </p>
          <p class="text-sm break-all">
            <span class="text-base-content font-semibold">{t('doctor.shimDetails.path')}: </span>{' '}
            {props.shim.path}
          </p>

          {/* Args - always editable */}
          <div class="text-sm">
            <span class="text-base-content mb-1 block font-semibold">
              {t('doctor.shimDetails.arguments')}:
            </span>
            <div class="flex gap-2">
              <input
                type="text"
                class="input input-sm input-bordered flex-1 rounded-lg font-mono"
                value={editedArgs()}
                onInput={(e) => setEditedArgs(e.currentTarget.value)}
                placeholder={t('doctor.shimDetails.noArgs')}
                disabled={props.isOperationRunning || isSaving()}
              />
              <button
                class="btn btn-primary btn-sm rounded-lg"
                onClick={saveArgs}
                disabled={isSaving()}
                type="button"
              >
                <Check size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div class="border-base-200 flex justify-end gap-2 border-t pt-2">
          <button
            class="btn btn-footer"
            classList={{
              'btn-error': !deleteConfirm(),
              'btn-warning': deleteConfirm(),
            }}
            onClick={handleRemove}
            disabled={props.isOperationRunning || isSaving()}
          >
            <Trash2 size={16} />
            {deleteConfirm() ? t('buttons.confirm') : t('buttons.remove')}
          </button>
          <button
            class="btn btn-footer"
            onClick={handleAlter}
            disabled={props.isOperationRunning || isSaving()}
          >
            <Show
              when={!props.shim.isHidden}
              fallback={
                <>
                  <Eye size={16} /> {t('doctor.shimDetails.unhide')}
                </>
              }
            >
              <EyeOff size={16} /> {t('doctor.shimDetails.hide')}
            </Show>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ShimDetailsModal;
