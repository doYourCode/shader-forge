---
title: Limits and troubleshooting
description: Browser requirements, what is not saved, editor limits, performance advice and fixes for common symptoms.
section: reference
order: 4
draft: false
---

# Limits and troubleshooting

This page collects the boundaries that are easy to hit and the fixes for the
most common symptoms. If a page elsewhere says an editor can do something, this
page says what it cannot do.

## Browser and hardware requirements

- **WebGL 2 is required.** All three editors create a WebGL 2 context. There is
  no WebGL 1 or 2D-canvas fallback.
- **Supported desktop browsers:** current Chrome and Edge, current Firefox, and
  Safari 15 or newer. WebGL 2 is the baseline those versions ship; a browser
  without it cannot run the editors.
- **Hardware acceleration should be enabled.** A software renderer can run the
  editors, but compilation and animation will be slow.
- The 3D editor and the Screen Space editor also use Babylon.js; the 2D Sandbox
  uses a small dedicated WebGL 2 renderer. Both still require WebGL 2.
- Mobile browsers are not a supported target. The editors are laid out for a
  desktop viewport and the screen-space scene is expensive.
- If the browser cannot create a WebGL 2 context, the preview reports an error
  instead of rendering. Try a current desktop browser with acceleration on.

## What is not saved

Nothing is persisted. There is no account, project file, autosave or URL that
encodes your shader. Reloading the page resets:

- both stages and the post-effect stack;
- every User data definition and value;
- the selected model and environment;
- the active tab and the camera.

**Copy source** is the only export in the 3D editor; it copies the active
document with the generated user-data block. The 2D Sandbox has no copy or
export control, so keep important fragments outside the page.

## Language and content

The interface is available in English and Brazilian Portuguese. Documentation
pages are authored in English for now. When a page has no translation yet, the
app serves the English original and shows a fallback notice; the page content is
English even if the interface is Portuguese.

The content trees are managed in Pages CMS (`.pages.yml`). The lesson
frontmatter contract, the section ids and the code-fence modifiers are
documented in [Authoring lessons](/docs/authoring-lessons). Generated pages such
as the [ABI Reference](/docs/abi-reference) are rebuilt by `npm run docs:abi`.

A few preview labels are hardcoded in English: **Model**, **Environment**,
**Cfg** and **Toggle Wireframe**.

## 3D Shader Editor limits

- The model catalogue is fixed: Monkey, Sphere, Cube, Bunny, Dragon. You cannot
  upload a GLB.
- The environment catalogue is fixed: Wooden Studio 17, Peppermint Powerplant,
  Pergola Walkway, Qwantani Sunrise, Mossy Forest. You cannot upload an HDR.
- One material is active. Loading an example replaces both stages and the whole
  User data document.
- The camera orbits and zooms within fixed distance limits; you cannot move the
  model or add lights.
- The post-effect stack receives real view-space normals, depth and camera
  matrices, but only for the single mesh.
- There is no save, export or share beyond **Copy source**.

## 2D Sandbox limits

- One fragment document. The vertex stage is internal and cannot be edited, so
  there are no custom attributes or varyings.
- No geometry, camera, light or environment.
- The User data panel does not offer `samplerCube`; only `sampler2D` textures
  are supported.
- No bundled examples, no copy source, no wireframe, no model or environment
  menus.
- Post effects receive neutral normals, neutral depth and identity camera
  matrices. Depth- and normal-based effects do not work here.

## Post-effect limits

- Effects are fragment-only; the fullscreen vertex stage is internal.
- The stack is linear. The display pass applies the output transform and sRGB
  encoding once, at the end.
- A chain is installed only if every pass compiles. A failure keeps the previous
  chain.
- Disabled effects are not compiled and their uniforms are not bound.
- The sandbox's neutral geometry makes geometry-dependent effects no-ops; they
  still compile.

## Screen Space editor limits

- One scene is available (Bistro) and the HDRI catalogue is fixed. There is no
  upload path for either.
- Effects are fragment-only; the fullscreen vertex stage is internal.
- The G-buffer attachments are requested only when the compiled effects or the
  active debug view read them. Adding a sampler to a disabled effect does not
  add a pass.
- The screen-space ABI is separate from the surface post-effect ABI. A shader
  written for `gbufferTexture`/`depthTexture` will not see the same data there.
- `materialTexture` stores F0 and glossiness, not metallic/roughness. Decode it
  with the documented helpers before using it.
