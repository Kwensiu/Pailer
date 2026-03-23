import {
  For,
  Show,
  createMemo,
  createSignal,
  Switch,
  Match,
  createEffect,
  onCleanup,
} from 'solid-js';
import { BucketInfo } from '../../hooks/buckets/useBuckets';
import { SearchableBucket } from '../../hooks/buckets/useBucketSearch';
import { useBucketInstall } from '../../hooks/buckets/useBucketInstall';
import { clearManifestCache } from '../../hooks/buckets/useBuckets';
import {
  Ellipsis,
  GitBranch,
  Download,
  Trash2,
  LoaderCircle,
  GalleryVerticalEnd,
  RefreshCw,
  FolderOpen,
  Globe,
} from 'lucide-solid';
import Dropdown, { type DropdownItem } from '../common/Dropdown';
import Modal from '../common/Modal';
import BranchSelector from '../common/BranchSelector';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import settingsStore from '../../stores/settings';
import { t } from '../../i18n';
import { formatBucketDate } from '../../utils/date';

interface BucketInfoModalProps {
  bucket: BucketInfo | null;
  manifests: string[];
  manifestsLoading: boolean;
  error: string | null;
  description?: string; // Optional description for external/search buckets
  searchBucket?: SearchableBucket; // For external buckets from search
  isInstalled?: boolean; // Whether this bucket is currently installed
  installedBuckets?: BucketInfo[]; // List of installed buckets to check against
  onClose: () => void;
  onPackageClick?: (packageName: string, bucketName: string) => void;
  onBucketInstalled?: () => void; // Callback when bucket is installed/removed
  onFetchManifests?: (bucketName: string) => Promise<void>; // Callback to fetch manifests for newly installed bucket
  onBucketUpdated?: (bucketName: string, newBranch?: string) => void; // Callback when bucket is updated (e.g., branch switch)
  zIndex?: string; // Z-index for modal layering
  fromPackageModal?: boolean; // Whether opened from PackageInfoModal
}

// Component to render bucket detail values
function DetailValue(props: { value: string | number | undefined }) {
  const displayValue = () => {
    if (props.value === undefined || props.value === null) return t('bucketInfo.unknown');
    return String(props.value);
  };

  return <span class="wrap-break-word">{displayValue()}</span>;
}

