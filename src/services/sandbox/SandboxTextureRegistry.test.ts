import { describe, expect, it, vi } from 'vitest';

import type { PreviewTexture } from '@/core/models/previewTexture';
import type { UserTextureSource } from '@/core/models/userUniform';
import {
  SandboxTextureRegistry,
  type SandboxImageLoader,
} from './SandboxTextureRegistry';
import type { ObjectUrlProvider } from '@/services/userdata/TextureSource';

const TEXTURE_2D = 0x0de1;
const TEXTURE0 = 0x84c0;
const ACTIVE_TEXTURE = 0x84e0;
const TEXTURE_BINDING_2D = 0x8069;
const RGBA = 0x1908;
const UNSIGNED_BYTE = 0x1401;
const UNPACK_FLIP_Y_WEBGL = 0x9240;
const TEXTURE_MIN_FILTER = 0x2801;
const TEXTURE_MAG_FILTER = 0x2800;
const TEXTURE_WRAP_S = 0x2802;
const TEXTURE_WRAP_T = 0x2803;
const LINEAR_MIPMAP_LINEAR = 0x2703;
const LINEAR = 0x2601;
const REPEAT = 0x2901;

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function createHarness() {
  let nextTexture = 1;
  const textures = new Map<number, object>();
  let activeUnit = TEXTURE0;
  let boundTexture: WebGLTexture | null = null;
  const gl = {
    TEXTURE_2D,
    TEXTURE0,
    ACTIVE_TEXTURE,
    TEXTURE_BINDING_2D,
    RGBA,
    UNSIGNED_BYTE,
    UNPACK_FLIP_Y_WEBGL,
    TEXTURE_MIN_FILTER,
    TEXTURE_MAG_FILTER,
    TEXTURE_WRAP_S,
    TEXTURE_WRAP_T,
    LINEAR_MIPMAP_LINEAR,
    LINEAR,
    REPEAT,
    createTexture: vi.fn(() => {
      const texture = { id: nextTexture++ };
      textures.set(texture.id, texture);
      return texture as unknown as WebGLTexture;
    }),
    deleteTexture: vi.fn(),
    activeTexture: vi.fn((unit: number) => {
      activeUnit = unit;
    }),
    bindTexture: vi.fn((_target: number, texture: WebGLTexture | null) => {
      boundTexture = texture;
    }),
    getParameter: vi.fn((pname: number) =>
      pname === ACTIVE_TEXTURE ? activeUnit : boundTexture,
    ),
    pixelStorei: vi.fn(),
    texImage2D: vi.fn(),
    generateMipmap: vi.fn(),
    texParameteri: vi.fn(),
  } as unknown as WebGL2RenderingContext;

  const objectUrls: ObjectUrlProvider = {
    createObjectUrl: vi.fn(() => 'blob:user-file'),
    revokeObjectUrl: vi.fn(),
  };
  const loadImage = vi.fn<SandboxImageLoader>(() =>
    Promise.resolve({} as TexImageSource),
  );
  const onTextureReady = vi.fn();
  const catalog = new Map<string, PreviewTexture>([
    [
      'checker',
      {
        id: 'checker',
        label: 'Checker',
        url: '/textures/checker.png',
        sampler: 'sampler2D',
        format: 'image',
      },
    ],
  ]);
  const lookup = vi.fn((id: string) => catalog.get(id));

  const registry = new SandboxTextureRegistry(gl, lookup, {
    objectUrls,
    loadImage,
    onTextureReady,
  });

  return {
    registry,
    gl,
    objectUrls,
    loadImage,
    onTextureReady,
    textures,
  };
}

const URL_SOURCE: UserTextureSource = { kind: 'url', url: '/a.png' };

