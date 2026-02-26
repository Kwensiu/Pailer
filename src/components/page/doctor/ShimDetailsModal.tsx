import { Show } from 'solid-js';
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
  const handleRemove = () => {
    props.onRemove(props.shim.name);
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
          <button class="btn btn-error" onClick={handleRemove} disabled={props.isOperationRunning}>
            <Trash2 class="h-4 w-4" /> {t('doctor.shimDetails.remove')}
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