// Component to render manifest lists in a compact, scrollable form
function ManifestsList(props: {
  manifests: string[];
  loading: boolean;
  onPackageClick?: (packageName: string) => void;
  showAll?: boolean;
  onLoadAll?: () => void;
}) {
  const isLargeList = () => props.manifests.length > 1500;
  const shouldShowAll = () => props.showAll || !isLargeList();

  return (
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
        when={props.manifests.length > 0}
        fallback={
          <div class="py-4 text-center">
            <p class="text-base-content/70 text-sm">{t('bucketInfo.noPackagesFound')}</p>
          </div>
        }
      >
        <Show
          when={isLargeList() && !shouldShowAll()}
          fallback={
            <div class="max-h-60 overflow-y-auto">
              <div class="grid grid-cols-2 gap-1 text-xs">
                <For each={props.manifests}>
                  {(manifest) => {
                    // Clean up manifest name (remove (root) suffix if present)
                    const cleanName = manifest.replace(/ \(root\)$/, '');
                    return (
                      <div
                        class="hover:text-primary hover:bg-base-300 cursor-pointer rounded px-1 py-0.5 transition-colors"
                        onClick={() => props.onPackageClick?.(cleanName)}
                        title={t('bucketInfo.clickToViewInfo', { name: cleanName })}
                      >
                        {manifest}
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          }
        >
          <div class="py-19 text-center">
            <div class="mb-4">
              <p class="text-base-content/70 mb-2 text-sm">
                {t('bucketInfo.tooManyPackages', { count: props.manifests.length })}
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
  );
}

function BucketInfoModal(props: BucketInfoModalProps) {
  const bucketInstall = useBucketInstall();
  const { settings } = settingsStore;

  // State for remove confirmation
  const [removeConfirm, setRemoveConfirm] = createSignal(false);
  const [removeTimer, setRemoveTimer] = createSignal<number | null>(null);

  let leftDetailsEl: HTMLDivElement | undefined;
  const [rightCardHeight, setRightCardHeight] = createSignal<number | undefined>(undefined);
  let rafId: number | null = null;

  const measureLeftDetailsHeight = () => {
    if (!leftDetailsEl) return;
    const height = leftDetailsEl.offsetHeight;
    setRightCardHeight(height || undefined);
  };

  const measureNextFrame = () => {
    // Cancel any pending RAF to prevent race conditions
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    // Double RAF ensures layout/fonts are settled
    rafId = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        measureLeftDetailsHeight();
        rafId = null;
      })
    );
  };

  // Re-measure when visible content changes.
  createEffect(() => {
    // Track dependencies that actually affect layout
    props.bucket?.name;
    props.searchBucket?.name;
    props.manifestsLoading;
    props.manifests.length;

    measureNextFrame();
  });

  const onResize = () => measureNextFrame();
  window.addEventListener('resize', onResize);
  onCleanup(() => {
    window.removeEventListener('resize', onResize);
    if (removeTimer()) {
      clearTimeout(removeTimer()!);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });

  const isDark = () => settings.theme === 'dark';
  const BgColor = () => (isDark() ? '#282c34' : '#f0f4f9');

  const bucketName = () => props.bucket?.name || props.searchBucket?.name || '';
  const isExternalBucket = () => !props.bucket && !!props.searchBucket;

  // State for handling large manifest lists
  const [showAllManifests, setShowAllManifests] = createSignal(false);

  // Properly check if bucket is installed
  const isInstalled = () => {
    const name = bucketName();

    // If explicitly provided, use that
    if (props.isInstalled !== undefined) {
      return props.isInstalled;
    }

    // If we have a bucket from local data (props.bucket), it's installed
    if (props.bucket && !props.searchBucket) {
      return true;
    }

    // If we have installed buckets list, check against it
    if (props.installedBuckets && name) {
      const installed = props.installedBuckets.some((installed) => installed.name === name);
      return installed;
    }

    // Default: if it's a search bucket only, it's not installed
    return false;
  };

  // Handle bucket installation
  const handleInstallBucket = async () => {
    if (!props.searchBucket) return;

    try {
      const result = await bucketInstall.installBucket({
        name: props.searchBucket.name,
        url: props.searchBucket.url,
        force: false,
      });

      if (result.success) {
        console.log('Bucket installed successfully from modal, refreshing bucket list');

        // First refresh the bucket list
        props.onBucketInstalled?.();

        // Then fetch manifests for the newly installed bucket
        if (props.onFetchManifests) {
          console.log('Fetching manifests for newly installed bucket:', props.searchBucket.name);
          await props.onFetchManifests(props.searchBucket.name);
        }
      } else {
        console.error('Bucket installation failed:', result.message);
      }
    } catch (error) {
      console.error('Failed to install bucket:', error);
    }
  };

  // Handle bucket removal
  const handleRemoveBucket = async () => {
    const name = bucketName();
    if (!name) return;

    try {
      const result = await bucketInstall.removeBucket(name);

      if (result.success) {
        console.log('Bucket removed successfully from modal, refreshing bucket list');
        props.onBucketInstalled?.();
        // Close modal after successful removal
        props.onClose();
      } else {
        console.error('Bucket removal failed:', result.message);
      }
    } catch (error) {
      console.error('Failed to remove bucket:', error);
    }
  };

  // Handle loading all manifests for large buckets
  const handleLoadAllManifests = () => {
    setShowAllManifests(true);
  };

  // Handle refreshing manifests with cache clear
  const handleRefreshManifests = async () => {
    const name = bucketName();
    if (!name) return;

    // Clear cache for this bucket
    clearManifestCache(name);

    // Fetch fresh manifests
    if (props.onFetchManifests) {
      await props.onFetchManifests(name);
    }
  };

  // Handle branch change in modal
  const handleBranchChanged = (newBranch: string) => {
    // Update bucket info and refresh manifests after branch change
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

    // Add git_url if it exists
    if (props.bucket.git_url) {
      details.push({
        key: 'repository',
        label: t('bucketInfo.repository'),
        value: props.bucket.git_url,
      });
    }

    return details.filter((item) => item.value !== undefined && item.value !== null);
  });

  const searchBucketDetails = createMemo(() => {
    if (!props.searchBucket) return [];

    const details = [
      { key: 'name', label: t('bucketInfo.name'), value: props.searchBucket.name },
      { key: 'type', label: t('bucketInfo.type'), value: t('bucketInfo.gitRepository') },
      { key: 'packages', label: t('bucketInfo.packages'), value: props.searchBucket.apps },
      { key: 'repository', label: t('bucketInfo.repository'), value: props.searchBucket.url },
    ];

    // Add last_updated if it exists and is not 'Unknown'
    if (props.searchBucket.last_updated && props.searchBucket.last_updated !== 'Unknown') {
      details.push({
        key: 'lastUpdated',
        label: t('bucketInfo.lastUpdated'),
        value: props.searchBucket.last_updated,
      });
    }

    return details.filter((item) => item.value !== undefined && item.value !== null);
  });

  const menuItems = createMemo(() => {
    const items: DropdownItem[] = [];

    // Refresh bucket - moved to first position
    if (isInstalled()) {
      items.push({
        label: t('bucketInfo.refreshBucket'),
        onClick: () => {
          const name = bucketName();
          if (name) props.onBucketUpdated?.(name);
        },
        icon: RefreshCw,
      });
    }

    // Open in Explorer
    const path = props.bucket?.path;
    if (path) {
      items.push({
        label: t('bucketInfo.openFolder'),
        onClick: async () => {
          try {
            await openPath(path);
          } catch (error) {
            console.error('Failed to open folder:', error);
            // Could show user feedback here if needed
          }
        },
        icon: FolderOpen,
      });
    }

    // View on GitHub
    const url = props.bucket?.git_url || props.searchBucket?.url;
    items.push({
      label: t('bucketInfo.viewOnGithub'),
      onClick: async () => {
        if (url) {
          try {
            await openUrl(url);
          } catch (error) {
            console.error('Failed to open URL:', error);
            // Could show user feedback here if needed
          }
        }
      },
      icon: Globe,
      disabled: !url,
    });

    return items;
  });

  const headerAction = (
    <div class="flex items-center gap-2">
      <Show when={isExternalBucket()}>
        <div class="badge badge-warning badge-sm">{t('bucketInfo.external')}</div>
      </Show>
      <Dropdown
        position="end"
        items={menuItems()}
        trigger={<Ellipsis class="h-5 w-5" />}
        triggerClass="btn btn-ghost btn-sm btn-circle"
      />
    </div>
  );

  const footer = (
    <>
      <Show when={!isInstalled() && props.searchBucket}>
        <button
          type="button"
          class="btn btn-primary"
          onClick={handleInstallBucket}
          disabled={bucketInstall.isBucketBusy(bucketName())}
        >
          <Show
            when={bucketInstall.isBucketInstalling(bucketName())}
            fallback={
              <>
                <Download class="mr-2 h-4 w-4" />
                {t('bucketInfo.install')}
              </>
            }
          >
            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
            {t('bucketInfo.installing')}
          </Show>
        </button>
      </Show>
      <Show when={isInstalled()}>
        <button
          type="button"
          class="btn btn-error"
          classList={{ 'btn-warning': removeConfirm() }}
          onClick={() => {
            if (removeConfirm()) {
              // Execute remove
              if (removeTimer()) {
                window.clearTimeout(removeTimer()!);
                setRemoveTimer(null);
              }
              setRemoveConfirm(false);
              handleRemoveBucket();
            } else {
              // First click - show confirmation
              setRemoveConfirm(true);
              const timer = window.setTimeout(() => {
                setRemoveConfirm(false);
                setRemoveTimer(null);
              }, 3000);
              setRemoveTimer(timer);
            }
          }}
          disabled={bucketInstall.isBucketBusy(bucketName())}
        >
          <Show
            when={bucketInstall.isBucketRemoving(bucketName())}
            fallback={
              <>
                <Trash2 class="mr-2 h-4 w-4" />
                {removeConfirm() ? t('buttons.sure') : t('buttons.remove')}
              </>
            }
          >
            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
            {t('bucketInfo.removing')}
          </Show>
        </button>
      </Show>
      <button class="btn btn-soft w-18" data-modal-close>
        {t('bucketInfo.close')}
      </button>
    </>
  );

  return (
    <Show when={!!props.bucket || !!props.searchBucket}>
      <Modal
        isOpen={!!props.bucket || !!props.searchBucket}
        onClose={props.onClose}
        title={
          <span class="flex items-center gap-2">
            {t('bucketInfo.bucket')}:{' '}
            <span class="text-info font-mono">
              {props.bucket?.name || props.searchBucket?.name}
            </span>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{props.error}</span>
          </div>
        </Show>
        <Show when={props.bucket || props.searchBucket}>
          <div class="flex flex-col gap-6 md:flex-row">
            <div class="flex-1">
              <h4 class="mb-3 border-b pb-2 text-lg font-medium">{t('bucketInfo.details')}</h4>
              <div
                class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm"
                ref={(el) => {
                  leftDetailsEl = el;
                  measureNextFrame();
                }}
              >
                <Show
                  when={props.bucket && isInstalled()}
                  fallback={
                    // Show basic info for external buckets
                    <Show when={props.searchBucket}>
                      <For each={searchBucketDetails()}>
                        {(item) => (
                          <div class="border-base-content/10 grid grid-cols-3 gap-2 border-b py-1">
                            <div class="text-base-content/70 col-span-1 font-semibold">
                              {item.label}:
                            </div>
                            <div class="col-span-2">
                              <Switch fallback={<DetailValue value={item.value} />}>
                                <Match when={item.key === 'lastUpdated'}>
                                  {formatBucketDate(item.value as string)}
                                </Match>
                                <Match when={item.key === 'packages'}>
                                  <div class="flex items-center gap-1">
                                    <span class="text-primary font-bold">{item.value}</span>
                                    <span class="text-base-content/70 text-xs">
                                      {t('bucketInfo.packagesCount')}
                                    </span>
                                  </div>
                                </Match>
                                <Match when={item.key === 'repository'}>
                                  <a
                                    href={item.value as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="link link-primary flex items-center gap-1 text-xs break-all"
                                  >
                                    <GalleryVerticalEnd class="h-3 w-3" />
                                    {item.value}
                                  </a>
                                </Match>
                              </Switch>
                            </div>
                          </div>
                        )}
                      </For>
                    </Show>
                  }
                >
                  {/* Show detailed info for installed buckets */}
                  <For each={orderedDetails()}>
                    {(item) => (
                      <div class="border-base-content/10 grid grid-cols-3 gap-2 border-b py-1">
                        <div class="text-base-content/70 col-span-1 font-semibold capitalize">
                          {item.label}:
                        </div>
                        <div class="col-span-2">
                          <Switch fallback={<DetailValue value={item.value} />}>
                            <Match when={item.key === 'lastUpdated'}>
                              {formatBucketDate(item.value as string)}
                            </Match>
                            <Match when={item.key === 'path'}>
                              <div
                                class="link-primary border-primary inline-block cursor-pointer break-all"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const path = props.bucket?.path;
                                  if (path) {
                                    try {
                                      await openPath(path);
                                    } catch (error) {
                                      console.error('Failed to open path:', error);
                                    }
                                  }
                                }}
                                title={t('bucketInfo.openFolder')}
                              >
                                {item.value}
                              </div>
                            </Match>
                            <Match when={item.key === 'packages'}>
                              <div class="flex items-center gap-1">
                                <span class="text-primary font-bold">{item.value}</span>
                                <span class="text-base-content/70 text-xs">
                                  {t('bucketInfo.packagesCount')}
                                </span>
                              </div>
                            </Match>
                            <Match when={item.key === 'repository'}>
                              <a
                                href={item.value as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link link-primary flex items-center gap-1 text-xs break-all"
                              >
                                <GitBranch class="h-3 w-3" />
                                {item.value}
                              </a>
                            </Match>
                          </Switch>
                        </div>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            <div class="flex-1">
              <Show when={props.fromPackageModal}>
                <h4 class="mb-3 border-b pb-2 text-lg font-medium">
                  {t('bucketInfo.availablePackages')}
                </h4>
                <div
                  class="bg-base-content-bg flex items-center justify-center overflow-hidden rounded-lg px-6 py-4"
                  style={{
                    height: rightCardHeight() ? `${rightCardHeight()}px` : undefined,
                    'max-height': rightCardHeight() ? `${rightCardHeight()}px` : undefined,
                  }}
                >
                  <div class="text-center">
                    <div class="bg-base-200 mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full">
                      <GalleryVerticalEnd class="text-base-content/50 h-6 w-6" />
                    </div>
                    <p class="text-base-content/70 mb-2 whitespace-pre-line">
                      {t('bucketInfo.viewPackagesOnRepository')}
                    </p>
                  </div>
                </div>
              </Show>

              <Show when={!props.fromPackageModal}>
                <Show
                  when={isInstalled() && (props.manifests.length > 0 || props.manifestsLoading)}
                  fallback={
                    <Show
                      when={
                        isInstalled() && props.manifests.length === 0 && !props.manifestsLoading
                      }
                      fallback={
                        <Show when={props.description && !isInstalled()}>
                          <h4 class="mb-3 border-b pb-2 text-lg font-medium">
                            {t('bucketInfo.description')}
                          </h4>
                          <div class="rounded-lg p-4" style={{ 'background-color': BgColor() }}>
                            <p class="text-sm leading-relaxed">{props.description}</p>
                          </div>
                        </Show>
                      }
                    >
                      <h4 class="mb-3 border-b pb-2 text-lg font-medium">
                        {t('bucketInfo.availablePackages')}
                      </h4>
                      <div
                        class="bg-base-content-bg flex items-center justify-center overflow-hidden rounded-lg px-6 py-4"
                        style={{
                          height: rightCardHeight() ? `${rightCardHeight()}px` : undefined,
                          'max-height': rightCardHeight() ? `${rightCardHeight()}px` : undefined,
                        }}
                      >
                        <div class="text-center">
                          <div class="bg-base-200 mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full">
                            <GalleryVerticalEnd class="text-base-content/50 h-6 w-6" />
                          </div>
                          <p class="text-base-content/70 mb-2">{t('bucketInfo.noPackagesFound')}</p>
                        </div>
                      </div>
                    </Show>
                  }
                >
                  <h4 class="mb-3 flex items-center justify-between border-b pb-1 text-lg font-medium">
                    <span class="flex items-center gap-2">
                      {t('bucketInfo.availablePackages')} ({props.manifests.length})
                    </span>
                    <Show when={isInstalled()}>
                      <button
                        class="btn btn-ghost btn-sm"
                        onClick={handleRefreshManifests}
                        title={t('bucketInfo.refreshManifests')}
                      >
                        <RefreshCw class="h-4 w-4" />
                      </button>
                    </Show>
                  </h4>
                  <div class="bg-base-content-bg rounded-lg p-3">
                    <ManifestsList
                      manifests={props.manifests}
                      loading={props.manifestsLoading}
                      showAll={showAllManifests()}
                      onLoadAll={handleLoadAllManifests}
                      onPackageClick={(packageName) =>
                        props.onPackageClick?.(packageName, props.bucket?.name ?? bucketName())
                      }
                    />
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </Show>
      </Modal>
    </Show>
  );
}

export default BucketInfoModal;
