import { For, Show, createMemo, createSignal } from 'solid-js';
import { useBucketInstall } from '../../../hooks/buckets/useBucketInstall';
import { clearManifestCache } from '../../../hooks/buckets/useBuckets';
import { RefreshCw, Package } from 'lucide-solid';
import Modal from '../../common/Modal';
import BranchSelector from '../../common/BranchSelector';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import { t } from '../../../i18n';
import { BucketInfoModalHeader } from './Header';
import { BucketInfoModalFooter } from './Footer';
import { BucketDetailRenderer } from './DetailRenderer';
import type { BucketInfoModalProps } from './types';

function ManifestsList(props: {
  manifests: string[];
  loading: boolean;
  onPackageClick?: (packageName: string) => void;
  searchQuery?: string;
  showAll?: boolean;
  onLoadAll?: () => void;
  class?: string;
}) {
  const filteredManifests = createMemo(() => {
    const query = props.searchQuery?.trim().toLowerCase();
    if (!query) return props.manifests;
    return props.manifests.filter((manifest) => manifest.toLowerCase().includes(query));
  });
  const isLargeList = () => filteredManifests().length > 1500;
  const shouldShowAll = () => props.showAll || !isLargeList();

  return (
    <div class={props.class || ''}>
      <Show
        when={!props.loading}
        fallback={
          <div class="z-0 flex items-center gap-2 py-4">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="text-sm">{t('bucketInfo.loadingPackages')}</span>
          </div>
        }
      >
        <Show
          when={filteredManifests().length > 0}
          fallback={
            <div class="py-4 text-center">
              <p class="text-base-content/70 text-sm">{t('bucketInfo.noPackagesFound')}</p>
            </div>
          }
        >
          <Show
            when={isLargeList() && !shouldShowAll()}
            fallback={
              <div class="max-h-72 min-h-9 overflow-y-auto">
                <div
                  class="grid gap-1 text-xs"
                  style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
                >
                  <For each={filteredManifests()}>
                    {(manifest) => {
                      const cleanName = manifest.replace(/ \(root\)$/, '');
                      return (
                        <button
                          type="button"
                          class="btn btn-soft btn-sm w-full justify-start rounded-lg"
                          onClick={() => props.onPackageClick?.(cleanName)}
                          title={t('bucketInfo.clickToViewInfo', { name: cleanName })}
                        >
                          <Package size={14} />
                          {manifest}
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>
            }
          >
            <div class="py-20 text-center">
              <div class="mb-4">
                <p class="text-base-content/70 mb-2 text-sm">
                  {t('bucketInfo.tooManyPackages', { count: filteredManifests().length })}
                </p>
                <p class="text-base-content/50 text-xs">{t('bucketInfo.loadAllWarning')}</p>
              </div>
              <button class="btn btn-primary btn-sm" onClick={() => props.onLoadAll?.()}>
                {t('bucketInfo.loadAllPackages')}
              </button>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

function BucketInfoModal(props: BucketInfoModalProps) {
  const bucketInstall = useBucketInstall();

  const [manifestQuery, setManifestQuery] = createSignal('');

  const bucketName = () => props.bucket?.name || props.searchBucket?.name || props.bucketName || '';
  const modalBucketName = () => bucketName();
  const isExternalBucket = () => !props.bucket && !!props.searchBucket;

  const [showAllManifests, setShowAllManifests] = createSignal(false);

  const handleInstallBucket = async () => {
    if (!props.searchBucket) return;
    try {
      const result = await bucketInstall.installBucket({
        name: props.searchBucket.name,
        url: props.searchBucket.url,
        force: false,
      });

      if (result.success) {
        props.onBucketInstalled?.();

        if (props.onFetchManifests) {
          await props.onFetchManifests(props.searchBucket.name);
        }
      }
    } catch (error) {
      console.error('Failed to install bucket:', error);
    }
  };

  const handleRemoveBucket = async () => {
    const name = bucketName();
    if (!name) return;
    try {
      const result = await bucketInstall.removeBucket(name);
      if (result.success) {
        props.onBucketInstalled?.();
        props.onClose();
      }
    } catch (error) {
      console.error('Failed to remove bucket:', error);
    }
  };

  const handleLoadAllManifests = () => setShowAllManifests(true);

  const handleFetchPackages = async () => {
    const name = bucketName();
    if (!name || !props.onFetchManifests) return;
    await props.onFetchManifests(name);
  };

  const handleRefreshManifests = async () => {
    const name = bucketName();
    if (!name) return;
    clearManifestCache(name);
    if (props.onFetchManifests) {
      await props.onFetchManifests(name);
    }
  };

  const handleBranchChanged = (newBranch: string) => {
    if (props.onBucketUpdated && bucketName()) {
      props.onBucketUpdated(bucketName(), newBranch);
    }
  };

  const orderedDetails = createMemo(() => {
    if (!props.bucket) return [];
    const details = [
      { key: 'name', label: t('bucketInfo.name'), value: props.bucket.name },
      {
        key: 'type',
        label: t('bucketInfo.type'),
        value: props.bucket.is_git_repo
          ? t('bucketInfo.gitRepository')
          : t('bucketInfo.localDirectory'),
      },
      { key: 'packages', label: t('bucketInfo.packages'), value: props.bucket.manifest_count },
      { key: 'branch', label: t('bucketInfo.branch'), value: props.bucket.git_branch },
      { key: 'lastUpdated', label: t('bucketInfo.lastUpdated'), value: props.bucket.last_updated },
      { key: 'path', label: t('bucketInfo.path'), value: props.bucket.path },
    ];
    if (props.bucket.git_url) {
      details.push({
        key: 'git_url',
        label: t('bucketInfo.repository'),
        value: props.bucket.git_url,
      });
    }
    return details;
  });

  const searchBucketDetails = createMemo(() => {
    if (!props.searchBucket) return [];
    const details = [
      { key: 'name', label: t('bucketInfo.name'), value: props.searchBucket.name },
      { key: 'type', label: t('bucketInfo.type'), value: t('bucketInfo.gitRepository') },
      { key: 'packages', label: t('bucketInfo.packages'), value: props.searchBucket.apps },
      { key: 'repository', label: t('bucketInfo.repository'), value: props.searchBucket.url },
    ];
    if (props.searchBucket.last_updated && props.searchBucket.last_updated !== 'Unknown') {
      details.push({
        key: 'lastUpdated',
        label: t('bucketInfo.lastUpdated'),
        value: props.searchBucket.last_updated,
      });
    }
    return details.filter((item) => item.value !== undefined && item.value !== null);
  });

  const resolvedBucketState = createMemo(() => {
    const name = bucketName();
    const modalName = modalBucketName();
    const externalBucket = isExternalBucket();
    const installed = (() => {
      if (props.isInstalled !== undefined) {
        return props.isInstalled;
      }
      if (props.bucket && !props.searchBucket) {
        return true;
      }
      if (props.installedBuckets && name) {
        return props.installedBuckets.some((installedBucket) => installedBucket.name === name);
      }
      return false;
    })();

    return {
      name,
      modalName,
      externalBucket,
      installed,
      details: props.bucket && installed ? orderedDetails() : searchBucketDetails(),
    };
  });

  const headerAction = (
    <BucketInfoModalHeader
      bucket={props.bucket}
      searchBucket={props.searchBucket}
      isExternalBucket={() => resolvedBucketState().externalBucket}
      isInstalled={() => resolvedBucketState().installed}
      bucketName={() => resolvedBucketState().name}
      onBucketUpdated={props.onBucketUpdated}
    />
  );

  const footer = (
    <BucketInfoModalFooter
      bucketName={() => resolvedBucketState().name}
      searchBucket={props.searchBucket}
      isInstalled={() => resolvedBucketState().installed}
      bucketInstall={bucketInstall}
      onInstallBucket={handleInstallBucket}
      onRemoveBucket={handleRemoveBucket}
    />
  );

  return (
    <Show when={!!props.bucket || !!props.searchBucket || !!props.bucketName}>
      <Modal
        isOpen={!!props.bucket || !!props.searchBucket || !!props.bucketName}
        onClose={props.onClose}
        title={
          <span class="flex items-center gap-2">
            {t('bucketInfo.bucket')}:{' '}
            <span class="text-info font-mono">{resolvedBucketState().modalName}</span>
            <Show when={props.bucket?.is_git_repo && props.bucket?.name}>
              {(() => {
                const bucket = props.bucket!;
                return (
                  <BranchSelector
                    bucketName={bucket.name}
                    currentBranch={bucket.git_branch}
                    onBranchChanged={handleBranchChanged}
                  />
                );
              })()}
            </Show>
          </span>
        }
        size="large"
        animation="scale"
        headerAction={headerAction}
        footer={footer}
        preventBackdropClose={false}
        zIndex={props.zIndex}
      >
        <Show when={props.error}>
          <div role="alert" class="alert alert-error mb-4">
            <span>{props.error}</span>
          </div>
        </Show>
        <Show when={props.loading}>
          <div class="flex items-center gap-2 py-4">
            <span class="loading loading-spinner loading-sm" />
            <span class="text-base-content/70 text-sm">{t('bucketInfo.loading')}</span>
          </div>
        </Show>
        <Show when={props.bucket || props.searchBucket}>
          <div class="grid grid-cols-1 gap-3 xl:grid-cols-[4fr_3fr] xl:items-stretch">
            <div class="bg-base-200/20 border-base-content/8 min-w-0 rounded-xl border p-3">
              <For each={resolvedBucketState().details}>
                {(item) => (
                  <BucketDetailRenderer
                    item={item}
                    bucket={props.bucket}
                    onOpenPath={async (path) => {
                      try {
                        await openPath(path);
                      } catch (error) {
                        console.error('Failed to open path:', error);
                      }
                    }}
                    onOpenUrl={async (url) => {
                      try {
                        await openUrl(url);
                      } catch (error) {
                        console.error('Failed to open URL:', error);
                      }
                    }}
                  />
                )}
              </For>
            </div>

            <div class="bg-base-200/20 border-base-content/8 flex min-w-0 flex-col rounded-xl border p-3">
              <Show
                when={props.fromPackageModal}
                fallback={
                  <>
                    <div class="mb-2 flex shrink-0 items-center justify-between">
                      <h4 class="text-sm font-semibold tracking-wide uppercase opacity-70">
                        {t('bucketInfo.packages')}
                      </h4>
                      <Show when={props.manifests.length > 0}>
                        <button
                          class="btn btn-ghost btn-xs"
                          onClick={handleRefreshManifests}
                          title={t('bucketInfo.refreshManifests')}
                        >
                          <RefreshCw class="h-3 w-3" />
                        </button>
                      </Show>
                    </div>
                    <Show when={props.manifests.length > 0}>
                      <input
                        type="text"
                        value={manifestQuery()}
                        onInput={(e) => setManifestQuery(e.currentTarget.value)}
                        placeholder={t('app.search')}
                        class="input input-sm input-bordered mb-2 w-full rounded-lg"
                      />
                    </Show>
                    <ManifestsList
                      manifests={props.manifests}
                      loading={props.manifestsLoading}
                      onPackageClick={(name) =>
                        props.onPackageClick?.(name, resolvedBucketState().name)
                      }
                      searchQuery={manifestQuery()}
                      showAll={showAllManifests()}
                      onLoadAll={handleLoadAllManifests}
                      class="min-h-0 flex-1"
                    />
                  </>
                }
              >
                <div class="flex flex-1 items-center justify-center py-8">
                  <div class="text-center">
                    <div class="bg-base-content/5 mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full">
                      <Package class="text-base-content/50 h-6 w-6" />
                    </div>
                    <p class="text-base-content/70 text-sm whitespace-pre-line">
                      {t('bucketInfo.viewPackagesOnRepository')}
                    </p>
                    <Show when={props.onFetchManifests && props.manifests.length === 0}>
                      <button
                        class="btn btn-primary btn-sm mt-4"
                        onClick={handleFetchPackages}
                        disabled={props.manifestsLoading}
                      >
                        <Show when={props.manifestsLoading} fallback={t('bucketInfo.loadPackages')}>
                          <span class="loading loading-spinner loading-xs"></span>
                          {t('bucketInfo.loadingPackages')}
                        </Show>
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </Modal>
    </Show>
  );
}

export default BucketInfoModal;
export type { BucketInfoModalProps } from './types';
