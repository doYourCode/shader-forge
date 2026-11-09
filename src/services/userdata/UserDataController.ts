import {
  createEmptyUserDataDocument,
  GLSL_RESERVED_WORDS,
  hasTextureContent,
  isSamplerKind,
  isValueForKind,
  validateUniformName,
  type NameValidationReason,
  type NameValidationResult,
  type UserDataDocument,
  type UserTextureSource,
  type UserUniformDefinition,
  type UserUniformKind,
  type UserUniformStage,
  type UserUniformValue,
} from '@/core/models/userUniform';
import { defaultUniformValue } from '@/core/constants/userUniformKinds';
import { assembleUserData } from '@/core/shader/uniformCodegen';
import {
  SHADER_ATTRIBUTES,
  SHADER_SAMPLERS,
  SHADER_SAMPLER_NAMES,
  SHADER_UNIFORMS,
  SHADER_UNIFORM_NAMES,
} from '@/services/babylon/preview/MaterialController';
import type {
  MaterialBlueprint,
  ShaderSource,
} from '@/services/babylon/preview/PreviewTypes';
import {
  toUniformBinding,
  type UniformBindingTarget,
  type UniformBinderPort,
} from './UniformBinder';
import type { TextureRegistryPort } from './TextureRegistry';

/**
 * Names the engine already owns. Imported (never copied) from the material
 * factory so the shader contract and the validation cannot drift apart.
 */
export const BUILTIN_RESERVED_UNIFORM_NAMES: ReadonlySet<string> = new Set([
  ...Object.values(SHADER_UNIFORM_NAMES),
  ...Object.values(SHADER_SAMPLER_NAMES),
  ...SHADER_UNIFORMS,
  ...SHADER_SAMPLERS,
  ...SHADER_ATTRIBUTES,
]);

const RESERVED_UNIFORM_NAMES: ReadonlySet<string> = new Set([
  ...GLSL_RESERVED_WORDS,
  ...BUILTIN_RESERVED_UNIFORM_NAMES,
]);

/** Structural edits recompile once the user stops editing. */
export const USER_DATA_COMPILE_DEBOUNCE_MS = 300;

/** Scene-scoped GPU collaborators, attached by the scene manager. */
export interface UserDataGpuPort {
  readonly textures: TextureRegistryPort;
  readonly binder: UniformBinderPort;
}

export interface UserDataControllerDeps {
  /** The current vertex/fragment documents, read when a blueprint is built. */
  getSources: () => ShaderSource;
  /** Wired to the preview compile pipeline by the editor composable. */
  onCompileRequested: (blueprint: MaterialBlueprint) => void;
  debounceMs?: number;
  /** Injectable debounce so tests do not depend on wall-clock time. */
  schedule?: (callback: () => void, delayMs: number) => () => void;
}

export type UserDataCommandReason = NameValidationReason | 'not-found';

export type UserDataCommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: UserDataCommandReason };

export type AddUserUniformResult =
  | { readonly ok: true; readonly definition: UserUniformDefinition }
  | { readonly ok: false; readonly reason: UserDataCommandReason };

const NOT_FOUND: UserDataCommandResult = { ok: false, reason: 'not-found' };

/**
 * Orchestrates the two user-data command paths:
 *
 * - value edits mutate the document and bind live, never recompiling;
 * - structural edits (add/remove/rename/re-kind/retarget) mutate the document,
 *   sync the texture registry and request a debounced recompile.
 *
 * It owns the document but knows nothing about Babylon: the scene supplies
 * `UserDataGpuPort` implementations and the composable supplies the sources
 * and the compile request.
 */
export class UserDataController {
  private readonly deps: UserDataControllerDeps;
  private readonly document: UserDataDocument;
  /**
   * Sampler definitions whose texture must be disposed once the rebuilt
   * material no longer references it. Releasing immediately would make the
   * live material unready (Babylon rejects disposed textures), blanking the
   * preview until the debounced recompile lands.
   */
  private readonly pendingTextureReleases = new Set<string>();
  private gpu: UserDataGpuPort | null = null;
  private cancelScheduledCompile: (() => void) | null = null;
  private nextId = 1;
  private disposed = false;

