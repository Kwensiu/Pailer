import { invoke } from '@tauri-apps/api/core';

interface CancelWithRetryOptions {
  operationId: string;
  isInProgress: () => boolean;
  logPrefix: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

const requestCancellation = (operationId: string, logPrefix: string) => {
  void invoke('request_cancel_operation', { operationId }).catch((error) => {
    console.error(`[${logPrefix}] Failed to request cancellation for ${operationId}:`, error);
  });
};

export const requestCancelWithRetry = (options: CancelWithRetryOptions): (() => void) => {
  const { operationId, isInProgress, logPrefix, maxRetries = 3, retryDelayMs = 100 } = options;

  let attempts = 0;
  let disposed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetryTimer = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const retry = () => {
    if (disposed) return;

    if (!isInProgress()) {
      clearRetryTimer();
      return;
    }

    if (attempts >= maxRetries) {
      console.warn(`[${logPrefix}] Cancel retry limit reached for: ${operationId}`);
      clearRetryTimer();
      return;
    }

    attempts += 1;
    console.log(`[${logPrefix}] Retrying cancellation (${attempts}/${maxRetries}): ${operationId}`);
    requestCancellation(operationId, logPrefix);
    retryTimer = setTimeout(retry, retryDelayMs);
  };

  requestCancellation(operationId, logPrefix);
  retryTimer = setTimeout(retry, retryDelayMs);

  return () => {
    disposed = true;
    clearRetryTimer();
  };
};
