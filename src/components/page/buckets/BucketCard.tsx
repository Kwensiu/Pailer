import { Show, createEffect, createSignal } from 'solid-js';
import { RefreshCw, Eye } from 'lucide-solid';
import { BucketInfo } from '../../../hooks/useBuckets';
import { openPath } from '@tauri-apps/plugin-opener';
import Card from '../../common/Card';
import { formatBucketDate } from '../../../utils/date';
import { t } from '../../../i18n';
import settingsStore from '../../../stores/settings';
import { toast } from '../../common/ToastAlert';

interface BucketCardProps {
  bucket: BucketInfo;
  onViewBucket: (bucket: BucketInfo) => void;
  onUpdateBucket?: (bucketName: string) => void;
  isUpdating?: boolean;
  updateResult?: string;
  updateResultStatus?: 'success' | 'info' | 'error' | 'default';
  isBulkUpdate?: boolean;
}

function BucketCard(props: BucketCardProps) {
  const { settings } = settingsStore;

  // Track the last result that triggered a toast to prevent duplicates
  const [lastToastResult, setLastToastResult] = createSignal<string | null>(null);

  // Show update result as toast notification only when update is complete and not in bulk update mode
  createEffect(() => {
    const result = props.updateResult;
    const status = props.updateResultStatus;
    const isUpdating = props.isUpdating;
    const isBulkUpdate = props.isBulkUpdate;

    // Only show toast when update is complete, we have a result, not in bulk update mode, and it's a new result
    if (!isUpdating && result && !isBulkUpdate && status) {
      const lastResult = lastToastResult();

      // More robust comparison - trim and normalize whitespace
      const normalizedResult = result.trim();
      const normalizedLastResult = lastResult?.trim() || '';

      if (normalizedResult !== normalizedLastResult) {
        setLastToastResult(result);
        switch (status) {
          case 'success':
            toast.success(result);
            break;
          case 'info':
            toast.info(result);
            break;
          case 'error':
            toast.error(result);
            break;
          default:
            toast.info(result);
            break;
        }
      }
    }
  });

  return (
    <div class="relative">
      <Show when={props.bucket.git_branch}>
        <div class="badge badge-soft badge-sm border-primary/50 bg-primary/15 absolute top-5.25 right-4 z-10 border backdrop-blur-sm">
          {props.bucket.git_branch}
        </div>
      </Show>
      <Show when={!props.bucket.is_git_repo}>
        <div class="badge badge-soft badge-sm border-base-content/30 bg-base-200 absolute top-5.25 right-4 z-10 border backdrop-blur-sm">
          {t('bucket.card.local')}
        </div>
      </Show>

      <Card
        title={
          <h3 class="overflow-hidden text-ellipsis whitespace-nowrap" title={props.bucket.name}>
            {props.bucket.name}
          </h3>
        }
        description={
          <div class="text-base-content/70 text-sm">
            <div class="mb-1 flex items-center gap-1">
              <span class="text-info text-xl font-bold">{props.bucket.manifest_count}</span>
              <span class="text-sm">{t('bucket.card.packages')}</span>
            </div>
            <Show when={props.bucket.last_updated}>
              <div class="text-base-content/50 text-xs">
                {t('bucket.card.updated', { date: formatBucketDate(props.bucket.last_updated) })}
              </div>
            </Show>
          </div>
        }
        class={`card-bucket bg-base-card ${settings.theme}`}
      >
        {props.bucket.git_url ? (
          <div
            class="text-base-content/60 bg-base-200 mt-2 cursor-pointer truncate rounded px-2 py-1 font-mono text-xs hover:underline"
            onClick={() => openPath(props.bucket.git_url!)}
            title={props.bucket.git_url}
          >
            {props.bucket.git_url}
          </div>
        ) : (
          <div
            class="text-base-content/60 bg-base-200 mt-2 cursor-pointer truncate rounded px-2 py-1 font-mono text-xs hover:underline"
            onClick={() => openPath(props.bucket.path)}
            title={props.bucket.path}
          >
            {props.bucket.path}
          </div>
        )}

        {/* Action buttons */}
        <div class="mt-3 flex gap-2">
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
