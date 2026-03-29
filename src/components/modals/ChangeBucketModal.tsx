import Modal from '../common/Modal';
import { t } from '../../i18n';
import { For, createEffect, createSignal, untrack } from 'solid-js';
import { ScoopPackage } from '../../types/scoop';
import { BucketInfo } from '../../hooks/buckets/useBuckets';
import { invoke } from '@tauri-apps/api/core';

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
  const [filteredBuckets, setFilteredBuckets] = createSignal<BucketInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  let requestToken = 0;

  createEffect(() => {
    const isOpen = props.isOpen;
    const pkg = props.package;
    const availableBuckets = props.buckets;

    if (!isOpen || !pkg) {
      requestToken += 1;
      setFilteredBuckets([]);
      setLoading(false);
      return;
    }

    const token = ++requestToken;
    setLoading(true);
    invoke<string[]>('get_package_buckets', { packageName: pkg.name })
      .then((bucketNames) => {
        if (token !== requestToken) return;

        const availableSet = new Set(bucketNames.map((name) => name.toLowerCase()));
        const nextBuckets = availableBuckets.filter(
          (bucket) =>
            availableSet.has(bucket.name.toLowerCase()) &&
            bucket.name.toLowerCase() !== pkg.source.toLowerCase()
        );
        setFilteredBuckets(nextBuckets);

        const currentNewBucketName = untrack(() => props.newBucketName);
        if (!nextBuckets.some((bucket) => bucket.name === currentNewBucketName)) {
          props.onNewBucketNameChange(nextBuckets[0]?.name ?? '');
        }
      })
      .catch((err) => {
        if (token !== requestToken) return;

        console.error(`Failed to query available buckets for ${pkg.name}:`, err);
        setFilteredBuckets([]);
        props.onNewBucketNameChange('');
      })
      .finally(() => {
        if (token === requestToken) {
          setLoading(false);
        }
      });
  });

  const canConfirm = () => {
    if (loading()) return false;
    if (!props.newBucketName) return false;
    return filteredBuckets().some((bucket) => bucket.name === props.newBucketName);
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onCancel}
      title={t('packageInfo.changeBucketFor', { name: props.package?.name })}
      size="small"
      animation="scale"
      zIndex="z-61"
      footer={
        <>
          <button class="btn btn-close-outline" onClick={props.onCancel}>
            {t('buttons.cancel')}
          </button>
          <button class="btn btn-primary" onClick={props.onConfirm} disabled={!canConfirm()}>
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
            class="select select-bordered w-full rounded-lg"
            disabled={loading() || filteredBuckets().length === 0}
          >
            <option value="" disabled>
              {loading() ? t('messages.loading') : t('packageInfo.bucket')}
            </option>
            <For each={filteredBuckets()}>
              {(bucket) => <option value={bucket.name}>{bucket.name}</option>}
            </For>
          </select>
          <div class="text-base-content/70 mt-2 text-sm">
            {t('packageInfo.current')}: {props.package?.source}
          </div>
        </div>
        <div class="status-alert-warning border-info/20 rounded-sm border p-3">
          <p class="text-sm">
            <strong>{t('packageInfo.warning')}:</strong>{' '}
            <span class="text-base-content/90">{t('packageInfo.ensureSoftwarePresent')}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default ChangeBucketModal;
