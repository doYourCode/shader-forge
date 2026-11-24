import type { UniformBindingTarget } from './UniformBinding';
import type {
  UserColor3Value,
  UserColor4Value,
  UserVector2Value,
  UserVector3Value,
  UserVector4Value,
} from '@/core/models/userUniform';

/**
 * Fans one user-data definition out to every live program target.
 *
 * The sandbox has a base program plus one program per post-effect pass, all
 * fed by the same document. Targets whose program does not declare a name
 * silently skip it (their location lookup returns null), so applying the whole
 * document to every target is safe.
 */
export class CompositeUniformBindingTarget<
  TTexture,
> implements UniformBindingTarget<TTexture> {
  private readonly targets: readonly UniformBindingTarget<TTexture>[];

  constructor(targets: readonly UniformBindingTarget<TTexture>[]) {
    this.targets = targets;
  }

  setFloat(name: string, value: number): void {
    for (const target of this.targets) target.setFloat(name, value);
  }

  setInt(name: string, value: number): void {
    for (const target of this.targets) target.setInt(name, value);
  }

  setVector2(name: string, value: UserVector2Value): void {
    for (const target of this.targets) target.setVector2(name, value);
  }

  setVector3(name: string, value: UserVector3Value): void {
    for (const target of this.targets) target.setVector3(name, value);
  }

  setVector4(name: string, value: UserVector4Value): void {
    for (const target of this.targets) target.setVector4(name, value);
  }

  setColor3(name: string, value: UserColor3Value): void {
    for (const target of this.targets) target.setColor3(name, value);
  }

  setColor4(name: string, value: UserColor4Value): void {
    for (const target of this.targets) target.setColor4(name, value);
  }

  setTexture(name: string, texture: TTexture): void {
    for (const target of this.targets) target.setTexture(name, texture);
  }
}
