import { createSignal, createEffect, onMount, Show, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import {
  useBuckets,
  type BucketInfo,
  type BulkUpdateResult,
  updateBucketsCache,
  clearManifestCache,
  handleBucketPackageClick,
} from '../hooks';
import { usePackageInfo } from '../hooks';
import { usePackageOperations } from '../hooks';
import { createTauriSignal } from '../hooks';
import { searchCacheManager } from '../hooks/search/useSearchCache';
import { ScoopPackage } from '../types/scoop';
import BucketInfoModal from '../components/modals/BucketInfoModal';
import PackageInfoModal from '../components/modals/PackageInfoModal';
import BucketSearch from '../components/page/buckets/BucketSearch';
import BucketGrid from '../components/page/buckets/BucketGrid';
import { BucketSearchResults } from '../components/page/buckets/BucketSearch';
import BulkUpdateProgress from '../components/page/buckets/BulkUpdateProgress';
import { SearchableBucket } from '../hooks';
import { t } from '../i18n';
import { toast } from '../components/common/ToastAlert';
import installedPackagesStore from '../stores/installedPackagesStore';
import bucketBulkUpdateStore from '../stores/bucketBulkUpdateStore';
import { useOperationFollowUp } from '../hooks/packages/useOperationFollowUp';

const UPDATE_RESULT_DISPLAY_DURATION = 2000;

function BucketPage() {
  const ITEMS_PER_PAGE = 8;
  const {
    buckets,
    loading,
    error,
    fetchBucketSummaries,
    preloadBucketDetails,
    markForRefresh,
    hydrateBucketInfo,
    getBucketManifestsPage,
    cleanup,
  } = useBuckets();
  const packageInfo = usePackageInfo();
  const packageOperations = usePackageOperations();
  const bulkUpdate = bucketBulkUpdateStore;

  const [selectedBucket, setSelectedBucket] = createSignal<BucketInfo | null>(null);
  const [manifests, setManifests] = createSignal<string[]>([]);
  const [manifestsLoading, setManifestsLoading] = createSignal(false);
  const [manifestsLoadingMore, setManifestsLoadingMore] = createSignal(false);
  const [manifestsTotal, setManifestsTotal] = createSignal(0);
  const [manifestsHasMore, setManifestsHasMore] = createSignal(false);
  const MANIFESTS_PAGE_SIZE = 80;
  let activeManifestRequestToken = 0;

  // Search state
  const [isSearchActive, setIsSearchActive] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<SearchableBucket[]>([]);
  const [searchTotalCount, setSearchTotalCount] = createSignal(0);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [isExpandedSearch, setIsExpandedSearch] = createTauriSignal('bucketExpandedSearch', false);
  const [currentPage, setCurrentPage] = createTauriSignal('bucketSearchCurrentPage', 1);

  // Infinite scroll state
  const [hasMore, setHasMore] = createSignal(true);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  let loadMoreFn: ((neededCount?: number) => Promise<void>) | null = null;

  // Update state
  const [updatingBuckets, setUpdatingBuckets] = createSignal<Set<string>>(new Set());
  const [updateResults, setUpdateResults] = createSignal<{ [key: string]: string }>({});
  const [updateResultStatuses, setUpdateResultStatuses] = createSignal<{
    [key: string]: 'success' | 'info' | 'error' | 'default';
  }>({});
  let resultTimerIds: Map<string, number> = new Map();

  onMount(() => {
    // Load the bucket shell first, then let the shared bucket cache finish details in the background.
    void (async () => {
      await fetchBucketSummaries(false);
      await preloadBucketDetails();
    })();
  });

  onCleanup(() => {
    cleanupTimers();
    cleanup();
  });

  createEffect(() => {
    if (bulkUpdate.needsRefresh() && bulkUpdate.updateState().status !== 'updating') {
      void (async () => {
        await fetchBucketSummaries(true, true);
        bulkUpdate.clearRefreshFlag();
      })();
    }
  });

  const toggleSearch = () => {
    setIsSearchActive(!isSearchActive());
    if (!isSearchActive()) {
      // Reset search results when closing search
      setSearchResults([]);
      setSearchTotalCount(0);
      setSearchError(null);
      setIsExpandedSearch(false);
      setCurrentPage(1);
      setHasMore(true);
    }
  };

  // Note: Don't reset page on searchResults change - it breaks infinite scroll
  // Page reset is handled in toggleSearch and handleSearchResults (new search only)

  const handleSearchResults = (results: any) => {
    const nextTotalCount = results.totalCount || 0;

    setSearchResults(results.results || []);
    setSearchTotalCount(nextTotalCount);
    setSearchLoading(results.isSearching || false);
    setSearchError(results.error || null);
    setIsExpandedSearch(results.isExpandedSearch || false);
    setHasMore(results.hasMore ?? true);
    setIsLoadingMore(results.isLoadingMore ?? false);
    loadMoreFn = results.loadMore || null;

    // Always keep current page in valid range based on backend total count
    const totalPages = Math.max(1, Math.ceil(nextTotalCount / ITEMS_PER_PAGE));
    if (currentPage() > totalPages) {
      setCurrentPage(totalPages);
    }
  };

  const handleLoadMore = async (neededCount?: number) => {
    if (loadMoreFn) {
      setIsLoadingMore(true);
      try {
        await loadMoreFn(neededCount);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  const handleViewBucket = async (bucket: BucketInfo) => {
    const detailedBucket = bucket.details_loaded ? bucket : await hydrateBucketInfo(bucket.name);
    setSelectedBucket(detailedBucket || bucket);
    await handleFetchManifests(bucket.name);
  };

  // Additional state for external bucket modal
  const [selectedSearchBucket, setSelectedSearchBucket] = createSignal<SearchableBucket | null>(
    null
  );

  const handleSearchBucketSelect = async (searchBucket: SearchableBucket) => {
    // First check if this bucket is already installed locally
    const installedBucket = buckets().find((b) => b.name === searchBucket.name);

    if (installedBucket) {
      // Bucket is installed locally - use the regular handler to show manifests
      setSelectedSearchBucket(null); // Clear search bucket
      handleViewBucket(installedBucket);
    } else {
      // Bucket is not installed - show as external bucket with description
      const bucketInfo: BucketInfo = {
        name: searchBucket.name,
        path: searchBucket.url, // Use URL as path for external buckets
        is_git_repo: true,
        git_url: searchBucket.url,
        git_branch: 'main', // Default branch
        last_updated: searchBucket.last_updated,
        manifest_count: searchBucket.apps,
        manifest_count_loaded: true,
        details_loaded: true,
      };

      setSelectedBucket(bucketInfo);
      setSelectedSearchBucket(searchBucket); // Store the search bucket for the modal
      setManifests([]); // No manifests for external buckets
      setManifestsLoading(false);
    }
  };

  const closeModal = () => {
    activeManifestRequestToken += 1;
    setSelectedBucket(null);
    setSelectedSearchBucket(null);
    setManifests([]);
    setManifestsLoading(false);
    setManifestsLoadingMore(false);
    setManifestsTotal(0);
    setManifestsHasMore(false);
  };

  const handlePackageClick = async (packageName: string, bucketName: string) => {
    // Use the shared hook for consistent behavior
    await handleBucketPackageClick(
      packageName,
      bucketName,
      packageInfo.fetchPackageInfo,
      undefined, // Don't close bucket modal for BucketPage behavior
      installedPackagesStore.packages() // Pass installed packages to avoid redundant backend calls
    );
  };

  const handleBucketInstalled = async () => {
    markForRefresh();
    await fetchBucketSummaries(true);
  };

  const refreshSelectedPackageAfterOperation = async () => {
    await installedPackagesStore.silentRefetch();

    const currentSelectedPackage = packageInfo.selectedPackage();
    if (currentSelectedPackage) {
      const matchedInstalledPackage = packageInfo.syncSelectedPackage(
        installedPackagesStore.packages()
      );

      if (!matchedInstalledPackage && currentSelectedPackage.is_installed) {
        const fallbackPackage = {
          ...currentSelectedPackage,
          is_installed: false,
          is_installed_from_current_bucket: false,
          available_version: undefined,
        };
        packageInfo.updateSelectedPackage(fallbackPackage);
        await packageInfo.refreshSelectedPackageInfo(fallbackPackage);
      }

      try {
        const response = await invoke<{ packages: ScoopPackage[]; is_cold: boolean }>(
          'search_scoop',
          {
            term: currentSelectedPackage.name,
          }
        );
        const match = response.packages.find(
          (p) =>
            p.name === currentSelectedPackage.name && p.source === currentSelectedPackage.source
        );
        if (match) {
          const refreshedPackage = packageInfo.syncSelectedPackage(response.packages);
          await packageInfo.refreshSelectedPackageInfo(refreshedPackage ?? currentSelectedPackage);
        }
      } catch (e) {
        console.error('Failed to check package status', e);
      }
    }

    const currentBucket = selectedBucket();
    if (currentBucket) {
      await handleFetchManifests(currentBucket.name);
    }
  };

  const operationFollowUp = useOperationFollowUp(refreshSelectedPackageAfterOperation);

  const handleInstallWithFollowUp = operationFollowUp.withFollowUp(packageOperations.handleInstall);
  const handleUninstallWithFollowUp = operationFollowUp.withFollowUp(
    packageOperations.handleUninstall
  );
  const handleUpdateWithFollowUp = operationFollowUp.withAsyncFollowUp(
    packageOperations.handleUpdate
  );
  const handleForceUpdateWithFollowUp = operationFollowUp.withAsyncFollowUp(
    packageOperations.handleForceUpdate
  );

  // Handle fetching manifests for newly installed bucket
  const handleFetchManifests = async (bucketName: string, query = '') => {
    const requestToken = ++activeManifestRequestToken;
    const normalizedQuery = query.trim();
    setManifestsLoading(true);
    try {
      const page = await getBucketManifestsPage(bucketName, {
        query: normalizedQuery,
        offset: 0,
        limit: MANIFESTS_PAGE_SIZE,
      });
      if (requestToken !== activeManifestRequestToken) {
        return;
      }
      setManifests(page.manifests);
      setManifestsTotal(page.total);
      setManifestsHasMore(page.has_more);
    } catch (error) {
      if (requestToken !== activeManifestRequestToken) {
        return;
      }
      console.error('Failed to fetch manifests for bucket:', bucketName, error);
    } finally {
      if (requestToken === activeManifestRequestToken) {
        setManifestsLoading(false);
      }
    }
  };

  const handleLoadMoreManifests = async (bucketName: string, query = '') => {
    if (manifestsLoadingMore() || !manifestsHasMore()) {
      return;
    }

    const requestToken = activeManifestRequestToken;
    const normalizedQuery = query.trim();
    setManifestsLoadingMore(true);
    try {
      const page = await getBucketManifestsPage(bucketName, {
        query: normalizedQuery,
        offset: manifests().length,
        limit: MANIFESTS_PAGE_SIZE,
      });
      if (requestToken !== activeManifestRequestToken) {
        return;
      }
      setManifests((current) => [...current, ...page.manifests]);
      setManifestsTotal(page.total);
      setManifestsHasMore(page.has_more);
    } catch (error) {
      if (requestToken !== activeManifestRequestToken) {
        return;
      }
      console.error('Failed to fetch more manifests for bucket:', bucketName, error);
    } finally {
      if (requestToken === activeManifestRequestToken) {
        setManifestsLoadingMore(false);
      }
    }
  };

  const refreshBucketInfoInCache = async (bucketName: string): Promise<BucketInfo | null> => {
    try {
      const updatedBucketInfo = await invoke<BucketInfo>('get_bucket_info', {
        bucketName: bucketName,
      });

      if (!updatedBucketInfo || updatedBucketInfo.name !== bucketName) {
        throw new Error('Invalid bucket info received');
      }

      const currentBuckets = buckets();
      const bucketExists = currentBuckets.some((bucket) => bucket.name === bucketName);
      const updatedBuckets = bucketExists
        ? currentBuckets.map((bucket: BucketInfo) =>
            bucket.name === bucketName ? updatedBucketInfo : bucket
          )
        : [...currentBuckets, updatedBucketInfo];

      updateBucketsCache(updatedBuckets);
      return updatedBucketInfo;
    } catch (error) {
      console.error('Failed to refresh bucket info:', error);
      return null;
    }
  };

  // Handle updating a single bucket
  const handleUpdateBucket = async (
    bucketName: string,
    shouldRefreshBuckets: boolean = true,
    abortSignal?: AbortSignal
  ) => {
    if (updatingBuckets().has(bucketName)) {
      return { success: false, message: 'Operation already in progress', bucket_name: bucketName };
    }

    const isBulkUpdateCancelling = bulkUpdate.isCancelling();

    // Add to updating set
    setUpdatingBuckets((prev) => new Set([...prev, bucketName]));

    try {
      // Check if operation was aborted before starting
      if (abortSignal?.aborted) {
        return { success: false, message: 'Operation cancelled', bucket_name: bucketName };
      }

      const result = await invoke<BulkUpdateResult>('update_bucket', {
        bucketName: bucketName,
      });

      // Check if operation was aborted after completion
      if (abortSignal?.aborted) {
        return { success: false, message: 'Operation cancelled', bucket_name: bucketName };
      }

      // Always determine the display message and return the correct result format
      let status: 'success' | 'info' | 'error' | 'default' = 'default';
      let displayMessage = result.message;

      if (result.success) {
        if (result.message === 'BUCKET_UP_TO_DATE') {
          status = 'info';
          displayMessage = t('bucket.update.upToDate', { bucket: bucketName });
        } else if (result.message === 'BUCKET_UPDATE_SUCCESS') {
          status = 'success';
          displayMessage = t('bucket.update.success', {
            bucket: bucketName,
            count: result.manifest_count || 0,
          });
        } else {
          status = 'success';
        }
      } else {
        status = 'error';
        if (result.message === 'BUCKET_HAS_UNCOMMITTED_CHANGES') {
          displayMessage = t('bucket.update.hasUncommittedChanges', { bucket: bucketName });
        } else {
          displayMessage = result.message;
        }
      }

      if (!isBulkUpdateCancelling && shouldRefreshBuckets) {
        switch (status) {
          case 'success':
            toast.success(displayMessage);
            break;
          case 'info':
            toast.info(displayMessage);
            break;
          case 'error':
            toast.error(displayMessage);
            break;
          default:
            toast.info(displayMessage);
            break;
        }

        setUpdateResults((prev) => ({
          ...prev,
          [bucketName]: displayMessage,
        }));

        setUpdateResultStatuses((prev) => ({
          ...prev,
          [bucketName]: status,
        }));

        if (!isBulkUpdateCancelling) {
          const timerId = window.setTimeout(() => {
            setUpdateResults((prev) => {
              const newResults = { ...prev };
              delete newResults[bucketName];
              return newResults;
            });
            resultTimerIds.delete(bucketName);
          }, UPDATE_RESULT_DISPLAY_DURATION);

          resultTimerIds.set(bucketName, timerId);
        }
      }

      if (result.success && shouldRefreshBuckets && !isBulkUpdateCancelling) {
        clearManifestCache(bucketName);

        const currentBucket = selectedBucket();
        if (currentBucket && currentBucket.name === bucketName) {
          await handleFetchManifests(bucketName);
        }

        await refreshBucketInfoInCache(bucketName);
      }

      // Always return the correct result format for bulk update statistics
      return {
        success: result.success,
        message: displayMessage,
        bucket_name: bucketName,
      };
    } catch (error) {
      // Check if operation was aborted
      if (abortSignal?.aborted) {
        return { success: false, message: 'Operation cancelled', bucket_name: bucketName };
      }

      console.error('Failed to update bucket:', bucketName, error);

      if (!isBulkUpdateCancelling && shouldRefreshBuckets) {
        setUpdateResults((prev) => ({
          ...prev,
          [bucketName]: `Failed to update: ${error instanceof Error ? error.message : String(error)}`,
        }));

        setUpdateResultStatuses((prev) => ({
          ...prev,
          [bucketName]: 'error',
        }));

        const timerId = window.setTimeout(() => {
          setUpdateResults((prev) => {
            const newResults = { ...prev };
            delete newResults[bucketName];
            return newResults;
          });
          setUpdateResultStatuses((prev) => {
            const newStatuses = { ...prev };
            delete newStatuses[bucketName];
            return newStatuses;
          });
          resultTimerIds.delete(bucketName);
        }, UPDATE_RESULT_DISPLAY_DURATION);

        resultTimerIds.set(bucketName, timerId);
      }

      // Return a proper BulkUpdateResult instead of throwing
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        bucket_name: bucketName,
      };
    } finally {
      // Remove from updating set in all cases
      setUpdatingBuckets((prev) => {
        const newSet = new Set(prev);
        newSet.delete(bucketName);
        return newSet;
      });
    }
  };

  const handleUpdateAllBuckets = () => {
    void bulkUpdate.start({
      buckets: buckets().map((bucket) => ({ name: bucket.name, is_git_repo: bucket.is_git_repo })),
      updateAllBuckets: handleUpdateAllBucketsSequential,
      updateBucket: handleUpdateBucket,
    });
  };

  const handleUpdateAllBucketsSequential = async (runId: string): Promise<BulkUpdateResult[]> => {
    return invoke<BulkUpdateResult[]>('update_all_buckets', { runId });
  };

  // Handle manual reload of local buckets
  const handleReloadLocalBuckets = async () => {
    markForRefresh();
    await fetchBucketSummaries(true);
  };

  // Handle bucket update (e.g., branch switch)
  const handleBucketUpdated = async (bucketName: string, newBranch?: string) => {
    console.log(`Bucket updated: ${bucketName}, new branch: ${newBranch || 'unknown'}`);

    clearManifestCache(bucketName);
    searchCacheManager.invalidateCache();

    const currentBucket = selectedBucket();
    if (currentBucket && currentBucket.name === bucketName) {
      if (newBranch) {
        setSelectedBucket({
          ...currentBucket,
          git_branch: newBranch,
        });
      }
      await handleFetchManifests(bucketName);
    }

    const updatedBucketInfo = await refreshBucketInfoInCache(bucketName);
    if (!updatedBucketInfo) {
      markForRefresh();
      await fetchBucketSummaries(true);
    }
  };

  const cleanupTimers = () => {
    resultTimerIds.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    resultTimerIds.clear();
  };

  const handlePageChange = async (page: number) => {
    const neededItems = page * ITEMS_PER_PAGE;
    const loadedItems = searchResults().length;

    if (neededItems > loadedItems && hasMore() && loadMoreFn && !isLoadingMore()) {
      setIsLoadingMore(true);
      try {
        await loadMoreFn(neededItems);
      } finally {
        setIsLoadingMore(false);
      }
    }

    setCurrentPage(page);
    setTimeout(() => {
      const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement;
      if (scrollContainer && typeof scrollContainer.scrollTo === 'function') {
        try {
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } catch {
          // Silently fail and try window
        }
      }
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          // Ignore scroll errors
        }
      }
    }, 50);
  };

  onMount(() => {
    const handleArrowPagination = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const hasBlockingOverlayOpen =
        document.body.classList.contains('contextmenu-open') ||
        document.querySelector('.modal.modal-open') !== null;

      if (hasBlockingOverlayOpen || !isSearchActive()) {
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable;

      if (isTypingTarget || target?.closest('[data-pagination-editor]')) {
        return;
      }

      const totalPages = Math.max(1, Math.ceil(searchTotalCount() / ITEMS_PER_PAGE));
      if (totalPages <= 1) {
        return;
      }

      if (event.key === 'ArrowLeft' && currentPage() > 1) {
        event.preventDefault();
        handlePageChange(currentPage() - 1);
      }

      if (event.key === 'ArrowRight' && currentPage() < totalPages) {
        event.preventDefault();
        handlePageChange(currentPage() + 1);
      }
    };

    window.addEventListener('keydown', handleArrowPagination);

    onCleanup(() => {
      window.removeEventListener('keydown', handleArrowPagination);
    });
  });

  return (
    <div class="mx-auto max-w-7xl">
      <div class="p-6">
        {/* Header Section */}
        <div
          class={`relative mb-6 transition-all duration-300 ${isSearchActive() ? 'mb-6' : 'mb-6'}`}
        >
          <div class="flex items-center justify-between">
            <div
              class={`transition-all duration-300 ${isSearchActive() ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
            >
              <h1 class="mb-2 text-3xl font-bold">{t('app.buckets')}</h1>
              <p class="text-base-content/70">{t('bucket.page.description')}</p>
            </div>

            <BucketSearch
              isActive={isSearchActive}
              onToggle={toggleSearch}
              onSearchResults={handleSearchResults}
            />
          </div>
        </div>

        {/* Error State */}
        <Show when={error() && !isSearchActive()}>
          <div class="alert alert-error mb-4">
            <span>{error()}</span>
          </div>
        </Show>

        {/* Main Content */}
        {/* Search Results */}
        <Show when={isSearchActive()}>
          <div
            class={`transition-all duration-300 ${
              isSearchActive() ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <div class="card bg-base-100">
              <div class="card-body">
                <BucketSearchResults
                  buckets={searchResults()}
                  loading={searchLoading()}
                  error={searchError()}
                  totalCount={searchTotalCount()}
                  isExpandedSearch={isExpandedSearch()}
                  installedBuckets={buckets()}
                  onBucketSelect={handleSearchBucketSelect}
                  onBucketInstalled={handleBucketInstalled}
                  currentPage={currentPage()}
                  onPageChange={handlePageChange}
                  hasMore={hasMore()}
                  isLoadingMore={isLoadingMore()}
                  onLoadMore={handleLoadMore}
                />
              </div>
            </div>
          </div>
        </Show>

        <BulkUpdateProgress
          updateState={bulkUpdate.updateState}
          errorDetails={bulkUpdate.getErrorDetails}
          showErrorDetails={bulkUpdate.showErrorDetails}
          canCancel={bulkUpdate.canCancel}
          onCancel={bulkUpdate.cancel}
          onClose={bulkUpdate.close}
          onToggleErrorDetails={bulkUpdate.toggleErrorDetails}
        />

        {/* Regular Buckets View */}
        <Show when={!isSearchActive()}>
          <div
            class={`transition-all duration-300 ${
              !isSearchActive() ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <BucketGrid
              buckets={buckets()}
              onViewBucket={handleViewBucket}
              onRefresh={handleReloadLocalBuckets}
              onUpdateBucket={handleUpdateBucket}
              onUpdateAll={handleUpdateAllBuckets}
              updatingBuckets={updatingBuckets()}
              updateResults={updateResults()}
              updateResultStatuses={updateResultStatuses()}
              loading={loading() && bulkUpdate.updateState().status !== 'updating'}
              isUpdatingAll={bulkUpdate.updateState().status === 'updating'}
              isCancelling={bulkUpdate.isCancelling()}
              bulkUpdateCompleted={bulkUpdate.updateState().status === 'completed'}
              bulkUpdateMessage={bulkUpdate.updateState().message}
              isBulkUpdate={bulkUpdate.updateState().status === 'updating'}
              onBucketUpdated={handleBucketUpdated}
            />
          </div>
        </Show>
      </div>

      {/* Modals */}
      <Show when={selectedBucket()}>
        {(() => {
          const bucket = selectedBucket()!;
          const searchBucket = selectedSearchBucket();

          return (
            <BucketInfoModal
              bucket={bucket}
              manifests={manifests()}
              manifestsLoading={manifestsLoading()}
              manifestsLoadingMore={manifestsLoadingMore()}
              manifestsTotal={manifestsTotal()}
              manifestsHasMore={manifestsHasMore()}
              error={null}
              searchBucket={searchBucket || undefined}
              onClose={closeModal}
              onPackageClick={handlePackageClick}
              onBucketInstalled={handleBucketInstalled}
              onFetchManifests={(bucketName: string, query?: string) =>
                handleFetchManifests(bucketName, query)
              }
              onLoadMoreManifests={(bucketName: string, query?: string) =>
                handleLoadMoreManifests(bucketName, query)
              }
              onBucketUpdated={handleBucketUpdated}
            />
          );
        })()}
      </Show>

      <PackageInfoModal
        pkg={packageInfo.selectedPackage()}
        info={packageInfo.info()}
        loading={packageInfo.loading()}
        error={packageInfo.error()}
        onClose={packageInfo.closeModal}
        onInstall={handleInstallWithFollowUp}
        onUninstall={handleUninstallWithFollowUp}
        onUpdate={handleUpdateWithFollowUp}
        onForceUpdate={handleForceUpdateWithFollowUp}
        showBackButton={true}
        onPackageStateChanged={async () => {
          await refreshSelectedPackageAfterOperation();
        }}
      />
    </div>
  );
}

export default BucketPage;
