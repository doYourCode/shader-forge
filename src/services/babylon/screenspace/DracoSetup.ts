import { DracoCompression } from '@babylonjs/core';

let configured = false;

/**
 * Points Babylon's glTF Draco decoder at the files bundled in `public/draco`.
 *
 * The Bistro scene requires `KHR_draco_mesh_compression`; the default decoder
 * URL is a CDN, which would make the editor fail offline and would leak a
 * network dependency into a self-contained preview.
 */
export function ensureDracoDecoder(): void {
  if (configured) return;
  configured = true;

  const base = import.meta.env.BASE_URL;
  DracoCompression.Configuration = {
    decoder: {
      wasmUrl: `${base}draco/draco_wasm_wrapper_gltf.js`,
      wasmBinaryUrl: `${base}draco/draco_decoder_gltf.wasm`,
      fallbackUrl: `${base}draco/draco_decoder_gltf.js`,
    },
  };
}