describe('SandboxTextureRegistry', () => {
  it('loads a URL into a WebGL texture and notifies the preview', async () => {
    const { registry, gl, loadImage, onTextureReady, textures } =
      createHarness();

    const texture = await registry.load('u1', 'sampler2D', URL_SOURCE);
    // `onTextureReady` is queued after the controller's binding reaction.
    await Promise.resolve();

    expect(loadImage).toHaveBeenCalledWith('/a.png');
    expect(texture).not.toBeNull();
    expect(registry.textureFor('u1')).toBe(texture);
    expect(textures.size).toBe(1);
    expect(gl.texImage2D).toHaveBeenCalledTimes(1);
    expect(gl.generateMipmap).toHaveBeenCalledWith(TEXTURE_2D);
    expect(onTextureReady).toHaveBeenCalledTimes(1);
  });

  it('restores the upload unit binding so live samplers are not clobbered', async () => {
    const { registry, gl } = createHarness();
    const liveSamplerTexture = {} as WebGLTexture;

    gl.bindTexture(TEXTURE_2D, liveSamplerTexture);
    await registry.load('u1', 'sampler2D', URL_SOURCE);

    expect(gl.getParameter(TEXTURE_BINDING_2D)).toBe(liveSamplerTexture);
  });

  it('notifies after the load reaction so bindings land before the redraw', async () => {
    const { registry, onTextureReady } = createHarness();
    const order: string[] = [];
    onTextureReady.mockImplementation(() => order.push('redraw'));

    const load = registry
      .load('u1', 'sampler2D', URL_SOURCE)
      .then(() => order.push('bound'));

    await load;
    await Promise.resolve();

    expect(order).toEqual(['bound', 'redraw']);
  });

  it('tracks and revokes the ObjectURL of an uploaded file', async () => {
    const { registry, objectUrls } = createHarness();
    const source: UserTextureSource = {
      kind: 'file',
      file: new File(['x'], 'a.png'),
    };

    await registry.load('u1', 'sampler2D', source);
    registry.release('u1');

    expect(objectUrls.createObjectUrl).toHaveBeenCalledTimes(1);
    expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:user-file');
  });

  it('resolves repository textures through the injected catalog', async () => {
    const { registry, loadImage } = createHarness();

    await registry.load('u1', 'sampler2D', {
      kind: 'repository',
      textureId: 'checker',
    });

    expect(loadImage).toHaveBeenCalledWith('/textures/checker.png');
  });

  it('rejects a repository texture with the wrong sampler', async () => {
    const { registry, loadImage } = createHarness();

    const texture = await registry.load('u1', 'samplerCube', {
      kind: 'repository',
      textureId: 'checker',
    });

    expect(texture).toBeNull();
    expect(loadImage).not.toHaveBeenCalled();
  });

  it('rejects samplerCube and keeps an existing texture released', async () => {
    const { registry, loadImage } = createHarness();

    await registry.load('u1', 'sampler2D', URL_SOURCE);
    const texture = await registry.load('u1', 'samplerCube', URL_SOURCE);

    expect(texture).toBeNull();
    expect(registry.textureFor('u1')).toBeNull();
    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('lets the latest request win without leaking the retired texture', async () => {
    const { registry, loadImage, onTextureReady } = createHarness();
    const first = deferred<TexImageSource>();
    const second = deferred<TexImageSource>();
    loadImage
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const firstLoad = registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/first.png',
    });
    const secondLoad = registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/second.png',
    });

    first.resolve({} as TexImageSource);
    await expect(firstLoad).resolves.toBeNull();

    second.resolve({} as TexImageSource);
    const texture = await secondLoad;
    await Promise.resolve();

    expect(texture).not.toBeNull();
    expect(registry.textureFor('u1')).toBe(texture);
    expect(onTextureReady).toHaveBeenCalledTimes(1);
  });

  it('settles with null and revokes the URL when loading fails', async () => {
    const { registry, loadImage, objectUrls, onTextureReady } = createHarness();
    loadImage.mockRejectedValueOnce(new Error('missing'));

    const texture = await registry.load('u1', 'sampler2D', {
      kind: 'file',
      file: new File(['x'], 'a.png'),
    });

    expect(texture).toBeNull();
    expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:user-file');
    expect(onTextureReady).not.toHaveBeenCalled();
  });

  it('disposes the current texture and URL with the registry', async () => {
    const { registry, gl, objectUrls } = createHarness();

    await registry.load('u1', 'sampler2D', {
      kind: 'file',
      file: new File(['x'], 'a.png'),
    });
    registry.dispose();

    expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
    expect(objectUrls.revokeObjectUrl).toHaveBeenCalledWith('blob:user-file');
    expect(registry.textureFor('u1')).toBeNull();
  });
});
