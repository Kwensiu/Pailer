import { createMemo } from 'solid-js';
import Modal from '../common/Modal';
import { t } from '../../i18n';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  children: any;
  onDelete?: () => void;
  type?:
    | 'default'
    | 'destructive'
    | 'version-management'
    | 'cleanup-all-versions'
    | 'pailer-update';
}

// Button configuration system
const buttonConfigs = {
  default: (props: ConfirmationModalProps) => (
    <div class="flex w-full justify-end gap-2">
      <button class="btn-close-outline flex-1" onClick={props.onCancel}>
        {props.cancelText || t('buttons.cancel')}
      </button>
      <button class="btn btn-footer btn-error flex-1" onClick={props.onConfirm}>
        {props.confirmText || t('buttons.confirm')}
      </button>
    </div>
  ),

  destructive: (props: ConfirmationModalProps) => (
    <div class="flex w-full justify-end gap-2">
      <button class="btn btn-footer btn-error flex-1" onClick={props.onConfirm}>
        {props.confirmText || t('buttons.confirm')}
      </button>
      <button class="btn-close-outline flex-1" onClick={props.onCancel}>
        {props.cancelText || t('buttons.cancel')}
      </button>
    </div>
  ),

  'version-management': (props: ConfirmationModalProps) => (
    <div class="w-full space-y-2 pt-2">
      <div class="flex w-full gap-2">
        <button class="btn btn-footer btn-error btn-sm flex-1" onClick={() => props.onDelete?.()}>
          {t('buttons.delete')}
        </button>
        <button class="btn btn-footer btn-primary btn-sm flex-1" onClick={props.onConfirm}>
          {t('buttons.switch')}
        </button>
      </div>
      <button class="btn btn-footer btn-soft btn-sm btn-close w-full!" onClick={props.onCancel}>
        {t('buttons.cancel')}
      </button>
    </div>
  ),

  'cleanup-all-versions': (props: ConfirmationModalProps) => (
    <div class="flex w-full justify-end gap-2">
      <button class="btn btn-footer btn-error flex-1" onClick={props.onConfirm}>
        {t('buttons.delete')}
      </button>
      <button class="btn btn-close-outline flex-1" onClick={props.onCancel}>
        {t('buttons.cancel')}
      </button>
    </div>
  ),

  'pailer-update': (props: ConfirmationModalProps) => (
    <div class="flex w-full justify-end gap-2">
      <button class="btn-close-outline flex-1" onClick={props.onCancel}>
        {props.cancelText || t('buttons.cancel')}
      </button>
      <button class="btn btn-info flex-1" onClick={props.onConfirm}>
        {props.confirmText || t('buttons.confirm')}
      </button>
    </div>
  ),
} as const;

function ConfirmationModal(props: ConfirmationModalProps) {
  const buttons = createMemo(() => {
    const config = buttonConfigs[props.type || 'default'];
    return config(props);
  });

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onCancel}
      title=""
      hideHeader={true}
      animation="scale"
      class="w-auto! max-w-lg min-w-xs"
    >
      <div class="space-y-4">
        {/* Title */}
        <h3 class="text-lg font-bold">{props.title}</h3>

        {/* Content */}
        <div class="text-base-content/70">{props.children}</div>

        {/* Buttons */}
        {buttons()}
      </div>
    </Modal>
  );
}

export default ConfirmationModal;
