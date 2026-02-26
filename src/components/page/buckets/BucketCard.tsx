import { Show } from 'solid-js';
import { RefreshCw, Eye } from 'lucide-solid';
import { BucketInfo } from '../../../hooks/useBuckets';
import { openPath } from '@tauri-apps/plugin-opener';
import Card from '../../common/Card';
import { formatBucketDate } from '../../../utils/date';
import { t } from '../../../i18n';

interface BucketCardProps {
  bucket: BucketInfo;
  onViewBucket: (bucket: BucketInfo) => void;
  onUpdateBucket?: (bucketName: string) => void;
  isUpdating?: boolean;
  updateResult?: string;
}

function BucketCard(props: BucketCardProps) {
  return (
    <div class="relative">
      <Show when={props.bucket.git_branch}>
        <div class="badge badge-outline badge-sm bg-base-100/90 absolute top-[21px] right-[16px] z-10 backdrop-blur-sm">
          {props.bucket.git_branch}
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
              <span class="text-primary text-xl font-bold">{props.bucket.manifest_count}</span>
              <span class="text-sm">{t('bucket.card.packages')}</span>
            </div>
            <Show when={props.bucket.last_updated}>
              <div class="text-base-content/50 text-xs">
                {t('bucket.card.updated', { date: formatBucketDate(props.bucket.last_updated) })}
              </div>
            </Show>
          </div>
        }
        class="bg-base-200 border-base-300 border shadow-sm transition-all duration-200 hover:shadow-md"
      >
        <Show when={props.bucket.git_url}>
          <div
            class="text-base-content/40 bg-base-100 mt-2 cursor-pointer truncate rounded px-2 py-1 font-mono text-xs hover:underline"
            onClick={() => openPath(props.bucket.git_url!)}
            title={props.bucket.git_url}
          >
            {props.bucket.git_url}
          </div>
        </Show>

        {/* Update result message */}
        <Show when={props.updateResult}>
          <div class="bg-base-100 mt-2 rounded border p-2 text-xs">{props.updateResult}</div>
        </Show>

        {/* Action buttons */}
        <div class="mt-3 flex gap-2">
          <button
            class="btn btn-primary btn-sm flex-1 gap-2"
            onClick={() => props.onViewBucket(props.bucket)}
          >
            <Eye class="h-4 w-4" />
            {t('bucket.card.view')}
          </button>

          <Show when={props.bucket.is_git_repo && props.onUpdateBucket}>
            <button
              class="btn btn-secondary btn-sm gap-2"
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