- The transparent overlay target is disabled by default; its debug view is
  hidden while that is true.
- The preview lowers its internal resolution when it misses the 60 fps budget
  (down to 50%). The stats overlay shows the current scale.
- There is no save, export or share beyond **Copy source**, and nothing persists
  across reloads.

## Performance

- The sandbox caps the device pixel ratio at 2. A very large pane still costs
  more than a small one, because the fragment shader runs per device pixel.
- Every enabled post-effect pass is a fullscreen draw. Several passes at a large
  pane size can dominate frame time.
- Raymarching, long loops and many texture taps are the usual causes of a slow
  preview. Reduce iterations or the canvas size before assuming the browser is
  broken.
- **Pause** stops rendering in both editors. In the sandbox it also freezes
  `uTime`; in the 3D editor `time` is wall-clock and jumps forward on resume.
- GPU resources are released when the editor unmounts or the preview is
  disposed, but a reload is the simplest way to recover from a lost context.

## Troubleshooting

| Symptom                                              | Likely cause                                                        | What to do                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Canvas is blank from the start                       | WebGL 2 unavailable, or the first compile failed                    | Check the error panel and the status bar; confirm WebGL 2 support and hardware acceleration. |
| The image did not change after an edit               | No compile ran, or the compile failed                               | Press **Compile** and read the status bar. Editing does not auto-compile.                    |
| The old image is still visible after an error        | Last-good rule                                                      | This is expected. Fix the error and compile again.                                           |
| Compile reports "Unavailable"                        | The preview is not ready, was disposed, or a newer compile superseded this one | Wait for the preview to finish loading; retry the compile.                       |
| A uniform does nothing                               | Wrong stage, typo, or the shader never reads it                     | Check the stage column; in 3D use **Post** for post effects and **All** for vertex+fragment. |
| A post effect looks like a no-op in the sandbox      | It reads `gbufferTexture`, `depthTexture` or camera matrices        | Use `textureSampler`, `resolution`, `texelSize`, `time` or your own uniforms.                |
| A texture is black                                   | No source, still loading, or a sampler-kind mismatch                | Choose a valid source; use **Texture 2D** for a 2D image; wait for the load.                 |
| A screen-space effect reads black G-buffer data       | The attachment was not requested, or the view is the background     | Sample the mask (`normalTexture.a`) and check the G-Buffer debug view.                      |
| The screen-space image looks soft after a while       | Adaptive resolution lowered the render scale                        | Read the `%` in the stats overlay; reduce passes or shader cost to recover it.              |
| A screen-space uniform does nothing                   | It targets the wrong stage, or the effect is disabled               | User data is post-only here; enable the effect and compile the stack.                        |
| The 3D editor example loads but the sandbox link does not | A material example id was used in a sandbox deep link            | Sandbox examples are the ids listed in the sandbox menu (`uv`, `gradient`, `pattern`, `noise`, `sdf`). |
| A docs page is in English                             | No translation is published yet                                     | The interface language and the content language are separate; a fallback notice confirms it. |
| An "Open in editor" link does nothing                 | The example id is stale or the page is generated from an older ABI | Run `npm test`; the link test fails on an unknown example id.                                |
| The page content is in English                       | No translation is published yet                                     | The interface language and the content language are separate; a fallback notice confirms it. |
| Reloading lost the shader                            | Nothing is persisted                                                | Use **Copy source** in the 3D editor before reloading; keep sandbox code outside the page.   |
| A model or environment switch failed                 | The asset failed to load                                            | The previous selection is restored; try another asset and check the console.                 |
| The shader takes a long time to compile              | A very large shader, or a stalled driver                            | Wait for the 15 s watchdog; if it times out, simplify the shader and reload.                 |
| The preview stopped updating and reports context loss| The GPU context was lost                                            | Reload the page. If it repeats, update the browser/driver and lower the shader cost.         |

When reporting a problem, include the exact error text and kind, the stage, the
browser and whether the problem survives a reload. Those four details usually
identify the cause without a reproduction.

## Related

- [Editors Overview](/docs/editors-overview)
- [3D Shader Editor](/docs/3d-editor)
- [2D Sandbox](/docs/2d-sandbox)
- [Screen Space GLSL Editor](/docs/screen-space-editor)
- [Compiling and errors](/docs/compiling-and-errors)
- [ABI Reference](/docs/abi-reference)
