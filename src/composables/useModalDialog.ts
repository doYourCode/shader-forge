/**
 * Shared modal state for the picker dialogs: scroll lock, `inert` background
 * and focus restoration. Keeping it in one place means both pickers cannot
 * disagree about what closing a dialog restores.
 */
export interface ModalDialog {
  /** Marks the background inert and locks body scrolling. Idempotent. */
  enter(): void;
  /**
   * Releases the background. `fallback` wins over the element that was focused
   * when the dialog opened, which is what a trigger wants.
   */
  leave(restoreFocus: boolean, fallback?: HTMLElement | null): void;
}

export function useModalDialog(): ModalDialog {
  let previouslyFocused: HTMLElement | null = null;
  let previousBodyOverflow = '';
  let active = false;

  return {
    enter(): void {
      if (active) return;
      active = true;

      previouslyFocused =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.getElementById('app')?.setAttribute('inert', '');
    },

    leave(restoreFocus: boolean, fallback: HTMLElement | null = null): void {
      if (!active) return;
      active = false;

      document.body.style.overflow = previousBodyOverflow;
      document.getElementById('app')?.removeAttribute('inert');

      if (restoreFocus) {
        (fallback ?? previouslyFocused)?.focus({ preventScroll: true });
      }

      previouslyFocused = null;
    },
  };
}
