import { computed, onBeforeUnmount, type Ref } from 'vue';
import iro from '@jaames/iro';

import type {
  UserColor3Value,
  UserColor4Value,
} from '@/core/models/userUniform';
import { byteToUnit, clampUnit, unitToByte } from '@/core/utils/color';

/** iro is byte-based; treat sub-byte alpha drift as the same value. */
const ALPHA_EPSILON = 1e-3;

type ColorPickerConstructor = new (
  host: HTMLElement,
  options: Parameters<typeof iro.ColorPicker>[1],
) => iro.ColorPicker;

// iro's declarations only describe the callable widget factory, while the
// runtime value is also a constructor. Keep the explicit `new` and give it the
// construct signature the implementation actually has.
const ColorPicker = iro.ColorPicker as unknown as ColorPickerConstructor;

export interface IroColorPickerOptions {
  /** Element the widget mounts into; owned by the view that renders it. */
  readonly host: Ref<HTMLDivElement | null>;
  /** Canonical document colour; a getter keeps the prop the source of truth. */
  readonly color: () => UserColor3Value;
  /** Undefined for a plain colour value; a number enables the alpha slider. */
  readonly alpha: () => number | undefined;
  /** Receives the picker's value in the unit range on every widget edit. */
  readonly onChange: (value: UserColor3Value | UserColor4Value) => void;
}

export interface IroColorPicker {
  /** Creates the widget on first open; later calls are a no-op. */
  ensure(): void;
  /** Pushes external prop edits into the widget without emitting a change. */
  sync(): void;
}

/**
 * Bridges iro's byte-based colour to the unit floats the document stores.
 *
 * It owns the widget instance and its cleanup; deduplicating edits and keeping
 * the hex draft in sync are the caller's concern.
 */
export function useIroColorPicker(
  options: IroColorPickerOptions,
): IroColorPicker {
  const hasAlpha = computed(() => options.alpha() !== undefined);
  const alphaUnit = computed(() => clampUnit(options.alpha() ?? 1));

  let picker: iro.ColorPicker | null = null;

  function onColorChange(color: iro.Color): void {
    const rgb: UserColor3Value = {
      r: byteToUnit(color.red),
      g: byteToUnit(color.green),
      b: byteToUnit(color.blue),
    };

    options.onChange(
      hasAlpha.value ? { ...rgb, a: clampUnit(color.alpha) } : rgb,
    );
  }

  function ensure(): void {
    const host = options.host.value;
    if (picker || !host) return;

    const r = unitToByte(options.color().r);
    const g = unitToByte(options.color().g);
    const b = unitToByte(options.color().b);

    const instance = new ColorPicker(host, {
      width: 220,
      color: hasAlpha.value ? { r, g, b, a: alphaUnit.value } : { r, g, b },
      layout: [
        { component: iro.ui.Wheel },
        { component: iro.ui.Slider, options: { sliderType: 'value' } },
        ...(hasAlpha.value
          ? [{ component: iro.ui.Slider, options: { sliderType: 'alpha' } }]
          : []),
      ],
      borderWidth: 0,
      margin: 10,
      handleRadius: 7,
    });

    instance.on('color:change', onColorChange);
    picker = instance;
  }

  function sync(): void {
    const instance = picker;
    if (!instance) return;

    const r = unitToByte(options.color().r);
    const g = unitToByte(options.color().g);
    const b = unitToByte(options.color().b);

    const sameRgb =
      instance.color.red === r &&
      instance.color.green === g &&
      instance.color.blue === b;
    const sameAlpha =
      !hasAlpha.value ||
      Math.abs(clampUnit(instance.color.alpha) - alphaUnit.value) <=
        ALPHA_EPSILON;

    if (sameRgb && sameAlpha) return;

    instance.color.set(
      hasAlpha.value ? { r, g, b, a: alphaUnit.value } : { r, g, b },
    );
  }

  onBeforeUnmount(() => {
    // iro v5 has no destroy(); unbinding and removing its root is the cleanup.
    picker?.off('color:change', onColorChange);
    picker?.base?.remove();
    picker = null;
  });

  return { ensure, sync };
}
