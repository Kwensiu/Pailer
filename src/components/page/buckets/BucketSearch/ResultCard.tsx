import { Show, createSignal } from 'solid-js';
import {
  Star,
  Package,
  GitFork,
  Clock,
  Download,
  Trash2,
  LoaderCircle,
  House,
  Warehouse,
  PencilLine,
} from 'lucide-solid';
import { openUrl } from '@tauri-apps/plugin-opener';
import { SearchableBucket, BucketInfo, useBucketInstall } from '../../../../hooks';
import { t } from '../../../../i18n';
import { formatBucketDate } from '../../../../utils/date';
import { Verified } from '../../../common/icons/CustomIcon';
import { toast } from '../../../common/ToastAlert';
import { getLocalizedError } from '../../../../utils/scoopErrorMapper';

interface BucketSearchResultCardProps {
  bucket: SearchableBucket;
  installedBuckets: BucketInfo[];
  onBucketSelect?: (bucket: SearchableBucket) => void;
  onBucketInstalled?: () => void;
}

function BucketSearchResultCard(props: BucketSearchResultCardProps) {
  const bucketInstall = useBucketInstall();
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [customBucketName, setCustomBucketName] = createSignal(props.bucket.name);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  const isBucketInstalled = () => {
    // Normalize URL by removing .git suffix for comparison
    const normalizeUrl = (url: string) => url.replace(/\.git$/, '').toLowerCase();

    return props.installedBuckets.some((installed) => {
      // Match by URL (more reliable for unique identification)
      if (installed.git_url && props.bucket.url) {
        return normalizeUrl(installed.git_url) === normalizeUrl(props.bucket.url);
      }
      // Fallback to name matching if URL not available
      return installed.name === props.bucket.name;
    });
  };

  const handleInstallBucket = async (event: Event) => {
    event.stopPropagation();

    try {
      const result = await bucketInstall.installBucket({
        name: props.bucket.name,
        url: props.bucket.url,
        force: false,
      });

      if (result.success) {
        props.onBucketInstalled?.();
      } else {
        console.error('Bucket installation failed:', result.message);
        toast.error(getLocalizedError(result.message));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to install bucket';
      console.error('Failed to install bucket:', error);
      toast.error(getLocalizedError(errorMsg));
    }
  };

  const handleRemoveBucket = async (event: Event) => {
    event.stopPropagation();

    try {
      const result = await bucketInstall.removeBucket(props.bucket.name);

      if (result.success) {
        props.onBucketInstalled?.();
      } else {
        console.error('Bucket removal failed:', result.message);
        toast.error(getLocalizedError(result.message));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to remove bucket';
      console.error('Failed to remove bucket:', error);
      toast.error(getLocalizedError(errorMsg));
    }
  };

  const handleInstallBucketWithCustomName = async (event: Event) => {
    event.stopPropagation();

    const bucketName = customBucketName().trim() || props.bucket.name;

    try {
      const result = await bucketInstall.installBucket({
        name: bucketName,
        url: props.bucket.url,
        force: false,
      });

      if (result.success) {
        props.onBucketInstalled?.();
      } else {
        console.error('Bucket installation failed:', result.message);
        toast.error(getLocalizedError(result.message));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to install bucket';
      console.error('Failed to install bucket:', error);
      toast.error(getLocalizedError(errorMsg));
    }
  };

  const toggleExpanded = (e: MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded());
  };

  const toggleExpandedFromKeyboard = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(!isExpanded());
    }
  };

  return (
    <div
      class="group bg-base-card hover:border-base-300 mb-4 overflow-hidden rounded-2xl shadow-sm transition-all duration-200 hover:shadow-lg"
      data-contextmenu-allow="true"
      tabIndex={0}
      aria-label={`${props.bucket.name} bucket actions`}
    >
      <div
        class="border-base-200/80 bg-base-100/30 hover:bg-base-100/50 cursor-pointer rounded-2xl border px-5 py-4 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded()}
        aria-label={t('search.results.toggleDetails')}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
            return;
          }
          toggleExpanded(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpandedFromKeyboard(e);
          }
        }}
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="bg-primary/10 text-primary ring-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset">
              <Warehouse size={20} />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="text-base-content hover:bg-base-content/10 hover:text-primary cursor-pointer truncate rounded-md px-2 py-0.5 text-lg font-bold tracking-tight transition-colors outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onBucketSelect?.(props.bucket);
                  }}
                  title={props.bucket.name}
                >
                  {props.bucket.name}
                </button>
                <Show when={props.bucket.is_verified}>
                  <Verified class="text-info h-4 w-4" />
                </Show>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <Show when={isBucketInstalled()}>
              <span class="bg-success/10 text-success ring-success/10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                {t('bucket.searchResults.installed')}
              </span>
            </Show>
            <div class="bg-base-200/60 text-base-content/60 flex items-center gap-2 rounded-full px-2 py-1 text-xs">
              <Show when={props.bucket.last_updated !== 'Unknown'}>
                <span class="flex items-center gap-1">
                  <Clock size={14} />
                  {formatBucketDate(props.bucket.last_updated)}
                </span>
              </Show>
              <span class="text-base-content/30">|</span>
              <span class="flex items-center gap-1">
                <Star size={14} class="text-warning/70" />
                {formatNumber(props.bucket.stars)}
              </span>
            </div>
            <Show when={!isBucketInstalled()}>
              <button
                class="btn btn-primary btn-square btn-sm rounded-xl"
                aria-label={t('bucket.searchResults.install')}
                onClick={handleInstallBucket}
                disabled={bucketInstall.isBucketBusy(props.bucket.name)}
              >
                <Show
                  when={bucketInstall.isBucketInstalling(props.bucket.name)}
                  fallback={<Download class="h-4 w-4" />}
                >
                  <LoaderCircle class="h-4 w-4 animate-spin" />
                </Show>
              </button>
            </Show>
            <Show when={isBucketInstalled()}>
              <button
                class="btn btn-error btn-square btn-sm rounded-xl"
                aria-label={t('buttons.remove')}
                onClick={handleRemoveBucket}
                disabled={bucketInstall.isBucketBusy(props.bucket.name)}
              >
                <Show
                  when={bucketInstall.isBucketRemoving(props.bucket.name)}
                  fallback={<Trash2 class="h-4 w-4" />}
                >
                  <LoaderCircle class="h-4 w-4 animate-spin" />
                </Show>
              </button>
            </Show>
          </div>
        </div>
      </div>

      <div
        class="grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{
          'grid-template-rows': isExpanded() ? '1fr' : '0fr',
          opacity: isExpanded() ? '1' : '0',
        }}
      >
        <div class="min-h-0 overflow-hidden" aria-hidden={!isExpanded()} inert={!isExpanded()}>
          <div class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            <div class="space-y-3">
              <Show when={props.bucket.description}>
                <p class="text-base-content/75 line-clamp-3 max-w-2xl text-sm leading-relaxed">
                  {props.bucket.description}
                </p>
              </Show>

              <div class="text-base-content/70 text-sm">
                <Show when={props.bucket.url}>
                  <div class="flex items-start gap-2 break-all">
                    <House class="text-primary/70 mt-0.5 h-4 w-4 shrink-0" />
                    <button
                      type="button"
                      class="text-primary hover:text-primary/80 cursor-pointer transition-colors hover:underline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await openUrl(props.bucket.url);
                        } catch (error) {
                          console.error('Failed to open GitHub URL:', error);
                        }
                      }}
                    >
                      {props.bucket.url}
                    </button>
                  </div>
                </Show>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-xs">
                <div class="bg-base-200/50 flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium">
                  <Star class="text-warning h-3.5 w-3.5" />
                  <span class="text-base-content">{formatNumber(props.bucket.stars)}</span>
                </div>
                <div class="bg-base-200/50 flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium">
                  <GitFork class="text-success h-3.5 w-3.5" />
                  <span class="text-base-content">{formatNumber(props.bucket.forks)}</span>
                </div>
                <div class="bg-base-200/50 flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium">
                  <Package class="text-primary h-3.5 w-3.5" />
                  <span class="text-base-content">{formatNumber(props.bucket.apps)}</span>
                  <span class="text-base-content/50">{t('bucket.card.packages')}</span>
                </div>
              </div>
            </div>

            <div class="lg:col-span-1">
              <div class="border-base-200/80 bg-base-100/50 space-y-3 rounded-2xl border p-3">
                <div class="text-base-content/70 text-xs font-medium">
                  {t('bucket.searchResults.customName')}
                </div>
                <div class="border-base-200 bg-base-200/60 input flex max-h-[34px] w-full items-center gap-2 rounded-xl border px-3 py-2">
                  <PencilLine size={12} class="text-base-content/60" />
                  <input
                    type="text"
                    value={customBucketName()}
                    onInput={(e) => setCustomBucketName(e.currentTarget.value)}
                    placeholder={props.bucket.name}
                    class="text-base-content min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div class="grid grid-cols-[1fr_auto] gap-3">
                  <div class="border-base-200 bg-base-200/60 flex w-full items-center gap-2 rounded-xl border px-3 py-2">
                    <span class="text-base-content/50 shrink-0 font-mono text-xs">&gt;</span>
                    <input
                      type="text"
                      readonly
                      value={`scoop bucket add ${customBucketName().trim() || props.bucket.name} ${props.bucket.url}`}
                      class="text-base-content min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <button
                    class="btn btn-primary btn-soft btn-sm h-full w-10 self-stretch rounded-xl"
                    onClick={handleInstallBucketWithCustomName}
                    title={t('bucket.searchResults.install')}
                    disabled={bucketInstall.isBucketBusy(
                      customBucketName().trim() || props.bucket.name
                    )}
                  >
                    <Show
                      when={bucketInstall.isBucketInstalling(
                        customBucketName().trim() || props.bucket.name
                      )}
                      fallback={<Download class="h-4 w-4" />}
                    >
                      <LoaderCircle class="h-4 w-4 animate-spin" />
                    </Show>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BucketSearchResultCard;
