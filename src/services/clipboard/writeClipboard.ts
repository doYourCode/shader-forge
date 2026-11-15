/**
 * Copies text to the system clipboard.
 *
 * `navigator.clipboard` only exists in a secure context (https or localhost),
 * so the selection-based fallback keeps the copy button working when the app is
 * previewed over plain http. Returns false when both paths fail: the caller
 * surfaces that as a failed copy instead of failing silently.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or no usable clipboard: fall through to the fallback.
  }

  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.opacity = '0';
  document.body.append(area);

  try {
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
