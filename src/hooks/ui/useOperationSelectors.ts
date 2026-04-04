import { OperationStatus } from '../../types/operations';
import type { OperationState } from '../../types/operations';

type OperationLike = Pick<OperationState, 'status'> | undefined | null;

export const isRunning = (op: OperationLike): boolean => op?.status === OperationStatus.InProgress;

export const isTerminal = (op: OperationLike): boolean =>
  op != null &&
  (op.status === OperationStatus.Success ||
    op.status === OperationStatus.Warning ||
    op.status === OperationStatus.Error ||
    op.status === OperationStatus.Cancelled);

export const isSuccessful = (op: OperationLike): boolean =>
  op?.status === OperationStatus.Success || op?.status === OperationStatus.Warning;

export const primaryAction = (op: OperationLike): 'cancel' | 'close' =>
  isRunning(op) ? 'cancel' : 'close';

export const primaryButtonVariant = (op: OperationLike): string => {
  if (isRunning(op)) return 'btn-error';
  if (op?.status === OperationStatus.Success) return 'btn-primary';
  return 'btn-warning';
};
