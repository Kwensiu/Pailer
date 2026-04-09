import Modal from '../common/Modal';
import { t } from '../../i18n';
import { For, createEffect, createSignal, untrack } from 'solid-js';
import { ScoopPackage } from '../../types/scoop';
import { BucketInfo } from '../../hooks/buckets/useBuckets';
import { invoke } from '@tauri-apps/api/core';

interface PackageBucketContext {
  currentBucket: string | null;
  candidateBuckets: string[];
}

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
  const [currentBucketName, setCurrentBucketName] = createSignal('');
  let requestToken = 0;

  createEffect(() => {
    const isOpen = props.isOpen;
    const pkg = props.package;
    const availableBuckets = props.buckets;

    if (!isOpen || !pkg) {
      requestToken += 1;
      setFilteredBuckets([]);
      setLoading(false);
      setCurrentBucketName('');
      return;
    }

    const token = ++requestToken;
    setLoading(true);
    invoke<PackageBucketContext>('get_package_buckets', { packageName: pkg.name })
      .then(({ candidateBuckets, currentBucket }) => {
        if (token !== requestToken) return;

        const resolvedCurrentBucket = currentBucket || pkg.source;
        setCurrentBucketName(resolvedCurrentBucket);
        const bucketMap = new Map(
          availableBuckets.map((bucket) => [bucket.name.toLowerCase(), bucket])
        );
        const nextBuckets = candidateBuckets.map((bucketName) => {
          const existingBucket = bucketMap.get(bucketName.toLowerCase());
          return (
            existingBucket ?? {
              name: bucketName,
              path: '',
              manifest_count: 0,
              is_git_repo: false,
            }
          );
        });
        setFilteredBuckets(nextBuckets);

        const selectedBucket =
          nextBuckets.find(
            (bucket) => bucket.name.toLowerCase() === resolvedCurrentBucket.toLowerCase()
          ) ?? nextBuckets[0];

        const currentValue = (untrack(() => props.newBucketName) || '').trim();
        const hasValidCurrentValue = nextBuckets.some(
          (bucket) => bucket.name.toLowerCase() === currentValue.toLowerCase()
        );

        if (!hasValidCurrentValue) {
          props.onNewBucketNameChange(selectedBucket?.name ?? '');
        }
      })
      .catch((err) => {
        if (token !== requestToken) return;

        console.error(`Failed to query available buckets for ${pkg.name}:`, err);
        setFilteredBuckets([]);
        setCurrentBucketName(pkg.source);
        props.onNewBucketNameChange(pkg.source);
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
    if (!filteredBuckets().some((bucket) => bucket.name === props.newBucketName)) return false;
    return props.newBucketName.toLowerCase() !== currentBucketName().toLowerCase();
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
          <button class="btn btn-footer btn-close-outline" onClick={props.onCancel}>
            {t('buttons.cancel')}
          </button>
          <button
            class="btn btn-footer btn-primary"
            onClick={props.onConfirm}
            disabled={!canConfirm()}
          >
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
            {t('packageInfo.current')}: {currentBucketName() || props.package?.source}
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
