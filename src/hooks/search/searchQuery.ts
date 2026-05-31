export interface ParsedSearch {
  appName: string;
  bucketName?: string;
  forceAppMatch: boolean;
  forceBucketMatch: boolean;
}

/**
 * Parse search format: supports app_name/bucket and 'app_name'/'bucket' formats
 *
 * Supported formats:
 * - 7zip: normal search
 * - 7zip/ai: bucket-limited search (bucket name contains "ai")
 * - 7zip/: all buckets search (same as normal search)
 * - '7zip'/'ai': force exact match
 *
 * Notes:
 * - "/bucket" (without app name) will return empty results
 * - Does not support multiple slashes input, such as "app/bucket/extra"
 */
export function parseSearchFormat(input: string): ParsedSearch {
  const trimmed = input.trim();

  const quoteMatch = trimmed.match(/^(['"])(.*?)\1\s*\/\s*(['"])(.*?)\3$/);
  if (quoteMatch) {
    return {
      appName: quoteMatch[2],
      bucketName: quoteMatch[4],
      forceAppMatch: true,
      forceBucketMatch: true,
    };
  }

  const slashIndex = trimmed.indexOf('/');
  if (slashIndex !== -1) {
    const appPart = trimmed.substring(0, slashIndex).trim();
    const bucketPart = trimmed.substring(slashIndex + 1).trim();

    return {
      appName: appPart,
      bucketName: bucketPart || undefined,
      forceAppMatch: false,
      forceBucketMatch: false,
    };
  }

  return {
    appName: trimmed,
    bucketName: undefined,
    forceAppMatch: false,
    forceBucketMatch: false,
  };
}
