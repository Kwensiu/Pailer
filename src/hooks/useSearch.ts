import { createSignal, createEffect, on, Setter, onMount, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ScoopPackage, ScoopInfo } from '../types/scoop';
import { usePackageOperations } from './usePackageOperations';
import { usePackageInfo } from './usePackageInfo';
import { OperationNextStep } from '../types/operations';
import { parseSearchFormat, type ParsedSearch } from './useGlobalHotkey';

interface UseSearchReturn {
  searchTerm: () => string;
  setSearchTerm: Setter<string>;
  loading: () => boolean;
  error: () => string | null;
  activeTab: () => 'packages' | 'includes';
  setActiveTab: Setter<'packages' | 'includes'>;
  resultsToShow: () => ScoopPackage[];
  packageResults: () => ScoopPackage[];
  binaryResults: () => ScoopPackage[];

  // From usePackageInfo
  selectedPackage: () => ScoopPackage | null;
  info: () => ScoopInfo | null;
  infoLoading: () => boolean;
  infoError: () => string | null;
  fetchPackageInfo: (pkg: ScoopPackage) => Promise<void>;
  closeModal: () => void;
  updateSelectedPackage: (pkg: ScoopPackage) => void;

  // From usePackageOperations (with enhanced closeOperationModal)
  operationTitle: () => string | null;
  operationNextStep: () => OperationNextStep | null;
  isScanning: () => boolean;
  handleInstall: (pkg: ScoopPackage) => void;
  handleUninstall: (pkg: ScoopPackage) => void;
  handleInstallConfirm: () => void;
  closeOperationModal: (operationId: string, wasSuccess: boolean) => Promise<void>;

  // Cleanup function
  cleanup: () => void;
  // Refresh function
  refreshSearchResults: (force?: boolean) => Promise<void>;
  // Restore search results
  restoreSearchResults: () => void;
  // Check if has cached results
  hasCachedResults: () => boolean;

  // Bucket filter
  bucketFilter: () => string;
  setBucketFilter: Setter<string>;
}

let searchResultsCache: ScoopPackage[] | null = null;
let currentSearchTermCache: string | null = null;

