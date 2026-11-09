import { describe, expect, it, vi } from 'vitest';
import type { BaseTexture, Scene, ShaderMaterial } from '@babylonjs/core';

import { IblEnvironment } from './IblEnvironment';
import { SHADER_SAMPLER_NAMES } from './MaterialController';

function createHarness() {
  const irradiance = { name: 'irradiance' } as unknown as BaseTexture;
  const environment = {
    name: 'environment',
    irradianceTexture: irradiance,
  } as unknown as BaseTexture;
  const brdf = { name: 'brdf' } as unknown as BaseTexture;
  const scene = { environmentTexture: environment } as unknown as Scene;
  const material = { setTexture: vi.fn() } as unknown as ShaderMaterial;
  const getBrdfLut = vi.fn(() => brdf);
  const ibl = new IblEnvironment(scene, getBrdfLut);

  return {
    ibl,
    scene,
    material,
    environment,
    irradiance,
    brdf,
    getBrdfLut,
  };
}

describe('IblEnvironment', () => {
  it('binds the prefiltered environment, irradiance and BRDF LUT', () => {
    const harness = createHarness();

    harness.ibl.bind(harness.material);

    expect(harness.material.setTexture).toHaveBeenCalledWith(
      SHADER_SAMPLER_NAMES.prefilteredEnvironment,
      harness.environment,
    );
    expect(harness.material.setTexture).toHaveBeenCalledWith(
      SHADER_SAMPLER_NAMES.irradiance,
      harness.irradiance,
    );
    expect(harness.material.setTexture).toHaveBeenCalledWith(
      SHADER_SAMPLER_NAMES.brdfLut,
      harness.brdf,
    );
  });

  it('obtains the scene BRDF LUT only once', () => {
    const harness = createHarness();

    harness.ibl.bind(harness.material);
    harness.ibl.bind(harness.material);

    expect(harness.getBrdfLut).toHaveBeenCalledTimes(1);
  });

  it('follows environment and irradiance changes', () => {
    const harness = createHarness();
    const replacementIrradiance = {
      name: 'next-irr',
    } as unknown as BaseTexture;
    const replacement = {
      name: 'next-env',
      irradianceTexture: replacementIrradiance,
    } as unknown as BaseTexture;

    const scene = harness.scene as unknown as {
      environmentTexture: BaseTexture;
    };

    harness.ibl.bind(harness.material);
    scene.environmentTexture = replacement;
    harness.ibl.bind(harness.material);

    expect(harness.material.setTexture).toHaveBeenLastCalledWith(
      SHADER_SAMPLER_NAMES.brdfLut,
      harness.brdf,
    );
    expect(harness.material.setTexture).toHaveBeenCalledWith(
      SHADER_SAMPLER_NAMES.prefilteredEnvironment,
      replacement,
    );
    expect(harness.material.setTexture).toHaveBeenCalledWith(
      SHADER_SAMPLER_NAMES.irradiance,
      replacementIrradiance,
    );
  });

  it('skips the irradiance sampler when the environment has none', () => {
    const harness = createHarness();
    const scene = harness.scene as unknown as {
      environmentTexture: BaseTexture;
    };
    scene.environmentTexture = { name: 'raw' } as unknown as BaseTexture;

    harness.ibl.bind(harness.material);

    expect(harness.material.setTexture).not.toHaveBeenCalledWith(
      SHADER_SAMPLER_NAMES.irradiance,
      expect.anything(),
    );
  });

  it('stops binding after disposal', () => {
    const harness = createHarness();
    harness.ibl.dispose();

    harness.ibl.bind(harness.material);

    expect(harness.material.setTexture).not.toHaveBeenCalled();
    expect(harness.getBrdfLut).not.toHaveBeenCalled();
  });
});
