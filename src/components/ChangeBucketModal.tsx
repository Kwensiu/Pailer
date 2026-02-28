import Modal from './common/Modal';
import { t } from '../i18n';
import { For } from 'solid-js';
import { ScoopPackage } from '../types/scoop';
import { BucketInfo } from '../hooks/useBuckets';

interface ChangeBucketModalProps {
  isOpen: boolean;
  package: ScoopPackage | null;
  buckets: BucketInfo[];
  newBucketName: string;
  onNewBucketNameChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ChangeBucketModal(props: ChangeBucketModalProps) {
  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onCancel}
      title={t('packageInfo.changeBucketFor', { name: props.package?.name })}
      size="medium"
      animation="scale"
      zIndex="z-61"
      footer={
        <>
          <button class="btn btn-close-outline" onClick={props.onCancel}>
            {t('buttons.cancel')}
          </button>
          <button class="btn btn-primary" onClick={props.onConfirm}>
            {t('buttons.confirm')}
          </button>
        </>
      }
    >
      <div class="space-y-4">
        <div>
          <select
            value={props.newBucketName}
            onInput={(e) => props.onNewBucketNameChange(e.currentTarget.value)}
            class="select select-bordered w-full max-w-xs rounded-lg"
          >
            <option value="" disabled>
              {t('packageInfo.bucket')}
            </option>
            <For each={props.buckets}>
              {(bucket) => <option value={bucket.name}>{bucket.name}</option>}
            </For>
          </select>
          <div class="text-base-content/70 mt-2 text-sm">
            {t('packageInfo.current')}: {props.package?.source}
          </div>
        </div>
        <div class="bg-warning/90 border-info/20 rounded-sm border p-3">
          <p class="text-info-content/85 text-sm">
            <strong class="text-yellow-800">{t('packageInfo.warning')}:</strong>{' '}
            {t('packageInfo.ensureSoftwarePresent')}
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default ChangeBucketModal;
