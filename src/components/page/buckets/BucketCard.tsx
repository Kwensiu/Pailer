import { Show } from 'solid-js';
import { RefreshCw, Eye } from 'lucide-solid';
import { BucketInfo } from '../../../hooks';
import { openPath } from '@tauri-apps/plugin-opener';
import Card from '../../common/Card';
import BranchSelector from '../../common/BranchSelector';
import { formatBucketDate } from '../../../utils/date';
import { t } from '../../../i18n';
import settingsStore from '../../../stores/settings';

interface BucketCardProps {
  bucket: BucketInfo;
  onViewBucket: (bucket: BucketInfo) => void;
  onUpdateBucket?: (bucketName: string) => void;
  isUpdating?: boolean;
  updateResult?: string;
  updateResultStatus?: 'success' | 'info' | 'error' | 'default';
  isBulkUpdate?: boolean;
  onBucketUpdated?: (bucketName: string, newBranch?: string) => void;
}

function BucketCard(props: BucketCardProps) {
  const { effectiveTheme } = settingsStore;
  const detailsLoaded = () => props.bucket.details_loaded ?? true;
  const manifestCountLoaded = () => props.bucket.manifest_count_loaded ?? true;
  const linkTarget = () => props.bucket.git_url || props.bucket.path;
  const openBucketLocation = () => openPath(linkTarget());

  return (
    <div class="relative h-full">
      <Card
        title={
          <h3
            class="max-w-48 overflow-hidden text-ellipsis whitespace-nowrap"
            title={props.bucket.name}
          >
            {props.bucket.name.length > 18
              ? props.bucket.name.substring(0, 18) + '...'
              : props.bucket.name}
          </h3>
        }
        headerAction={
          <div class="flex h-6 min-w-16 items-center justify-end">
            <Show
              when={props.bucket.git_branch}
              fallback={
                <Show
                  when={!props.bucket.is_git_repo}
                  fallback={
                    <Show when={!detailsLoaded()}>
                      <div
                        class="badge badge-soft badge-sm border-primary/30 bg-primary/10 min-w-16 cursor-not-allowed border opacity-70 backdrop-blur-sm"
                        aria-disabled="true"
                      >
                        <span class="bucket-card-skeleton h-2 w-8 rounded"></span>
                      </div>
                    </Show>
                  }
                >
                  <Show when={detailsLoaded()}>
                    <div class="badge badge-soft badge-sm border-base-content/30 bg-base-200 border backdrop-blur-sm">
                      {t('bucket.card.local')}
                    </div>
                  </Show>
                </Show>
              }
            >
              <BranchSelector
                bucketName={props.bucket.name}
                currentBranch={props.bucket.git_branch}
                onBranchChanged={(newBranch) => {
                  // Refresh bucket info after branch change
                  props.onBucketUpdated?.(props.bucket.name, newBranch);
                }}
              />
            </Show>
          </div>
        }
        description={
          <div class="text-base-content/70 min-h-11 text-sm">
            <div class="mb-1 flex h-7 items-center gap-1">
              <span class="flex min-w-8 items-center">
                <Show
                  when={manifestCountLoaded()}
                  fallback={<span class="bucket-card-skeleton h-6 w-10 rounded"></span>}
                >
                  <span class="text-info text-xl leading-7 font-bold">
                    {props.bucket.manifest_count}
                  </span>
                </Show>
              </span>
              <span class="text-sm">{t('bucket.card.packages')}</span>
            </div>
            <div class="text-base-content/50 h-4 text-xs">
              <Show
                when={detailsLoaded()}
                fallback={
                  <>
                    {t('bucket.card.updated', { date: '' })}
                    <span class="bucket-card-skeleton ml-1 inline-block h-3 w-16 rounded align-[-2px]"></span>
                  </>
                }
              >
                {t('bucket.card.updated', {
                  date: props.bucket.last_updated
                    ? formatBucketDate(props.bucket.last_updated)
                    : '',
                })}
              </Show>
            </div>
          </div>
        }
        contentContainer={false}
        class={`card-bucket h-full ${effectiveTheme()}`}
      >
        <div
          class="text-base-content/60 bg-base-200 mt-2 h-7 cursor-pointer truncate rounded px-2 py-1 font-mono text-xs leading-5 hover:underline"
          onClick={openBucketLocation}
          title={linkTarget()}
        >
          {linkTarget()}
        </div>

        {/* Action buttons */}
        <div class="mt-3 flex min-h-8 gap-2">
          <button
            class="btn btn-info btn-sm flex-1 gap-2"
            onClick={() => props.onViewBucket(props.bucket)}
          >
            <Eye class="h-4 w-4" />
            {t('bucket.card.view')}
          </button>

          <Show when={props.bucket.is_git_repo && props.onUpdateBucket}>
            <button
              class="btn btn-accent btn-sm gap-2"
              onClick={(e) => {
                e.stopPropagation();
                props.onUpdateBucket!(props.bucket.name);
              }}
              disabled={props.isUpdating}
            >
              <Show when={props.isUpdating} fallback={<RefreshCw class="h-4 w-4" />}>
                <span class="loading loading-spinner loading-xs"></span>
              </Show>
              {props.isUpdating ? t('bucket.card.updating') : t('bucket.card.update')}
            </button>
          </Show>
        </div>
      </Card>
    </div>
  );
}

export default BucketCard;
