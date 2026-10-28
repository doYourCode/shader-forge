export interface WebGpuAvailability {
  supported: boolean;
  /** Human-readable reason when unsupported */
  reason?: string;
}

export class WebGpuService {
  private cached: WebGpuAvailability | null = null;

  public async check(): Promise<WebGpuAvailability> {
    if (this.cached) return this.cached;

    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      this.cached = {
        supported: false,
        reason: 'This browser does not expose the WebGPU API.',
      };
      return this.cached;
    }

    try {
      const adapter = await (navigator as Navigator & {
        gpu: { requestAdapter: () => Promise<unknown | null> };
      }).gpu.requestAdapter();

      if (!adapter) {
        this.cached = {
          supported: false,
          reason: 'No compatible GPU adapter was found.',
        };
      } else {
        this.cached = { supported: true };
      }
    } catch (err) {
      this.cached = {
        supported: false,
        reason: `WebGPU init failed: ${(err as Error).message}`,
      };
    }

    return this.cached;
  }
}

export const webGpuService = new WebGpuService();