export function useSearch(): UseSearchReturn {
  const [searchTerm, setSearchTerm] = createSignal<string>(
    sessionStorage.getItem('searchTerm') || ''
  );

  const [error, setError] = createSignal<string | null>(null);
  const [results, setResults] = createSignal<ScoopPackage[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'packages' | 'includes'>(
    (() => {
      const stored = sessionStorage.getItem('searchActiveTab');
      return stored === 'packages' || stored === 'includes' ? stored : 'packages';
    })()
  );
  const [cacheVersion, setCacheVersion] = createSignal(0);
  const [bucketFilter, setBucketFilter] = createSignal<string>('');

  let isRestoring = false;

  // Use shared hooks
  const packageOperations = usePackageOperations();
  const packageInfo = usePackageInfo();

  let debounceTimer: ReturnType<typeof setTimeout>;
  let currentCacheVersion: number = 0;
  let currentSearchController: AbortController | null = null;

  // Sync search content to sessionStorage
  createEffect(() => {
    const term = searchTerm();
    if (term) {
      sessionStorage.setItem('searchTerm', term);
    } else {
      sessionStorage.removeItem('searchTerm');
    }
  });

  // Sync pagination state to sessionStorage
  createEffect(() => {
    const tab = activeTab();
    sessionStorage.setItem('searchActiveTab', tab);
  });

  // Sync search results to sessionStorage
  createEffect(() => {
    const currentResults = results();
    const term = searchTerm();
    if (term && currentResults.length > 0) {
      sessionStorage.setItem('searchResults', JSON.stringify(currentResults));
      sessionStorage.setItem('searchResultsTerm', term);
      sessionStorage.setItem('searchResultsVersion', cacheVersion().toString());
    } else {
      // Clear sessionStorage when search is cleared
      sessionStorage.removeItem('searchResults');
      sessionStorage.removeItem('searchResultsTerm');
      sessionStorage.removeItem('searchResultsVersion');
    }
  });

  onMount(async () => {
    restoreSearchResults();
    const unlistenBuckets = await listen('buckets-changed', () => setCacheVersion((v) => v + 1));
    const unlistenPackages = await listen('packages-refreshed', () =>
      setCacheVersion((v) => v + 1)
    );
    return () => {
      unlistenBuckets();
      unlistenPackages();
    };
  });

  // Memoized check for cached results
  const hasCachedResults = createMemo(() => {
    return Boolean(
      searchResultsCache &&
      currentSearchTermCache === searchTerm() &&
      searchTerm().trim() !== '' &&
      currentCacheVersion === cacheVersion()
    );
  });

  const handleSearch = async (force: boolean = false) => {
    if (currentSearchController && !force) {
      currentSearchController.abort();
    }

    if (isRestoring && !force) {
      return;
    }

    if (searchTerm().trim() === '') {
      setResults([]);
      searchResultsCache = null;
      currentSearchTermCache = null;
      setLoading(false);
      setError(null);
      return;
    }

    // Parse search format
    const parsedSearch: ParsedSearch = parseSearchFormat(searchTerm());
    console.log('🔍 Parsed search:', parsedSearch);

    // If search format has only bucket name without app name (like "/main"), return empty results directly
    if (parsedSearch.bucketName && !parsedSearch.appName.trim()) {
      console.log('🚫 Empty app name in bucket-only search, returning empty results');
      setResults([]);
      searchResultsCache = [];
      currentSearchTermCache = searchTerm();
      currentCacheVersion = cacheVersion();
      return;
    }

    currentSearchController = new AbortController();
    const { signal } = currentSearchController;

    setLoading(true);
    setError(null);
    try {
      // For normal search, use original search term
      // For bucket-limited search, we need to filter on frontend, so search with app name first
      const searchQuery = parsedSearch.bucketName ? parsedSearch.appName : searchTerm();

      const response = await invoke<{ packages: ScoopPackage[]; is_cold: boolean }>(
        'search_scoop',
        {
          term: searchQuery,
        }
      );

      if (!signal.aborted || force) {
        let filteredResults = response.packages;

        // Apply bucket filtering
        if (parsedSearch.bucketName) {
          filteredResults = response.packages.filter((pkg) => {
            if (parsedSearch.forceBucketMatch) {
              // Force match: bucket name must exactly equal specified name
              return pkg.source === parsedSearch.bucketName;
            } else {
              // Include match: bucket name contains specified string
              return pkg.source.toLowerCase().includes(parsedSearch.bucketName!.toLowerCase());
            }
          });
        }

        // Apply app name exact match filtering (if force match is specified)
        if (parsedSearch.forceAppMatch) {
          filteredResults = filteredResults.filter((pkg) => {
            if (parsedSearch.forceAppMatch) {
              // Force match: app name must exactly equal specified name
              return pkg.name === parsedSearch.appName;
            }
          });
        }

        setResults(filteredResults);
        searchResultsCache = filteredResults;
        currentSearchTermCache = searchTerm();
        currentCacheVersion = cacheVersion();

        console.log(`✅ Search completed: ${filteredResults.length} results found`);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
        setError('搜索失败，请检查网络或稍后重试');
      }
    } finally {
      setLoading(false);
      currentSearchController = null;
    }
  };

  // Function to refresh search results after package operations
  const refreshSearchResults = async (force: boolean = false) => {
    if (searchTerm().trim() !== '' || force) {
      await handleSearch(force);
    }
  };

  // Restore search results from cache
  const restoreSearchResults = () => {
    if (isRestoring) {
      return;
    }

    isRestoring = true;

    // First try to restore from sessionStorage
    const storedResults = sessionStorage.getItem('searchResults');
    const storedTerm = sessionStorage.getItem('searchResultsTerm');
    const storedVersion = sessionStorage.getItem('searchResultsVersion');

    if (
      storedResults &&
      storedTerm === searchTerm() &&
      storedVersion === cacheVersion().toString() &&
      searchTerm().trim() !== ''
    ) {
      try {
        const parsedResults = JSON.parse(storedResults);
        setResults(parsedResults);
        setLoading(false);
      } catch (error) {
        console.error('Failed to parse stored search results:', error);
        // If parsing fails, clear corrupted data
        sessionStorage.removeItem('searchResults');
        sessionStorage.removeItem('searchResultsTerm');
        sessionStorage.removeItem('searchResultsVersion');
        // Clear memory cache to ensure new search term uses sessionStorage or re-search
        searchResultsCache = null;
        currentSearchTermCache = null;
        handleSearch();
      }
    }
    // If sessionStorage has no valid data, try memory cache
    else if (
      searchResultsCache &&
      currentSearchTermCache === searchTerm() &&
      searchTerm().trim() !== '' &&
      currentCacheVersion === cacheVersion()
    ) {
      setResults(searchResultsCache);
      setLoading(false);
    } else if (searchTerm().trim() !== '') {
      handleSearch();
    }

    isRestoring = false;
  };

  createEffect(
    on([searchTerm], () => {
      if (isRestoring) {
        return;
      }

      if (searchTerm().trim() === '') {
        setResults([]);
        // Clear memory cache to prioritize sessionStorage
        searchResultsCache = null;
        currentSearchTermCache = null;
        setLoading(false);
        setError(null);
        return;
      }

      // Check if there is valid cache, if yes, don't clear memory cache
      const hasValidCache =
        searchResultsCache &&
        currentSearchTermCache === searchTerm() &&
        currentCacheVersion === cacheVersion();

      if (!hasValidCache) {
        // Clear memory cache to ensure new search term uses sessionStorage or re-search
        searchResultsCache = null;
        currentSearchTermCache = null;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          handleSearch();
        }, 600);
      }
      // If there is valid cache, do not set debounce timer
    })
  );

  // Cleanup function to cancel ongoing search and clear timer
  const cleanup = () => {
    clearTimeout(debounceTimer);
    if (currentSearchController) {
      currentSearchController.abort();
    }
  };

  // Enhanced close operation modal that refreshes search results
  const closeOperationModal = async (_operationId: string, wasSuccess: boolean) => {
    packageOperations.closeOperationModal(wasSuccess);
    if (wasSuccess) {
      // Refresh search results to reflect installation state changes
      await refreshSearchResults();

      // Update selectedPackage if it exists
      const currentSelected = packageInfo.selectedPackage();
      if (currentSelected) {
        const updatedPackage = results().find((p) => p.name === currentSelected.name);
        if (updatedPackage) {
          packageInfo.updateSelectedPackage(updatedPackage);
        }
      }
    }
  };

  const packageResults = () => results().filter((p) => p.match_source === 'name');
  const binaryResults = () => results().filter((p) => p.match_source === 'binary');
  const resultsToShow = () => {
    const filteredResults = activeTab() === 'packages' ? packageResults() : binaryResults();

    // Check if search format has already specified bucket limit
    const parsedSearch: ParsedSearch = parseSearchFormat(searchTerm());
    const hasSearchBucketFilter = parsedSearch.bucketName !== undefined;

    // If search format has already specified bucket, don't apply global bucket filter
    // Otherwise, apply global bucket filter
    if (!hasSearchBucketFilter && bucketFilter()) {
      return filteredResults.filter((p) => p.source === bucketFilter());
    }

    return filteredResults;
  };

  return {
    searchTerm,
    setSearchTerm,
    error,
    loading,
    activeTab,
    setActiveTab,
    resultsToShow,
    packageResults,
    binaryResults,

    // From usePackageInfo
    selectedPackage: packageInfo.selectedPackage,
    info: packageInfo.info,
    infoLoading: packageInfo.loading,
    infoError: packageInfo.error,
    fetchPackageInfo: packageInfo.fetchPackageInfo,
    closeModal: packageInfo.closeModal,
    updateSelectedPackage: packageInfo.updateSelectedPackage,

    // From usePackageOperations (with enhanced closeOperationModal)
    operationTitle: packageOperations.operationTitle,
    operationNextStep: packageOperations.operationNextStep,
    isScanning: packageOperations.isScanning,
    handleInstall: packageOperations.handleInstall,
    handleUninstall: packageOperations.handleUninstall,
    handleInstallConfirm: packageOperations.handleInstallConfirm,
    closeOperationModal,

    // Cleanup function
    cleanup,
    // Refresh function
    refreshSearchResults,
    // Restore function
    restoreSearchResults,
    // Check cached results
    hasCachedResults,
    // Bucket filter
    bucketFilter,
    setBucketFilter,
  };
}
