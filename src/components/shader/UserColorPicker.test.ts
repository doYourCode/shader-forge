// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';

import { i18n } from '@/i18n';
import type {
  UserColor3Value,
  UserColor4Value,
} from '@/core/models/userUniform';
import UserColorPicker from './UserColorPicker.vue';

interface PickerColorState {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface PickerLayoutEntry {
  component: unknown;
  options?: { sliderType?: string };
}

interface PickerOptions {
  width?: number;
  color?: { r: number; g: number; b: number; a?: number };
  layout?: PickerLayoutEntry[];
  borderWidth?: number;
  margin?: number;
  handleRadius?: number;
}

type ColorChangeHandler = (color: FakeIroColor) => void;

interface FakeIroColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  set(value: {
    r?: number;
    g?: number;
    b?: number;
    a?: number;
  }): void;
  readonly _state: PickerColorState;
}

interface FakeIroPicker {
  base: HTMLElement;
  color: FakeIroColor;
  options: PickerOptions;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

const iroMock = vi.hoisted(() => {
  const instances: FakeIroPicker[] = [];
  const Wheel = 'iro-wheel';
  const Slider = 'iro-slider';

  const ColorPicker = vi.fn(
    function (
      this: unknown,
      host: HTMLElement,
      options: PickerOptions,
    ): FakeIroPicker {
      const listeners = new Set<ColorChangeHandler>();
      const state: PickerColorState = {
        r: options.color?.r ?? 0,
        g: options.color?.g ?? 0,
        b: options.color?.b ?? 0,
        a: options.color?.a ?? 1,
      };

      const color: FakeIroColor = {
        get red() {
          return Math.round(state.r);
        },
        get green() {
          return Math.round(state.g);
        },
        get blue() {
          return Math.round(state.b);
        },
        get alpha() {
          return state.a;
        },
        _state: state,
        set(value) {
          if (typeof value.r === 'number') state.r = value.r;
          if (typeof value.g === 'number') state.g = value.g;
          if (typeof value.b === 'number') state.b = value.b;
          if (typeof value.a === 'number') state.a = value.a;

          for (const listener of listeners) listener(color);
        },
      };

      const picker: FakeIroPicker = {
        base: document.createElement('div'),
        color,
        options,
        on: vi.fn((event: string, callback: ColorChangeHandler) => {
          if (event === 'color:change') listeners.add(callback);
        }),
        off: vi.fn((event: string, callback: ColorChangeHandler) => {
          if (event === 'color:change') listeners.delete(callback);
        }),
      };

      host.appendChild(picker.base);
      instances.push(picker);
      return picker;
    },
  );

  return { ColorPicker, instances, Wheel, Slider };
});

vi.mock('@jaames/iro', () => ({
  default: {
    ColorPicker: iroMock.ColorPicker,
    ui: { Wheel: iroMock.Wheel, Slider: iroMock.Slider },
  },
}));

const mounted = new Set<VueWrapper>();

function mountPicker(props: {
  color: UserColor3Value;
  alpha?: number;
  label?: string;
}): VueWrapper {
  const wrapper = mount(UserColorPicker, {
    props,
    attachTo: document.body,
    global: { plugins: [i18n] },
  });

  mounted.add(wrapper);
  return wrapper;
}

function unmount(wrapper: VueWrapper): void {
  wrapper.unmount();
  mounted.delete(wrapper);
}

function trigger(wrapper: VueWrapper): HTMLButtonElement {
  return wrapper.find('.user-color-picker__trigger')
    .element as HTMLButtonElement;
}

async function open(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('.user-color-picker__trigger').trigger('click');
  await flushPromises();
}

function panel(): HTMLElement {
  const element = document.body.querySelector<HTMLElement>(
    '.user-color-picker__panel',
  );
  if (!element) throw new Error('color picker panel not rendered');

  return element;
}

function hexInput(): HTMLInputElement {
  const element = panel().querySelector<HTMLInputElement>(
    '.user-color-picker__hex-input',
  );
  if (!element) throw new Error('hex input not rendered');

  return element;
}

async function typeHex(value: string): Promise<void> {
  const input = hexInput();
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
  await nextTick();
}

function firstValue<T>(wrapper: VueWrapper): T {
  const events = wrapper.emitted('change');
  if (!events || events.length === 0) throw new Error('no change emitted');

  return events[0]![0] as T;
}

describe('UserColorPicker', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
    iroMock.instances.length = 0;
    iroMock.ColorPicker.mockClear();
  });

  afterEach(() => {
    for (const wrapper of mounted) wrapper.unmount();
    mounted.clear();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('does not construct the picker until the trigger is opened', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    expect(iroMock.ColorPicker).not.toHaveBeenCalled();

    await open(wrapper);

    expect(iroMock.ColorPicker).toHaveBeenCalledTimes(1);
    expect(iroMock.instances).toHaveLength(1);
  });

  it('shows the RGB hex and a muted alpha in the trigger', () => {
    const wrapper = mountPicker({
      color: { r: 1, g: 0, b: 0 },
      alpha: 0.5,
    });

    expect(wrapper.find('.user-color-picker__hex').text()).toBe('#ff0000');
    expect(wrapper.find('.user-color-picker__alpha-value').text()).toBe(
      'a 0.50',
    );
  });

  it('hides the alpha value for a plain color trigger', () => {
    const wrapper = mountPicker({ color: { r: 1, g: 0, b: 0 } });

    expect(wrapper.find('.user-color-picker__hex').text()).toBe('#ff0000');
    expect(wrapper.find('.user-color-picker__alpha-value').exists()).toBe(
      false,
    );
  });

  it('focuses the hex field when the panel opens', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });

    await open(wrapper);

    expect(document.activeElement).toBe(hexInput());
  });

  it('clamps the panel into the viewport and flips above the trigger', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(400);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);

    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    const button = trigger(wrapper);
    const rectAt = (top: number): DOMRect => ({
      x: 300,
      y: top,
      width: 80,
      height: 24,
      top,
      right: 380,
      bottom: top + 24,
      left: 300,
      toJSON: () => ({}),
    });

    button.getBoundingClientRect = () => rectAt(400);
    await open(wrapper);

    const element = panel();
    expect(element.style.left).toBe('148px');
    expect(element.style.top).toBe('74px');

    // A captured scroll re-anchors the fixed panel to the moved trigger.
    button.getBoundingClientRect = () => rectAt(300);
    window.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(element.style.top).toBe('272px');
  });

  it('constructs an RGB picker with the wheel and value slider', async () => {
    const wrapper = mountPicker({
      color: { r: 1, g: 0.5, b: 0 },
      label: 'tint',
    });
    await open(wrapper);

    const options = iroMock.ColorPicker.mock.calls[0]![1];

    expect(options.color).toEqual({ r: 255, g: 128, b: 0 });
    expect(options.layout?.map((entry) => entry.component)).toEqual([
      iroMock.Wheel,
      iroMock.Slider,
    ]);
    expect(options.layout?.[1]?.options).toEqual({ sliderType: 'value' });
    expect(options.width).toBe(220);
    expect(options.borderWidth).toBe(0);
    expect(options.margin).toBe(10);
    expect(options.handleRadius).toBe(7);
  });

  it('adds an alpha slider and the alpha value for color4', async () => {
    const wrapper = mountPicker({
      color: { r: 0, g: 0, b: 0 },
      alpha: 0.5,
      label: 'tint',
    });
    await open(wrapper);

    const options = iroMock.ColorPicker.mock.calls[0]![1];

    expect(options.color).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(options.layout?.map((entry) => entry.component)).toEqual([
      iroMock.Wheel,
      iroMock.Slider,
      iroMock.Slider,
    ]);
    expect(options.layout?.[2]?.options).toEqual({ sliderType: 'alpha' });
  });

  it('emits unit floats without alpha for a color change', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    iroMock.instances[0]!.color.set({ r: 255, g: 0, b: 0 });
    await nextTick();

    const value = firstValue<UserColor3Value>(wrapper);
    expect(value).toEqual({ r: 1, g: 0, b: 0 });
    expect('a' in value).toBe(false);
  });

  it('includes alpha for a color4 change', async () => {
    const wrapper = mountPicker({
      color: { r: 1, g: 1, b: 1 },
      alpha: 1,
    });
    await open(wrapper);

    iroMock.instances[0]!.color.set({ r: 0, g: 255, b: 0, a: 0.4 });
    await nextTick();

    const value = firstValue<UserColor4Value>(wrapper);
    expect(value.r).toBe(0);
    expect(value.g).toBe(1);
    expect(value.b).toBe(0);
    expect(value.a).toBeCloseTo(0.4, 5);
  });

  it('keeps RGB when only alpha changes', async () => {
    const wrapper = mountPicker({
      color: { r: 0.2, g: 0.4, b: 0.6 },
      alpha: 1,
    });
    await open(wrapper);

    iroMock.instances[0]!.color.set({ a: 0.25 });
    await nextTick();

    const value = firstValue<UserColor4Value>(wrapper);
    expect(Math.round(value.r * 255)).toBe(51);
    expect(Math.round(value.g * 255)).toBe(102);
    expect(Math.round(value.b * 255)).toBe(153);
    expect(value.a).toBeCloseTo(0.25, 5);
  });

  it('syncs external prop changes into iro without emitting', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    const picker = iroMock.instances[0]!;
    const setSpy = vi.spyOn(picker.color, 'set');

    await wrapper.setProps({ color: { r: 0, g: 1, b: 0 } });

    expect(setSpy).toHaveBeenCalledWith({ r: 0, g: 255, b: 0 });
    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('does not emit on construction, open or initial sync', async () => {
    const wrapper = mountPicker({ color: { r: 0, g: 0, b: 0 } });
    await open(wrapper);
    await nextTick();

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('commits a valid hex value', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    await typeHex('#ff0000');

    expect(firstValue<UserColor3Value>(wrapper)).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexInput().getAttribute('aria-invalid')).toBeNull();
  });

  it('accepts shorthand hex without a leading hash', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    await typeHex('0f0');

    expect(firstValue<UserColor3Value>(wrapper)).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('keeps the current alpha for a six-digit color4 hex', async () => {
    const wrapper = mountPicker({
      color: { r: 0, g: 0, b: 0 },
      alpha: 0.5,
    });
    await open(wrapper);

    await typeHex('#00ff00');

    expect(firstValue<UserColor4Value>(wrapper)).toEqual({
      r: 0,
      g: 1,
      b: 0,
      a: 0.5,
    });
  });

  it('accepts an eight-digit color4 hex and its alpha', async () => {
    const wrapper = mountPicker({
      color: { r: 0, g: 0, b: 0 },
      alpha: 1,
    });
    await open(wrapper);

    await typeHex('0000ff80');

    const value = firstValue<UserColor4Value>(wrapper);
    expect(value.r).toBe(0);
    expect(value.g).toBe(0);
    expect(value.b).toBe(1);
    expect(value.a).toBeCloseTo(128 / 255, 10);
  });

  it('restores the last valid value and reports an invalid hex', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    await typeHex('#zzzzzz');

    expect(wrapper.emitted('change')).toBeUndefined();
    expect(hexInput().value).toBe('#ffffff');
    expect(hexInput().getAttribute('aria-invalid')).toBe('true');
    expect(panel().querySelector('.user-color-picker__error')?.textContent).toContain(
      'valid hex color',
    );
  });

  it('rejects alpha digits for a plain color', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    await typeHex('#ff0000ff');

    expect(wrapper.emitted('change')).toBeUndefined();
    expect(hexInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    const button = trigger(wrapper);
    button.focus();
    hexInput().focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await nextTick();
    await flushPromises();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panel().style.display).toBe('none');
    expect(document.activeElement).toBe(button);
  });

  it('closes from the trigger without moving focus back', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    await wrapper.find('.user-color-picker__trigger').trigger('click');
    await nextTick();

    expect(
      wrapper.find('.user-color-picker__trigger').attributes('aria-expanded'),
    ).toBe('false');
    expect(panel().style.display).toBe('none');
  });

  it('closes on an outside pointerdown without stealing focus', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    const button = trigger(wrapper);
    button.focus();
    hexInput().focus();

    document.body.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true }),
    );
    await nextTick();
    await flushPromises();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).not.toBe(button);
  });

  it('closes with the close button and returns focus', async () => {
    const wrapper = mountPicker({ color: { r: 1, g: 1, b: 1 } });
    await open(wrapper);

    const button = trigger(wrapper);
    button.focus();
    hexInput().focus();

    const close = panel().querySelector<HTMLButtonElement>(
      '.user-color-picker__close',
    );
    close?.click();
    await nextTick();
    await flushPromises();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('exposes translated trigger and dialog labels', async () => {
    const wrapper = mountPicker({
      color: { r: 1, g: 1, b: 1 },
      label: 'tint',
    });
    const button = wrapper.find('.user-color-picker__trigger');

    expect(button.attributes('aria-haspopup')).toBe('dialog');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.attributes('aria-label')).toBe('Open color picker for tint');

    await open(wrapper);

    expect(button.attributes('aria-expanded')).toBe('true');
    expect(button.attributes('aria-controls')).toBe(panel().id);

    const dialog = panel();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(
      'Color picker for tint',
    );
    expect(
      dialog
        .querySelector('.user-color-picker__close')
        ?.getAttribute('aria-label'),
    ).toBe('Close color picker');
    expect(
      hexInput().closest('label')?.textContent,
    ).toContain('Hex value');
  });

  it('translates the labels into pt-BR', async () => {
    i18n.global.locale.value = 'pt-BR';

    const wrapper = mountPicker({
      color: { r: 1, g: 1, b: 1 },
      label: 'tint',
    });
    const button = wrapper.find('.user-color-picker__trigger');

    expect(button.attributes('aria-label')).toBe(
      'Abrir seletor de cor para tint',
    );

    await open(wrapper);

    expect(panel().getAttribute('aria-label')).toBe(
      'Seletor de cor para tint',
    );
  });

  it('unbinds iro, removes its root and drops document listeners', async () => {
    const wrapper = mountPicker({ color: { r: 0, g: 0, b: 0 } });
    await open(wrapper);

    const picker = iroMock.instances[0]!;
    expect(picker.base.parentNode).not.toBeNull();

    const removeSpy = vi.spyOn(picker.base, 'remove');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');

    unmount(wrapper);

    expect(picker.off).toHaveBeenCalledWith(
      'color:change',
      expect.any(Function),
    );
    expect(removeSpy).toHaveBeenCalled();
    expect(picker.base.parentNode).toBeNull();
    expect(documentRemove).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    );
    expect(documentRemove).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
    );
    expect(windowRemove).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
    expect(windowRemove).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      true,
    );
  });
});