  constructor(
    deps: UserDataControllerDeps,
    document: UserDataDocument = createEmptyUserDataDocument(),
  ) {
    this.deps = deps;
    this.document = document;
  }

  get doc(): UserDataDocument {
    return this.document;
  }

  /** Attaches (or detaches, with null) the scene-scoped GPU collaborators. */
  attachGpu(gpu: UserDataGpuPort | null): void {
    this.gpu = gpu;
    // Releases queued for a previous scene died with its registry.
    this.pendingTextureReleases.clear();
    if (gpu) this.loadCurrentTextures();
  }

  /**
   * Binds the new material after every `MaterialController.apply`. The binder
   * re-applies the whole document so a fresh effect never keeps GPU defaults.
   */
  onMaterialApplied(target: UniformBindingTarget | null): void {
    if (this.disposed) return;

    const gpu = this.gpu;
    if (!gpu) return;

    gpu.binder.attach(target);
    gpu.binder.applyAll(this.bindings());
    this.flushTextureReleases(gpu);
  }

  validateName(name: string, exceptId?: string): NameValidationResult {
    const taken = new Set<string>();
    for (const definition of this.document.definitions) {
      if (definition.id !== exceptId) taken.add(definition.name);
    }

    return validateUniformName(name, taken, RESERVED_UNIFORM_NAMES);
  }

  /** Projects the document onto assembled GLSL plus the material extras. */
  buildBlueprint(
    sources: ShaderSource = this.deps.getSources(),
  ): MaterialBlueprint {
    const assembly = assembleUserData(
      this.document,
      sources.vertex,
      sources.fragment,
    );

    return {
      vertex: assembly.vertex,
      fragment: assembly.fragment,
      extraUniforms: this.document.definitions
        .filter((definition) => !isSamplerKind(definition.kind))
        .map((definition) => definition.name),
      extraSamplers: this.document.definitions
        .filter((definition) => isSamplerKind(definition.kind))
        .map((definition) => definition.name),
      userData: assembly.record,
    };
  }

  add(request: {
    name: string;
    kind: UserUniformKind;
    stages?: UserUniformStage;
  }): AddUserUniformResult {
    const validation = this.validateName(request.name);
    if (!validation.ok) return { ok: false, reason: validation.reason };

    const definition: UserUniformDefinition = {
      id: `user-${this.nextId++}`,
      name: request.name,
      kind: request.kind,
      stages: request.stages ?? 'fragment',
      value: defaultUniformValue(request.kind),
    };

    this.document.definitions.push(definition);
    this.bumpRevision();
    this.syncTexture(definition);
    this.scheduleCompile();

    return { ok: true, definition };
  }

  remove(id: string): UserDataCommandResult {
    const index = this.document.definitions.findIndex(
      (definition) => definition.id === id,
    );
    if (index < 0) return NOT_FOUND;

    const [definition] = this.document.definitions.splice(index, 1);
    this.bumpRevision();

    if (definition && isSamplerKind(definition.kind)) {
      this.queueTextureRelease(definition.id);
    }

    this.scheduleCompile();
    return { ok: true };
  }

  rename(id: string, name: string): UserDataCommandResult {
    const definition = this.find(id);
    if (!definition) return NOT_FOUND;
    if (definition.name === name) return { ok: true };

    const validation = this.validateName(name, id);
    if (!validation.ok) return { ok: false, reason: validation.reason };

    definition.name = name;
    this.bumpRevision();
    this.scheduleCompile();
    return { ok: true };
  }

  changeKind(id: string, kind: UserUniformKind): UserDataCommandResult {
    const definition = this.find(id);
    if (!definition) return NOT_FOUND;
    if (definition.kind === kind) return { ok: true };

    if (isSamplerKind(definition.kind)) {
      this.queueTextureRelease(definition.id);
    }

    definition.kind = kind;
    definition.value = defaultUniformValue(kind);
    this.bumpRevision();
    this.syncTexture(definition);
    this.scheduleCompile();
    return { ok: true };
  }

