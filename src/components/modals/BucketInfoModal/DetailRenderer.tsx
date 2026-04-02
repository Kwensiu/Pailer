import { Switch, Match } from 'solid-js';
import { Package } from 'lucide-solid';
import { t } from '../../../i18n';
import { formatBucketDate } from '../../../utils/date';

interface DetailItem {
  key: string;
  label: string;
  value: string;
}

interface BucketDetailRendererProps {
  item: DetailItem;
  bucket?: {
    path?: string;
    git_url?: string;
  } | null;
  onOpenPath?: (path: string) => void;
  onOpenUrl?: (url: string) => void;
}

export function BucketDetailRenderer(props: BucketDetailRendererProps) {
  const handlePathClick = () => {
    const path = props.bucket?.path;
    if (path && props.onOpenPath) {
      props.onOpenPath(path);
    }
  };

  return (
    <div class="border-base-content/8 flex min-w-0 items-center gap-x-3 border-b py-2 last:border-b-0">
      <div class="w-14 shrink-0">
        <span class="detail-label-text block">{props.item.label || '—'}</span>
      </div>
      <div class="min-w-0 flex-1">
        <Switch
          fallback={
            <span class="text-base-content/80 block max-w-full text-sm font-medium break-all">
              {props.item.value}
            </span>
          }
        >
          <Match when={props.item.key === 'lastUpdated'}>
            <span class="text-base-content/75 block text-sm font-medium">
              {formatBucketDate(props.item.value)}
            </span>
          </Match>
          <Match when={props.item.key === 'path'}>
            <button
              type="button"
              class="bucket-detail-link -ml-1"
              onClick={handlePathClick}
              title={t('bucketInfo.openFolder')}
            >
              <span class="break-all">{props.item.value}</span>
            </button>
          </Match>
          <Match when={props.item.key === 'packages'}>
            <span class="text-primary flex items-center gap-1.5 text-sm font-semibold">
              <Package class="h-3.5 w-3.5 shrink-0" />
              {props.item.value}
              <span class="text-base-content/45 text-xs font-medium">
                {t('bucketInfo.packagesCount')}
              </span>
            </span>
          </Match>
          <Match when={props.item.key === 'git_url' || props.item.key === 'repository'}>
            <button
              type="button"
              class="bucket-detail-link -ml-1"
              onClick={() => props.onOpenUrl?.(props.item.value)}
              title={props.item.value}
            >
              <span class="break-all">{props.item.value}</span>
            </button>
          </Match>
        </Switch>
      </div>
    </div>
  );
}
