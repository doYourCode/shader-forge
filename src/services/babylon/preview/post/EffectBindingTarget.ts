import {
  Vector2,
  Vector3,
  Vector4,
  type BaseTexture,
  type Effect,
} from '@babylonjs/core';
import type { UniformBindingTarget } from '@/services/userdata/UniformBinding';
import type {
  UserColor3Value,
  UserColor4Value,
  UserVector2Value,
  UserVector3Value,
  UserVector4Value,
} from '@/core/models/userUniform';

/**
 * Babylon `Effect` adapter for the user-data binder. Effects expose the same
 * scalar/vector/texture setters as materials, minus the colour helpers, so
 * colours travel as their component vectors.
 */
export class EffectBindingTarget implements UniformBindingTarget<BaseTexture> {
  private readonly effect: Effect;

  constructor(effect: Effect) {
    this.effect = effect;
  }

  setFloat(name: string, value: number): void {
    this.effect.setFloat(name, value);
  }

  setInt(name: string, value: number): void {
    this.effect.setInt(name, value);
  }

  setVector2(name: string, value: UserVector2Value): void {
    this.effect.setVector2(name, new Vector2(value.x, value.y));
  }

  setVector3(name: string, value: UserVector3Value): void {
    this.effect.setVector3(name, new Vector3(value.x, value.y, value.z));
  }

  setVector4(name: string, value: UserVector4Value): void {
    this.effect.setVector4(
      name,
      new Vector4(value.x, value.y, value.z, value.w),
    );
  }

  setColor3(name: string, value: UserColor3Value): void {
    this.effect.setVector3(name, new Vector3(value.r, value.g, value.b));
  }

  setColor4(name: string, value: UserColor4Value): void {
    this.effect.setVector4(
      name,
      new Vector4(value.r, value.g, value.b, value.a),
    );
  }

  setTexture(name: string, texture: BaseTexture): void {
    this.effect.setTexture(name, texture);
  }
}
