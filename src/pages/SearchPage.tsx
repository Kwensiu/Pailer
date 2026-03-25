import PackageInfoModal from '../components/modals/PackageInfoModal';
import BucketInfoModal from '../components/modals/BucketInfoModal';
import OperationModal from '../components/modals/OperationModal';

import SearchBar from '../components/page/search/SearchBar';
import SearchResultsTabs from '../components/page/search/SearchResultsTabs';
import SearchResultsList from '../components/page/search/SearchResultsList';

import { createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { useSearch, createTauriSignal } from '../hooks';
import { useBuckets, type BucketInfo } from '../hooks/buckets/useBuckets';
import { searchCacheManager } from '../hooks/search/useSearchCache';
import { t } from '../i18n';
import { RefreshCw } from 'lucide-solid';

function SearchPage() {
  const {
    searchTerm,
    setSearchTerm,
    loading,
    activeTab,
    setActiveTab,
    resultsToShow,
    packageResults,
    binaryResults,
    selectedPackage,
    info,
    infoLoading,
    infoError,
    operationTitle,
    operationNextStep,
    isScanning,
    handleInstall,
    handleUninstall,
    handleInstallConfirm,
    fetchPackageInfo,
    closeModal,
    closeOperationModal,
    cleanup,
    restoreSearchResults,
    refreshSearchResults,
    bucketFilter,
    setBucketFilter,
  } = useSearch();

  const [currentPage, setCurrentPage] = createTauriSignal('searchCurrentPage', 1);
  const [uniqueBuckets, setUniqueBuckets] = createSignal<string[]>([]);
  const [refreshing, setRefreshing] = createSignal(false);
  const [selectedBucket, setSelectedBucket] = createSignal<string | null>(null);
  const [bucketInfo, setBucketInfo] = createSignal<BucketInfo | null>(null);
  const [bucketInfoLoading, setBucketInfoLoading] = createSignal(false);
  const [bucketInfoError, setBucketInfoError] = createSignal<string | null>(null);
  const [bucketGitUrlMap, setBucketGitUrlMap] = createSignal<Map<string, string>>(new Map());

  const { getBucketInfo, buckets, fetchBuckets } = useBuckets();

  // 复用 useSearch 的 AbortController 模式
  let currentBucketController: AbortController | null = null;

  // 集成全局缓存管理（复用 SearchCacheManager 模式）
  const bucketInfoCache = new Map<string, { info: BucketInfo; timestamp: number }>();
  const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
  const MAX_CACHE_SIZE = 50; // 限制缓存大小

  onMount(async () => {
    restoreSearchResults();
    await fetchBuckets();
  });

  // Listen to search result changes to update buckets list
  createEffect(() => {
    const bucketNames = [
      ...new Set([...packageResults(), ...binaryResults()].map((p) => p.source)),
    ];
    setUniqueBuckets(bucketNames);
  });

  // Build bucket git_url map from fetched buckets
  createEffect(() => {
    const allBuckets = buckets();
    const urlMap = new Map<string, string>();
    allBuckets.forEach((bucket) => {
      if (bucket.git_url) {
        urlMap.set(bucket.name, bucket.git_url);
      }
    });
    setBucketGitUrlMap(urlMap);
  });

  // Reset pagination to first page when results or tabs change
  createEffect(() => {
    resultsToShow();
    activeTab();
    setCurrentPage(1);
  });

  const handleViewBucket = async (bucketName: string) => {
    // Cancel previous request (reuse useSearch pattern)
    if (currentBucketController) {
      currentBucketController.abort();
      currentBucketController = null;
    }

    // Check cache (reuse SearchCacheManager pattern)
    const cached = bucketInfoCache.get(bucketName);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSelectedBucket(bucketName);
      setBucketInfoLoading(false);
      setBucketInfoError(null);
      setBucketInfo(cached.info);
      return;
    }

    // Limit cache size, prioritize evicting oldest entries
    if (bucketInfoCache.size >= MAX_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;

      bucketInfoCache.forEach((value, key) => {
        if (value.timestamp < oldestTimestamp) {
          oldestTimestamp = value.timestamp;
          oldestKey = key;
        }
      });

      if (oldestKey) {
        bucketInfoCache.delete(oldestKey);
      }
    }

    setSelectedBucket(bucketName);
    setBucketInfoLoading(true);
    setBucketInfo(null);
    setBucketInfoError(null);

    currentBucketController = new AbortController();
    const { signal } = currentBucketController;

    try {
      const info = await getBucketInfo(bucketName);
      // Check if request was cancelled
      if (signal.aborted) return;

      if (info) {
        setBucketInfo(info);
        // Cache result (reuse SearchCacheManager pattern)
        bucketInfoCache.set(bucketName, { info, timestamp: Date.now() });
      } else {
        setBucketInfoError(t('search.bucketInfo.notFound'));
      }
    } catch (error) {
      if (signal.aborted) return; // Ignore cancelled request errors
      console.error('Failed to get bucket info:', error);
      setBucketInfoError(t('search.bucketInfo.loadFailed'));
    } finally {
      if (!signal.aborted) {
        setBucketInfoLoading(false);
        currentBucketController = null;
      }
    }
  };

  const handleCloseBucketModal = () => {
    if (currentBucketController) {
      currentBucketController.abort();
      currentBucketController = null;
    }
    setSelectedBucket(null);
    setBucketInfo(null);
    setBucketInfoError(null);
  };

  // 监听全局缓存失效（复用 SearchCacheManager 模式）
  onMount(() => {
    const unsubscribe = searchCacheManager.subscribe(() => {
      // 清理 bucket 缓存
      bucketInfoCache.clear();
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSearchResults();
    } finally {
      setRefreshing(false);
    }
  };

  onCleanup(() => {
    cleanup();
    // 清理 bucket 请求（复用 useSearch 模式）
    if (currentBucketController) {
      currentBucketController.abort();
      currentBucketController = null;
    }
  });

  return (
    <div class="p-4">
      <div class="mx-auto max-w-7xl">
        <div class="mb-4 flex items-center gap-2">
          <div class="flex-1">
            <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          </div>
          <button
            class="btn btn-square tooltip tooltip-top hover:btn-outline"
            data-tip={t('search.refreshResults')}
            onClick={handleRefresh}
            disabled={refreshing() || !searchTerm()}
          >
            <RefreshCw class={`h-5 w-5 ${refreshing() || loading() ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs and bucket filter on the same line */}
        <div class="mb-6 flex items-center justify-between">
          <div class="flex-1">
            <SearchResultsTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              packageCount={packageResults().length}
              includesCount={binaryResults().length}
            />
          </div>
          <div class="dropdown">
            <div tabindex="0" role="button" class="select select-bordered select-md min-w-40">
              {bucketFilter() || t('search.filter.allBuckets')}
            </div>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box border-base-300 z-1 mt-1.5 w-full border p-1 shadow"
            >
              <li>
                <a onClick={() => setBucketFilter('')}>{t('search.filter.allBuckets')}</a>
              </li>
              {uniqueBuckets().map((bucket) => (
                <li>
                  <a onClick={() => setBucketFilter(bucket)}>{bucket}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Empty state when no search term */}
        <Show when={!searchTerm().trim()}>
          <div class="-mt-[10%] flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center text-center">
            <div class="bg-base-300 mb-6 rounded-full p-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="text-base-content/50 h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-2xl font-bold">{t('search.emptyState.title')}</h3>
            <p class="text-base-content/70 mb-4 max-w-md text-lg">
              {t('search.emptyState.description')}
            </p>
          </div>
        </Show>

        {/* Search results */}
        <Show when={searchTerm().trim()}>
          <SearchResultsList
            loading={loading()}
            results={resultsToShow()}
            searchTerm={searchTerm()}
            activeTab={activeTab()}
            onViewInfo={fetchPackageInfo}
            onInstall={handleInstall}
            onViewBucket={handleViewBucket}
            onPackageStateChanged={() => {
              // This will be called when install buttons are clicked
              // The actual refresh will happen in closeOperationModal when the operation completes
            }}
            currentPage={currentPage()}
            onPageChange={setCurrentPage}
            bucketGitUrlMap={bucketGitUrlMap()}
          />
        </Show>
      </div>

      <PackageInfoModal
        pkg={selectedPackage()}
        info={info()}
        loading={infoLoading()}
        error={infoError()}
        onClose={closeModal}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        context="search"
        fromPackageModal={true}
        onPackageStateChanged={() => {
          // This will be called when install/uninstall buttons are clicked
          // The actual refresh will happen in closeOperationModal when the operation completes
        }}
      />
      <OperationModal
        title={operationTitle()}
        onClose={closeOperationModal}
        isScan={isScanning()}
        onInstallConfirm={handleInstallConfirm}
        nextStep={operationNextStep() ?? undefined}
      />

      <Show when={selectedBucket()}>
        <BucketInfoModal
          bucket={bucketInfo()}
          bucketName={selectedBucket() ?? undefined}
          manifests={[]}
          manifestsLoading={bucketInfoLoading()}
          loading={bucketInfoLoading() && !bucketInfo()}
          error={bucketInfoError()}
          onClose={handleCloseBucketModal}
          fromPackageModal={true}
        />
      </Show>
    </div>
  );
}

export default SearchPage;
