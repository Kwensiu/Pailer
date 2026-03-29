export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const INVISIBLE_URL_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
const ANSI_ESCAPE = /\x1B\[[0-9;]*[A-Za-z]/g;

export function sanitizeExternalUrlText(value?: string | null): string {
  if (!value) return '';

  return value
    .replace(INVISIBLE_URL_CHARS, '')
    .replace(CONTROL_CHARS, '')
    .replace(ANSI_ESCAPE, '')
    .trim()
    .replace(/^[<\[\(\{"'`\s]+|[>\]\)\}"'`\s]+$/g, '');
}

/**
 * Normalize external URLs from manifests so anchors remain clickable.
 * Removes invisible/control characters and wrapper punctuation, then extracts the first http(s) URL.
 */
export function normalizeExternalUrl(value?: string | null): string | null {
  const cleaned = sanitizeExternalUrlText(value);
  if (!cleaned) return null;

  const matched = cleaned.match(/https?:\/\/[^\s<>"']+/i);
  const candidate = matched?.[0] ?? cleaned;
  const normalized = candidate.replace(/[),.;:!?]+$/g, '');

  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
