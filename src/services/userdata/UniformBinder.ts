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
  UserVector2Value,
  UserVector3Value,
  UserVector4Value,
} from '@/core/models/userUniform';
import type { UniformBindingTarget } from './UniformBinding';

/**
 * Babylon `ShaderMaterial` adapter for the user-data binder.
 *
 * The binder itself, its ports and the kind-to-setter projection are
 * platform-neutral (`UniformBinding.ts`); this module is the only place in the
 * user-data feature that calls into a real `ShaderMaterial`.
 */
export class ShaderMaterialBindingTarget implements UniformBindingTarget<BaseTexture> {
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
