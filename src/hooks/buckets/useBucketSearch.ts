import { createSignal, createEffect, on, createResource, Resource, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../../i18n';
import { BUCKET_SEARCH_CONFIG } from '../../components/page/buckets/BucketSearch/constants';

export interface SearchableBucket {
  name: string;
  full_name: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  apps: number;
  last_updated: string;
  is_verified: boolean;
}

export interface BucketSearchRequest {
  query?: string;
  include_expanded: boolean;
  max_results?: number;
  offset?: number; // For pagination/infinite scroll
  sort_by?: string;
  disable_chinese_buckets?: boolean;
  minimum_stars?: number;
}

export interface BucketSearchResponse {
  buckets: SearchableBucket[];
  total_count: number;
  is_expanded_search: boolean;
  expanded_list_size_mb?: number;
}

export interface ExpandedSearchInfo {
  estimated_size_mb: number;
  total_buckets: number;
  description: string;
}

export interface BucketCacheInfo {
  exists: boolean;
  local_updated_at: string | null;
  remote_updated_at: string | null;
  has_remote_update: boolean;
}

export interface BucketCacheRefreshResult {
  updated: boolean;
  skipped: boolean;
  reason: string;
  local_updated_at: string | null;
  remote_updated_at: string | null;
}

export type SearchErrorType = 'network' | 'cache' | 'unknown';

export interface SearchError {
  type: SearchErrorType;
  message: string;
  retryable: boolean;
}

interface UseBucketSearchReturn {
  // State
  searchQuery: () => string;
  setSearchQuery: (query: string) => void;
  includeExpanded: () => boolean;
  setIncludeExpanded: (include: boolean) => void;
  sortBy: () => string;
  setSortBy: (sort: string) => void;
  maxResults: () => number;
  setMaxResults: (max: number) => void;
  disableChineseBuckets: () => boolean;
  setDisableChineseBuckets: (disable: boolean) => void;
  minimumStars: () => number;
  setMinimumStars: (stars: number) => void;

  // Results
  searchResults: () => SearchableBucket[];
  totalCount: () => number;
  isExpandedSearch: () => boolean;
  expandedListSizeMb: () => number | undefined;
  isSearching: () => boolean;
  error: () => string | null;
  errorType: () => SearchErrorType;
  isRetryable: () => boolean;
  cacheExists: () => boolean;
  cacheInfo: () => BucketCacheInfo | null;
  isRefreshingCache: () => boolean;

  // Infinite scroll
  hasMore: () => boolean;
  isLoadingMore: () => boolean;
  loadMore: (neededCount?: number) => Promise<void>;

  // Default buckets
  defaultBuckets: Resource<SearchableBucket[]>;

  // Actions
  searchBuckets: (
    query?: string,
    includeExpanded?: boolean,
    maxResults?: number,
    sortBy?: string,
    disableChineseBuckets?: boolean,
    minimumStars?: number
  ) => Promise<BucketSearchResponse | undefined>;
  clearSearch: () => Promise<void>;
  loadDefaults: () => Promise<void>;
  disableExpandedSearch: () => Promise<void>;
  resetCache: () => Promise<void>;
  checkCacheStatus: () => Promise<boolean>;
  fetchCacheInfo: () => Promise<BucketCacheInfo | null>;
  refreshCommunityCache: () => Promise<BucketCacheRefreshResult | null>;
  getExpandedSearchInfo: () => Promise<ExpandedSearchInfo | null>;
  retry: () => Promise<void>;
}

export function useBucketSearch(): UseBucketSearchReturn {
  const [searchQuery, setSearchQuery] = createSignal<string>('');
  const [includeExpanded, setIncludeExpanded] = createSignal(false);
  const [sortBy, setSortBy] = createSignal<string>(BUCKET_SEARCH_CONFIG.defaults.sortBy);
  const [maxResults, setMaxResults] = createSignal<number>(
    BUCKET_SEARCH_CONFIG.defaults.maxResults
  );
  const [disableChineseBuckets, setDisableChineseBuckets] = createSignal(false);
  const [minimumStars, setMinimumStars] = createSignal(BUCKET_SEARCH_CONFIG.defaults.minimumStars);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<SearchableBucket[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);
  const [isExpandedSearch, setIsExpandedSearch] = createSignal(false);
  const [expandedListSizeMb, setExpandedListSizeMb] = createSignal<number | undefined>(undefined);
  const [error, setError] = createSignal<string | null>(null);
  const [errorType, setErrorType] = createSignal<SearchErrorType>('unknown');
  const [isRetryable, setIsRetryable] = createSignal(false);
  const [cacheExists, setCacheExists] = createSignal(false);
  const [cacheInfo, setCacheInfo] = createSignal<BucketCacheInfo | null>(null);
  const [isRefreshingCache, setIsRefreshingCache] = createSignal(false);

  // Infinite scroll state
  const [hasMore, setHasMore] = createSignal(true);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);

  // Use reactive signals instead of module-level variables to prevent cross-instance pollution
  const [cacheStatusChecked, setCacheStatusChecked] = createSignal(false);
  let lastSearchParams: Parameters<typeof searchBuckets> | null = null;

  // Classify error based on message content
  const classifyError = (err: unknown): SearchError => {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('timeout') ||
      msg.includes('connection')
    ) {
      return { type: 'network', message: msg, retryable: true };
    }
    if (msg.includes('cache')) {
      return { type: 'cache', message: msg, retryable: false };
    }
    return { type: 'unknown', message: msg, retryable: false };
  };

  // Check if cache exists on mount
  const checkCacheStatus = async () => {
    try {
      const exists = await invoke<boolean>('check_bucket_cache_exists');
      setCacheExists(exists);

      setCacheStatusChecked(true);
      return exists;
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      return false;
    }
  };

  const fetchCacheInfo = async (): Promise<BucketCacheInfo | null> => {
    try {
      const info = await invoke<BucketCacheInfo>('get_bucket_cache_info');
      setCacheInfo(info);
      setCacheExists(info.exists);
      return info;
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      return null;
    }
  };

  const refreshCommunityCache = async (): Promise<BucketCacheRefreshResult | null> => {
    setIsRefreshingCache(true);
    // Capture current query at refresh start to prevent stale query after async operations
    const queryAtStart = searchQuery().trim() || undefined;
    try {
      const result = await invoke<BucketCacheRefreshResult>('refresh_bucket_cache_if_needed', {
        disableChineseBuckets: disableChineseBuckets(),
        minimumStars: minimumStars(),
      });

      await fetchCacheInfo();

      if (result.updated && includeExpanded()) {
        await searchBuckets(queryAtStart, true);
      }

      return result;
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      return null;
    } finally {
      setIsRefreshingCache(false);
    }
  };

  // Load default buckets on initialization
  const [defaultBuckets] = createResource(async () => {
    try {
      await fetchCacheInfo();
      const buckets = await invoke<SearchableBucket[]>('get_default_buckets');
      setSearchResults(buckets);
      setTotalCount(buckets.length);
      setIsExpandedSearch(false);
      setExpandedListSizeMb(undefined);
      return buckets;
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      return [];
    }
  });

  // Get expanded search info
  const getExpandedSearchInfo = async (): Promise<ExpandedSearchInfo | null> => {
    try {
      return {
        estimated_size_mb: BUCKET_SEARCH_CONFIG.expandedSearch.estimatedSizeMb,
        total_buckets: BUCKET_SEARCH_CONFIG.expandedSearch.totalBuckets,
        description: t('bucket.search.description'),
      };
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      return null;
    }
  };

  // Perform search
  const searchBuckets = async (
    query?: string,
    includeExpandedParam?: boolean,
    maxResultsParam?: number,
    sortByParam?: string,
    disableChineseBucketsParam?: boolean,
    minimumStarsParam?: number
  ): Promise<BucketSearchResponse | undefined> => {
    setIsSearching(true);
    setError(null);
    setErrorType('unknown');
    setIsRetryable(false);

    const actualIncludeExpanded =
      includeExpandedParam !== undefined ? includeExpandedParam : includeExpanded();
    const actualMaxResults = maxResultsParam !== undefined ? maxResultsParam : maxResults();
    const actualSortBy = sortByParam !== undefined ? sortByParam : sortBy();
    const actualDisableChineseBuckets =
      disableChineseBucketsParam !== undefined
        ? disableChineseBucketsParam
        : disableChineseBuckets();
    const actualMinimumStars = minimumStarsParam !== undefined ? minimumStarsParam : minimumStars();

    // Store params for retry
    lastSearchParams = [
      query,
      includeExpandedParam,
      maxResultsParam,
      sortByParam,
      disableChineseBucketsParam,
      minimumStarsParam,
    ];

    try {
      const request: BucketSearchRequest = {
        query,
        include_expanded: actualIncludeExpanded,
        max_results: actualMaxResults,
        sort_by: actualSortBy,
        disable_chinese_buckets: actualDisableChineseBuckets,
        minimum_stars: actualMinimumStars,
      };

      const response = await invoke<BucketSearchResponse>('search_buckets', {
        request,
      });

      setSearchResults(response.buckets);
      setTotalCount(response.total_count);
      setIsExpandedSearch(response.is_expanded_search);
      setExpandedListSizeMb(response.expanded_list_size_mb);

      // Reset hasMore for new search
      setHasMore(response.buckets.length === actualMaxResults);

      // Update cache status if expanded search was performed
      if (response.is_expanded_search) {
        setCacheExists(true);
      }

      return response;
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      console.error('Bucket search failed:', classified.message);
      return undefined;
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search and return to defaults
  const clearSearch = async () => {
    setSearchQuery('');
    setSearchResults([]);
    setTotalCount(0);
    setError(null);
    setHasMore(true);

    // Reload default buckets
    await loadDefaults();
  };

  // Load more results for infinite scroll
  const loadMore = async (neededCount?: number) => {
    if (!hasMore() || isLoadingMore() || isSearching()) return;

    setIsLoadingMore(true);
    const currentResults = searchResults();
    const currentCount = currentResults.length;

    // Calculate how much to load:
    // - If neededCount provided (jump to page), load enough to cover it
    // - Otherwise load next batch
    const defaultBatchSize = maxResults();
    const targetCount = neededCount ?? currentCount + defaultBatchSize;
    const itemsToLoad = Math.max(targetCount - currentCount, defaultBatchSize);

    // Cap at a reasonable limit to avoid huge requests
    const actualLimit = Math.min(itemsToLoad, 500);

    try {
      const request: BucketSearchRequest = {
        query: searchQuery() || undefined,
        include_expanded: includeExpanded(),
        max_results: actualLimit,
        offset: currentCount,
        sort_by: sortBy(),
        disable_chinese_buckets: disableChineseBuckets(),
        minimum_stars: minimumStars(),
      };

      const response = await invoke<BucketSearchResponse>('search_buckets', {
        request,
      });

      // Append new results to existing
      setSearchResults([...currentResults, ...response.buckets]);
      setHasMore(response.buckets.length === actualLimit);
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      console.error('Failed to load more buckets:', classified.message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Disable expanded search (keep cache for session)
  const disableExpandedSearch = async () => {
    setIncludeExpanded(false);
    if (searchQuery().trim()) {
      await searchBuckets(searchQuery(), false);
    } else {
      await loadDefaults();
    }
  };

  // Reset cache and disable expanded search
  const resetCache = async () => {
    console.log('Resetting bucket search cache...');
    try {
      await invoke('clear_bucket_cache');
      setCacheExists(false);
      setCacheInfo(null);
      await disableExpandedSearch();
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
      console.error('Failed to reset cache:', classified.message);
    }
  };

  // Load defaults explicitly (for when search is reopened)
  const loadDefaults = async () => {
    try {
      await fetchCacheInfo();

      if (includeExpanded()) {
        await searchBuckets(undefined, true, undefined, 'stars');
      } else {
        const buckets = await invoke<SearchableBucket[]>('get_default_buckets');
        setSearchResults(buckets);
        setTotalCount(buckets.length);
        setIsExpandedSearch(false);
        setExpandedListSizeMb(undefined);
      }
    } catch (err) {
      const classified = classifyError(err);
      setError(classified.message);
      setErrorType(classified.type);
      setIsRetryable(classified.retryable);
    }
  };

  // Debounced search effect like in useSearch.ts
  let debounceTimer: ReturnType<typeof setTimeout>;
  const handleSearch = async () => {
    if (searchQuery().trim() === '') {
      await clearSearch();
      return;
    }
    await searchBuckets(searchQuery());
  };

  createEffect(
    on(searchQuery, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleSearch(), BUCKET_SEARCH_CONFIG.debounceMs);
    })
  );

  createEffect(() => {
    if (!cacheStatusChecked()) {
      void checkCacheStatus();
    }
  });

  onCleanup(() => clearTimeout(debounceTimer));

  return {
    // State
    searchQuery,
    setSearchQuery,
    includeExpanded,
    setIncludeExpanded,
    sortBy,
    setSortBy,
    maxResults,
    setMaxResults,
    disableChineseBuckets,
    setDisableChineseBuckets,
    minimumStars,
    setMinimumStars,

    // Results
    searchResults,
    totalCount,
    isExpandedSearch,
    expandedListSizeMb,
    isSearching,
    error,
    errorType,
    isRetryable,
    cacheExists,
    cacheInfo,
    isRefreshingCache,

    // Infinite scroll
    hasMore,
    isLoadingMore,
    loadMore,

    // Default buckets
    defaultBuckets,

    // Actions
    searchBuckets,
    clearSearch,
    loadDefaults,
    disableExpandedSearch,
    resetCache,
    checkCacheStatus,
    fetchCacheInfo,
    refreshCommunityCache,
    getExpandedSearchInfo,
    retry: async () => {
      if (lastSearchParams) {
        setError(null);
        setErrorType('unknown');
        setIsRetryable(false);
        await searchBuckets(...lastSearchParams);
      }
    },
  };
}
