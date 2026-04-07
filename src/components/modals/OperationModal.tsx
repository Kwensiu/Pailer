import { createSignal, createEffect, createMemo, Show, For, Component, onCleanup } from 'solid-js';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useOperations } from '../../stores/operations';
import { OperationModalProps, OperationStatus } from '../../types/operations';
import { X, Minimize2, ExternalLink } from 'lucide-solid';
import { t } from '../../i18n';
import { isErrorLineWithContext } from '../../utils/errorDetection';
import { ansiToHtml, stripAnsi, hasAnsiCodes } from '../../utils/ansiUtils';
import { requestCancelWithRetry } from '../../utils/operationCancellation';
import settingsStore from '../../stores/settings';
import {
  isRunning,
  isTerminal,
  isSuccessful,
  primaryButtonVariant,
} from '../../hooks/ui/useOperationSelectors';
import Modal from '../common/Modal';
import { useScrollManager } from '../common/ScrollManager';

const LineWithLinks: Component<{ line: string; isStderr?: boolean; previousLines?: string[] }> = (
  props
) => {
  const cleanLine = stripAnsi(props.line);
  const hasColors = hasAnsiCodes(props.line);

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const isError = isErrorLineWithContext(cleanLine, props.previousLines || [], props.isStderr);

  // Render with ANSI colors preserved
  if (hasColors) {
    const htmlContent = ansiToHtml(props.line);
    return <span class="font-mono" innerHTML={htmlContent} />;
  }

  // Fallback to original logic for non-colored output
  if (isError) {
    return (
      <span class="font-mono">
        {cleanLine.match(urlRegex) ? (
          <For each={cleanLine.split(urlRegex)}>
            {(part) => {
              if (part.match(urlRegex)) {
                return (
                  <a href={part} target="_blank" class="link link-error inline-flex items-center">
                    {part}
                    <ExternalLink class="ml-1 h-3 w-3" />
                  </a>
                );
              }
              return <span>{part}</span>;
            }}
          </For>
        ) : (
          <span>{cleanLine}</span>
        )}
      </span>
    );
  }

  return (
    <span>
      {cleanLine.match(urlRegex) ? (
        <For each={cleanLine.split(urlRegex)}>
          {(part) => {
            if (part.match(urlRegex)) {
              return (
                <a href={part} target="_blank" class="link link-info inline-flex items-center">
                  {part}
                  <ExternalLink class="ml-1 h-3 w-3" />
                </a>
              );
            }
            return <span>{part}</span>;
          }}
        </For>
      ) : (
        <span>{cleanLine}</span>
      )}
    </span>
  );
};

