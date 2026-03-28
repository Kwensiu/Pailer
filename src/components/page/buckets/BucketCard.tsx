import { Show, createEffect, createSignal } from 'solid-js';
import { RefreshCw, Eye } from 'lucide-solid';
import { BucketInfo } from '../../../hooks';
import { openPath } from '@tauri-apps/plugin-opener';
import Card from '../../common/Card';
import BranchSelector from '../../common/BranchSelector';
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
  onBucketUpdated?: (bucketName: string, newBranch?: string) => void;
}

function BucketCard(props: BucketCardProps) {
  const { effectiveTheme } = settingsStore;

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
          <Show
            when={props.bucket.git_branch}
            fallback={
              <Show when={!props.bucket.is_git_repo}>
                <div class="badge badge-soft badge-sm border-base-content/30 bg-base-200 border backdrop-blur-sm">
                  {t('bucket.card.local')}
                </div>
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
        contentContainer={false}
        class={`card-bucket ${effectiveTheme()}`}
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
