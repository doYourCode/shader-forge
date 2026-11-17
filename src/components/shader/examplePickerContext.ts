import type { InjectionKey } from 'vue';

import type { ExamplePickerPort } from '@/services/examplepicker/ExamplePicker';

/** Injection key for the example picker provided by the editor view. */
export const EXAMPLE_PICKER: InjectionKey<ExamplePickerPort> = Symbol(
  'shaderforge.examplePicker',
);
