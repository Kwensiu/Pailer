import { Show, For, createSignal, onMount, onCleanup } from 'solid-js';
import { RefreshCw, X } from 'lucide-solid';
import { BucketInfo } from '../../../hooks/useBuckets';
import BucketCard from './BucketCard';
import { t } from '../../../i18n';

interface BucketGridProps {
  buckets: BucketInfo[];
  onViewBucket: (bucket: BucketInfo) => void;
  onRefresh?: () => void;
  onUpdateBucket?: (bucketName: string) => void;
  onUpdateAll?: () => void;
  onCancelUpdateAll?: () => void;
  updatingBuckets?: Set<string>;
  updateResults?: { [key: string]: string };
  loading?: boolean;
  isUpdatingAll?: boolean;
  isCancelling?: boolean;
}

function BucketGrid(props: BucketGridProps) {
  const [isSmallScreen, setIsSmallScreen] = createSignal(false);

  const checkScreenSize = () => {
    setIsSmallScreen(window.innerWidth < 768);
  };

  onMount(() => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', checkScreenSize);
  });

  return (
    <>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="card-title">{t('bucket.grid.title')}</h2>
        <Show when={props.onUpdateAll && props.buckets.some((b) => b.is_git_repo)}>
          <div class="flex gap-2">
            <Show
              when={!props.isUpdatingAll}
              fallback={
                <button
                  class="btn btn-warning btn-sm gap-2"
                  onClick={props.onCancelUpdateAll}
                  disabled={props.isCancelling}
                >
                  <X class="h-4 w-4" />
                  {props.isCancelling ? t('bucket.grid.cancelling') : t('bucket.grid.cancel')}
                </button>
              }
            >
              <button
                class="btn btn-accent btn-sm gap-2"
                onClick={props.onUpdateAll}
                disabled={props.updatingBuckets && props.updatingBuckets.size > 0}
              >
                <RefreshCw class="h-4 w-4" />
                <span
                  class="relative inline-block truncate transition-all duration-300 ease-in-out"
                  classList={{
                    'max-w-64': !isSmallScreen(),
                    'max-w-16': isSmallScreen(),
                  }}
                >
                  <span
                    class="transition-opacity duration-300 ease-in-out"
                    classList={{
                      'relative opacity-100': isSmallScreen(),
                      'absolute inset-0 opacity-0': !isSmallScreen(),
                    }}
                  >
                    {t('bucket.grid.updateAllGitShort')}
                  </span>
                  <span
                    class="transition-opacity duration-300 ease-in-out"
                    classList={{
                      'absolute inset-0 opacity-0': isSmallScreen(),
                      'relative opacity-100': !isSmallScreen(),
                    }}
                  >
                    {t('bucket.grid.updateAllGit')}
                  </span>
                </span>
              </button>
            </Show>
            <Show when={props.onRefresh}>
              <button class="btn btn-soft btn-sm gap-2" onClick={props.onRefresh}>
                <RefreshCw class="h-4 w-4" />
                <span
                  class="relative inline-block truncate transition-all duration-300 ease-in-out"
                  classList={{
                    'max-w-64': !isSmallScreen(),
                    'max-w-16': isSmallScreen(),
                  }}
                >
                  <span
                    class="transition-opacity duration-300 ease-in-out"
                    classList={{
                      'relative opacity-100': isSmallScreen(),
                      'absolute inset-0 opacity-0': !isSmallScreen(),
                    }}
                  >
                    {t('bucket.grid.reloadLocalShort')}
                  </span>
                  <span
                    class="transition-opacity duration-300 ease-in-out"
                    classList={{
                      'absolute inset-0 opacity-0': isSmallScreen(),
                      'relative opacity-100': !isSmallScreen(),
                    }}
                  >
                    {t('bucket.grid.reloadLocal')}
                  </span>
                </span>
              </button>
            </Show>
          </div>
        </Show>
      </div>

      <Show when={props.loading}>
        <div class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-2">{t('bucket.grid.loading')}</span>
        </div>
      </Show>

      <Show when={!props.loading}>
        <Show
          when={props.buckets.length > 0}
          fallback={
            <div class="py-8 text-center">
              <p class="text-base-content/70">{t('bucket.grid.noBucketsFound')}</p>
              <p class="text-base-content/50 mt-2 text-sm">
                {t('bucket.grid.noBucketsDescription')}
              </p>
              <Show when={props.onRefresh}>
                <div class="mt-4">
                  <button class="btn btn-primary" onClick={props.onRefresh}>
                    {t('bucket.grid.refresh')}
                  </button>
                </div>
              </Show>
            </div>
          }
        >
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <For each={props.buckets}>
              {(bucket) => (
                <BucketCard
                  bucket={bucket}
                  onViewBucket={props.onViewBucket}
                  onUpdateBucket={props.onUpdateBucket}
                  isUpdating={props.updatingBuckets?.has(bucket.name) || false}
                  updateResult={props.updateResults?.[bucket.name]}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </>
  );
}

export default BucketGrid;
