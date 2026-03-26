import PackageInfoModal from '../components/modals/PackageInfoModal';
import ManifestModal from '../components/modals/ManifestModal';
import BucketInfoModal from '../components/modals/BucketInfoModal';
import OperationModal from '../components/modals/OperationModal';

import SearchBar from '../components/page/search/SearchBar';
import SearchResultsTabs from '../components/page/search/SearchResultsTabs';
import SearchResultsList from '../components/page/search/SearchResultsList';
import Dropdown from '../components/common/Dropdown';

import { createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
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
  const [bucketGitBranchMap, setBucketGitBranchMap] = createSignal<Map<string, string>>(new Map());
  const [manifestPackage, setManifestPackage] = createSignal<string | null>(null);
  const [manifestSource, setManifestSource] = createSignal<string | null>(null);
  const [manifestContent, setManifestContent] = createSignal<string | null>(null);
  const [manifestLoading, setManifestLoading] = createSignal(false);
  const [manifestError, setManifestError] = createSignal<string | null>(null);

  const { getBucketInfo, buckets, fetchBuckets } = useBuckets();

  // AbortController instances for request cancellation
  let currentBucketController: AbortController | null = null;
  let currentManifestController: AbortController | null = null;

  // Bucket info cache for performance optimization
  const bucketInfoCache = new Map<string, { info: BucketInfo; timestamp: number }>();
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration
  const MAX_CACHE_SIZE = 50; // Maximum cache entries limit

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
    const branchMap = new Map<string, string>();
    allBuckets.forEach((bucket) => {
      if (bucket.git_url) {
        urlMap.set(bucket.name, bucket.git_url);
      }
      if (bucket.git_branch) {
        branchMap.set(bucket.name, bucket.git_branch);
      }
    });
    setBucketGitUrlMap(urlMap);
    setBucketGitBranchMap(branchMap);
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

  const closeManifestModal = () => {
    if (currentManifestController) {
      currentManifestController.abort();
      currentManifestController = null;
    }
    setManifestPackage(null);
    setManifestSource(null);
    setManifestContent(null);
    setManifestLoading(false);
    setManifestError(null);
  };

  const handleViewManifest = async (pkg: { name: string; source: string }) => {
    // Abort previous manifest request to prevent race conditions
    if (currentManifestController) {
      currentManifestController.abort();
      currentManifestController = null;
    }

    setManifestPackage(pkg.name);
    setManifestSource(pkg.source);
    setManifestLoading(true);
    setManifestError(null);
    setManifestContent(null);

    currentManifestController = new AbortController();
    const { signal } = currentManifestController;

    try {
      const result = await invoke<string>('get_package_manifest', {
        packageName: pkg.name,
        bucket: pkg.source,
      });
      // Early return if request was aborted
      if (signal.aborted) return;

      setManifestContent(result);
    } catch (error) {
      // Ignore errors from cancelled requests
      if (signal.aborted) return;
      const errorMsg = error instanceof Error ? error.message : String(error);
      setManifestError(errorMsg);
      console.error(`Failed to fetch manifest for ${pkg.name}:`, errorMsg);
    } finally {
      if (!signal.aborted) {
        setManifestLoading(false);
        currentManifestController = null;
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

  // Listen to global cache invalidation events
  onMount(() => {
    const unsubscribe = searchCacheManager.subscribe(() => {
      // Clear bucket cache when global cache is invalidated
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top after page change with delay for DOM updates
    setTimeout(() => {
      // Try the main scroll container first (common in Tauri apps)
      const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement;
      if (scrollContainer && typeof scrollContainer.scrollTo === 'function') {
        try {
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } catch (error) {
          // Silently fail and try window
        }
      }
      // Fallback to window scroll
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
          // Ignore scroll errors
        }
      }
    }, 50);
  };

  onCleanup(() => {
    cleanup();
    // Clean up ongoing requests to prevent memory leaks
    if (currentBucketController) {
      currentBucketController.abort();
      currentBucketController = null;
    }
    if (currentManifestController) {
      currentManifestController.abort();
      currentManifestController = null;
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
        <div class="my-6 flex items-center justify-between">
          <div class="flex-1">
            <SearchResultsTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              packageCount={packageResults().length}
              includesCount={binaryResults().length}
            />
          </div>
          <Dropdown
            position="end"
            selectMode
            trigger={<span>{bucketFilter() || t('search.filter.allBuckets')}</span>}
            triggerClass="select select-bordered select-md min-w-40 justify-start"
            contentClass="min-w-40"
            items={[
              {
                label: t('search.filter.allBuckets'),
                onClick: () => setBucketFilter(''),
              },
              ...uniqueBuckets().map((bucket) => ({
                label: bucket,
                onClick: () => setBucketFilter(bucket),
              })),
            ]}
          />
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
            onViewManifest={handleViewManifest}
            onInstall={handleInstall}
            onViewBucket={handleViewBucket}
            onPackageStateChanged={() => {
              // This will be called when install buttons are clicked
              // The actual refresh will happen in closeOperationModal when the operation completes
            }}
            currentPage={currentPage()}
            onPageChange={handlePageChange}
            bucketGitUrlMap={bucketGitUrlMap()}
            bucketGitBranchMap={bucketGitBranchMap()}
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
        bucketGitUrl={bucketGitUrlMap().get(selectedPackage()?.source ?? '') ?? null}
        bucketGitBranch={bucketGitBranchMap().get(selectedPackage()?.source ?? '') ?? null}
      />
      <ManifestModal
        packageName={manifestPackage() ?? ''}
        manifestContent={manifestContent()}
        loading={manifestLoading()}
        error={manifestError()}
        onClose={closeManifestModal}
        bucketSource={manifestSource()}
        bucketGitUrl={(() => {
          const source = manifestSource();
          return source ? (bucketGitUrlMap().get(source) ?? null) : null;
        })()}
        bucketGitBranch={(() => {
          const source = manifestSource();
          return source ? (bucketGitBranchMap().get(source) ?? null) : null;
        })()}
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
