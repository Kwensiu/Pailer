import { t } from '../i18n';

interface MappedError {
  key: string;
  params?: Record<string, string>;
}

// Scoop error patterns to i18n keys
const SCOOP_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  key: string;
  extractParams?: (match: RegExpMatchArray) => Record<string, string>;
}> = [
  {
    pattern: /bucket ['"](.+?)['"] already exists/i,
    key: 'bucket.errors.alreadyExists',
    extractParams: (m) => ({ name: m[1] }),
  },
  {
    pattern: /bucket ['"](.+?)['"] does not exist/i,
    key: 'bucket.errors.notFound',
    extractParams: (m) => ({ name: m[1] }),
  },
  {
    pattern: /failed to clone repository/i,
    key: 'bucket.errors.cloneFailed',
  },
  {
    pattern: /could not find (?:bucket|repository)/i,
    key: 'bucket.errors.notFound',
  },
  {
    pattern: /network|connection.*(?:failed|refused|timeout)/i,
    key: 'errors.network',
  },
  {
    pattern: /permission denied|access is denied/i,
    key: 'errors.permission',
  },
];

/**
 * Map Scoop CLI error message to i18n key.
 * Returns null if no pattern matches (use raw message as fallback).
 */
export function mapScoopError(message: string): MappedError | null {
  for (const { pattern, key, extractParams } of SCOOP_ERROR_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        key,
        params: extractParams?.(match),
      };
    }
  }
  return null;
}

/**
 * Get localized error message, fallback to raw message.
 */
export function getLocalizedError(message: string): string {
  const mapped = mapScoopError(message);
  if (mapped) {
    return t(mapped.key, mapped.params);
  }
  return message;
}
