import { createSignal, For, Show, onMount, onCleanup, Component } from 'solid-js';
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

  const [showMore, setShowMore] = createSignal(false);
  const cancelRetryCleanups = new Map<string, () => void>();

  // Get minimized operations list
  const getMinimizedOperations = () => {
    return getActiveOperations()
      .filter((op) => op.isMinimized)
      .sort((a, b) => b.updatedAt - a.updatedAt); // Sort by update time in descending order
  };

  // Get visible operations list
  const getVisibleOperations = () => {
    const minimized = getMinimizedOperations();
    const count = 5; // Fixed display 5 items
    return showMore() ? minimized : minimized.slice(0, count);
  };

  // Handle indicator click
  const handleIndicatorClick = (operationId: string) => {
    toggleMinimize(operationId);
  };

  // Handle indicator close
  const handleIndicatorClose = (operationId: string) => {
    const operation = getActiveOperations().find((op) => op.id === operationId);
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

  // Calculate if there are more operations
  const hasMoreOperations = () => {
    const minimized = getMinimizedOperations();
    return minimized.length > 5;
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowMore(false);
    }
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
    <Show when={getMinimizedOperations().length > 0}>
      <div class="minimized-indicators-container">
        <For each={getVisibleOperations()}>
          {(operation, index) => (
            <MinimizedOperation
              operationId={operation.id}
              title={operation.title}
              status={operation.status}
              isMinimized={operation.isMinimized}
              visible={true}
              onClick={() => handleIndicatorClick(operation.id)}
              onClose={() => handleIndicatorClose(operation.id)}
              index={index()}
            />
          )}
        </For>

        {/* Show more button */}
        <Show when={hasMoreOperations() && !showMore()}>
          <button
            class="minimized-indicator minimized-indicator--more"
            style={`--index: ${getVisibleOperations().length};`}
            onClick={() => setShowMore(true)}
            aria-label={t('buttons.showMore')}
          >
            <div class="minimized-indicator__content">
              <div class="minimized-indicator__title">+{getMinimizedOperations().length - 5}</div>
            </div>
          </button>
        </Show>

        {/* Collapse button */}
        <Show when={showMore() && hasMoreOperations()}>
          <button
            class="minimized-indicator minimized-indicator--collapse"
            style={`--index: ${getVisibleOperations().length};`}
            onClick={() => setShowMore(false)}
            aria-label={t('buttons.showLess')}
          >
            <div class="minimized-indicator__content">
              <div class="minimized-indicator__title">{t('buttons.collapse')}</div>
            </div>
          </button>
        </Show>
      </div>
    </Show>
  );
};

export default MinimizedOperationsTray;
