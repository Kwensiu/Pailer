import { createSignal, createEffect, on, Setter, onMount, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ScoopPackage, ScoopInfo } from '../types/scoop';
import { usePackageOperations } from './usePackageOperations';
import { usePackageInfo } from './usePackageInfo';
import { OperationNextStep } from '../types/operations';

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

  // 同步搜索内容到 sessionStorage
  createEffect(() => {
    const term = searchTerm();
    if (term) {
      sessionStorage.setItem('searchTerm', term);
    } else {
      sessionStorage.removeItem('searchTerm');
    }
  });

  // 同步分页状态到 sessionStorage
  createEffect(() => {
    const tab = activeTab();
    sessionStorage.setItem('searchActiveTab', tab);
  });

  // 同步搜索结果到 sessionStorage
  createEffect(() => {
    const currentResults = results();
    const term = searchTerm();
    if (term && currentResults.length > 0) {
      sessionStorage.setItem('searchResults', JSON.stringify(currentResults));
      sessionStorage.setItem('searchResultsTerm', term);
      sessionStorage.setItem('searchResultsVersion', cacheVersion().toString());
    } else {
      // 清空搜索时清理 sessionStorage
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

    currentSearchController = new AbortController();
    const { signal } = currentSearchController;

    setLoading(true);
    setError(null);
    try {
      const response = await invoke<{ packages: ScoopPackage[]; is_cold: boolean }>(
        'search_scoop',
        {
          term: searchTerm(),
        }
      );
      if (!signal.aborted || force) {
        setResults(response.packages);
        searchResultsCache = response.packages;
        currentSearchTermCache = searchTerm();
        currentCacheVersion = cacheVersion();
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
    
    // 首先尝试从 sessionStorage 恢复
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
        // 如果解析失败，清除损坏的数据
        sessionStorage.removeItem('searchResults');
        sessionStorage.removeItem('searchResultsTerm');
        sessionStorage.removeItem('searchResultsVersion');
        // 清除内存缓存，强制重新搜索
        searchResultsCache = null;
        currentSearchTermCache = null;
        handleSearch();
      }
    }
    // 如果 sessionStorage 没有有效数据，尝试内存缓存
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
        // 清理内存缓存，让 sessionStorage 优先
        searchResultsCache = null;
        currentSearchTermCache = null;
        setLoading(false);
        setError(null);
        return;
      }

      // 检查是否有有效的缓存，如果有则不清理内存缓存
      const hasValidCache = 
        searchResultsCache &&
        currentSearchTermCache === searchTerm() &&
        currentCacheVersion === cacheVersion();
      
      if (!hasValidCache) {
        // 清理内存缓存，确保新搜索词使用 sessionStorage 或重新搜索
        searchResultsCache = null;
        currentSearchTermCache = null;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          handleSearch();
        }, 600);
      }
      // 有有效缓存时，不设置 debounce timer
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
    if (bucketFilter()) {
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
