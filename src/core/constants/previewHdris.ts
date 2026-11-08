import peppermintUrl from '@/assets/hdri/peppermint_powerplant_2k.hdr?url';
import woodenStudioUrl from '@/assets/hdri/wooden_studio_17_2k.hdr?url';
import type { PreviewHdri } from '@/core/models/previewHdri';

const defaultHdri: PreviewHdri = {
  id: 'wooden-studio-17',
  label: 'Wooden Studio 17',
  url: woodenStudioUrl,
};

/**
 * HDR environment maps available in the scene viewer. Adding another HDR is a
 * one-line change: import its URL and append an entry to this list.
 */
export const previewHdris: readonly PreviewHdri[] = [
  defaultHdri,
  {
    id: 'peppermint-powerplant',
    label: 'Peppermint Powerplant',
    url: peppermintUrl,
  },
];

export const defaultPreviewHdri = defaultHdri;

export function findPreviewHdri(id: string): PreviewHdri | undefined {
  return previewHdris.find((hdri) => hdri.id === id);
}
