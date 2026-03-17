import { createSignal, Show, For, createEffect } from 'solid-js';
import { X, ChevronDown, ChevronUp } from 'lucide-solid';
import { t } from '../../../i18n';
import { toast } from '../../common/ToastAlert';

export interface BulkUpdateResult {
  success: boolean;
  message: string;
  bucket_name: string;
  bucket_path?: string;
  manifest_count?: number;
}

export interface BulkUpdateState {
  status: 'idle' | 'updating' | 'completed' | 'error' | 'cancelled';
  current: number;
  total: number;
  message: string;
}

interface BulkUpdateProgressProps {
  buckets: { name: string; is_git_repo: boolean }[];
  updateState: () => BulkUpdateState;
  onUpdateStateChange: (state: BulkUpdateState) => void;
  onClose: () => void;
  onRefreshBuckets?: () => Promise<void>;
  onUpdateBucket?: (
    bucketName: string,
    shouldRefreshBuckets?: boolean,
    abortSignal?: AbortSignal
  ) => Promise<BulkUpdateResult>;
  errorDetails?: () => BulkUpdateResult[];
  showErrorDetails?: () => boolean;
  onToggleErrorDetails?: () => void;
  onSetCancelling?: (cancelling: boolean) => void;
  onFailedResultsChange?: (results: BulkUpdateResult[]) => void;
}

function BulkUpdateProgress(props: BulkUpdateProgressProps) {
  const [abortController, setAbortController] = createSignal<AbortController | null>(null);
  const [isStarted, setIsStarted] = createSignal(false);

  // Handle starting bulk update
  const startBulkUpdate = async () => {
    const gitBuckets = props.buckets.filter((bucket) => bucket.is_git_repo);

    if (gitBuckets.length === 0) {
      toast.info(t('bucket.grid.noGitBuckets'));
      return;
    }

    // Initialize state
    props.onUpdateStateChange({
      status: 'updating',
      current: 0,
      total: gitBuckets.length,
      message: t('bucket.grid.updatingBuckets'),
    });

    // Create AbortController for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Create update promises
      const updatePromises = gitBuckets.map(async (bucket) => {
        // Check if cancelled before starting
        if (controller.signal.aborted) return { success: false, cancelled: true };

        try {
          const result = await props.onUpdateBucket?.(bucket.name, false, controller.signal);

          // Check if cancelled after update
          if (controller.signal.aborted) return { success: false, cancelled: true };

          // Update progress
          const currentState = props.updateState();
          props.onUpdateStateChange({
            ...currentState,
            current: currentState.current + 1,
          });

          return { success: true, cancelled: false, result };
        } catch (error) {
          // Check if operation was aborted
          if (controller.signal.aborted) {
            return { success: false, cancelled: true };
          }

          console.error(`Failed to update bucket ${bucket.name}:`, error);

          // Update progress
          const currentState = props.updateState();
          props.onUpdateStateChange({
            ...currentState,
            current: currentState.current + 1,
          });

          return { success: false, error };
        }
      });

      // Execute all promises
      const results = await Promise.allSettled(updatePromises);

      // Check results and collect failures
      const failures: BulkUpdateResult[] = [];
      let successfulUpdates = 0;

      results.forEach((settledResult, index) => {
        const bucketName = gitBuckets[index].name;

        if (settledResult.status === 'fulfilled') {
          const updateResult = settledResult.value;

          if (!updateResult || typeof updateResult !== 'object') {
            failures.push({
              success: false,
              message: 'Invalid result format',
              bucket_name: bucketName,
            });
            return;
          }

          const isCancelled = 'cancelled' in updateResult && updateResult.cancelled;
          if (isCancelled) {
            return;
          }

          const isLegacyFormat = 'result' in updateResult;
          const actualResult = isLegacyFormat ? (updateResult as any).result : updateResult;

          if (actualResult && typeof actualResult === 'object' && 'success' in actualResult) {
            if (actualResult.success) {
              successfulUpdates++;
            } else {
              failures.push({
                success: false,
                message: actualResult.message || 'Update failed',
                bucket_name: bucketName,
              });
            }
          } else {
            failures.push({
              success: false,
              message: 'Invalid result structure',
              bucket_name: bucketName,
            });
          }
        } else {
          failures.push({
            success: false,
            message: 'Unexpected error',
            bucket_name: bucketName,
          });
        }
      });

      // Check if cancelled
      if (controller.signal.aborted) {
        props.onUpdateStateChange({
          ...props.updateState(),
          status: 'cancelled',
          message: t('bucket.grid.updateCancelled'),
        });
        toast.info(t('bucket.grid.updateCancelled'));
        return;
      }

      // Refresh bucket list
      await props.onRefreshBuckets?.();

      // Show completion state
      if (failures.length > 0) {
        const failureMessage = t('bucket.grid.bulkUpdateCompletedWithFailures', {
          successful: successfulUpdates,
          total: gitBuckets.length,
          failures: failures.length,
        });
        props.onUpdateStateChange({
          ...props.updateState(),
          status: 'completed',
          message: failureMessage,
        });
        props.onFailedResultsChange?.(failures);
        toast.warning(failureMessage);
      } else {
        const successMessage = t('bucket.grid.bulkUpdateCompletedSuccess', {
          successful: successfulUpdates,
          total: gitBuckets.length,
        });
        props.onUpdateStateChange({
          ...props.updateState(),
          status: 'completed',
          message: successMessage,
        });
        props.onFailedResultsChange?.([]);
        toast.success(successMessage);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        props.onUpdateStateChange({
          ...props.updateState(),
          status: 'cancelled',
          message: t('bucket.grid.updateCancelled'),
        });
        toast.info(t('bucket.grid.updateCancelled'));
        return;
      }

      console.error('Error updating all buckets:', error);
      let errorMessage = 'Error occurred during bulk update';
      if (error instanceof Error) {
        errorMessage = `Bulk update failed: ${error.message}`;
      }

      props.onUpdateStateChange({
        ...props.updateState(),
        status: 'error',
        message: errorMessage,
      });

      toast.error(errorMessage);
    } finally {
      setAbortController(null);
      setIsStarted(false);
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    const controller = abortController();
    if (controller) {
      controller.abort();
      props.onSetCancelling?.(true);

      props.onUpdateStateChange({
        ...props.updateState(),
        status: 'cancelled',
        message: t('bucket.grid.cancellingUpdates'),
      });
    }
  };

  // Auto-start update when status becomes 'updating' and we have buckets
  createEffect(() => {
    if (
      props.updateState().status === 'updating' &&
      props.buckets.length > 0 &&
      !abortController() &&
      !isStarted()
    ) {
      setIsStarted(true);
      startBulkUpdate();
    }
  });

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
            <Show when={props.updateState().status === 'updating' && abortController()}>
              <button
                class="btn btn-warning btn-xs btn-circle"
                onClick={handleCancel}
                title="Cancel update"
              >
                <X class="h-3 w-3" />
              </button>
            </Show>
            <Show
              when={
                props.updateState().status === 'completed' || props.updateState().status === 'error'
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
                  ? 'bg-warning' // Warning color when there are errors
                  : 'bg-success' // Success color when all good
                : props.updateState().status === 'error'
                  ? 'bg-error'
                  : props.updateState().status === 'cancelled'
                    ? 'bg-warning'
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

        {/* Expandable error details */}
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
