import type {
  UserColor3Value,
  UserColor4Value,
  UserUniformKind,
  UserUniformValue,
  UserVector2Value,
  UserVector3Value,
  UserVector4Value,
} from '@/core/models/userUniform';

/**
 * Platform-neutral user-uniform binding.
 *
 * A binding target is the only thing an adapter has to implement: Babylon
 * materials/effects and the sandbox's WebGL program each project the same
 * definition list onto their own setters. The texture handle is a type
 * parameter so the controller never has to know whether a texture is a Babylon
 * `BaseTexture` or a `WebGLTexture`.
 */

export interface UniformBindingTarget<TTexture> {
  setFloat(name: string, value: number): void;
  setInt(name: string, value: number): void;
  setVector2(name: string, value: UserVector2Value): void;
  setVector3(name: string, value: UserVector3Value): void;
  setVector4(name: string, value: UserVector4Value): void;
  setColor3(name: string, value: UserColor3Value): void;
  setColor4(name: string, value: UserColor4Value): void;
  setTexture(name: string, texture: TTexture): void;
}

/** Resolves the loaded texture backing a sampler definition. */
export interface TextureResolver<TTexture> {
  textureFor(definitionId: string): TTexture | null;
}

/**
 * One definition projected for binding. The definition id is kept because the
 * texture registry is keyed by it (renames keep the same texture).
 */
export interface UniformBinding {
  readonly id: string;
  readonly name: string;
  readonly kind: UserUniformKind;
  readonly value: UserUniformValue;
}

export interface UniformSetterContext<TTexture> {
  resolveTexture(definitionId: string): TTexture | null;
}

export type UniformKindSetter<TTexture> = (
  target: UniformBindingTarget<TTexture>,
  binding: UniformBinding,
  context: UniformSetterContext<TTexture>,
) => void;

/**
 * Maps every kind to the material/program setter it must use. This is the
 * single place where the kind/value union is narrowed, so both adapters stay
 * uniform. A factory (rather than one shared record) keeps the map tied to the
 * adapter's texture handle type.
 */
export function createUniformKindSetters<TTexture>(): Record<
  UserUniformKind,
  UniformKindSetter<TTexture>
> {
  return {
    float: (target, binding) =>
      target.setFloat(binding.name, binding.value as number),
    vec2: (target, binding) =>
      target.setVector2(binding.name, binding.value as UserVector2Value),
    vec3: (target, binding) =>
      target.setVector3(binding.name, binding.value as UserVector3Value),
    vec4: (target, binding) =>
      target.setVector4(binding.name, binding.value as UserVector4Value),
    color: (target, binding) =>
      target.setColor3(binding.name, binding.value as UserColor3Value),
    color4: (target, binding) =>
      target.setColor4(binding.name, binding.value as UserColor4Value),
    direction: (target, binding) =>
      target.setVector3(
        binding.name,
        normalizeDirection(binding.value as UserVector3Value),
      ),
    position: (target, binding) =>
      target.setVector3(binding.name, binding.value as UserVector3Value),
    sampler2D: bindTexture,
    samplerCube: bindTexture,
  };
}

/** Port consumed by the user-data controller; each platform implements it. */
export interface UniformBinderPort<TTexture> {
  attach(target: UniformBindingTarget<TTexture> | null): void;
  apply(binding: UniformBinding): void;
  applyAll(bindings: readonly UniformBinding[]): void;
}

/**
 * Applies definition values to whatever target is currently attached.
 *
 * Attaching a new target is a platform concern (Babylon materials are rebuilt
 * on every compile; the sandbox program is linked again). The controller
 * re-applies all current values right after each attach so a fresh program
 * starts from the document, not from GPU defaults.
 */
export class UniformBinder<TTexture>
  implements UniformBinderPort<TTexture>, UniformSetterContext<TTexture>
{
  private readonly textures: TextureResolver<TTexture>;
  private readonly setters = createUniformKindSetters<TTexture>();
  private target: UniformBindingTarget<TTexture> | null = null;

  constructor(textures: TextureResolver<TTexture>) {
    this.textures = textures;
  }

  attach(target: UniformBindingTarget<TTexture> | null): void {
    this.target = target;
  }

  apply(binding: UniformBinding): void {
    const target = this.target;
    if (!target) return;

    this.setters[binding.kind](target, binding, this);
  }

  applyAll(bindings: readonly UniformBinding[]): void {
    for (const binding of bindings) this.apply(binding);
  }

  resolveTexture(definitionId: string): TTexture | null {
    return this.textures.textureFor(definitionId);
  }
}

/** Projects a stored definition into the shape the binder consumes. */
export function toUniformBinding(binding: {
  readonly id: string;
  readonly name: string;
  readonly kind: UserUniformKind;
  readonly value: UserUniformValue;
}): UniformBinding {
  return {
    id: binding.id,
    name: binding.name,
    kind: binding.kind,
    value: binding.value,
  };
}

function bindTexture<TTexture>(
  target: UniformBindingTarget<TTexture>,
  binding: UniformBinding,
  context: UniformSetterContext<TTexture>,
): void {
  const texture = context.resolveTexture(binding.id);
  if (texture) target.setTexture(binding.name, texture);
}

/** Normalises at bind time; a zero-length direction binds as (0, 0, 0). */
function normalizeDirection(value: UserVector3Value): UserVector3Value {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= 1e-12) {
    return { x: 0, y: 0, z: 0 };
  }

  return { x: value.x / length, y: value.y / length, z: value.z / length };
}
