import { Accessor, onCleanup } from 'solid-js';
import { OperationStatus, OperationType } from '../../types/operations';
import { useOperations } from '../../stores/operations';
import { requestCancelWithRetry } from '../../utils/operationCancellation';

interface RunningUpdateOperationOptions {
  packageName?: Accessor<string | undefined>;
  updateBatchId?: Accessor<string | null | undefined>;
  logPrefix: string;
}

export function useRunningUpdateOperation(options: RunningUpdateOperationOptions) {
  const {
    getActiveOperations,
    getRunningPackageUpdateOperation,
    getRunningUpdateAllOperation,
    removeOperation,
  } = useOperations();
  let cancelRetryCleanup: (() => void) | null = null;

  const runningOperation = () => {
    const packageName = options.packageName?.();
    if (packageName) {
      return getRunningPackageUpdateOperation(packageName);
    }

    if (options.updateBatchId) {
      const updateBatchId = options.updateBatchId();
      if (!updateBatchId) {
        return getRunningUpdateAllOperation();
      }

      return getActiveOperations().find(
        (op) =>
          !op.isScan &&
          op.operationType === OperationType.Update &&
          op.updateBatchId === updateBatchId &&
          (op.status === OperationStatus.InProgress || op.status === OperationStatus.Queued)
      );
    }

    return (
      getRunningUpdateAllOperation() ??
      getActiveOperations().find(
        (op) =>
          !op.isScan &&
          op.operationType === OperationType.Update &&
          (op.status === OperationStatus.InProgress || op.status === OperationStatus.Queued)
      )
    );
  };

  const isUpdating = () => runningOperation()?.status === OperationStatus.InProgress;
  const isActive = () => {
    const op = runningOperation();
    return op?.status === OperationStatus.InProgress || op?.status === OperationStatus.Queued;
  };

  const clearCancelRetry = () => {
    cancelRetryCleanup?.();
    cancelRetryCleanup = null;
  };

  const requestCancel = () => {
    const packageName = options.packageName?.();

    if (!packageName) {
      const updateBatchId = options.updateBatchId?.();
      if (options.updateBatchId && !updateBatchId) {
        return;
      }

      getActiveOperations()
        .filter(
          (op) =>
            !op.isScan &&
            op.operationType === OperationType.Update &&
            (!updateBatchId || op.updateBatchId === updateBatchId) &&
            (op.status === OperationStatus.InProgress || op.status === OperationStatus.Queued)
        )
        .forEach((op) => {
          if (op.status === OperationStatus.Queued) {
            removeOperation(op.id);
            return;
          }

          requestCancelWithRetry({
            operationId: op.id,
            logPrefix: options.logPrefix,
            isInProgress: () =>
              getActiveOperations().some(
                (current) =>
                  current.id === op.id && current.status === OperationStatus.InProgress
              ),
          });
        });
      return;
    }

    const op = runningOperation();
    if (!op) {
      return;
    }

    if (op.status === OperationStatus.Queued) {
      removeOperation(op.id);
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
    isActive,
    requestCancel,
    clearCancelRetry,
  };
}
