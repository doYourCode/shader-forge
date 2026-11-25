# View-space post effects

The editor can run a stack of user-authored fragment shaders over the rendered
image. Effects are edited on the **Post effect** tab, one document per stack
entry, and compiled as a chain of Babylon `PostProcess` passes.

## Using it

1. Open **Post effect** and pick an entry in the stack (or **Add effect**).
2. Write the fragment source. The default source documents the inputs.
3. **Compile** builds every enabled effect plus the internal passes; a failed
   compile keeps the last working stack on screen.
4. Reorder, enable/disable or delete entries in the stack panel. Each change
   rebuilds the chain.
5. Pick an output transform (none, Reinhard, ACES) at the bottom of the panel.

## Shader contract

Effects are **fragment-only** and written in **GLSL ES 3.00**. Babylon supplies
a fullscreen vertex stage; the fragment receives `vUV` and must write
`layout(location = 0) out vec4 fragColor`.

| Input | Meaning |
| --- | --- |
| `textureSampler` | Output of the previous pass (linear colour). |
| `gbufferTexture.rgb` | View-space normal, encoded as `n * 0.5 + 0.5`. |
| `gbufferTexture.a` | Reserved (`1` on geometry, `0` on the cleared background). |
| `depthTexture.r` | Linear view depth normalised to the clip range: `0` = near, `1` = far/background. World units: `cameraNear + r * (cameraFar - cameraNear)`. |
| `resolution`, `texelSize` | Render size in pixels and its reciprocal. |
| `time` | Seconds since the preview started. |
| `cameraNear`, `cameraFar` | Camera clip planes. |
| `cameraPosition` | Camera position in world space. |
| `projection`, `inverseProjection` | Projection matrix and its inverse. |
| `view`, `inverseView` | View matrix and its inverse. |

Custom uniforms are declared in the **User data** tab with the **Post** stage.
They are injected into every enabled effect and bound once per frame; value
edits apply live without recompiling. Names used by the contract above are
reserved.

## Pipeline

```
scene ──► normal prepass ──┐
      └─► depth prepass ───┼──► linearize ──► effect 1 ──► … ──► effect N ──► display
                            (buffers bound to every effect)
```

- Two prepasses (`ViewSpaceGbuffer`) render the preview mesh into off-screen
  targets before the camera: normals in an RGBA half-float target and linear
  depth in a single-channel `R32F` target (8-bit fallback). The camera uses a
  tight clip range (`0.1` / `20`) so the normalised depth uses its full range.
  They are registered as custom render targets **only while an installed effect
  samples one of their textures**: the default passthrough samples neither, so
  it draws the mesh once instead of three times.
- `linearize` decodes the scene colour from display space into the linear
  working space; `display` applies the selected transform and re-encodes to
  sRGB. With **none**, the round trip is the identity.
- Effects run in stack order; each samples the previous output through
  `textureSampler`.
- The chain is replaced only as a whole, after every pass compiled.

## Limitations

- The prepasses use the mesh's undeformed geometry, so vertex displacement from
  a surface shader is not reflected in the normal/depth buffers.
- Depth is normalised over `cameraNear..cameraFar`; the background reads `1`.
  Reconstruct world units before comparing distances across pixels.
- Without float render-target support the depth target falls back to an 8-bit
  normalised channel (correct range, reduced precision).
- Effects are not serialised with the app; the stack lives in memory for the
  editing session.

## Source map

- `src/core/models/postEffect.ts` — documents, stack, assembled source types.
- `src/core/constants/postEffectAbi.ts` — shared uniform/sampler contract.
- `src/core/shader/postEffectCodegen.ts` — user-data block injection.
- `src/services/babylon/preview/post/` — prepass, compiler, pipeline, binder
  adapter.
- `src/components/shader/PostEffectPanel.vue` — stack UI.
