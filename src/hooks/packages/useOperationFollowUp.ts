import { onCleanup } from 'solid-js';
import { useOperations } from '../../stores/operations';
import type { OperationResult } from '../../types/operations';

type OperationStarter<Args extends unknown[]> = (...args: Args) => string | null;
type AsyncOperationStarter<Args extends unknown[]> = (...args: Args) => Promise<string | null>;

export function useOperationFollowUp(onSuccess: (result: OperationResult) => void | Promise<void>) {
  const { addCompletionFollowUp } = useOperations();
  const unsubscribeFollowUps = new Set<() => void>();

  const addFollowUp = (operationId: string | null) => {
    if (!operationId) {
      return;
    }

    let unsubscribeRef: (() => void) | undefined;
    const cleanup = () => {
      unsubscribeRef?.();
      unsubscribeFollowUps.delete(cleanup);
    };

    unsubscribeRef = addCompletionFollowUp(operationId, async (result) => {
      cleanup();
      if (result.success) {
        await onSuccess(result);
      }
    });
    unsubscribeFollowUps.add(cleanup);
  };

  const withFollowUp = <Args extends unknown[]>(starter: OperationStarter<Args>) => {
    return (...args: Args) => {
      addFollowUp(starter(...args));
    };
  };

  const withAsyncFollowUp = <Args extends unknown[]>(starter: AsyncOperationStarter<Args>) => {
    return async (...args: Args) => {
      addFollowUp(await starter(...args));
    };
  };

  onCleanup(() => {
    unsubscribeFollowUps.forEach((unsubscribe) => unsubscribe());
    unsubscribeFollowUps.clear();
  });

  return {
    addFollowUp,
    withFollowUp,
    withAsyncFollowUp,
  };
}
