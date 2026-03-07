import { createSignal, createEffect, createMemo, Show, For, Component, onCleanup } from 'solid-js';
import { listen, UnlistenFn, emit } from '@tauri-apps/api/event';
import { useOperations } from '../../stores/operations';
import {
  OperationOutput as StoreOperationOutput,
  OperationResult as StoreOperationResult,
  OperationModalProps,
} from '../../types/operations';
import { X, Minimize2, ExternalLink } from 'lucide-solid';
import { t } from '../../i18n';
import { isErrorLineWithContext } from '../../utils/errorDetection';
import { stripAnsi } from '../../utils/ansiUtils';
import Modal from '../common/Modal';

// Define VirustotalResult locally since it's not exported from types
interface VirustotalResult {
  detections_found: number;
  is_api_key_missing: boolean;
}

// Helper component to find and render links in a line of text
const LineWithLinks: Component<{ line: string; isStderr?: boolean; previousLines?: string[] }> = (
  props
) => {
  const cleanLine = stripAnsi(props.line);

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Check if line should be displayed as error with context awareness
  const isError = isErrorLineWithContext(cleanLine, props.previousLines || [], props.isStderr);

  // If it's an error line, wrap it in error styling
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

// Helper component to format error messages with proper line breaks
const FormattedErrorMessage: Component<{ message: string }> = (props) => {
  // Split the message by common error separators and clean up
  const formatErrorMessage = (message: string) => {
    // Look for patterns like "ERROR:", "WARN:", or numbered errors
    const parts = message.split(/(?=\s*(?:ERROR|WARN|INFO|WARNING|FATAL):)/i);

    if (parts.length === 1) {
      // No special formatting needed, just split by newlines
      return message.split('\n').filter((line) => line.trim());
    }

    // Format as list items
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

function OperationModal(props: OperationModalProps) {
  const {
    removeOperation,
    addOperationOutput,
    setOperationResult,
    toggleMinimize,
    setOperationStatus,
    generateOperationId,
    operations,
  } = useOperations();

  const [isClosing, setIsClosing] = createSignal(false);
  const [rendered, setRendered] = createSignal(false);
  const [isMinimizing, setIsMinimizing] = createSignal(false);

  // Generate or use provided operation ID
  const operationId = createMemo(() => {
    if (props.operationId) {
      return props.operationId;
    }
    return generateOperationId(props.title || 'operation');
  });

  // Get operation state from store
  const operation = createMemo(() => {
    return operations()[operationId()];
  });

  // This effect now correctly manages the lifecycle of the listeners
  let scrollRef: HTMLDivElement | undefined;

  // Use a separate effect for listener management that only cleans up when operation is complete
  createEffect(() => {
    const currentOp = operation();
    if (!props.title || !currentOp) return;

    console.log(
      'Setting up persistent listeners for operation:',
      operationId(),
      'Status:',
      currentOp.status
    );
    setRendered(true);

    let outputListener: UnlistenFn | undefined;
    let standardResultListener: UnlistenFn | undefined;
    let vtResultListener: UnlistenFn | undefined;
    let isDisposed = false;

    const setupListeners = async () => {
      try {
        // Common output listener for all operations
        outputListener = await listen<StoreOperationOutput>('operation-output', (event) => {
          if (isDisposed) return;
          console.log('Received operation-output event:', event.payload);
          // Support both operationId and operation_id for compatibility
          const eventOperationId = event.payload.operationId || event.payload.operation_id;
          // Only process output for this operation
          if (eventOperationId === operationId()) {
            // Check if operation still exists to prevent race conditions
            const currentOp = operation();
            if (!currentOp) {
              console.log('Operation no longer exists, ignoring output');
              return;
            }

            // Deduplicate consecutive identical lines
            const currentOutput = currentOp.output || [];
            const lastLine =
              currentOutput.length > 0 ? currentOutput[currentOutput.length - 1].line : null;
            if (lastLine === event.payload.line) {
              console.log('Skipping duplicate line:', event.payload.line);
              return;
            }

            console.log('Operation output matches current operationId:', operationId());
            addOperationOutput(operationId(), {
              operationId: operationId(),
              line: event.payload.line,
              source: event.payload.source,
              message: event.payload.message,
            });
          } else {
            console.log('Operation output ignored - different operationId:', {
              received: eventOperationId,
              current: operationId(),
            });
          }
        });

        if (props.isScan) {
          // Listen for the special VirusTotal result event
          vtResultListener = await listen<VirustotalResult>('virustotal-scan-finished', (event) => {
            if (isDisposed) return;
            // This is a global event, but we need to check if it's for this operation
            // For now, assume it's for the current scan operation
            const result: StoreOperationResult = {
              operationId: operationId(),
              success: !event.payload.detections_found && !event.payload.is_api_key_missing,
              message: event.payload.detections_found
                ? `Found ${event.payload.detections_found} potential threats`
                : event.payload.is_api_key_missing
                  ? 'VirusTotal API key not configured'
                  : 'No threats detected',
              timestamp: Date.now(),
            };

            setOperationResult(operationId(), result);

            if (!event.payload.detections_found && !event.payload.is_api_key_missing) {
              props.onInstallConfirm?.();
            }
          });
        } else {
          // Standard listener for install, update, etc.
          standardResultListener = await listen<StoreOperationResult>(
            'operation-finished',
            (event) => {
              if (isDisposed) return;
              console.log('Received operation-finished event:', event.payload);
              // Support both operationId and operation_id for compatibility
              const eventOperationId = event.payload.operationId || event.payload.operation_id;
              console.log('Current operationId():', operationId());
              console.log('Event payload operationId:', eventOperationId);
              console.log('Comparison result:', eventOperationId === operationId());
              // Only process result for this operation
              if (eventOperationId === operationId()) {
                // Check if operation still exists to prevent race conditions
                const currentOp = operation();
                if (!currentOp) {
                  console.log('Operation no longer exists, ignoring result');
                  return;
                }
                console.log('Operation finished matches current operationId:', operationId());
                console.log(
                  'Setting operation status to:',
                  event.payload.success ? 'success' : 'error'
                );
                setOperationResult(operationId(), event.payload);
                setOperationStatus(operationId(), event.payload.success ? 'success' : 'error');

                if (event.payload.success && props.nextStep) {
                  // Handle next step logic
                  props.nextStep.onNext();
                }
              } else {
                console.log('Operation finished ignored - different operationId:', {
                  received: eventOperationId,
                  current: operationId(),
                });
              }
            }
          );
        }
      } catch (error) {
        console.error('Failed to setup operation listeners:', error);
        // Set error result to notify user
        const errorResult: StoreOperationResult = {
          operationId: operationId(),
          success: false,
          message: 'Failed to initialize operation monitoring',
          timestamp: Date.now(),
        };
        setOperationResult(operationId(), errorResult);
      }
    };

    setupListeners();

    // Only cleanup when operation is complete or component unmounts
    onCleanup(() => {
      console.log(
        'Checking cleanup for operation:',
        operationId(),
        'Current status:',
        operation()?.status
      );
      const op = operation();
      // Only cleanup if operation is complete (success/error) or no longer exists
      if (!op || op.status === 'success' || op.status === 'error' || op.status === 'cancelled') {
        console.log('Cleaning up persistent listeners for operation:', operationId());
        isDisposed = true;
        outputListener?.();
        standardResultListener?.();
        vtResultListener?.();
      } else {
        console.log('Not cleaning up listeners - operation still in progress:', operationId());
      }
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

  const handleCloseOrCancelPanel = (wasSuccessful: boolean) => {
    setIsClosing(true);
    setOperationStatus(operationId(), wasSuccessful ? 'success' : 'cancelled');
    setTimeout(() => {
      removeOperation(operationId());
      props.onClose(operationId(), wasSuccessful);
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
      setOperationStatus(operationId(), 'cancelled');
    }
  };

  const handleMainButtonClick = (e: MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to modal
    const currentOperation = operation();
    if (currentOperation?.status === 'in-progress') {
      handleCancelOperation();
    } else {
      handleCloseOrCancelPanel(currentOperation?.status === 'success');
    }
  };

  const getCloseButtonText = () => {
    const currentOperation = operation();
    if (currentOperation?.status === 'in-progress') {
      return t('buttons.cancel');
    }
    return t('buttons.close');
  };

  const handleMinimize = () => {
    console.log('handleMinimize called for operation:', operationId());
    const currentOperation = operation();
    if (currentOperation && !currentOperation.isMinimized) {
      console.log('Minimizing operation:', currentOperation.title);
      // Send minimize state event to backend
      emit('panel-minimize-state', {
        isMinimized: true,
        showIndicator: true,
        title: currentOperation.title,
        result:
          currentOperation.status === 'success'
            ? 'success'
            : currentOperation.status === 'error'
              ? 'error'
              : 'in-progress',
      });

      // Start minimize animation with proper timing
      setIsMinimizing(true);

      // Use a more robust approach to prevent race conditions
      const minimizeTimer = setTimeout(() => {
        // Double-check that we're still in a valid state before proceeding
        const op = operation();
        if (op && !op.isMinimized && isMinimizing()) {
          setIsMinimizing(false);
          toggleMinimize(operationId());
        }
      }, 300);

      // Store timer ID for potential cleanup
      onCleanup(() => clearTimeout(minimizeTimer));
    } else if (currentOperation) {
      console.log('Restoring operation:', currentOperation.title);
      // Send restore state event to backend
      emit('panel-minimize-state', {
        isMinimized: false,
        showIndicator: false,
        title: currentOperation.title,
        result:
          currentOperation.status === 'success'
            ? 'success'
            : currentOperation.status === 'error'
              ? 'error'
              : 'in-progress',
      });

      toggleMinimize(operationId());
    }
  };

  // Scroll to bottom when new output is added, but only if user is near bottom
  createEffect(() => {
    const currentOperation = operation();
    if (
      scrollRef &&
      currentOperation?.output &&
      currentOperation.output.length > 0 &&
      !currentOperation.isMinimized
    ) {
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        const container = scrollRef!;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        // Check if user is near bottom (within 50px of bottom) or if content is short enough to fit entirely
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isNearBottom = distanceFromBottom <= 50;
        const contentFits = scrollHeight <= clientHeight;

        if (isNearBottom || contentFits) {
          container.scrollTop = scrollHeight;
        }
      });
    }
  });

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
      handleCloseOrCancelPanel(currentOperation.status === 'success');
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
              'btn btn-sm': true,
              'btn-error': currentOperation?.status === 'in-progress',
              'btn-primary': currentOperation?.status === 'success',
              'btn-warning': currentOperation?.status === 'error',
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
        style="white-space: pre-wrap; word-break: break-word;"
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
            <Show when={currentOperation.result?.message} fallback={<span>Operation failed</span>}>
              <FormattedErrorMessage message={currentOperation.result?.message || ''} />
            </Show>
          </div>
        </Show>

        <Show when={currentOperation?.status === 'success'}>
          <div class="status-alert status-alert-success rounded-lg!">
            <span>{currentOperation.result?.message || 'Operation completed successfully'}</span>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

export default OperationModal;
