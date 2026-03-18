/**
 * ScrollManager - Intelligent scroll management component
 *
 * Implements complete scroll functionality for scrollable containers:
 * - Auto-scroll: Automatically scroll to bottom when new content appears (when user is within 50px of bottom)
 * - User control: Stop auto-follow when user manually scrolls up
 * - Position saving: Save scroll position and bottom state when minimizing (optional)
 * - Smart restore: Direct restore for bottom position, smooth scroll from top to saved position for non-bottom (optional)
 */

import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { useOperations } from '../../stores/operations';

// Constants
const BOTTOM_THRESHOLD = 50;
const RESTORE_DELAY = 100;
const ANIMATION_DURATION = 500;
const CONTENT_SELECTOR = '.overflow-y-auto.p-6';

interface ScrollManagerProps {
  scrollRef: HTMLDivElement | undefined;
  operationId?: string;
  shouldAutoScroll?: () => boolean;
  setShouldAutoScroll?: (value: boolean) => void;
  enablePositionSaving?: boolean;
  contentLength?: number;
  threshold?: number;
}

export function useScrollManager(props: ScrollManagerProps) {
  const { updateOperation, operations } = useOperations();

  // Track previous minimized state (only for operation modals)
  const [previousMinimized, setPreviousMinimized] = createSignal<boolean>(false);
  const [isRestoring, setIsRestoring] = createSignal<boolean>(false);

  // Auto-scroll state
  const [shouldAutoScroll, setShouldAutoScroll] = createSignal(true);

  // Handle scroll events to detect user scrolling
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;

    // For operation modals, use content selector; for simple usage, use direct ref
    const isOperationModal = props.operationId !== undefined;
    const scrollTarget = isOperationModal
      ? target.matches(CONTENT_SELECTOR)
        ? target
        : null
      : target === props.scrollRef
        ? target
        : null;

    if (!scrollTarget) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollTarget;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = props.threshold || BOTTOM_THRESHOLD;

    // If user is more than threshold from bottom, stop auto-scrolling
    setShouldAutoScroll(distanceFromBottom <= threshold);

    // Call external setShouldAutoScroll if provided
    if (props.setShouldAutoScroll) {
      props.setShouldAutoScroll(distanceFromBottom <= threshold);
    }
  };

  // DOM query function (only for operation modals)
  const getModalContent = (): HTMLElement | null => {
    if (!props.operationId) return null;

    let modalContent = props.scrollRef?.closest(CONTENT_SELECTOR);

    if (!modalContent) {
      const operationModal = document.querySelector(
        `[data-operation-modal="${props.operationId}"]`
      );
      if (operationModal) {
        modalContent = operationModal.querySelector(CONTENT_SELECTOR);
      }
    }

    if (!modalContent) {
      modalContent = document.querySelector('.modal-box > .overflow-y-auto.p-6');
    }

    return modalContent as HTMLElement | null;
  };

  const saveScrollPosition = () => {
    if (!props.operationId || !props.enablePositionSaving) return;

    const modalContent = getModalContent();

    if (modalContent) {
      const savedPosition = modalContent.scrollTop;
      const scrollHeight = modalContent.scrollHeight;
      const clientHeight = modalContent.clientHeight;
      const distanceFromBottom = scrollHeight - savedPosition - clientHeight;
      const isAtBottom = distanceFromBottom <= BOTTOM_THRESHOLD;

      console.log('ScrollManager: Saving position', {
        savedPosition,
        scrollHeight,
        clientHeight,
        distanceFromBottom,
        isAtBottom,
        container: modalContent.className,
      });

      updateOperation(props.operationId, {
        scrollPosition: savedPosition,
        wasAtBottom: isAtBottom,
      });
    } else {
      console.log('ScrollManager: Could not find modal container for saving');
    }
  };

  // Restore scroll position with animation
  const restoreScrollPosition = () => {
    if (!props.operationId || !props.enablePositionSaving) return;

    const currentOperation = operations()[props.operationId];

    if (!currentOperation) return;

    const savedPos = currentOperation.scrollPosition || 0;
    const wasAtBottom = currentOperation.wasAtBottom || false;

    console.log('ScrollManager: Restoring position', { savedPos, wasAtBottom });

    // Set restoration flag to block auto-scroll
    setIsRestoring(true);

    const modalContent = getModalContent();
    if (modalContent) {
      if (wasAtBottom) {
        // For bottom position, set to bottom immediately
        modalContent.scrollTop = modalContent.scrollHeight;
        if (props.setShouldAutoScroll) {
          props.setShouldAutoScroll(true);
        }
        setIsRestoring(false);
      } else {
        // For non-bottom, set to top first, then animate to saved position
        modalContent.scrollTop = 0; // Start from top
        if (props.setShouldAutoScroll) {
          props.setShouldAutoScroll(false);
        }

        // Animate to saved position after a short delay
        requestAnimationFrame(() => {
          modalContent.style.scrollBehavior = 'smooth';
          modalContent.scrollTo({
            top: savedPos,
          });

          // Clean up after animation
          setTimeout(() => {
            setIsRestoring(false);
            modalContent.style.scrollBehavior = '';
          }, ANIMATION_DURATION);
        });
      }
    }
  };

  // Setup scroll listener and restoration logic
  onMount(() => {
    // For operation modals, use document-level scroll listener
    // For simple components, use direct scroll listener on the element
    if (props.operationId) {
      document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
      onCleanup(() => {
        document.removeEventListener('scroll', handleScroll, { capture: true });
      });
    } else {
      // For simple components, set up listener when scrollRef changes
      createEffect(() => {
        const ref = props.scrollRef;
        if (ref) {
          ref.addEventListener('scroll', handleScroll, { passive: true });
          onCleanup(() => {
            ref.removeEventListener('scroll', handleScroll);
          });
        }
      });
    }

    // Setup restoration logic (only for operation modals with position saving)
    createEffect(() => {
      if (!props.operationId || !props.enablePositionSaving) return;

      const currentOperation = operations()[props.operationId];
      if (!currentOperation) return;

      const isMinimized = currentOperation.isMinimized;
      const wasMinimized = previousMinimized();

      // Only restore scroll position when transitioning from minimized to not minimized
      if (wasMinimized && !isMinimized) {
        // Delay restoration to ensure DOM is fully rendered
        setTimeout(() => {
          restoreScrollPosition();
        }, RESTORE_DELAY);
      }

      setPreviousMinimized(isMinimized);
    });

    // Setup auto-scroll
    createEffect(() => {
      // For simple usage, use contentLength; for operation modals, use output length
      const contentLength =
        props.contentLength !== undefined
          ? props.contentLength
          : (() => {
              const currentOperation = props.operationId ? operations()[props.operationId] : null;
              return currentOperation?.output?.length || 0;
            })();

      // Skip auto-scroll during restoration or when disabled
      if (isRestoring() || !shouldAutoScroll() || contentLength === 0) {
        return;
      }

      requestAnimationFrame(() => {
        const scrollTarget = props.operationId ? getModalContent() : props.scrollRef;
        if (scrollTarget) {
          scrollTarget.scrollTop = scrollTarget.scrollHeight;
        }
      });
    });
  });

  return {
    saveScrollPosition,
    restoreScrollPosition,
    isRestoring,
  };
}