  changeStages(id: string, stages: UserUniformStage): UserDataCommandResult {
    const definition = this.find(id);
    if (!definition) return NOT_FOUND;
    if (definition.stages === stages) return { ok: true };

    definition.stages = stages;
    this.bumpRevision();
    this.scheduleCompile();
    return { ok: true };
  }

  /**
   * Live value edit: updates the document and the bound GPU value only. The
   * generated declarations do not change, so no recompile is requested.
   */
  setValue(id: string, value: UserUniformValue): UserDataCommandResult {
    const definition = this.find(id);
    if (!definition) return NOT_FOUND;
    if (!isValueForKind(definition.kind, value)) {
      return { ok: false, reason: 'invalid' };
    }

    definition.value = value;
    this.bumpRevision();
    this.applyValue(definition);
    return { ok: true };
  }

  /** Cancels pending work and detaches the scene without losing the document. */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.cancelScheduledCompile?.();
    this.cancelScheduledCompile = null;
    this.pendingTextureReleases.clear();
    this.gpu = null;
  }

  private find(id: string): UserUniformDefinition | undefined {
    return this.document.definitions.find(
      (definition) => definition.id === id,
    );
  }

  private bumpRevision(): void {
    this.document.revision += 1;
  }

  /**
   * Bindable snapshot. Samplers without a source are skipped so clearing a
   * URL never re-binds the texture left over from the previous value.
   */
  private bindings() {
    return this.document.definitions
      .filter(
        (definition) =>
          !isSamplerKind(definition.kind) ||
          hasTextureContent(definition.value),
      )
      .map((definition) => toUniformBinding(definition));
  }

  private applyValue(definition: UserUniformDefinition): void {
    const gpu = this.gpu;
    if (!gpu) return;

    if (isSamplerKind(definition.kind)) {
      this.syncTexture(definition);
      return;
    }

    gpu.binder.apply(toUniformBinding(definition));
  }

  private loadCurrentTextures(): void {
    for (const definition of this.document.definitions) {
      this.syncTexture(definition);
    }
  }

  /**
   * Starts loading the texture backing a sampler definition.
   *
   * An empty source is deliberately a no-op: the already loaded texture stays
   * registered (and bound to the live material) until the definition is
   * removed, re-kinded or the scene is disposed. Disposing it here would make
   * Babylon mark the material unready, blanking the preview for good.
   */
  private syncTexture(definition: UserUniformDefinition): void {
    const gpu = this.gpu;
    if (!gpu || !isSamplerKind(definition.kind)) return;
    if (!hasTextureContent(definition.value)) return;

    const kind = definition.kind;
    const source = definition.value as UserTextureSource;

    // A fresh load owns the definition id again; a queued disposal for it is
    // stale and must not reach the new texture.
    this.pendingTextureReleases.delete(definition.id);

    void gpu.textures
      .load(definition.id, kind, source)
      .then((texture) => {
        if (!texture || this.disposed || this.gpu !== gpu) return;
        if (definition.value !== source) return;

        gpu.binder.apply(toUniformBinding(definition));
      });
  }

  /** Defers disposal until the rebuilt material stops using the texture. */
  private queueTextureRelease(definitionId: string): void {
    if (!this.gpu) return;
    this.pendingTextureReleases.add(definitionId);
  }

  private flushTextureReleases(gpu: UserDataGpuPort): void {
    if (this.pendingTextureReleases.size === 0) return;

    for (const definitionId of this.pendingTextureReleases) {
      gpu.textures.release(definitionId);
    }
    this.pendingTextureReleases.clear();
  }

  private scheduleCompile(): void {
    if (this.disposed) return;

    this.cancelScheduledCompile?.();
    const schedule = this.deps.schedule ?? defaultSchedule;
    const delayMs = this.deps.debounceMs ?? USER_DATA_COMPILE_DEBOUNCE_MS;

    this.cancelScheduledCompile = schedule(() => {
      this.cancelScheduledCompile = null;
      if (this.disposed) return;

      this.deps.onCompileRequested(this.buildBlueprint());
    }, delayMs);
  }
}

function defaultSchedule(callback: () => void, delayMs: number): () => void {
  const handle = setTimeout(callback, delayMs);
  return () => clearTimeout(handle);
}
