import {
  Color3,
  Color4,
  Vector2,
  Vector3,
  Vector4,
  type BaseTexture,
  type ShaderMaterial,
} from '@babylonjs/core';
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
 * The setters the live binder needs from a material. Keeping the port this
 * narrow lets the binder (and its tests) stay independent of Babylon.
 */
export interface UniformBindingTarget {
  setFloat(name: string, value: number): void;
  setInt(name: string, value: number): void;
  setVector2(name: string, value: UserVector2Value): void;
  setVector3(name: string, value: UserVector3Value): void;
  setVector4(name: string, value: UserVector4Value): void;
  setColor3(name: string, value: UserColor3Value): void;
  setColor4(name: string, value: UserColor4Value): void;
  setTexture(name: string, texture: BaseTexture): void;
}

/** Resolves the loaded texture backing a sampler definition. */
export interface TextureResolver {
  textureFor(definitionId: string): BaseTexture | null;
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

export interface UniformSetterContext {
  resolveTexture(definitionId: string): BaseTexture | null;
}

export type UniformKindSetter = (
  target: UniformBindingTarget,
  binding: UniformBinding,
  context: UniformSetterContext,
) => void;

/**
 * Maps every kind to the material setter it must use. This is the single place
 * where the kind/value union is narrowed, so the binder itself stays uniform.
 */
export const UNIFORM_KIND_SETTERS: Record<UserUniformKind, UniformKindSetter> =
  {
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

/** Port consumed by the user-data controller; the Babylon adapter implements it. */
export interface UniformBinderPort {
  attach(target: UniformBindingTarget | null): void;
  apply(binding: UniformBinding): void;
  applyAll(bindings: readonly UniformBinding[]): void;
}

/**
 * Applies definition values to whatever material is currently attached.
 *
 * Attaching a new material is a scene concern (materials are rebuilt on every
 * compile); the controller re-applies all current values right after each
 * attach so a fresh effect starts from the document, not from GPU defaults.
 */
export class UniformBinder implements UniformBinderPort, UniformSetterContext {
  private readonly textures: TextureResolver;
  private target: UniformBindingTarget | null = null;

  constructor(textures: TextureResolver) {
    this.textures = textures;
  }

  attach(target: UniformBindingTarget | null): void {
    this.target = target;
  }

  apply(binding: UniformBinding): void {
    const target = this.target;
    if (!target) return;

    UNIFORM_KIND_SETTERS[binding.kind](target, binding, this);
  }

  applyAll(bindings: readonly UniformBinding[]): void {
    for (const binding of bindings) this.apply(binding);
  }

  resolveTexture(definitionId: string): BaseTexture | null {
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

function bindTexture(
  target: UniformBindingTarget,
  binding: UniformBinding,
  context: UniformSetterContext,
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

/**
 * Babylon adapter for `UniformBindingTarget`. The only place in the user-data
 * feature that calls into a real `ShaderMaterial`.
 */
export class ShaderMaterialBindingTarget implements UniformBindingTarget {
  private readonly material: ShaderMaterial;

  constructor(material: ShaderMaterial) {
    this.material = material;
  }

  setFloat(name: string, value: number): void {
    this.material.setFloat(name, value);
  }

  setInt(name: string, value: number): void {
    this.material.setInt(name, value);
  }

  setVector2(name: string, value: UserVector2Value): void {
    this.material.setVector2(name, new Vector2(value.x, value.y));
  }

  setVector3(name: string, value: UserVector3Value): void {
    this.material.setVector3(name, new Vector3(value.x, value.y, value.z));
  }

  setVector4(name: string, value: UserVector4Value): void {
    this.material.setVector4(
      name,
      new Vector4(value.x, value.y, value.z, value.w),
    );
  }

  setColor3(name: string, value: UserColor3Value): void {
    this.material.setColor3(name, new Color3(value.r, value.g, value.b));
  }

  setColor4(name: string, value: UserColor4Value): void {
    this.material.setColor4(
      name,
      new Color4(value.r, value.g, value.b, value.a),
    );
  }

  setTexture(name: string, texture: BaseTexture): void {
    this.material.setTexture(name, texture);
  }
}
