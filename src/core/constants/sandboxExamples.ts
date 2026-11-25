import uvFragment from '@/assets/sandbox-examples/uv.frag?raw';
import gradientFragment from '@/assets/sandbox-examples/gradient.frag?raw';
import patternFragment from '@/assets/sandbox-examples/pattern.frag?raw';
import noiseFragment from '@/assets/sandbox-examples/noise.frag?raw';
import sdfFragment from '@/assets/sandbox-examples/sdf.frag?raw';

/**
 * One bundled 2D Sandbox fragment. The sandbox vertex stage is internal, so a
 * source is exactly one fragment that targets the sandbox ABI: `vUv`,
 * `uResolution`, `uTime` and `fragColor`.
 */
export interface SandboxExample {
  /** Stable id; also the base name of the `?raw` asset. */
  readonly id: string;
  /** Name shown in the sandbox example menu and the docs. */
  readonly label: string;
  /** One-line summary of the technique. */
  readonly description: string;
  /** Menu folder; examples sharing a label share one group. */
  readonly group: string;
  readonly fragment: string;
}

/**
 * The sandbox lesson path, in teaching order. Adding an example means dropping
 * a fragment under `src/assets/sandbox-examples/` and appending one record; the
 * deep-link test verifies every docs reference resolves here.
 */
const examples: readonly SandboxExample[] = [
  {
    id: 'uv',
    label: 'UV as colour',
    description: 'vUv as RGB, plus a time pulse',
    group: 'Sandbox basics',
    fragment: uvFragment,
  },
  {
    id: 'gradient',
    label: 'Gradients',
    description: 'mix, smoothstep and a soft band',
    group: 'Sandbox basics',
    fragment: gradientFragment,
  },
  {
    id: 'pattern',
    label: 'Patterns',
    description: 'fract, step and tiling',
    group: 'Sandbox basics',
    fragment: patternFragment,
  },
  {
    id: 'noise',
    label: 'Value noise',
    description: 'hash, value noise and fbm',
    group: 'Procedural',
    fragment: noiseFragment,
  },
  {
    id: 'sdf',
    label: 'SDF shapes',
    description: 'Circle and box distance fields',
    group: 'Procedural',
    fragment: sdfFragment,
  },
];

export const sandboxExamples: readonly SandboxExample[] =
  Object.freeze(examples);

const byId = new Map(
  sandboxExamples.map((example) => [example.id, example] as const),
);

export function findSandboxExample(id: string): SandboxExample | undefined {
  return byId.get(id);
}
