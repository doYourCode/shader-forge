import type { UniformBindingTarget } from '@/services/userdata/UniformBinding';
import { TextureUnitAllocator } from './TextureUnitAllocator';
import type {
  UserColor3Value,
  UserColor4Value,
  UserVector2Value,
  UserVector3Value,
  UserVector4Value,
} from '@/core/models/userUniform';

/**
 * WebGL 2 adapter for the user-data binder.
 *
 * Uniform locations and texture units are program-scoped, so one target is
 * created per successful link. The binder re-applies the whole document right
 * after attaching, which also gives every sampler its unit and texture before
 * the first frame of the new program.
 */
export class SandboxUniformBindingTarget implements UniformBindingTarget<WebGLTexture> {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();
  private readonly units: TextureUnitAllocator;

  constructor(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    units: TextureUnitAllocator = new TextureUnitAllocator(0),
  ) {
    this.gl = gl;
    this.program = program;
    this.units = units;
  }

  setFloat(name: string, value: number): void {
    const location = this.location(name);
    if (location) this.gl.uniform1f(location, value);
  }

  setInt(name: string, value: number): void {
    const location = this.location(name);
    if (location) this.gl.uniform1i(location, value);
  }

  setVector2(name: string, value: UserVector2Value): void {
    const location = this.location(name);
    if (location) this.gl.uniform2f(location, value.x, value.y);
  }

  setVector3(name: string, value: UserVector3Value): void {
    const location = this.location(name);
    if (location) this.gl.uniform3f(location, value.x, value.y, value.z);
  }

  setVector4(name: string, value: UserVector4Value): void {
    const location = this.location(name);
    if (location) {
      this.gl.uniform4f(location, value.x, value.y, value.z, value.w);
    }
  }

  setColor3(name: string, value: UserColor3Value): void {
    const location = this.location(name);
    if (location) this.gl.uniform3f(location, value.r, value.g, value.b);
  }

  setColor4(name: string, value: UserColor4Value): void {
    const location = this.location(name);
    if (location) {
      this.gl.uniform4f(location, value.r, value.g, value.b, value.a);
    }
  }

  setTexture(name: string, texture: WebGLTexture): void {
    // An optimized-out sampler has no unit to bind; leaving the texture
    // unbound also keeps the unit budget for samplers that are actually read.
    const location = this.location(name);
    if (!location) return;

    const unit = this.unitFor(name);
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Resolves (and caches) a location, making the program current first. */
  private location(name: string): WebGLUniformLocation | null {
    const cached = this.locations.get(name);
    if (cached !== undefined) return cached;

    this.gl.useProgram(this.program);
    const location = this.gl.getUniformLocation(this.program, name);
    this.locations.set(name, location);
    return location;
  }

  private unitFor(name: string): number {
    return this.units.unitFor(name);
  }
}
