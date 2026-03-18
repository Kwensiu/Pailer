/**
 * ScrollManager - Intelligent scroll management component
 *
 * Implements complete scroll functionality for OperationModal:
 * - Auto-scroll: Automatically scroll to bottom when new output appears (when user is within 50px of bottom)
 * - User control: Stop auto-follow when user manually scrolls up
 * - Position saving: Save scroll position and bottom state when minimizing
 * - Smart restore: Direct restore for bottom position, smooth scroll from top to saved position for non-bottom
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
  operationId: string;
  shouldAutoScroll?: () => boolean;
  setShouldAutoScroll?: (value: boolean) => void;
}

export function useScrollManager(props: ScrollManagerProps) {
  const { updateOperation, operations } = useOperations();

  // Track previous minimized state
  const [previousMinimized, setPreviousMinimized] = createSignal<boolean>(false);
  const [isRestoring, setIsRestoring] = createSignal<boolean>(false);

  // Handle scroll events to detect user scrolling
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;

    // Only handle scroll events from the Modal Content area
    if (!target.matches(CONTENT_SELECTOR)) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // If user is more than threshold from bottom, stop auto-scrolling
    if (props.setShouldAutoScroll) {
      props.setShouldAutoScroll(distanceFromBottom <= BOTTOM_THRESHOLD);
    }
  };

  // DOM query function
  const getModalContent = (): HTMLElement | null => {
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
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    onCleanup(() => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    });

    // Setup restoration logic
    createEffect(() => {
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
      const currentOperation = operations()[props.operationId];
      const outputLength = currentOperation?.output?.length || 0;

      // Skip auto-scroll during restoration
      if (isRestoring() || !props.shouldAutoScroll?.() || outputLength === 0) {
        return;
      }

      requestAnimationFrame(() => {
        const modalContent = getModalContent();
        if (modalContent) {
          modalContent.scrollTop = modalContent.scrollHeight;
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
