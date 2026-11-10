import type { InjectionKey } from 'vue';

import type { TexturePickerPort } from '@/services/texturepicker/TexturePicker';

/** Injection key for the texture picker port supplied by the editor view. */
export const TEXTURE_PICKER: InjectionKey<TexturePickerPort> =
  Symbol('shaderforge.texture-picker');
