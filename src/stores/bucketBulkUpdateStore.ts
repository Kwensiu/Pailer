import { createRoot, createSignal } from 'solid-js';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { t } from '../i18n';
import { toast } from '../components/common/ToastAlert';

export interface BulkUpdateResult {
  success: boolean;
  message: string;
  bucket_name: string;
  bucket_path?: string;
  manifest_count?: number;
}

export interface BulkUpdateState {
  status: 'idle' | 'updating' | 'completed' | 'warning' | 'error' | 'cancelled';
  current: number;
  total: number;
  message: string;
}

interface BucketLike {
  name: string;
  is_git_repo: boolean;
}

interface BulkUpdateProgressEvent {
  run_id: string;
  current: number;
  total: number;
  bucket_name: string;
  result: BulkUpdateResult;
}

interface StartBulkUpdateOptions {
  buckets: BucketLike[];
  updateAllBuckets?: (runId: string) => Promise<BulkUpdateResult[]>;
  updateBucket?: (
    bucketName: string,
    shouldRefreshBuckets?: boolean,
    abortSignal?: AbortSignal
  ) => Promise<BulkUpdateResult>;
}

const bucketBulkUpdateStore = createRoot(() => {
  const [updateState, setUpdateState] = createSignal<BulkUpdateState>({
    status: 'idle',
    current: 0,
    total: 0,
    message: '',
  });
  const [failedResults, setFailedResults] = createSignal<BulkUpdateResult[]>([]);
  const [showErrorDetails, setShowErrorDetails] = createSignal(false);
  const [isCancelling, setIsCancelling] = createSignal(false);
  const [abortController, setAbortController] = createSignal<AbortController | null>(null);
  const [activeRunId, setActiveRunId] = createSignal<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = createSignal(false);

  let progressUnlistenPromise: Promise<UnlistenFn> | null = null;

  const ensureProgressListener = () => {
    if (progressUnlistenPromise) {
      return progressUnlistenPromise;
    }

    progressUnlistenPromise = listen<BulkUpdateProgressEvent>('bucket-update-progress', (event) => {
      const payload = event.payload;
      if (!payload || payload.run_id !== activeRunId()) {
        return;
      }

      setUpdateState((prev) => ({
        ...prev,
        current: payload.current,
        total: payload.total || prev.total,
        message: `${t('bucket.grid.updatingBuckets')} (${payload.bucket_name})`,
      }));
    });

    return progressUnlistenPromise;
  };

  const close = () => {
    setUpdateState((prev) => ({ ...prev, status: 'idle' }));
    setFailedResults([]);
    setShowErrorDetails(false);
    setIsCancelling(false);
    setAbortController(null);
  };

  const canCancel = () => updateState().status === 'updating' && !activeRunId();

  const cancel = () => {
    const controller = abortController();
    if (!controller || !canCancel()) {
      return;
    }

    controller.abort();
    setIsCancelling(true);
    setUpdateState((prev) => ({
      ...prev,
      status: 'cancelled',
      message: t('bucket.grid.cancellingUpdates'),
    }));
  };

  const start = async (options: StartBulkUpdateOptions) => {
    if (updateState().status === 'updating') {
      return;
    }

    const gitBuckets = options.buckets.filter((bucket) => bucket.is_git_repo);
    if (gitBuckets.length === 0) {
      toast.info(t('bucket.grid.noGitBuckets'));
      return;
    }

    setFailedResults([]);
    setShowErrorDetails(false);
    setIsCancelling(false);
    setNeedsRefresh(false);
    setUpdateState({
      status: 'updating',
      current: 0,
      total: gitBuckets.length,
      message: t('bucket.grid.updatingBuckets'),
    });

    const controller = options.updateAllBuckets ? null : new AbortController();
    setAbortController(controller);

    try {
      let results: BulkUpdateResult[] = [];

      if (options.updateAllBuckets) {
        await ensureProgressListener();
        const runId = `bulk-bucket-update-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setActiveRunId(runId);
        results = await options.updateAllBuckets(runId);
      } else {
        for (const bucket of gitBuckets) {
          if (controller?.signal.aborted) {
            break;
          }

          try {
            const result = await options.updateBucket?.(bucket.name, false, controller?.signal);
            results.push(
              result ?? {
                success: false,
                message: 'Invalid result format',
                bucket_name: bucket.name,
              }
            );
          } catch (error) {
            if (controller?.signal.aborted) {
              break;
            }

            results.push({
              success: false,
              message: error instanceof Error ? error.message : String(error),
              bucket_name: bucket.name,
            });
          } finally {
            setUpdateState((prev) => ({
              ...prev,
              current: Math.min(prev.current + 1, gitBuckets.length),
              message: `${t('bucket.grid.updatingBuckets')} (${bucket.name})`,
            }));
          }
        }
      }

      if (controller?.signal.aborted) {
        setUpdateState((prev) => ({
          ...prev,
          status: 'cancelled',
          message: t('bucket.grid.updateCancelled'),
        }));
        toast.info(t('bucket.grid.updateCancelled'));
        return;
      }

      const failures: BulkUpdateResult[] = [];
      let successfulUpdates = 0;

      results.forEach((result, index) => {
        const bucketName = result?.bucket_name || gitBuckets[index]?.name || 'unknown';
        if (!result || typeof result !== 'object' || !('success' in result)) {
          failures.push({
            success: false,
            message: 'Invalid result structure',
            bucket_name: bucketName,
          });
          return;
        }

        if (result.success) {
          successfulUpdates++;
        } else {
          failures.push({
            success: false,
            message: result.message || 'Update failed',
            bucket_name: bucketName,
          });
        }
      });

      setNeedsRefresh(true);

      if (failures.length > 0) {
        const failureMessage = t('bucket.grid.bulkUpdateCompletedWithFailures', {
          successful: successfulUpdates,
          total: gitBuckets.length,
          failures: failures.length,
        });
        setUpdateState((prev) => ({
          ...prev,
          current: gitBuckets.length,
          status: 'completed',
          message: failureMessage,
        }));
        setFailedResults(failures);
        toast.warning(failureMessage);
        return;
      }

      const successMessage = t('bucket.grid.bulkUpdateCompletedSuccess', {
        successful: successfulUpdates,
        total: gitBuckets.length,
      });
      setUpdateState((prev) => ({
        ...prev,
        current: gitBuckets.length,
        status: 'completed',
        message: successMessage,
      }));
      setFailedResults([]);
      toast.success(successMessage);
    } catch (error) {
      if (controller?.signal.aborted) {
        setUpdateState((prev) => ({
          ...prev,
          status: 'cancelled',
          message: t('bucket.grid.updateCancelled'),
        }));
        toast.info(t('bucket.grid.updateCancelled'));
        return;
      }

      const errorMessage =
        error instanceof Error
          ? `Bulk update failed: ${error.message}`
          : 'Error occurred during bulk update';

      console.error('Error updating all buckets:', error);
      setUpdateState((prev) => ({
        ...prev,
        status: 'error',
        message: errorMessage,
      }));
      toast.error(errorMessage);
    } finally {
      setAbortController(null);
      setIsCancelling(false);
      setActiveRunId(null);
    }
  };

  return {
    updateState,
    failedResults,
    showErrorDetails,
    isCancelling,
    needsRefresh,
    canCancel,
    start,
    cancel,
    close,
    clearRefreshFlag: () => setNeedsRefresh(false),
    toggleErrorDetails: () => setShowErrorDetails((prev) => !prev),
    getErrorDetails: () => (updateState().status === 'completed' ? failedResults() : []),
  };
});

export default bucketBulkUpdateStore;
