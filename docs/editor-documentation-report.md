# Documentation report: 3D Shader Editor and 2D Sandbox Editor

**Status:** analysis and content brief. No user-facing documentation page was rewritten.
**Baseline:** `34266c9` (24 Nov 2026).
**Surfaces inspected:** `/docs`, `/editor`, `/sandbox`, `/screen-space`, the content
pipeline (`src/core/content`, `src/services/content`), the i18n catalogues and the
two editor composition roots.

---

## 1. Bottom line

- The documentation page is currently an **internal API reference**, not user
  documentation. In production the `/docs` tree contains exactly one page,
  "ShaderEditor", and `/docs` redirects to it because it is the first readable
  leaf. Its body documents a class (`ShaderEditor` with `getValue()`,
  `setValue()` and compile events) that **does not exist** in the codebase; the
  behaviour lives in `EditorManager` and `useEditorNavigation`.
- The **2D sandbox has no documentation at all**. It shipped in `166e418` with
  only a one-line landing-card description.
- The **3D editor has no user-facing concept, usage or reference page** either.
  Its only descriptions are the landing card ("3D GLSL Editor — Edit shaders and
  test them in 3D meshes and HDRI environments") and the README.
- The two editors share most of their interaction model (CodeMirror, User data,
  Post effects, Compile and diagnostics, language switch) but have **different
  shader contracts**. Quality documentation should teach the shared model once
  and make the differences explicit, rather than write two unrelated manuals.
- The content platform is adequate but lacks the furniture a documentation page
  needs: no rendered page title or summary (the `description` frontmatter is
  parsed but never displayed), no table of contents, no search, no code
  highlighting, no copy button, no previous/next links, and **no link from either
  editor to `/docs`**.
- Minimum credible set: **seven pages** (overview, one page per editor, four
  shared reference pages), in English and pt-BR, with annotated screenshots and
  ABI tables verified against source.

---

## 2. What the documentation page is today

### 2.1 Rendering pipeline

`/docs/:slug?` → `DocumentationView.vue` (7 lines) → `ContentBrowser kind="docs"`
→ `TreeView` + `ContentPane`. With no slug, `ContentBrowser` replaces the URL
with the first readable leaf (`ContentBrowser.vue:90-102`). The pane renders
`content.body` **only** (`ContentBrowser.vue:141-147`), so the title and summary
exist in the tree/frontmatter but never appear above the article.

### 2.2 Inventory under production semantics

| File                                               | Title             | Section  | Order | Draft | Actual content                                |
| -------------------------------------------------- | ----------------- | -------- | ----- | ----- | --------------------------------------------- |
| `en/docs/shader-editor.md`                         | ShaderEditor      | `api`    | 1     | no    | Internal CodeMirror class, 3 responsibilities |
| `en/docs/scene-manager.md`                         | Scene Manager     | `api`    | 2     | yes   | Frontmatter only                              |
| `en/docs/your-first-shader.md`                     | Your First Shader | `guides` | —     | yes   | Frontmatter only                              |
| `pt-BR/docs/shader-editor.md`                      | Editor de Shader  | `api`    | 1     | no    | Translation of the same stale page            |
| `pt-BR/docs/{scene-manager,your-first-shader}.md`  | —                 | —        | —     | yes   | Empty stubs                                   |

Consequences:

- In production the docs tree has **one section and one item**: "API Reference →
  ShaderEditor". The Guides section does not render at all because both guide
  files are drafts.
- In `npm run dev` the drafts appear (English drafts are previewable), so the
  tree gains "Scene Manager" and "Your First Shader" — but still nothing about
  the sandbox.
- The only published page describes an abstraction that no reader can find in
  the UI. There is no `ShaderEditor` class in `src/`; `EditorManager` owns the
  CodeMirror instance and `useEditorNavigation` owns buffers, tabs and
  diagnostics.

### 2.3 What the Markdown renderer supports

`markdown-it` with `html: false`, linkification, heading anchors, tables,
images, blockquotes and Mermaid fences; root-relative links are prefixed with
Vite's base. Code fences are **not highlighted** (no highlighter is configured),
and there is no copy control. The CMS media collection
(`public/images/content`) is configured but contains one image, unrelated to the
editors.

### 2.4 Discoverability

The only entry point to `/docs` is the landing card. The app header contains the
brand (home) and the language switch; neither editor toolbar has a help or docs
control. Documentation pages can link back to `/editor` and `/sandbox` with
ordinary Markdown links, but nothing establishes that habit.

### 2.5 Content-contract constraints

- The relative path is the translation key; both locales must keep identical
  paths and frontmatter keys (`docs/i18n-content.md`).
- The tree is flat: `subfolders: false` in `.pages.yml`, and section ids are
  fixed in `contentTrees.ts:15-28`. The CMS select only offers `api` and
  `guides`.
- `content.integration.test.ts:28-42` pins `docs/shader-editor.md`, its pt-BR
  title and `hasTranslation`, and lines 80-84 pin the section label "Referência
  da API". Restructuring the docs requires updating that test.
- Slugs come from filenames (`slugFromRelativePath`), and the route carries only
  the slug, so filenames must stay unique across the whole `docs` collection.

---

## 3. What the two editors actually are

### 3.1 3D Shader Editor (`/editor`)

**Concept.** A surface-material editor. The user writes a vertex/fragment pair
for a GLB mesh, Babylon.js supplies attributes, matrices, camera, light and
image-based-lighting samplers, and the result renders live on a switchable model
under a switchable HDR environment. It is not a scene editor: lights, camera and
mesh are fixed by the app; only the shader and its parameters are authored.

**Layout.**

| Region            | Contents                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| Left toolbar      | Brand; "Shader Stages" (Vertex, Fragment); "Post effect"; "Shader Data" (User data, Attributes, Uniforms); "Examples" |
| Left workspace    | CodeMirror document, or the User data table, or the post-effect stack     |
| Right toolbar     | Compile; Cfg (wireframe); Pause/Resume; language switch                  |
| Right canvas      | Live preview, Model/Environment menus, loading overlay, error panel      |
| Bottom status bar | Cursor line/column, status state and message                             |

**Documents.**

| Tab         | Editable | Purpose                                                        |
| ----------- | -------- | -------------------------------------------------------------- |
| Vertex      | yes      | Vertex stage; attributes → varyings → `gl_Position`            |
| Fragment    | yes      | Fragment stage; varyings + uniforms → `fragColor`              |
| Post effect | yes      | Fragment of the selected effect in the view-space stack        |
| User data   | table    | Structured uniforms; generated GLSL is injected at compile time|
| Attributes  | no       | Built-in reference generated from `materialAbi.ts`             |
| Uniforms    | no       | Built-in reference generated from `materialAbi.ts`             |

**Shader contract (from `materialAbi.ts`).**

| Family    | Names                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------- |
| Attributes| `position` vec3, `normal` vec3, `tangent` vec3, `uv` vec2, `uv2` vec2, `color` vec4             |
| Uniforms  | `world` mat4, `view` mat4, `projection` mat4, `normalMatrix` mat3, `time` float, `cameraPos` vec3, `lightDir` vec3 |
| Samplers  | `environmentMap` cube, `irradianceMap` cube, `prefilteredEnvironmentMap` cube, `brdfLUT` 2D    |

Output is `layout(location = 0) out vec4 fragColor`, with `#version 300 es` and
an explicit precision. Attributes are vertex-only; the two stages must agree on
their user-declared varyings. Babylon uses a left-handed coordinate system.

**Scene assets.** Five models (Monkey, Sphere, Cube, Bunny, Dragon) and five
prebaked `.env` environments (Wooden Studio 17, Peppermint Powerplant, Pergola
Walkway, Qwantani Sunrise, Mossy Forest). The camera is an `ArcRotateCamera`
(drag to orbit, wheel to zoom within limits) and the mesh auto-rotates every
frame.

**Examples.** Seven examples in two folders — Lighting (Lambert, Phong,
Blinn-Phong, Oren-Nayar, Cook-Torrance) and Image-based lighting (Metalness /
Roughness, Specular / Glossiness). Loading one is deliberately destructive: it
replaces both editable stages and the whole User data document.

**Behaviour that must be documented rather than discovered.**

- A compile runs automatically on mount; afterwards the Compile button is the
  trigger. Editing text does not auto-compile.
- Compile targets the document family of the active tab: material for
  Vertex/Fragment/Attributes/Uniforms, post chain for Post effect. The User data
  tab does not change the target.
- A failed compile preserves the last successfully compiled shader on screen;
  errors appear in an overlay and as editor diagnostics.
- User-data **value** edits rebind without a recompile; adding, renaming or
  retargeting rebuilds the shader.
- Pause stops rendering. `uTime` is wall-clock (`performance.now()`), so it
  jumps forward on resume rather than freezing.
- The copy control copies the active document with the generated user-data
  block injected.
- Nothing is persisted: reloading resets both stages, user data, post effects
  and the selected model/environment.

### 3.2 2D Sandbox Editor (`/sandbox`)

**Concept.** A fragment-only fullscreen playground. One internal vertex shader
draws a fullscreen triangle with no vertex buffers and no attributes; the user
edits only the fragment. There is no mesh, camera, environment, HDRI or scene.
It is a raw WebGL 2 renderer, deliberately independent of Babylon.

**Contract.** `vUv` (normalised screen coordinate, GL convention) is the only
varying; the engine supplies `uResolution` (render-target size in pixels) and
`uTime` (seconds, frozen while paused). Output is `fragColor`. The fragment must
start with `#version 300 es` and declare its precision. There is no vertex tab,
so custom varyings and attributes are impossible by construction.

**UI.** Same toolbar pattern, but:

- "Shader Stages" contains only Fragment; "Shader Data" contains only User data.
- No Examples button, no copy-source control, no wireframe, no model or
  environment menus.
- Pause/Resume and the language switch remain.
- The canvas carries a small ABI badge: `vUv · uResolution · uTime · user data ·
  post effects`.

**User data.** Same table, but the kinds exclude `samplerCube` (no cube source
exists) and the stages exclude `vertex` (fragment, post, both only).

**Post effects.** The same stack and tonemap UI, but geometry inputs are
neutralised: `gbufferTexture` is a 1×1 solid normal texture, `depthTexture` is a
1×1 solid texture, `cameraNear`/`cameraFar` are 0/1 and all camera matrices are
identity. Effects that depend on normals or depth are therefore no-ops in the
sandbox; `textureSampler`, `resolution`, `texelSize` and `time` are meaningful.

**Pause.** Unlike the 3D editor, the sandbox accumulates elapsed time only while
unpaused, so Pause genuinely freezes `uTime` and animation.

**Limits.** WebGL 2 required; no save/export; no persistence; responsive layout
stacks the panes below 860 px.

### 3.3 The third card matters

`/screen-space` is not a separate renderer. `ScreenSpaceEditorView.vue` renders
the same `ShaderEditorView` with `initial-tab="post"`; it starts on the Post
effect document instead of Fragment. Any overview page must say this explicitly,
or readers will assume there are three independent engines.

### 3.4 Comparison

| Dimension       | 3D Shader Editor                   | 2D Sandbox                    | Screen Space (same 3D harness)   |
| --------------- | ---------------------------------- | ----------------------------- | -------------------------------- |
| Edits           | Surface vertex + fragment          | Fullscreen fragment only      | Post-effect fragment chain       |
| Geometry        | Switchable GLB mesh                | Fixed fullscreen triangle     | Scene rendered by the 3D preview |
| Scene inputs    | Camera, light, HDRI/IBL, model     | None                          | G-buffer, depth, camera matrices |
| Extra ABI       | Attributes, matrices, IBL samplers | `vUv`, `uResolution`, `uTime` | Post-effect uniforms/samplers    |
| Examples        | 7                                  | none                          | 7 (shared with 3D)               |
| Copy source     | yes                                | no                            | yes                              |
| Wireframe       | yes                                | no                            | yes                              |
| Pause semantics | stops rendering; `uTime` jumps      | freezes rendering and `uTime` | same as 3D                       |

---

## 4. The documentation set to write

### 4.1 Recommended information architecture

Add two user-facing sections and retire the internal one from the user docs:

| Section id  | English label | pt-BR label  | Holds                                      |
| ----------- | ------------- | ------------ | ------------------------------------------ |
| `editors`   | Editors       | Editores     | overview, then one page per editor         |
| `reference` | Reference     | Referência   | shared contracts and behaviour             |
| `guides`    | Guides        | Guias        | optional step-by-step tutorials            |
| `api`       | (retired)     | —            | no user-facing content                     |

The overview sits first in `editors` so `/docs` lands on it. `guides` stays
available for the optional tutorials; `api` keeps its schema entry until no
content uses it, then can be removed.

### 4.2 Page briefs

Paths below are filenames directly under `content/<locale>/docs/`; the prefix
names the intended `section` frontmatter value, not a subfolder (subfolders are
disabled in the content model).

#### P0-1. `editors/editors-overview.md`

**Job:** let a reader choose the right screen in under a minute.

Must cover: one-sentence product definition; the four landing cards and their
routes; what each editor edits; the shared interaction model (editor left,
preview right, Compile, User data, Post effects, no save); a decision table
("I want a material on a mesh" → 3D; "I want to paint pixels" → Sandbox; "I want
to post-process a 3D scene" → Screen Space); a short glossary (stage, varying,
uniform, ABI, pass, tonemap); links to the three editor pages and to the
rendering-pipeline knowledge page.

Done when: the comparison fits on one screen, names every route, and a reader
who only reads this page still knows what is not saved.

#### P0-2. `editors/3d-editor.md`

**Job:** the canonical concept, UI and contract reference for `/editor`.

Must cover: what it is and when to use it; an annotated UI map naming every
visible control (including the Cfg menu and the Model/Environment overlays); the
six documents and which are editable; the workflow (pick assets → start from
default or example → edit → compile → read errors → add data/effects); the ABI
tables in §3.1; the vertex/fragment varying contract; left-handed coordinates;
IBL semantics; example loading is destructive; orbit/zoom and auto-rotation;
copy source; pause caveat; last-good-image behaviour; explicit limits and links
to the shared reference pages.

Done when: every control in the screenshot has a sentence, every ABI name
matches `materialAbi.ts`, and the page contains one complete compilable pair.

#### P0-3. `editors/2d-sandbox.md`

**Job:** the canonical concept and reference for `/sandbox`, including what is
deliberately absent.

Must cover: what "2D" means here (a fullscreen fragment, not a canvas 2D scene);
the fixed vertex stage and why there is no vertex tab; the three-value ABI; the
coordinate convention and an aspect-correction recipe; the UI map with the
controls that are *not* there; how to start from the default ripple shader;
pause/time semantics; user-data differences; the post-effect caveat (neutral
geometry inputs); limits.

Done when: a reader can explain why `uResolution` is needed for circles, knows a
`samplerCube` is impossible here, and does not expect the sandbox to render a
mesh.

#### P0-4. `reference/user-data.md`

**Job:** explain the structured uniform system once for both editors.

Must cover: the table/generated-block model and the guarantee that the editor
buffer is never rewritten; the kind table (float, vec2, vec3, vec4, color,
color4, direction, position, sampler2D, samplerCube) with widget and GLSL type;
the stage table (fragment, vertex, both, post) and the sandbox exclusion; value
edits vs structural edits and their compile consequences; name rules and the
reserved sets (GLSL words, ABI names, `vUv`, `uResolution`, `uTime`, post-effect
names); texture sources (repository, URL, upload) and the 2D-only/cube
distinction; the read-only generated block and its injection point; how copy
source includes the block; common failure "declared it myself → duplicate
declaration".

Done when: the kind and stage tables are complete for both editors, and the
compile consequences are stated unambiguously.

#### P0-5. `reference/post-effects.md`

**Job:** explain the view-space chain, its ABI and its per-editor differences.

Must cover: the pipeline order (scene → linear target → each enabled effect in
stack order → display pass → output transform); the stack UI (add, enable,
reorder, remove, at least one effect always exists); the ABI table (`time`,
`resolution`, `texelSize`, `cameraNear`, `cameraFar`, `cameraPosition`,
`projection`, `inverseProjection`, `view`, `inverseView`; `textureSampler`,
`gbufferTexture`, `depthTexture`; `vUV`; `fragColor`); the meaning of each
sampler's channels; tonemap modes and why the transform is last and does not
recompile; the sandbox's neutral geometry inputs; recompile triggers; last-good
chain on failure; user data targeting `post`.

Done when: the g-buffer/depth channel semantics and the sandbox no-op caveat are
both explicit.

#### P0-6. `reference/compiling-and-errors.md`

**Job:** make the compile model predictable.

Must cover: when compilation happens (mount, button, structural user data, post
stack changes) and when it does not (typing, value edits, tonemap); what the
button targets per tab; the single queue and latest-wins behaviour; the
last-good-image rule; the status states (idle, ready, compiling, error); the
error taxonomy (syntax, type, logic, link, program, timeout, internal) and stage
labels; the overlay, squiggles, gutter markers, status text; click-to-reveal and
user-data row highlight; what "program" errors without a line mean.

Done when: a reader can explain why the image did not update after an error and
how to get from the overlay to the offending line.

#### P0-7. `reference/limits-and-troubleshooting.md`

**Job:** set expectations and answer the recurring questions.

Must cover: WebGL 2 requirement and context loss; no persistence/export/share;
GLSL ES 3.00 only (no WGSL editing); DPR cap 2 and performance advice; texture
size and sampler-count limits; sandbox limitations; 3D catalog limitations; FAQ
entries (blank canvas, stale image after error, uniform not bound, texture not
visible, example replaced my code, page falls back to English, "2D" naming).

Done when: every FAQ answer names a cause and an action, not just a symptom.

### 4.3 Optional pages (P1)

- `guides/first-3d-material.md` and `guides/first-2d-fragment.md`: step-by-step
  tutorials, only if the editor pages exceed ~1,500 words.
- `reference/glossary.md`: if the overview glossary grows.
- `reference/examples.md`: a catalog of the seven examples and their parameters.

### 4.4 Suggested page skeleton

```markdown
# <Title>            <!-- only if the page header is not rendered by the app -->

<What this is, who it is for, what you can do — 2-3 sentences.>

## What it is
## When to use it
## The screen            <!-- annotated screenshot + control table -->
## Workflow
## Shader contract       <!-- ABI tables, stage rules -->
## Limits
## Related
```

Every page should end with Related links in both directions: editor ↔ shared
reference ↔ knowledge.

---

## 5. Quality bar

A page is publishable only when all of these hold.

1. **Verified.** Every claim was checked against this build (commit + date
   recorded in the page or the PR). No claim inherited from README or memory.
2. **Complete.** Every visible control has a label and an effect. "The rest is
   self-explanatory" is not acceptable for a tool whose users do not know the
   shader contract.
3. **Terminology.** One canonical name per concept, with aliases on first use
   ("3D Shader Editor (also labelled 3D GLSL Editor)"). The glossary covers
   stage, varying, uniform, attribute, ABI, pass, tonemap.
4. **Task-oriented.** Each concept page answers "what do I do next", not only
   "what is this".
5. **Code is real.** Snippets compile, include `#version 300 es` and precision,
   and avoid declaring ABI or user-data uniforms that the engine injects.
6. **Visuals.** At least one annotated screenshot per editor at a fixed
   viewport, with numbered callouts and alt text; refresh when the UI changes.
7. **Limits are explicit.** Every page says what the editor cannot do, what is
   lost on reload, and which browser features are required.
8. **Localised.** English and pt-BR share paths, section and order; pt-BR is
   authored, not machine-translated; no fallback notice on core pages.
9. **Linked.** No dead ends: overview → editors → reference → knowledge → back
   to the live editor.
10. **Maintainable.** ABI tables are guarded by a test or generated from source;
    screenshots carry the build they were captured on.

---

## 6. Platform changes required to support that quality

| Change | Why | Where |
| ------ | --- | ----- |
| Add `editors` and `reference` sections | The current `api`/`guides` split does not fit user docs | `contentTrees.ts` SECTIONS + both `.pages.yml` collections |
| Retire the internal API pages from `/docs` | "ShaderEditor" and "Scene Manager" describe internals, not screens | Move to `docs/` contributor notes; update `content.integration.test.ts` |
| Render page title + `description` (or require an H1) | The pane currently starts at an H2 with no context; the CMS asks for a summary nobody sees | `ContentPane.vue` / `ContentBrowser.vue`; document the rule in `docs/i18n-content.md` |
| Make the overview the default `/docs` page | `/docs` currently opens the stale internal page | `order: 0` on the overview; first section in `SECTIONS` |
| Link to docs from the editors | The only entry point is the landing card | `EditorToolbar.vue` or `ViewerToolbar.vue` help control |
| Localise docs chrome | "Tree view", "Content", "Loading…" and the empty state are hardcoded English | `ContentBrowser.vue`, `SplitViewLayout.vue` |
| Add code highlighting and copy | Shader snippets are the core of these pages | `markdown.ts` (highlighter) + a small copy control; or accept plain code and keep snippets short |
| Define the image workflow | Quality UI docs need annotated screenshots | `public/images/content/editors/`; CMS media already configured |
| Add a TOC for long pages | Editor pages will exceed ~1,500 words | Small "On this page" component from heading anchors (P2) |
| Guard ABI drift | Docs will duplicate `materialAbi.ts` / `postEffectAbi.ts` | Test extracting names from Markdown and comparing to the constants (P2) |

Two smaller fixes materially affect what screenshots can show: the viewer's
"Model", "Environment", "Cfg" and "Toggle Wireframe" labels are hardcoded in
English, while the rest of the UI is localised. Either localise them before
capturing pt-BR screenshots or caption them as-is.

---

## 7. Decisions needed before writing

1. **Canonical names.** The product says "3D GLSL Editor" and "2D GLSL Sandbox";
   the user says "3D Shader Editor" and "2D Sandbox Editor". Pick one public name
   per screen and list the other as an alias.
2. **The third editor.** Is Screen Space a first-class product or a mode of the
   3D editor? The overview cannot be written until this is decided.
3. **Audience.** Beginners need a GLSL primer; experienced users need the engine
   contract. The briefs above assume "can read GLSL, does not know this engine".
4. **ABI duplication.** Should docs own the ABI tables, or point at the in-app
   Attributes/Uniforms tabs? Owning them is friendlier; it requires a drift guard.
5. **Where contributor docs live.** `SceneManager` and `ShaderEditor` internals
   belong in `docs/`, not in the user-facing tree. Confirm the move.
6. **pt-BR ownership.** Fallback is acceptable for a release, but "quality"
   means both locales for the seven P0 pages.
7. **Persistence expectations.** There is no save, export or share today. Docs
   must either state that plainly or the product needs a persistence feature
   before docs promise one.

---

## 8. Accuracy traps found in the current implementation

These are the places where a plausible-sounding sentence would be wrong.

| Trap | Reality |
| ---- | ------- |
| "The docs page documents the editor" | It documents a non-existent `ShaderEditor` class; `/docs` opens it by default |
| "The sandbox has the same post effects as the 3D editor" | Same stack and ABI, but g-buffer/depth are 1×1 neutral textures and camera matrices are identity; geometry-dependent effects are no-ops |
| "Pause freezes time" | True in the sandbox; in the 3D editor `uTime` is wall-clock and jumps on resume |
| "2D means the Canvas 2D API" | It is a WebGL 2 fullscreen fragment shader |
| "You can edit the vertex shader in the sandbox" | The vertex stage is internal and not editable |
| "User data supports any GLSL type" | Ten fixed kinds; no matrices, arrays or structs; `samplerCube` is 3D-only |
| "Compile always compiles the shader" | It targets the active document family; the User data tab leaves the target unchanged |
| "Edits recompile automatically" | Only mount, the button, structural user-data edits and post-stack changes compile |
| "Your work is saved" | No persistence anywhere; reload resets everything |
| "WGSL is supported" | The editors compile GLSL ES 3.00 only; WGSL exists only as knowledge content |
| "Loading an example adds to my work" | It replaces both stages and the whole user-data document |
| "All UI labels are translated" | Model, Environment, Cfg and Toggle Wireframe are hardcoded English |
| "The docs summary appears on the page" | `description` is parsed and never rendered |

Also verify, before writing prose: the sign convention of `lightDir` (the
examples use it directly as `L` in `dot(N, L)`, while the ABI hint says
"direction vector of the directional light"), and the exact `vUv` vertical
orientation in the sandbox. Both are easy to get backwards.

---

## 9. Plan and effort

| Phase | Work | Output | Estimate |
| ----- | ---- | ------ | -------- |
| 0 | Decisions in §7; add sections; move internal pages; update the content test | Clean IA, green tests | 0.5–1 day |
| 1 | Write the two editor pages and the overview | 3 pages, en | 2–3 days |
| 2 | Write the four shared reference pages | 4 pages, en | 2 days |
| 3 | Annotated screenshots, links, pt-BR translation, review | 14 files, both locales | 2–3 days |
| 4 | Optional tutorials, glossary, drift guard, TOC | P1/P2 | 1–2 days |

One technical writer with engineering review: roughly one week for the seven P0
pages.
Writing the pages without the platform fixes in §6 will produce correct but
hard-to-find, hard-to-scan documentation.

---

## 10. Definition of done

- `/docs` opens an overview that explains the three editors and links to each.
- The 3D and sandbox pages exist in both locales and contain no statement from
  §8.
- Every visible control on both screens is named and explained.
- Every ABI name matches the constants; every snippet compiles.
- Each editor page has an annotated screenshot with alt text.
- The shared pages are linked from both editor pages, and the editor pages are
  linked from the docs overview.
- No page in `/docs` describes an internal class or an internal service.
- `npm run test`, `npm run lint` and `npm run build` pass after the content test
  is updated.
- A reader can answer, using only the docs: which editor to use, what contract
  to write against, when compilation happens, why the image did not change,
  what is saved, and where to go next.

---

## Appendix A — suggested frontmatter

English:

```yaml
---
title: 3D Shader Editor
description: Write a vertex/fragment pair for a mesh, compile it, and preview it under an HDR environment.
section: editors
order: 2
draft: false
---
```

pt-BR:

```yaml
---
title: Editor de Shader 3D
description: Escreva um par vertex/fragment para uma malha, compile e visualize com um ambiente HDR.
section: editors
order: 2
draft: false
---
```

`section` and `order` must match the English file; only `title`, `description`
and the body are translated.

## Appendix B — source of truth for each fact

| Fact | Source |
| ---- | ------ |
| Docs sections and order | `src/core/content/contentTrees.ts` |
| Frontmatter fields and CMS | `.pages.yml` |
| Draft/fallback policy | `src/core/content/ContentResolver.ts`, `docs/i18n-content.md` |
| 3D tabs and buffers | `src/core/models/editorTab.ts`, `src/composables/useEditorNavigation.ts` |
| 3D ABI | `src/core/constants/materialAbi.ts` |
| 3D assets and examples | `src/core/constants/previewModels.ts`, `previewHdris.ts`, `shaderExamples.ts` |
| 3D scene/camera/light | `src/services/babylon/preview/createPreviewScene.ts` |
| 3D time and pause | `src/services/babylon/preview/PreviewAnimator.ts`, `PreviewEngine.ts` |
| Sandbox ABI and restrictions | `src/core/constants/sandbox.ts`, `src/assets/internal-shaders/sandbox.*.glsl` |
| Sandbox renderer | `src/services/sandbox/SandboxPreview.ts` |
| Sandbox post behaviour | `src/services/sandbox/SandboxPostPipeline.ts` |
| Post ABI and tonemap | `src/core/constants/postEffectAbi.ts`, `src/core/constants/postEffects.ts` |
| User data kinds/stages | `src/core/models/userUniform.ts`, `src/core/constants/sandbox.ts` |
| Compile queue and status | `src/composables/useShaderCompilation.ts` |
| UI labels (en) | `src/i18n/locales/en.json` |
| Screen-space alias | `src/views/ScreenSpaceEditorView.vue` |