const FormattedErrorMessage: Component<{ message: string }> = (props) => {
  const formatErrorMessage = (message: string) => {
    const parts = message.split(/(?=\s*(?:ERROR|WARN|INFO|WARNING|FATAL):)/i);

    if (parts.length === 1) {
      return message.split('\n').filter((line) => line.trim());
    }

    return parts.map((part) => part.trim()).filter((line) => line);
  };

  const formattedLines = formatErrorMessage(props.message);

  return (
    <div class="space-y-1">
      <For each={formattedLines}>
        {(line) => {
          const isErrorLine = /^(ERROR|WARN|INFO|WARNING|FATAL):/i.test(line);
          const shouldShowBullet = formattedLines.length > 1 && isErrorLine;

          return (
            <div class="flex items-start">
              <Show when={shouldShowBullet}>
                <span class="mt-1 mr-2 text-red-400">•</span>
              </Show>
              <span class="flex-1">
                <LineWithLinks line={line} isStderr={true} />
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
};

const getOperationDisplayName = (operation: any) => {
  const result = operation?.result;
  return operation?.title || result?.operationName || result?.operation_name || 'Operation';
};

const getErrorMessage = (operation: any) => {
  if (!operation) return t('operation.failed.generic', { name: 'Operation' });

  const result = operation.result;

  if (result?.message) {
    return result.message;
  }

  const operationName = getOperationDisplayName(operation);
  const errorCount = result?.errorCount ?? result?.error_count;

  if (errorCount && errorCount > 0) {
    return t('operation.failed.withErrors', {
      name: operationName,
      count: errorCount,
    });
  } else {
    return t('operation.failed.generic', { name: operationName });
  }
};

const getSuccessMessage = (operation: any) => {
  if (!operation) {
    return t('operation.completed', { name: 'Operation' });
  }

  const result = operation.result;

  if (result?.message) {
    return result.message;
  }

  const operationName = getOperationDisplayName(operation);

  const operationPatterns = [
    { prefix: 'Installing ', key: 'packageInfo.success.install' },
    { prefix: 'Updating ', key: 'packageInfo.success.update' },
    { prefix: 'Force updating ', key: 'packageInfo.success.forceUpdate' },
    { prefix: 'Uninstalling ', key: 'packageInfo.success.uninstall' },
    { prefix: 'Scanning ', key: 'virustotal.noThreats' },
  ];

  for (const { prefix, key } of operationPatterns) {
    if (operationName.startsWith(prefix)) {
      const packageName = operationName.substring(prefix.length);
      return t(key, { name: packageName });
    }
  }

  // Handle special cases (minimal hardcoding)
  const specialCases = [
    {
      check: (name: string) => name === 'Updating all packages',
      result: () => t('operation.updateAllSuccess'),
    },
    {
      check: (name: string) => name.startsWith('Switching ') || name.startsWith('Switched '),
      result: (name: string) => {
        const words = name.split(' ');
        if (words.length >= 4) {
          const packageName = words[0].replace(/^(Switching|Switched)\s*/, '');
          const version = words[2];
          return t('packageInfo.success.switchVersion', { name: packageName, version });
        }
      },
    },
  ];

  for (const { check, result } of specialCases) {
    if (check(operationName)) {
      return result(operationName) || t('operation.completed', { name: operationName });
    }
  }

  // Fallback to generic completion message with operation name
  return t('operation.completed', { name: operationName });
};

const getWarningMessage = (operation: any) => {
  if (!operation) {
    return t('operation.withWarnings', { name: 'Operation' });
  }

  const result = operation.result;

  if (result?.message) {
    return result.message;
  }

  const operationName = getOperationDisplayName(operation);

  return t('operation.withWarnings', { name: operationName });
};

function OperationModal(props: OperationModalProps) {
  const {
    removeOperation,
    toggleMinimize,
    setOperationStatus,
    updateOperation,
    addOperationOutput,
    generateOperationId,
    operations,
  } = useOperations();

  const [isClosing, setIsClosing] = createSignal(false);
  const [rendered, setRendered] = createSignal(false);
  const [isMinimizing, setIsMinimizing] = createSignal(false);
  let cancelRetryCleanup: (() => void) | null = null;

  const operationId = createMemo(() => {
    if (props.operationId) {
      return props.operationId;
    }
    return generateOperationId(props.title || 'operation');
  });

  const operation = createMemo(() => {
    return operations()[operationId()];
  });

  let scrollRef: HTMLDivElement | undefined;

  const [previousStatus, setPreviousStatus] = createSignal<OperationStatus | null>(null);
  const [lastFinishedStatus, setLastFinishedStatus] = createSignal<OperationStatus | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = createSignal(true);

  // Initialize scroll manager with reactive scrollRef
  const scrollManager = useScrollManager({
    get scrollRef() {
      return scrollRef;
    },
    get operationId() {
      return operationId();
    },
    shouldAutoScroll,
    setShouldAutoScroll,
  });

  // Watch for operation status changes to trigger onOperationFinished
  createEffect(() => {
    const op = operation();
    if (!op) return;

    const newStatus = op.status;
    const prevStatus = previousStatus();
    const finishedStatus = lastFinishedStatus();

    if (
      isTerminal({ status: newStatus }) &&
      newStatus !== finishedStatus &&
      (prevStatus === null || newStatus !== prevStatus)
    ) {
      if (props.onOperationFinished) {
        props.onOperationFinished(operationId(), isSuccessful({ status: newStatus }));
      }
      setLastFinishedStatus(newStatus);

      if (newStatus === 'success' && props.nextStep) {
        props.nextStep.onNext();
      }
    }

    if (!isTerminal({ status: newStatus }) && finishedStatus !== null) {
      setLastFinishedStatus(null);
    }
    setPreviousStatus(newStatus);
  });

  createEffect(() => {
    const currentOp = operation();
    if (!currentOp) return;

    setRendered(true);

    if (isTerminal(currentOp)) {
      return;
    }

    let isDisposed = false;
    let listenersSetup = false;

    const setupListeners = async () => {
      if (listenersSetup) return;
      listenersSetup = true;

      // Listen for VirusTotal scan success events from global store
      const handleVirusTotalSuccess = (event: CustomEvent) => {
        if (isDisposed) return;
        if (event.detail.operationId === operationId()) {
          props.onInstallConfirm?.();
        }
      };

      window.addEventListener('virustotal-scan-success', handleVirusTotalSuccess as EventListener);

      onCleanup(() => {
        window.removeEventListener(
          'virustotal-scan-success',
          handleVirusTotalSuccess as EventListener
        );
      });
    };

    setupListeners();

    onCleanup(() => {
      isDisposed = true;
    });
  });

  createEffect(() => {
    if (isClosing()) {
      const timer = setTimeout(() => {
        setRendered(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  });

  onCleanup(() => {
    cancelRetryCleanup?.();
    cancelRetryCleanup = null;
  });

  const requestOperationCancel = () => {
    cancelRetryCleanup?.();
    cancelRetryCleanup = requestCancelWithRetry({
      operationId: operationId(),
      logPrefix: 'OperationModal',
      isInProgress: () => operation()?.status === OperationStatus.InProgress,
    });
  };

  const handleCloseOrCancelPanel = (status: OperationStatus | undefined) => {
    setIsClosing(true);
    const resolvedStatus =
      status === OperationStatus.InProgress || !status ? OperationStatus.Cancelled : status;
    setOperationStatus(operationId(), resolvedStatus);
    setTimeout(() => {
      try {
        props.onClose(operationId(), isSuccessful({ status: resolvedStatus }));
      } catch (error) {
        console.error('Error calling onClose:', error);
      }

      removeOperation(operationId());
    }, 300);
  };

  const handleForceClose = () => {
    const currentOperation = operation();
    if (isRunning(currentOperation)) {
      // Cancel the operation but don't close the modal
      requestOperationCancel();
    } else {
      // Close the modal if operation is completed/cancelled
      cancelRetryCleanup?.();
      cancelRetryCleanup = null;
      removeOperation(operationId());
      props.onClose(operationId(), isSuccessful(currentOperation));
    }
  };

  const handleCancelOperation = () => {
    const currentOperation = operation();

    if (isRunning(currentOperation)) {
      requestOperationCancel();
    }
  };

  const handleMainButtonClick = (e: MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to modal
    const currentOperation = operation();
    if (isRunning(currentOperation)) {
      handleCancelOperation();
    } else {
      handleCloseOrCancelPanel(currentOperation?.status);
    }
  };

  const hasElevationError = () => {
    // TODO(elevation-followups): If new privilege-related failure patterns appear,
    // extend detection here and keep backend patterns in sync.
    // Related components to update together:
    // - src-tauri/src/commands/powershell.rs (contains_error_keywords)
    // - src-tauri/src/commands/scoop.rs (retry_operation_elevated)
    // - src/hooks/packages/usePackageOps.ts (operation metadata: bucket/flags)
    // - src/types/operations.ts (operation state fields)
    // - src/locales/en.json + src/locales/zh.json (button/error i18n text)
    const op = operation();
    if (!op || op.status !== OperationStatus.Error) return false;

    const permissionPatterns = [
      'permission denied',
      'access is denied',
      'administrator',
      'admin rights',
      'requires elevation',
      'elevation required',
      'unauthorizedaccessexception',
    ];

    const resultMessage = (op.result?.message || '').toLowerCase();
    if (permissionPatterns.some((pattern) => resultMessage.includes(pattern))) {
      return true;
    }

    return (op.output || []).some((line) =>
      permissionPatterns.some((pattern) => line.line.toLowerCase().includes(pattern))
    );
  };

  const handleElevatedRetry = async () => {
    const currentOp = operation();
    if (!currentOp || currentOp.status !== OperationStatus.Error) return;

    updateOperation(operationId(), {
      status: OperationStatus.InProgress,
      result: undefined,
    });

    addOperationOutput(operationId(), {
      operationId: operationId(),
      source: 'system',
      line: '[Pailer] Retrying with administrator privileges...',
      message: 'Retrying with administrator privileges...',
    });

    try {
      await invoke('retry_operation_elevated', {
        operationId: operationId(),
        operationName: currentOp.title,
        operationType: currentOp.isScan ? 'scan' : currentOp.operationType,
        packageName: currentOp.isScan ? undefined : currentOp.packageName,
        bucketName: currentOp.isScan ? undefined : currentOp.bucketName,
        forceUpdate: !currentOp.isScan && currentOp.forceUpdate === true,
        bypassSelfUpdate: settingsStore.settings.scoop.bypassSelfUpdate,
      });
    } catch (error) {
      // Only update if EVENT_FINISHED hasn't already moved the operation to a terminal state.
      const op = operation();
      if (op && op.status === OperationStatus.InProgress) {
        updateOperation(operationId(), {
          status: OperationStatus.Error,
        });
        addOperationOutput(operationId(), {
          operationId: operationId(),
          source: 'error',
          line: `[Pailer] Elevated retry failed to start: ${String(error)}`,
          message: String(error),
        });
      }
    }
  };

  const getCloseButtonText = () => {
    return isRunning(operation()) ? t('buttons.cancel') : t('buttons.close');
  };

  const handleMinimize = () => {
    const currentOperation = operation();
    if (currentOperation && !currentOperation.isMinimized) {
      // Save scroll position using scroll manager
      scrollManager.saveScrollPosition();

      // Send minimize state event to backend
      emit('panel-minimize-state', {
        isMinimized: true,
        showIndicator: true,
        title: currentOperation.title,
        result: currentOperation.status,
      });

      // Start minimize animation with proper timing
      setIsMinimizing(true);

      // Use a more robust approach to prevent race conditions
      setTimeout(() => {
        // Double-check that we're still in a valid state before proceeding
        const op = operation();
        if (op && !op.isMinimized && isMinimizing()) {
          setIsMinimizing(false);
          toggleMinimize(operationId());
        }
      }, 300);
    } else if (currentOperation) {
      emit('panel-minimize-state', {
        isMinimized: false,
        showIndicator: false,
        title: currentOperation.title,
        result: currentOperation.status,
      });

      toggleMinimize(operationId());
    }
  };

  const currentOperation = operation();

  // Modal state for the common Modal component
  const [isModalOpen, setIsModalOpen] = createSignal(false);

  createEffect(() => {
    setIsModalOpen(rendered() && currentOperation && !currentOperation.isMinimized);
  });

  const handleModalClose = () => {
    if (isClosing()) return;
    const currentOperation = operation();
    if (currentOperation) {
      handleCloseOrCancelPanel(currentOperation.status);
    }
  };

  return (
    <Modal
      isOpen={isModalOpen()}
      onClose={handleModalClose}
      title={currentOperation?.title || ''}
      size="large"
      showCloseButton={false}
      preventBackdropClose={true}
      animation="scale"
      zIndex="80"
      isMinimizing={isMinimizing()}
      class="operation-modal"
      data-operation-modal={operationId()}
      headerAction={
        <div class="flex justify-end gap-2">
          <button
            class="btn btn-sm btn-circle btn-ghost hover:bg-base-300 transition-colors duration-200"
            onClick={handleMinimize}
            title="Minimize"
          >
            <Minimize2 class="h-6 w-6 sm:h-5 sm:w-5" />
          </button>
          <button
            class="btn btn-sm btn-circle btn-ghost hover:bg-base-300 transition-colors duration-200"
            onClick={handleForceClose}
          >
            <X class="h-6 w-6 sm:h-5 sm:w-5" />
          </button>
        </div>
      }
      footer={
        <div class="flex justify-end gap-2">
          <Show when={hasElevationError()}>
            <button
              class="btn btn-footer btn-soft btn-warning"
              onClick={() => void handleElevatedRetry()}
            >
              {t('buttons.retryAsAdmin')}
            </button>
          </Show>
          <Show when={props.nextStep && currentOperation?.status === OperationStatus.Success}>
            <button class="btn btn-footer btn-primary" onClick={() => props.nextStep?.onNext()}>
              {props.nextStep?.buttonLabel}
            </button>
          </Show>
          <button
            class={`btn btn-footer btn-soft ${primaryButtonVariant(currentOperation)}`}
            onClick={handleMainButtonClick}
          >
            {getCloseButtonText()}
          </button>
        </div>
      }
    >
      {/* Output content */}
      <div
        ref={scrollRef}
        class="overflow-y-auto rounded-lg bg-black/90 p-4 font-mono text-xs text-white"
        style="white-space: pre; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;"
      >
        <For each={currentOperation?.output || []}>
          {(line, index) => (
            <div class="mb-1">
              <LineWithLinks
                line={line.line}
                isStderr={line.source === 'stderr'}
                previousLines={currentOperation?.output?.slice(0, index()).map((item) => item.line)}
              />
            </div>
          )}
        </For>
        <Show when={isRunning(currentOperation)}>
          <div class="mt-2 flex animate-pulse items-center">
            <span class="loading loading-spinner loading-xs mr-2"></span>
            {t('status.inProgress')}
          </div>
        </Show>
      </div>

      {/* Status alerts */}
      <div class="my-2">
        <Show when={currentOperation?.status === OperationStatus.Error}>
          <div class="status-alert status-alert-error rounded-lg!">
            <Show when={currentOperation.result?.message}>
              <FormattedErrorMessage message={currentOperation.result?.message || ''} />
            </Show>
            <Show when={!currentOperation.result?.message}>
              <span>{getErrorMessage(currentOperation)}</span>
            </Show>
          </div>
        </Show>

        <Show when={currentOperation?.status === OperationStatus.Warning}>
          <div class="status-alert status-alert-warning rounded-lg!">
            <span>{getWarningMessage(currentOperation)}</span>
          </div>
        </Show>

        <Show when={currentOperation?.status === OperationStatus.Cancelled}>
          <div class="status-alert status-alert-warning rounded-lg!">
            <span>
              {t('operation.cancelled', { name: getOperationDisplayName(currentOperation) })}
            </span>
          </div>
        </Show>

        <Show when={currentOperation?.status === OperationStatus.Success}>
          <div class="status-alert status-alert-success rounded-lg!">
            <span>{getSuccessMessage(currentOperation)}</span>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

export default OperationModal;
