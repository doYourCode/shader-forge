import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
  type CSSProperties,
  type Ref,
} from 'vue';

import type {
  UserColor3Value,
  UserColor4Value,
} from '@/core/models/userUniform';
import {
  clampUnit,
  parseHexColor,
  rgbToHex,
  rgbaToHex,
  unitToByte,
} from '@/core/utils/color';
import { useIroColorPicker } from './useIroColorPicker';

/** iro is byte-based; treat sub-byte alpha drift as the same value. */
const ALPHA_EPSILON = 1e-3;
const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 6;
const PANEL_FALLBACK_WIDTH = 244;
const PANEL_FALLBACK_HEIGHT = 320;

/** Whether the hex field has a pending edit or is showing a rejected one. */
type HexStatus = 'synced' | 'editing' | 'invalid';

export interface ColorPickerElements {
  /** Trigger button; the panel anchors and restores focus to it. */
  readonly trigger: Ref<HTMLButtonElement | null>;
  /** Teleported panel element; positioned on open and on viewport changes. */
  readonly panel: Ref<HTMLElement | null>;
  /** Element the iro widget mounts into. */
  readonly pickerHost: Ref<HTMLDivElement | null>;
  /** Hex field; receives focus when the panel opens. */
  readonly hexInput: Ref<HTMLInputElement | null>;
}

export interface ColorPickerOptions extends ColorPickerElements {
  /** Canonical document colour; a getter keeps the prop the source of truth. */
  readonly color: () => UserColor3Value;
  /** Undefined for a plain colour value; a number makes this a color4 picker. */
  readonly alpha: () => number | undefined;
  /** Receives an accepted edit in the unit range. */
  readonly onChange: (value: UserColor3Value | UserColor4Value) => void;
}

export interface ColorPicker {
  readonly isOpen: Ref<boolean>;
  readonly hexDraft: Ref<string>;
  readonly hexInvalid: ComputedRef<boolean>;
  readonly hasAlpha: ComputedRef<boolean>;
  readonly alphaUnit: ComputedRef<number>;
  readonly triggerHex: ComputedRef<string>;
  readonly swatchStyle: ComputedRef<CSSProperties>;
  togglePicker(): void;
  closePicker(restoreFocus?: boolean): void;
  commitHex(): void;
  onHexInput(event: Event): void;
  onHexFocus(): void;
  onHexBlur(): void;
}

/**
 * Behaviour of the anchored colour picker: the hex draft, the iro widget, and
 * the popover's open/position/dismiss state. The component keeps the markup,
 * the labels and the trigger presentation.
 */
