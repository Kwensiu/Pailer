import { createSignal, createEffect, createMemo, Show, For, Component, onCleanup } from 'solid-js';
import { listen, UnlistenFn, emit } from '@tauri-apps/api/event';
import { useOperations } from '../../stores/operations';
import {
  OperationResult as StoreOperationResult,
  OperationModalProps,
  OperationStatus,
} from '../../types/operations';
import { X, Minimize2, ExternalLink } from 'lucide-solid';
import { t } from '../../i18n';
import { isErrorLineWithContext } from '../../utils/errorDetection';
import { ansiToHtml, stripAnsi, hasAnsiCodes } from '../../utils/ansiUtils';
import Modal from '../common/Modal';
import { useScrollManager } from '../common/ScrollManager';

// Define VirustotalResult locally since it's not exported from types
interface VirustotalResult {
  detections_found: number;
  is_api_key_missing: boolean;
}

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
  return result?.operationName || result?.operation_name || operation?.title || 'Operation';
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
    setOperationResult,
    toggleMinimize,
    setOperationStatus,
    generateOperationId,
    operations,
  } = useOperations();

  const [isClosing, setIsClosing] = createSignal(false);
  const [rendered, setRendered] = createSignal(false);
  const [isMinimizing, setIsMinimizing] = createSignal(false);

  const isSuccessfulStatus = (status: OperationStatus | undefined) => {
    return status === 'success' || status === 'warning';
  };

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

    if (
      prevStatus !== null &&
      newStatus !== prevStatus &&
      (newStatus === 'success' ||
        newStatus === 'warning' ||
        newStatus === 'error' ||
        newStatus === 'cancelled')
    ) {
      if (props.onOperationFinished) {
        props.onOperationFinished(
          operationId(),
          newStatus === 'success' || newStatus === 'warning'
        );
      }

      if (newStatus === 'success' && props.nextStep) {
        props.nextStep.onNext();
      }
    }
    setPreviousStatus(newStatus);
  });

  createEffect(() => {
    const currentOp = operation();
    if (!currentOp) return;

    setRendered(true);

    if (
      currentOp.status === 'success' ||
      currentOp.status === 'warning' ||
      currentOp.status === 'error' ||
      currentOp.status === 'cancelled'
    ) {
      return;
    }

    let vtResultListener: UnlistenFn | undefined;
    let isDisposed = false;
    let listenersSetup = false;

    const setupListeners = async () => {
      if (listenersSetup) return;
      listenersSetup = true;

      try {
        if (props.isScan) {
          vtResultListener = await listen<VirustotalResult>('virustotal-scan-finished', (event) => {
            if (isDisposed) return;
            const result: StoreOperationResult = {
              operationId: operationId(),
              success: event.payload.detections_found === 0,
              operationName: `Scanning`,
              errorCount: event.payload.detections_found > 0 ? 1 : undefined,
              timestamp: Date.now(),
              message: event.payload.is_api_key_missing
                ? 'VirusTotal API key is not configured.'
                : event.payload.detections_found > 0
                  ? `VirusTotal found ${event.payload.detections_found} detection(s).`
                  : 'No threats found.',
            };

            setOperationResult(operationId(), result);

            if (!event.payload.detections_found && !event.payload.is_api_key_missing) {
              props.onInstallConfirm?.();
            }
          });
        }
      } catch (error) {
        console.error('Failed to setup operation listeners:', error);
        const errorResult: StoreOperationResult = {
          operationId: operationId(),
          success: false,
          operationName: 'Operation Error',
          message: 'Failed to initialize operation monitoring',
          timestamp: Date.now(),
        };
        setOperationResult(operationId(), errorResult);
      }
    };

    setupListeners();

    onCleanup(() => {
      isDisposed = true;
      vtResultListener?.();
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

  const handleCloseOrCancelPanel = (status: OperationStatus | undefined) => {
    setIsClosing(true);
    const finalStatus = status === 'in-progress' || !status ? OperationStatus.Cancelled : status;
    setOperationStatus(operationId(), finalStatus);
    setTimeout(() => {
      try {
        props.onClose(operationId(), isSuccessfulStatus(finalStatus));
      } catch (error) {
        console.error('Error calling onClose:', error);
      }

      removeOperation(operationId());
    }, 300);
  };

  const handleForceClose = () => {
    const currentOperation = operation();
    if (currentOperation && currentOperation.status === 'in-progress') {
      emit('cancel-operation');
    }
    // Immediately remove the operation when X is clicked
    removeOperation(operationId());
    props.onClose(operationId(), false);
  };

  const handleCancelOperation = () => {
    const currentOperation = operation();

    if (currentOperation && currentOperation.status === 'in-progress') {
      // Emit cancel event first, then update status for consistency
      emit('cancel-operation');
      // Update status to provide visual feedback
      setOperationStatus(operationId(), OperationStatus.Cancelled);
    }
  };

  const handleMainButtonClick = (e: MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to modal
    const currentOperation = operation();
    if (currentOperation?.status === 'in-progress') {
      handleCancelOperation();
    } else {
      handleCloseOrCancelPanel(currentOperation?.status);
    }
  };

  const getOperationResultStatus = (status: OperationStatus) => {
    if (status === 'success') return 'success';
    if (status === 'error') return 'error';
    if (status === 'warning') return 'warning';
    return 'in-progress';
  };

  const getCloseButtonText = () => {
    const currentOperation = operation();
    if (currentOperation?.status === 'in-progress') {
      return t('buttons.cancel');
    }
    return t('buttons.close');
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
        result: getOperationResultStatus(currentOperation.status),
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
      // Send restore state event to backend
      emit('panel-minimize-state', {
        isMinimized: false,
        showIndicator: false,
        title: currentOperation.title,
        result: getOperationResultStatus(currentOperation.status),
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
          <Show when={props.nextStep && currentOperation?.status === 'success'}>
            <button class="btn btn-primary btn-sm" onClick={() => props.nextStep?.onNext()}>
              {props.nextStep?.buttonLabel}
            </button>
          </Show>
          <button
            classList={{
              btn: true,
              'btn-error': currentOperation?.status === 'in-progress',
              'btn-primary': currentOperation?.status === 'success',
              'btn-warning':
                currentOperation?.status === 'error' || currentOperation?.status === 'warning',
            }}
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
        <Show when={currentOperation?.status === 'in-progress'}>
          <div class="mt-2 flex animate-pulse items-center">
            <span class="loading loading-spinner loading-xs mr-2"></span>
            {t('status.inProgress')}
          </div>
        </Show>
      </div>

      {/* Status alerts */}
      <div class="my-2">
        <Show when={currentOperation?.status === 'error'}>
          <div class="status-alert status-alert-error rounded-lg!">
            <Show when={currentOperation.result?.message}>
              <FormattedErrorMessage message={currentOperation.result?.message || ''} />
            </Show>
            <Show when={!currentOperation.result?.message}>
              <span>{getErrorMessage(currentOperation)}</span>
            </Show>
          </div>
        </Show>

        <Show when={currentOperation?.status === 'warning'}>
          <div class="status-alert status-alert-warning rounded-lg!">
            <span>{getWarningMessage(currentOperation)}</span>
          </div>
        </Show>

        <Show when={currentOperation?.status === 'success'}>
          <div class="status-alert status-alert-success rounded-lg!">
            <span>{getSuccessMessage(currentOperation)}</span>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

export default OperationModal;
