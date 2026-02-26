import { createSignal } from 'solid-js';
import { Plus } from 'lucide-solid';
import { t } from '../../../i18n';
import Modal from '../../common/Modal';

interface AddShimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, path: string, args: string, global: boolean) => void;
  isOperationRunning: boolean;
}

function AddShimModal(props: AddShimModalProps) {
  const [name, setName] = createSignal('');
  const [path, setPath] = createSignal('');
  const [args, setArgs] = createSignal('');
  const [isGlobal, setIsGlobal] = createSignal(false);

  const handleAdd = () => {
    if (name() && path()) {
      props.onAdd(name(), path(), args(), isGlobal());
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t('doctor.addShimModal.title')}
      size="medium"
      animation="scale"
      footer={
        <button
          class="btn btn-primary"
          onClick={handleAdd}
          disabled={!name() || !path() || props.isOperationRunning}
        >
          <Plus class="h-4 w-4" /> {t('doctor.addShimModal.addShim')}
        </button>
      }
    >
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">{t('doctor.addShimModal.shimName')}</span>
        </label>
        <input
          type="text"
          placeholder="e.g. my-app"
          class="input input-bordered w-full"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </div>
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">{t('doctor.addShimModal.commandPath')}</span>
        </label>
        <input
          type="text"
          placeholder="e.g. C:\\path\\to\\my-app.exe"
          class="input input-bordered w-full"
          value={path()}
          onInput={(e) => setPath(e.currentTarget.value)}
        />
      </div>
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">{t('doctor.addShimModal.arguments')}</span>
        </label>
        <input
          type="text"
          placeholder={t('doctor.addShimModal.argumentsPlaceholder')}
          class="input input-bordered w-full"
          value={args()}
          onInput={(e) => setArgs(e.currentTarget.value)}
        />
        <label class="label">
          <span class="label-text-alt">{t('doctor.addShimModal.argumentsHelp')}</span>
        </label>
      </div>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">{t('doctor.addShimModal.globalShim')}</span>
          <input
            type="checkbox"
            class="toggle toggle-primary"
            checked={isGlobal()}
            onChange={(e) => setIsGlobal(e.currentTarget.checked)}
          />
        </label>
      </div>
    </Modal>
  );
}

export default AddShimModal;
