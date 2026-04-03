/**
 * Bucket search configuration constants
 */
export const BUCKET_SEARCH_CONFIG = {
  expandedSearch: {
    estimatedSizeMb: 14.0,
    totalBuckets: 54000,
  },
  defaults: {
    minimumStars: 2,
    maxResults: 48,
    sortBy: 'stars' as const,
  },
  debounceMs: 300,
} as const;
