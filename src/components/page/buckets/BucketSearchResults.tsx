import { For, Show } from 'solid-js';
import { SearchableBucket } from '../../../hooks/useBucketSearch';
import { BucketInfo } from '../../../hooks/useBuckets';
import { useBucketInstall } from '../../../hooks/useBucketInstall';
import {
  ExternalLink,
  Star,
  Package,
  GitFork,
  Shield,
  Clock,
  Download,
  Trash2,
  LoaderCircle,
} from 'lucide-solid';
import { openUrl } from '@tauri-apps/plugin-opener';
import Card from '../../common/Card';
import { t } from '../../../i18n';
import { formatBucketDate } from '../../../utils/date';

interface BucketSearchResultsProps {
  buckets: SearchableBucket[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  isExpandedSearch: boolean;
  installedBuckets: BucketInfo[];
  onBucketSelect?: (bucket: SearchableBucket) => void;
  onBucketInstalled?: () => void; // Callback when a bucket is installed/removed
}

function BucketSearchResults(props: BucketSearchResultsProps) {
  const bucketInstall = useBucketInstall();
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  // Check if a bucket is installed locally
  const isBucketInstalled = (bucketName: string) => {
    return props.installedBuckets.some((installed) => installed.name === bucketName);
  };

  // Handle bucket installation
  const handleInstallBucket = async (bucket: SearchableBucket, event: Event) => {
    event.stopPropagation();

    try {
      const result = await bucketInstall.installBucket({
        name: bucket.name,
        url: bucket.url,
        force: false,
      });

      if (result.success) {
        // Call parent callback to refresh bucket list immediately
        console.log('Bucket installed successfully, refreshing bucket list');
        props.onBucketInstalled?.();
      } else {
        console.error('Bucket installation failed:', result.message);
      }
    } catch (error) {
      console.error('Failed to install bucket:', error);
    }
  };

  // Handle bucket removal
  const handleRemoveBucket = async (bucketName: string, event: Event) => {
    event.stopPropagation();

    try {
      const result = await bucketInstall.removeBucket(bucketName);

      if (result.success) {
        // Call parent callback to refresh bucket list immediately
        console.log('Bucket removed successfully, refreshing bucket list');
        props.onBucketInstalled?.();
      } else {
        console.error('Bucket removal failed:', result.message);
      }
    } catch (error) {
      console.error('Failed to remove bucket:', error);
    }
  };

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">
          {t('bucket.searchResults.title')}
          <Show when={!props.loading}>
            <span class="text-base-content/60 ml-2 text-lg font-normal">
              ({props.buckets.length}
              {props.totalCount > props.buckets.length ? ` of ${props.totalCount}` : ''})
            </span>
          </Show>
        </h2>

        <Show when={props.isExpandedSearch}>
          <div class="badge badge-info badge-outline badge-lg">
            <Shield class="mr-1 h-3 w-3" />
            {t('bucket.searchResults.expandedSearch')}
          </div>
        </Show>
      </div>

      {/* Loading State */}
      <Show when={props.loading}>
        <div class="flex items-center justify-center py-12">
          <span class="loading loading-spinner loading-lg mr-3"></span>
          <span class="text-lg">{t('bucket.searchResults.searchingBuckets')}</span>
        </div>
      </Show>

      {/* Error State */}
      <Show when={props.error}>
        <div class="alert alert-error">
          <span>{props.error}</span>
        </div>
      </Show>

      {/* No Results */}
      <Show when={!props.loading && !props.error && props.buckets.length === 0}>
        <div class="py-12 text-center">
          <Package class="text-base-content/40 mx-auto mb-4 h-16 w-16" />
          <h3 class="mb-2 text-xl font-semibold">{t('bucket.searchResults.noBucketsFound')}</h3>
          <p class="text-base-content/70">{t('bucket.searchResults.tryAdjustTerms')}</p>
        </div>
      </Show>

      {/* Results Grid */}
      <Show when={!props.loading && !props.error && props.buckets.length > 0}>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <For each={props.buckets}>
            {(bucket) => (
              <Card
                title={
                  <div class="flex w-full items-center justify-between gap-2">
                    <span class="truncate font-semibold">{bucket.name}</span>
                    <div class="flex shrink-0 items-center gap-1">
                      <Show when={bucket.is_verified}>
                        <div class="badge badge-info badge-outline absolute top-[21px] right-[16px] z-10">
                          <Shield class="mr-1 h-3 w-3" />
                          {t('bucket.searchResults.verified')}
                        </div>
                      </Show>
                      <button
                        type="button"
                        class="btn btn-circle btn-sm btn-ghost hover:btn-primary"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await openUrl(bucket.url);
                          } catch (error) {
                            console.error('Failed to open GitHub URL:', error);
                          }
                        }}
                        title={t('bucket.searchResults.openInGithub')}
                      >
                        <ExternalLink class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                }
                description={
                  <>
                    <p class="mb-4 line-clamp-2 min-h-10 text-sm">
                      {bucket.description || t('bucket.searchResults.noDescription')}
                    </p>

                    {/* Full Name */}
                    <p class="text-base-content/70 mb-4 truncate font-mono text-xs">
                      {bucket.full_name}
                    </p>

                    {/* Stats */}
                    <div class="mb-4 grid grid-cols-3 gap-2 text-xs">
                      <div class="stat-item flex items-center gap-1">
                        <Star class="h-3 w-3 text-yellow-500" />
                        <span class="font-medium">{formatNumber(bucket.stars)}</span>
                      </div>

                      <div class="stat-item flex items-center gap-1">
                        <Package class="h-3 w-3 text-blue-500" />
                        <span class="font-medium">{formatNumber(bucket.apps)}</span>
                      </div>

                      <div class="stat-item flex items-center gap-1">
                        <GitFork class="h-3 w-3 text-green-500" />
                        <span class="font-medium">{formatNumber(bucket.forks)}</span>
                      </div>
                    </div>

                    {/* Last Updated */}
                    <Show when={bucket.last_updated !== 'Unknown'}>
                      <div class="text-base-content/60 mb-3 flex items-center gap-1 border-b pb-3 text-xs">
                        <Clock class="h-3 w-3" />
                        <span>
                          {t('bucket.searchResults.updated', {
                            date: formatBucketDate(bucket.last_updated),
                          })}
                        </span>
                      </div>
                    </Show>
                  </>
                }
                class="bg-base-200 border-base-300 border shadow-sm transition-all duration-200 hover:shadow-md"
              >
                {/* Action Buttons */}
                <div class="flex items-center gap-2">
                  <Show
                    when={isBucketInstalled(bucket.name)}
                    fallback={
                      <button
                        class="btn btn-primary btn-sm flex-1"
                        onClick={(e) => handleInstallBucket(bucket, e)}
                        disabled={bucketInstall.isBucketBusy(bucket.name)}
                        title={t('bucket.searchResults.installTitle')}
                      >
                        <Show
                          when={bucketInstall.isBucketInstalling(bucket.name)}
                          fallback={
                            <>
                              <Download class="mr-1 h-4 w-4" />
                              {t('bucket.searchResults.install')}
                            </>
                          }
                        >
                          <LoaderCircle class="mr-1 h-4 w-4 animate-spin" />
                          {t('bucket.searchResults.installing')}
                        </Show>
                      </button>
                    }
                  >
                    <button
                      class="btn btn-error btn-sm flex-1"
                      onClick={(e) => handleRemoveBucket(bucket.name, e)}
                      disabled={bucketInstall.isBucketBusy(bucket.name)}
                      title={t('bucket.searchResults.removingTitle')}
                    >
                      <Show
                        when={bucketInstall.isBucketRemoving(bucket.name)}
                        fallback={
                          <>
                            <Trash2 class="mr-1 h-4 w-4" />
                            {t('bucket.searchResults.remove')}
                          </>
                        }
                      >
                        <LoaderCircle class="mr-1 h-4 w-4 animate-spin" />
                        {t('bucket.searchResults.removing')}
                      </Show>
                    </button>
                  </Show>

                  <button
                    class="btn-outline btn btn-sm"
                    onClick={() => props.onBucketSelect?.(bucket)}
                    title={t('bucket.searchResults.viewDetails')}
                  >
                    {t('bucket.searchResults.details')}
                  </button>
                </div>
              </Card>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default BucketSearchResults;
