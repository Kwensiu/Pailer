import { Show, JSX, onMount, onCleanup, createEffect, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';

const OPEN_MODAL_IDS = new Set<string>();
let modalIdCounter = 0;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = () => {
  if (OPEN_MODAL_IDS.size === 0) {
    document.body.style.overflow = '';
  }
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | JSX.Element;
  size?: 'small' | 'medium' | 'large' | 'full';
  showCloseButton?: boolean;
  children: JSX.Element;
  footer?: JSX.Element;
  headerAction?: JSX.Element;
  class?: string;
  preventBackdropClose?: boolean;
  zIndex?: string;

  editButton?: boolean;
  initialContent?: string;
  animation: 'none' | 'scale';
  animationDuration?: number;
  isMinimizing?: boolean;
}

export default function Modal(props: ModalProps) {
  const modalId = `modal-${++modalIdCounter}`;
  let previouslyFocusedElement: HTMLElement | null = null;
  let isRegistered = false;

  const getSizeClass = () => {
    switch (props.size) {
      case 'small':
        return 'max-w-md';
      case 'medium':
        return 'max-w-2xl';
      case 'large':
        return 'max-w-7xl';
      case 'full':
        return 'w-11/12 max-w-7xl';
      default:
        return 'max-w-2xl';
    }
  };

  // Animation state management
  const [isVisible, setIsVisible] = createSignal(false);
  const [isClosing, setIsClosing] = createSignal(false);
  const [rendered, setRendered] = createSignal(false);
  const [modalBoxRef, setModalBoxRef] = createSignal<HTMLDivElement>();
  const animationDuration = () => props.animationDuration || 300;
  const [isTopmost, setIsTopmost] = createSignal(false);

  const registerOpenModal = () => {
    if (isRegistered) return;
    isRegistered = true;
    OPEN_MODAL_IDS.add(modalId);
    lockBodyScroll();
    // Dispatch a global event to notify other modals to update their topmost status
    window.dispatchEvent(new CustomEvent('modal-stack-change'));
  };

  const unregisterOpenModal = () => {
    if (!isRegistered) return;
    isRegistered = false;
    OPEN_MODAL_IDS.delete(modalId);
    unlockBodyScroll();
    // Dispatch a global event to notify other modals to update their topmost status.
    // Use requestAnimationFrame to ensure we don't trigger state changes for sibling modals
    // while the current event is still being processed.
    // Check isRegistered again in case the modal was re-registered during the frame.
    requestAnimationFrame(() => {
      if (!isRegistered) {
        window.dispatchEvent(
          new CustomEvent('modal-stack-change', { detail: { removedId: modalId } })
        );
      }
    });
  };

  const updateTopmostStatus = () => {
    const openIds = Array.from(OPEN_MODAL_IDS);
    setIsTopmost(openIds[openIds.length - 1] === modalId);
  };

  // Listen to modal stack changes
  onMount(() => {
    window.addEventListener('modal-stack-change', updateTopmostStatus);
    onCleanup(() => window.removeEventListener('modal-stack-change', updateTopmostStatus));
  });

  const getFocusableElements = () => {
    const box = modalBoxRef();
    if (!box) return [] as HTMLElement[];
    return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) =>
        !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
    );
  };

  const focusInitialElement = () => {
    const box = modalBoxRef();
    if (!box) return;
    const [firstFocusable] = getFocusableElements();
    (firstFocusable ?? box).focus();
  };

  const restorePreviousFocus = () => {
    if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
      previouslyFocusedElement.focus?.();
    }
    previouslyFocusedElement = null;
  };

  // TODO: Promote modal open/close handling to a shared modal stack/focus manager so
  // scroll locking, ESC behavior, and focus restoration are coordinated in one place.

  // Animation effects
  createEffect(() => {
    if (props.isOpen) {
      if (!rendered()) {
        previouslyFocusedElement = document.activeElement as HTMLElement | null;
        registerOpenModal();
      }
      setRendered(true);
      setIsVisible(false);
      setIsClosing(false);
      // Use requestAnimationFrame to ensure DOM is updated before starting animation
      requestAnimationFrame(() => {
        setIsVisible(true);
        focusInitialElement();
      });
    } else if (rendered()) {
      // Trigger close animation when isOpen becomes false externally
      setIsVisible(false);
      setIsClosing(true);
      // Ensure we unregister immediately when the modal is closed,
      // even if the component stays mounted.
      unregisterOpenModal();
    }
  });

  createEffect(() => {
    if (isClosing()) {
      const timer = setTimeout(() => {
        setRendered(false);
        setIsClosing(false);
      }, animationDuration());
      return () => clearTimeout(timer);
    }
  });

  const handleClose = () => {
    if (isClosing()) return;
    setIsClosing(true);
    setIsVisible(false);
    // Ensure we unregister immediately when the modal is closed internally.
    unregisterOpenModal();
    // Delay closing props to complete animation
    setTimeout(() => {
      props.onClose();
    }, animationDuration());
  };

  // Handle ESC key to close modal
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen || !isTopmost()) {
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusableElements = getFocusableElements();
      const box = modalBoxRef();
      if (!box) return;

      if (focusableElements.length === 0) {
        e.preventDefault();
        box.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!activeElement || activeElement === firstElement || !box.contains(activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (!activeElement || activeElement === lastElement || !box.contains(activeElement)) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  onMount(() => {
    // Use capture phase to ensure we can stop propagation before bubbling listeners.
    // For nested modals on the same document element, registration order still matters,
    // but stopImmediatePropagation will work correctly.
    document.addEventListener('keydown', handleKeyDown, { capture: true });
  });

  onCleanup(() => {
    unregisterOpenModal();
    restorePreviousFocus();
    document.removeEventListener('keydown', handleKeyDown, { capture: true });
  });

  // Handle data-modal-close clicks
  createEffect(() => {
    const box = modalBoxRef();
    if (box) {
      const handleClick = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-modal-close]')) {
          e.preventDefault();
          handleClose();
        }
      };
      box.addEventListener('click', handleClick);
      onCleanup(() => box.removeEventListener('click', handleClick));
    }
  });

  const handleBackdropClick = () => {
    if (!props.preventBackdropClose) {
      handleClose();
    }
  };

  // Get animation classes
  const getAnimationClasses = () => {
    if (props.isMinimizing) {
      return {
        modalBox: 'transition-all duration-300 ease-in-out opacity-0',
        backdrop: 'transition-all duration-300 ease-in-out !opacity-0',
      };
    }
    if (props.animation === 'scale') {
      return {
        modalBox: `transition-all duration-300 ease-in-out ${
          !isVisible() || isClosing() ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`,
        backdrop: `transition-all duration-300 ease-in-out !bg-black/30 ${
          !isVisible() || isClosing() ? '!opacity-0' : '!opacity-100'
        } ${isClosing() ? 'pointer-events-none' : ''}`,
      };
    }
    return { modalBox: '', backdrop: '' };
  };

  return (
    <Portal>
      <Show when={rendered()}>
        <div
          class={`modal modal-open ${props.zIndex || 'z-50'} ${isClosing() ? 'pointer-events-none' : ''}`}
          role="dialog"
          aria-modal="true"
        >
          <div
            class={`modal-box bg-base-100 border-base-200 flex max-h-[90vh] flex-col overflow-hidden border p-0 shadow-2xl ${getSizeClass()} ${props.class ?? ''} ${getAnimationClasses().modalBox}`}
            ref={setModalBoxRef}
            tabindex="-1"
          >
            {/* Header */}
            <div class="border-base-300 bg-base-175 flex items-center justify-between border-b px-4 py-3">
              <div class="text-lg font-bold">{props.title}</div>
              <div class="flex items-center gap-2">
                <Show when={props.headerAction}>{props.headerAction}</Show>
                <Show when={props.showCloseButton !== false}>
                  <button
                    class="btn btn-sm btn-circle btn-ghost"
                    onClick={handleClose}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </Show>
              </div>
            </div>

            {/* Content */}
            <div class="bg-base-100 flex-1 overflow-y-auto p-6">{props.children}</div>

            {/* Footer */}
            <Show when={props.footer}>
              <div class="modal-action border-base-300 bg-base-175 mt-0 shrink-0 border-t p-4">
                {props.footer}
              </div>
            </Show>
          </div>
          <div
            class={`modal-backdrop backdrop-blur-xs ${getAnimationClasses().backdrop}`}
            onClick={handleBackdropClick}
          ></div>
        </div>
      </Show>
    </Portal>
  );
}
