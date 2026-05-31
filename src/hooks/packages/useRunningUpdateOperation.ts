import { Accessor, onCleanup } from 'solid-js';
import { OperationStatus } from '../../types/operations';
import { useOperations } from '../../stores/operations';
import { requestCancelWithRetry } from '../../utils/operationCancellation';

interface RunningUpdateOperationOptions {
  packageName?: Accessor<string | undefined>;
  logPrefix: string;
}

export function useRunningUpdateOperation(options: RunningUpdateOperationOptions) {
  const { getRunningPackageUpdateOperation, getRunningUpdateAllOperation } = useOperations();
  let cancelRetryCleanup: (() => void) | null = null;

  const runningOperation = () => {
    const packageName = options.packageName?.();
    return packageName
      ? (getRunningPackageUpdateOperation(packageName) ?? getRunningUpdateAllOperation())
      : getRunningUpdateAllOperation();
  };

  const isUpdating = () => runningOperation()?.status === OperationStatus.InProgress;

  const clearCancelRetry = () => {
    cancelRetryCleanup?.();
    cancelRetryCleanup = null;
  };

  const requestCancel = () => {
    const op = runningOperation();
    if (!op) {
      return;
    }

    clearCancelRetry();
    cancelRetryCleanup = requestCancelWithRetry({
      operationId: op.id,
      logPrefix: options.logPrefix,
      isInProgress: isUpdating,
    });
  };

  onCleanup(() => {
    clearCancelRetry();
  });

  return {
    runningOperation,
    isUpdating,
    requestCancel,
    clearCancelRetry,
  };
}
