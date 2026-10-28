import { onMounted, ref } from 'vue';
import { webGpuService } from '@/services/webgpu/WebGpuService';

export function useWebGpuAvailability() {
  const supported = ref<boolean | null>(null); // null = still checking
  const reason = ref<string | null>(null);

  onMounted(async () => {
    const result = await webGpuService.check();
    supported.value = result.supported;
    reason.value = result.reason ?? null;
  });

  return { supported, reason };
}