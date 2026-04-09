import { Show, For } from 'solid-js';
import { X, ChevronDown, ChevronUp } from 'lucide-solid';
import { t } from '../../../i18n';
import type { BulkUpdateResult, BulkUpdateState } from '../../../hooks';

interface BulkUpdateProgressProps {
  updateState: () => BulkUpdateState;
  errorDetails?: () => BulkUpdateResult[];
  showErrorDetails?: () => boolean;
  canCancel?: () => boolean;
  onCancel?: () => void;
  onClose: () => void;
  onToggleErrorDetails?: () => void;
}

function BulkUpdateProgress(props: BulkUpdateProgressProps) {
  return (
    <Show when={props.updateState().status !== 'idle'}>
      <div class="bg-base-100 rounded-box mb-4 p-4 shadow transition-opacity duration-300">
        <div class="mb-1 flex justify-between">
          <span class="text-base font-medium">
            {props.updateState().status === 'completed'
              ? t('bucket.grid.updateCompleted')
              : t('bucket.grid.updatingBuckets')}
          </span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">
              {props.updateState().current}/{props.updateState().total}
            </span>
            <Show when={props.updateState().status === 'updating' && props.canCancel?.()}>
              <button
                class="btn btn-warning btn-xs btn-circle"
                onClick={props.onCancel}
                title="Cancel update"
              >
                <X class="h-3 w-3" />
              </button>
            </Show>
            <Show
              when={
                props.updateState().status === 'completed' ||
                props.updateState().status === 'error' ||
                props.updateState().status === 'cancelled'
              }
            >
              <button
                class="btn btn-ghost btn-xs btn-circle"
                onClick={props.onClose}
                title="Close progress"
              >
                <X class="h-3 w-3" />
              </button>
            </Show>
          </div>
        </div>
        <div class="h-1.5 w-full rounded-full bg-gray-200">
          <div
            class={`mt-2 h-1.5 rounded-full transition-all duration-300 ${
              props.updateState().status === 'completed'
                ? props.errorDetails && props.errorDetails().length > 0
                  ? 'bg-warning'
                  : 'bg-success'
                : props.updateState().status === 'error'
                  ? 'bg-error'
                  : 'bg-warning'
            }`}
            style={{
              width: `${(props.updateState().current / Math.max(props.updateState().total, 1)) * 100}%`,
            }}
          ></div>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <div class="text-sm text-gray-500">{props.updateState().message}</div>
          <Show when={props.errorDetails && props.errorDetails().length > 0}>
            <button
              class="btn btn-ghost btn-xs text-error hover:bg-error/10 gap-1"
              onClick={props.onToggleErrorDetails}
            >
              <span class="text-xs">
                {props.showErrorDetails
                  ? props.showErrorDetails()
                    ? t('bucket.grid.hideErrors')
                    : t('bucket.grid.showErrors')
                  : ''}
              </span>
              <Show
                when={props.showErrorDetails ? props.showErrorDetails() : false}
                fallback={<ChevronDown class="h-3 w-3" />}
              >
                <ChevronUp class="h-3 w-3" />
              </Show>
            </button>
          </Show>
        </div>

        <Show
          when={
            props.showErrorDetails &&
            props.showErrorDetails() &&
            props.errorDetails &&
            props.errorDetails()
          }
        >
          <div class="border-error/20 bg-error/5 mt-2 max-h-32 overflow-y-auto rounded border p-2">
            <div class="text-error mb-1 text-xs font-medium">{t('bucket.grid.errorDetails')}</div>
            <div class="space-y-1">
              <For each={props.errorDetails ? props.errorDetails() : []}>
                {(result: BulkUpdateResult, index) => (
                  <div class="text-error/80 text-xs wrap-break-word">
                    {index() + 1}. {result.bucket_name}: {result.message}
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

export default BulkUpdateProgress;
