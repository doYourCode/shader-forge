# Baking environments

The app ships prefiltered Babylon `.env` environments. The source panoramas in
`src/assets/hdri/*.hdr` are kept as the reproducible input of the bake but are
not part of the production bundle: they are referenced only from
`src/tools/hdriSourceUrls.ts`, which is reachable from `bake.html` alone.
`src/tools/hdriSourceUrls.test.ts` keeps that list in sync with the catalog in
`src/core/constants/previewHdris.ts`.

## Rebaking

```bash
npm run bake:env
```

This opens `/bake.html` in a browser tab. Press **Bake all environments** and
save the downloaded files to `src/assets/hdri/env/`.

The tool runs the same pipeline the runtime used to run on every load (HDR
decode → panorama to cubemap → irradiance convolution → GGX prefilter →
RGBD/WebP encode), but only once, offline.
