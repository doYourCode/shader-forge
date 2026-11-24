/**
 * Shared WebGL texture-unit allocation for user samplers.
 *
 * The sandbox base program and every post-effect program share one document, so
 * the same uniform name must resolve to the same unit in all of them. Units
 * 0–2 are reserved by the post passes (`textureSampler`, `gbufferTexture`,
 * `depthTexture`), hence the default first unit of 3 for user textures.
 */
export class TextureUnitAllocator {
  private readonly units = new Map<string, number>();
  private nextUnit: number;

  constructor(firstUnit = 0) {
    this.nextUnit = firstUnit;
  }

  unitFor(name: string): number {
    const existing = this.units.get(name);
    if (existing !== undefined) return existing;

    const unit = this.nextUnit++;
    this.units.set(name, unit);
    return unit;
  }
}
