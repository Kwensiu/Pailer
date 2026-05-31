import { createMemo, createSignal, For, Show, onMount, onCleanup, Component } from 'solid-js';
import { CircleCheckBig, CircleX, TriangleAlert, CircleSlash } from 'lucide-solid';
import { useOperations } from '../../stores/operations';
import type { MinimizedIndicatorProps } from '../../types/operations';
import { OperationStatus } from '../../types/operations';
import { t } from '../../i18n';
import { requestCancelWithRetry } from '../../utils/operationCancellation';

// Single minimized operation indicator
const MinimizedOperation: Component<MinimizedIndicatorProps> = (props) => {
  const handleCancelClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onClose?.();
  };

  const handleMiddleClick = (e: MouseEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    props.onClose?.();
  };

  const getStatusIcon = () => {
    switch (props.status) {
      case 'in-progress':
        return (
          <button
            type="button"
            class="btn btn-xs btn-circle btn-ghost"
            onClick={handleCancelClick}
            aria-label={t('buttons.cancel')}
            title={t('buttons.cancel')}
          >
            <CircleX class="text-base-content/60 h-4 w-4" />
          </button>
        );
      case 'success':
        return <CircleCheckBig class="text-success h-4 w-4" />;
      case 'warning':
        return <TriangleAlert class="text-warning h-4 w-4" />;
      case 'error':
        return <CircleX class="text-error h-4 w-4" />;
      case 'cancelled':
        return (
          <button
            type="button"
            class="btn btn-xs btn-circle btn-ghost"
            onClick={handleCancelClick}
            aria-label={t('buttons.close')}
            title={t('buttons.close')}
          >
            <CircleSlash class="text-base-content/60 h-4 w-4" />
          </button>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (props.status) {
      case 'in-progress':
        return t('status.inProgress');
      case 'success':
        return t('status.completed');
      case 'warning':
        return t('status.warning');
      case 'error':
        return t('status.failed');
      case 'cancelled':
        return t('status.cancelled');
      default:
        return '';
    }
  };

  return (
    <div
      class="minimized-indicator"
      style={`--index: ${props.index ?? 0};`}
      classList={{
        'minimized-indicator--minimized': props.isMinimized,
        'minimized-indicator--active': !props.isMinimized,
        'minimized-indicator--in-progress': props.status === 'in-progress',
      }}
      onClick={props.onClick}
      onMouseDown={handleMiddleClick}
      role="button"
      tabindex="0"
      aria-label={`${props.title} - ${getStatusText()}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick();
        }
      }}
    >
      <div class="minimized-indicator__content">
        <div class="minimized-indicator__title" title={props.title}>
          {props.title}
        </div>
        <div class="minimized-indicator__status">{getStatusIcon()}</div>
      </div>
    </div>
  );
};

// Global minimized operations tray - manages and displays minimized OperationModal processes
const MinimizedOperationsTray = () => {
  const { getActiveOperations, removeOperation, toggleMinimize } = useOperations();

  const [expanded, setExpanded] = createSignal(false);
  const cancelRetryCleanups = new Map<string, () => void>();

  const minimizedOperations = createMemo(() => {
    return getActiveOperations()
      .filter((op) => op.isMinimized)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const canExpandTray = () => minimizedOperations().length > 1;
  const trayCount = () => minimizedOperations().length;

  // Handle indicator click
  const handleIndicatorClick = (operationId: string) => {
    if (canExpandTray() && !expanded()) {
      setExpanded(true);
      return;
    }

    toggleMinimize(operationId);
  };

  // Handle indicator close
  const handleIndicatorClose = (operationId: string) => {
    const operation = minimizedOperations().find((op) => op.id === operationId);
    if (!operation) {
      console.warn(`[MinimizedOperationsTray] Operation not found: ${operationId}`);
      return;
    }

    if (operation.status === OperationStatus.InProgress) {
      console.log(`[MinimizedOperationsTray] Cancelling operation: ${operationId}`);
      cancelRetryCleanups.get(operationId)?.();
      const cleanup = requestCancelWithRetry({
        operationId,
        logPrefix: 'MinimizedOperationsTray',
        isInProgress: () => {
          const currentOp = getActiveOperations().find((op) => op.id === operationId);
          return currentOp?.status === OperationStatus.InProgress;
        },
      });
      cancelRetryCleanups.set(operationId, cleanup);
      return;
    }

    cancelRetryCleanups.get(operationId)?.();
    cancelRetryCleanups.delete(operationId);
    removeOperation(operationId);
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setExpanded(false);
    }
  };

  const collapseTray = () => {
    setExpanded(false);
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    for (const cleanup of cancelRetryCleanups.values()) {
      cleanup();
    }
    cancelRetryCleanups.clear();
  });

  return (
    <Show when={minimizedOperations().length > 0}>
      <div
        class="minimized-indicators-container"
        classList={{
          'minimized-indicators-container--expanded': expanded(),
          'minimized-indicators-container--collapsed': !expanded(),
        }}
        style={`--tray-count: ${trayCount()};`}
        onMouseEnter={() => canExpandTray() && setExpanded(true)}
        onMouseLeave={collapseTray}
        onFocusIn={() => canExpandTray() && setExpanded(true)}
      >
        <For each={minimizedOperations()}>
          {(operation, index) => (
            <MinimizedOperation
              operationId={operation.id}
              title={operation.title}
              status={operation.status}
              isMinimized={operation.isMinimized}
              onClick={() => handleIndicatorClick(operation.id)}
              onClose={() => handleIndicatorClose(operation.id)}
              index={index()}
            />
          )}
        </For>
      </div>
    </Show>
  );
};

export default MinimizedOperationsTray;
