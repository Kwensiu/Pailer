import { createStore } from 'solid-js/store';
import { createEffect, createMemo, onCleanup, createRoot, untrack } from 'solid-js';
import { createTauriSignal } from '../hooks/storage/createTauriSignal';
import type {
  BaseOperationState,
  OperationState,
  OperationOutput,
  OperationResult,
  OperationStatus,
  MultiInstanceWarning,
  LargeDatasetWarning,
  ScanOperationState,
  PackageOperationState,
} from '../types/operations';
import { OperationStatus as OperationStatusEnum } from '../types/operations';
import { OperationType } from '../types/operations';
import installedPackagesStore from './installedPackagesStore';
import { searchCacheManager } from '../hooks/search/useSearchCache';
import { listen } from '@tauri-apps/api/event';

// Command execution state interface
export interface CommandExecutionState {
  command: string;
  output: OperationOutput[];
  isRunning: boolean;
  useScoopPrefix: boolean;
}

// Wrap reactive computations in createRoot for proper disposal
const operationsStore = createRoot(() => {
  // Operation state store
  const [operations, setOperations] = createStore<Record<string, OperationState>>({});

  // Command execution state - persists across page navigation
  const [commandExecution, setCommandExecution] = createStore<CommandExecutionState>({
    command: '',
    output: [],
    isRunning: false,
    useScoopPrefix: true,
  });

  // Current active operations count - automatically calculated using createMemo
  const activeOperationsCount = createMemo(() => {
    return Object.values(operations).filter(
      (op) => op.status === OperationStatusEnum.InProgress || op.isMinimized
    ).length;
  });

  // Multi-instance warning configuration - using persistent storage
  const [multiInstanceWarning, setMultiInstanceWarning] = createTauriSignal<MultiInstanceWarning>(
    'multiInstanceWarning',
    {
      enabled: true,
      threshold: 2,
      dismissed: false,
    }
  );

  // Large dataset warning configuration for bucket search - using persistent storage
  const [largeDatasetWarning, setLargeDatasetWarning] = createTauriSignal<LargeDatasetWarning>(
    'largeDatasetWarning',
    {
      dismissed: false,
    }
  );

  // Operation management Hook
  const useOperations = () => {
    // Global event listener for operation-output events (must be global so minimized modals still receive output)
    createEffect(() => {
      let unlisten: (() => void) | undefined;

      const setupOutputListener = async () => {
        try {
          unlisten = await listen('operation-output', (event) => {
            const payload = event.payload as any;
            const operationId = payload.operationId ?? payload.operation_id;

            if (operationId) {
              // Use untrack to read store without establishing reactive dependency
              const currentOp = untrack(() => operations[operationId]);
              if (currentOp) {
                const currentOutput = currentOp.output || [];
                const lastLine =
                  currentOutput.length > 0 ? currentOutput[currentOutput.length - 1].line : null;

                if (lastLine !== payload.line) {
                  addOperationOutput(operationId, {
                    operationId,
                    line: payload.line,
                    source: payload.source,
                    message: payload.message,
                  });
                }
              }
            }
          });
        } catch (e) {
          console.error('Failed to setup operation-output listener:', e);
        }
      };

      setupOutputListener();

      onCleanup(() => {
        if (unlisten) {
          unlisten();
        }
      });
    });

    // Global event listener for operation-finished events
    createEffect(() => {
      let unlisten: (() => void) | undefined;

      const setupListener = async () => {
        try {
          unlisten = await listen('operation-finished', (event) => {
            const payload = event.payload as any;
            const result: OperationResult = {
              operationId: payload.operationId ?? payload.operation_id ?? '',
              success: !!payload.success,
              operationName: payload.operationName ?? payload.operation_name ?? '',
              errorCount: payload.errorCount ?? payload.error_count,
              warningCount: payload.warningCount ?? payload.warning_count,
              finalStatus: payload.finalStatus ?? payload.final_status,
              message: payload.message,
              timestamp: (() => {
                const ts = payload.timestamp;
                if (typeof ts !== 'number') return Date.now();
                return ts < 1e12 ? ts * 1000 : ts;
              })(),
            };

            const operationId = result.operationId || undefined;

            if (operationId) {
              setOperationResult(operationId, result);

              // Handle VirusTotal scan special logic
              const op = untrack(() => operations[operationId]);
              if (op && op.isScan && result.success !== undefined) {
                // Trigger onInstallConfirm for successful scans with no threats
                if (
                  result.success &&
                  !result.message?.includes('API key') &&
                  !result.message?.includes('detection')
                ) {
                  // Find the modal component and trigger onInstallConfirm
                  // This is a workaround since we can't directly access props from store
                  const event = new CustomEvent('virustotal-scan-success', {
                    detail: { operationId, result },
                  });
                  window.dispatchEvent(event);
                }
              }

              // Refresh installed/search caches immediately on successful package operations.
              // This must live here (global listener) so it still works when OperationModal is minimized/unmounted.
              // Use untrack to read store without establishing reactive dependency
              if (result.success && op && !op.isScan) {
                const operationType = op.operationType;
                if (
                  operationType === OperationType.Install ||
                  operationType === OperationType.Uninstall ||
                  operationType === OperationType.Update ||
                  operationType === OperationType.UpdateAll
                ) {
                  installedPackagesStore.silentRefetch();
                  searchCacheManager.invalidateCache();
                }
              }
            } else {
              console.warn(
                'Received operation-finished event without operationId; ignoring to prevent wrong operation binding:',
                result
              );
            }
          });
        } catch (e) {
          console.error('Failed to setup operation-finished listener:', e);
        }
      };

      setupListener();

      onCleanup(() => {
        if (unlisten) {
          unlisten();
        }
      });
    });

    // Add new operation
    type AddOperationPayload = Omit<BaseOperationState, 'createdAt' | 'updatedAt'> &
      (ScanOperationState | PackageOperationState);

    const addOperation = (operation: AddOperationPayload) => {
      const now = Date.now();
      const newOperation = {
        ...operation,
        createdAt: now,
        updatedAt: now,
      } as OperationState;

      setOperations(newOperation.id, newOperation);
      // Active operations count will be automatically updated through createMemo

      // Check if multi-instance warning needs to be displayed
      checkMultiInstanceWarning();
    };

    // Remove operation
    const removeOperation = (id: string) => {
      setOperations(id, undefined as any);
      // Active operations count will be automatically updated through createMemo
    };

    // Update operation status
    const updateOperation = (id: string, updates: Partial<OperationState>) => {
      setOperations(id, {
        ...updates,
        updatedAt: Date.now(),
      });
    };

    // Add operation output - optimize performance, reduce array creation
    const addOperationOutput = (
      operationId: string,
      output: Omit<OperationOutput, 'timestamp'>
    ) => {
      const timestamp = Date.now();
      const newOutput: OperationOutput = { ...output, timestamp };

      setOperations(operationId, 'output', (prev) => {
        const current = prev || [];
        // Use more reasonable limits to avoid excessive memory usage
        const MAX_OUTPUT_LINES = 500;
        const KEEP_LINES_AFTER_TRIM = 200;

        if (current.length >= MAX_OUTPUT_LINES) {
          // Keep more history to avoid losing important intermediate logs
          const updated = current.slice(-KEEP_LINES_AFTER_TRIM);
          updated.push(newOutput);
          return updated;
        }
        // Add directly in normal cases
        return [...current, newOutput];
      });
    };

    const TERMINAL_STATUSES = new Set<string>([
      OperationStatusEnum.Success,
      OperationStatusEnum.Warning,
      OperationStatusEnum.Error,
      OperationStatusEnum.Cancelled,
    ]);

    // Set operation result
    const setOperationResult = (operationId: string, result: OperationResult) => {
      // Terminal-state locking: once an operation reaches a terminal status, ignore duplicate finished events
      const existingOp = untrack(() => operations[operationId]);
      if (existingOp && TERMINAL_STATUSES.has(existingOp.status)) {
        return;
      }

      let status: OperationStatusEnum;

      // Prefer explicit finalStatus from backend; fall back to legacy inference
      if (result.finalStatus) {
        status = result.finalStatus as OperationStatusEnum;
      } else {
        console.warn(
          `[operations] operation-finished for "${operationId}" missing finalStatus; using legacy inference`
        );
        const isCancellation =
          !result.success &&
          (result.errorCount === undefined || result.errorCount === 0) &&
          (result.warningCount === undefined || result.warningCount === 0);

        if (isCancellation) {
          status = OperationStatusEnum.Cancelled;
        } else if (!result.success) {
          status = OperationStatusEnum.Error;
        } else if (result.warningCount && result.warningCount > 0) {
          status = OperationStatusEnum.Warning;
        } else {
          status = OperationStatusEnum.Success;
        }
      }

      updateOperation(operationId, {
        status,
        result,
      });
    };

    // Toggle minimize status
    const toggleMinimize = (operationId: string) => {
      const operation = operations[operationId];
      if (operation) {
        updateOperation(operationId, {
          isMinimized: !operation.isMinimized,
        });
      }
    };

    // Set operation status
    const setOperationStatus = (operationId: string, status: OperationStatus) => {
      updateOperation(operationId, { status });
    };

    // Get active operations
    const getActiveOperations = () => {
      return Object.values(operations).filter(
        (op) => op.status === OperationStatusEnum.InProgress || op.isMinimized
      );
    };

    // Update active operations count - removed, using createMemo for automatic calculation

    // Check multi-instance warning
    const checkMultiInstanceWarning = () => {
      const warning = multiInstanceWarning();
      const activeCount = activeOperationsCount(); // Use computed property

      if (warning.enabled && !warning.dismissed && activeCount >= warning.threshold) {
        return true;
      }
      return false;
    };

    // Dismiss multi-instance warning
    const dismissMultiInstanceWarning = () => {
      setMultiInstanceWarning((prev: MultiInstanceWarning) => ({ ...prev, dismissed: true }));
    };

    // Update multi-instance warning configuration
    const updateMultiInstanceWarning = (updates: Partial<MultiInstanceWarning>) => {
      setMultiInstanceWarning((prev: MultiInstanceWarning) => ({ ...prev, ...updates }));
    };

    // Check large dataset warning
    const checkLargeDatasetWarning = () => {
      return !largeDatasetWarning().dismissed;
    };

    // Dismiss large dataset warning
    const dismissLargeDatasetWarning = () => {
      setLargeDatasetWarning((prev: LargeDatasetWarning) => ({ ...prev, dismissed: true }));
    };

    // Command execution methods
    const setCommand = (command: string) => {
      setCommandExecution('command', command);
    };

    const setCommandRunning = (isRunning: boolean) => {
      setCommandExecution('isRunning', isRunning);
    };

    const toggleScoopPrefix = () => {
      setCommandExecution('useScoopPrefix', (prev) => !prev);
    };

    const addCommandOutput = (output: OperationOutput) => {
      setCommandExecution('output', (prev) => [...prev, output]);
    };

    const clearCommandOutput = () => {
      setCommandExecution('output', []);
    };

    const resetCommandState = () => {
      setCommandExecution({
        command: '',
        output: [],
        isRunning: false,
        useScoopPrefix: true,
      });
    };

    return {
      // State
      operations: () => operations,
      activeOperationsCount,
      multiInstanceWarning,
      commandExecution: () => commandExecution,

      // Operation methods
      addOperation,
      removeOperation,
      updateOperation,
      addOperationOutput,
      setOperationResult,
      toggleMinimize,
      setOperationStatus,
      getActiveOperations,

      // Command execution methods
      setCommand,
      setCommandRunning,
      toggleScoopPrefix,
      addCommandOutput,
      clearCommandOutput,
      resetCommandState,

      // Warning management
      checkMultiInstanceWarning,
      dismissMultiInstanceWarning,
      updateMultiInstanceWarning,
      checkLargeDatasetWarning,
      dismissLargeDatasetWarning,

      // Utility methods
      generateOperationId,
    };
  };

  // Periodic cleanup - fix memory leak issue
  createEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cleanupThreshold = 5 * 60 * 1000; // 5 minutes

      Object.entries(operations).forEach(([id, operation]) => {
        if (
          (operation.status === OperationStatusEnum.Success ||
            operation.status === OperationStatusEnum.Warning ||
            operation.status === OperationStatusEnum.Error ||
            operation.status === OperationStatusEnum.Cancelled) &&
          now - operation.updatedAt > cleanupThreshold
        ) {
          setOperations(id, undefined as any);
        }
      });
    }, 60000); // Clean up once per minute

    onCleanup(() => {
      clearInterval(cleanupInterval);
    });
  });

  return useOperations;
});

// Generate unique operation ID
export const generateOperationId = (operationType: string): string => {
  return `${operationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Operation management Hook - export function returned from createRoot
export const useOperations = operationsStore;