export function useColorPicker(options: ColorPickerOptions): ColorPicker {
  const {
    trigger: triggerRef,
    panel: panelRef,
    pickerHost,
    hexInput: hexInputRef,
  } = options;

  const isOpen = ref(false);
  const hexDraft = ref('');
  const hexFocused = ref(false);
  const hexStatus = ref<HexStatus>('synced');

  const hasAlpha = computed(() => options.alpha() !== undefined);
  const alphaUnit = computed(() => clampUnit(options.alpha() ?? 1));

  // The trigger stays compact with the RGB hex; the alpha is shown next to it
  // and the editable field carries the full #rrggbbaa form for color4.
  const triggerHex = computed(() => rgbToHex(options.color()));

  const currentHex = computed(() => {
    if (!hasAlpha.value) return triggerHex.value;

    const color = options.color();
    return rgbaToHex({
      r: color.r,
      g: color.g,
      b: color.b,
      a: alphaUnit.value,
    });
  });

  const hexInvalid = computed(() => hexStatus.value === 'invalid');

  const swatchStyle = computed(() => ({
    backgroundColor: `rgba(${unitToByte(options.color().r)}, ${unitToByte(
      options.color().g,
    )}, ${unitToByte(options.color().b)}, ${
      hasAlpha.value ? alphaUnit.value : 1
    })`,
  }));

  hexDraft.value = currentHex.value;

  function matchesCurrent(value: UserColor3Value | UserColor4Value): boolean {
    const color = options.color();
    const sameRgb =
      unitToByte(value.r) === unitToByte(color.r) &&
      unitToByte(value.g) === unitToByte(color.g) &&
      unitToByte(value.b) === unitToByte(color.b);

    if (!sameRgb || !hasAlpha.value) return sameRgb;
    if (!('a' in value)) return false;

    return Math.abs(clampUnit(value.a) - alphaUnit.value) <= ALPHA_EPSILON;
  }

  function formatHex(value: UserColor3Value | UserColor4Value): string {
    return 'a' in value ? rgbaToHex(value) : rgbToHex(value);
  }

  /** Applies a value produced by the picker or the hex field. */
  function accept(value: UserColor3Value | UserColor4Value): void {
    if (matchesCurrent(value)) return;

    hexDraft.value = formatHex(value);
    hexStatus.value = 'synced';
    options.onChange(value);
  }

  function resetHexDraft(): void {
    hexDraft.value = currentHex.value;
    hexStatus.value = 'synced';
  }

  /**
   * The panel is teleported to the body, so it cannot sit next to the trigger
   * in the layout. Place it from the trigger rect and keep it inside the
   * viewport.
   */
  function updatePosition(): void {
    const trigger = triggerRef.value;
    const panel = panelRef.value;
    if (!trigger || !panel || !isOpen.value) return;

    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth || PANEL_FALLBACK_WIDTH;
    const height = panel.offsetHeight || PANEL_FALLBACK_HEIGHT;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxLeft = Math.max(
      VIEWPORT_MARGIN,
      viewportWidth - width - VIEWPORT_MARGIN,
    );

    const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), maxLeft);
    let top = rect.bottom + PANEL_GAP;

    if (top + height > viewportHeight - VIEWPORT_MARGIN) {
      const above = rect.top - PANEL_GAP - height;
      top =
        above >= VIEWPORT_MARGIN
          ? above
          : Math.max(
              VIEWPORT_MARGIN,
              viewportHeight - height - VIEWPORT_MARGIN,
            );
    }

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  async function openPicker(): Promise<void> {
    if (isOpen.value) return;

    isOpen.value = true;
    await nextTick();

    iroPicker.ensure();
    iroPicker.sync();

    if (!hexFocused.value) resetHexDraft();

    updatePosition();

    // iro's own controls are pointer-only; land keyboard users on the hex field.
    hexInputRef.value?.focus({ preventScroll: true });
  }

  function closePicker(restoreFocus = false): void {
    if (!isOpen.value) return;

    isOpen.value = false;
    hexFocused.value = false;

    if (restoreFocus) {
      void nextTick(() => triggerRef.value?.focus());
    }
  }

  function togglePicker(): void {
    if (isOpen.value) {
      closePicker();
      return;
    }

    void openPicker();
  }

  function onHexInput(event: Event): void {
    hexDraft.value = (event.target as HTMLInputElement).value;
    hexStatus.value = 'editing';
  }

  function onHexFocus(): void {
    hexFocused.value = true;
  }

  function onHexBlur(): void {
    hexFocused.value = false;
    commitHex();
  }

  function commitHex(): void {
    if (hexStatus.value !== 'editing') return;

    const parsed = parseHexColor(hexDraft.value);
    if (!parsed || (!hasAlpha.value && 'a' in parsed)) {
      rejectHex();
      return;
    }

    const next: UserColor3Value | UserColor4Value = hasAlpha.value
      ? {
          r: parsed.r,
          g: parsed.g,
          b: parsed.b,
          a: 'a' in parsed ? parsed.a : alphaUnit.value,
        }
      : { r: parsed.r, g: parsed.g, b: parsed.b };

    hexDraft.value = formatHex(next);
    hexStatus.value = 'synced';

    accept(next);
  }

  function rejectHex(): void {
    hexStatus.value = 'invalid';
    hexDraft.value = currentHex.value;

    // The error line grows the panel; re-check the flip/clamp against it.
    void nextTick(updatePosition);
  }

  function onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !isOpen.value) return;

    event.preventDefault();
    closePicker(true);
  }

  function onDocumentPointerDown(event: PointerEvent): void {
    if (!isOpen.value) return;

    const target = event.target;
    if (
      target instanceof Node &&
      (panelRef.value?.contains(target) || triggerRef.value?.contains(target))
    ) {
      return;
    }

    // Clicking elsewhere already moves focus; do not pull it back to the trigger.
    closePicker();
  }

  function onViewportChange(): void {
    if (isOpen.value) updatePosition();
  }

  const iroPicker = useIroColorPicker({
    host: pickerHost,
    color: options.color,
    alpha: options.alpha,
    onChange: accept,
  });

  watch(
    () => {
      const color = options.color();
      return [color.r, color.g, color.b, options.alpha()] as const;
    },
    () => {
      iroPicker.sync();

      if (!hexFocused.value) resetHexDraft();
    },
  );

  onMounted(() => {
    document.addEventListener('keydown', onDocumentKeydown);
    document.addEventListener('pointerdown', onDocumentPointerDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onDocumentKeydown);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange, true);
  });

  return {
    isOpen,
    hexDraft,
    hexInvalid,
    hasAlpha,
    alphaUnit,
    triggerHex,
    swatchStyle,
    togglePicker,
    closePicker,
    commitHex,
    onHexInput,
    onHexFocus,
    onHexBlur,
  };
}
