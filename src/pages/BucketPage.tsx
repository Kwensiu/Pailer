import { createSignal, onMount, Show, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import {
  useBuckets,
  type BucketInfo,
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
import OperationModal from '../components/modals/OperationModal';
import BucketSearch from '../components/page/buckets/BucketSearch';
import BucketGrid from '../components/page/buckets/BucketGrid';
import { BucketSearchResults } from '../components/page/buckets/BucketSearch';
import BulkUpdateProgress, { BulkUpdateState } from '../components/page/buckets/BulkUpdateProgress';
import { SearchableBucket } from '../hooks';
import { t } from '../i18n';
import { toast } from '../components/common/ToastAlert';
import installedPackagesStore from '../stores/installedPackagesStore';

const UPDATE_RESULT_DISPLAY_DURATION = 2000;

interface BucketUpdateResult {
  success: boolean;
  message: string;
  bucket_name: string;
  bucket_path?: string;
  manifest_count?: number;
}

type UpdateState = BulkUpdateState;

function BucketPage() {
  const ITEMS_PER_PAGE = 8;
  const { buckets, loading, error, fetchBuckets, markForRefresh, getBucketManifests, cleanup } =
    useBuckets();
  const packageInfo = usePackageInfo();
  const packageOperations = usePackageOperations();

  const [selectedBucket, setSelectedBucket] = createSignal<BucketInfo | null>(null);
  const [manifests, setManifests] = createSignal<string[]>([]);
  const [manifestsLoading, setManifestsLoading] = createSignal(false);

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
  const [updateState, setUpdateState] = createSignal<UpdateState>({
    status: 'idle',
    current: 0,
    total: 0,
    message: '',
  });
  const [isCancelling, setIsCancelling] = createSignal(false);
  const [failedResults, setFailedResults] = createSignal<BucketUpdateResult[]>([]);

  // Error details expansion state
  const [showErrorDetails, setShowErrorDetails] = createSignal(false);

  let resultTimerIds: Map<string, number> = new Map();
  let stateTimerId: number | null = null;

  onMount(() => {
    // If we already have buckets (from preloading), don't force a refresh
    // useBuckets() will automatically use cachedBuckets if available
    fetchBuckets(false);
  });

  onCleanup(() => {
    cleanupTimers();
    cleanup();
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
    setSelectedBucket(bucket);
    setManifestsLoading(true);
    const bucketManifests = await getBucketManifests(bucket.name);
    setManifests(bucketManifests);
    setManifestsLoading(false);
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
      };

      setSelectedBucket(bucketInfo);
      setSelectedSearchBucket(searchBucket); // Store the search bucket for the modal
      setManifests([]); // No manifests for external buckets
      setManifestsLoading(false);
    }
  };

  const handleCloseBulkUpdate = () => {
    setUpdateState((prev) => ({
      ...prev,
      status: 'idle',
    }));
    setIsCancelling(false); // Reset cancelling state when closing
    setFailedResults([]); // Reset failed results when closing
    setShowErrorDetails(false); // Reset error details when closing
  };

  // Helper function to get error details from structured data
  const getErrorDetails = () => {
    if (updateState().status !== 'completed') return [];
    return failedResults();
  };

  const closeModal = () => {
    setSelectedBucket(null);
    setSelectedSearchBucket(null);
    setManifests([]);
    setManifestsLoading(false);
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
    await fetchBuckets(true);
  };

  // Handle fetching manifests for newly installed bucket
  const handleFetchManifests = async (bucketName: string) => {
    setManifestsLoading(true);
    try {
      const bucketManifests = await getBucketManifests(bucketName);
      setManifests(bucketManifests);
    } catch (error) {
      console.error('Failed to fetch manifests for bucket:', bucketName, error);
    } finally {
      setManifestsLoading(false);
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

    // Check if bulk update is being cancelled
    const isBulkUpdateCancelling = isCancelling();

    // Add to updating set
    setUpdatingBuckets((prev) => new Set([...prev, bucketName]));

    try {
      // Check if operation was aborted before starting
      if (abortSignal?.aborted) {
        return { success: false, message: 'Operation cancelled', bucket_name: bucketName };
      }

      const result = await invoke<BucketUpdateResult>('update_bucket', {
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

  // Handle updating all buckets - simplified to just trigger the update
  const handleUpdateAllBuckets = () => {
    // If we're already updating, don't start a new update
    if (updateState().status === 'updating') return;

    // Set updating state to trigger the component's logic
    setUpdateState({
      status: 'updating',
      current: 0,
      total: 0, // Will be set by the component
      message: t('bucket.grid.updatingBuckets'),
    });
  };

  // Handle state updates from BulkUpdateProgress component
  const handleUpdateStateChange = (newState: BulkUpdateState) => {
    setUpdateState(newState);
  };

  // Handle failed results from BulkUpdateProgress component
  const handleFailedResultsChange = (results: BucketUpdateResult[]) => {
    setFailedResults(results);
  };

  // Handle manual reload of local buckets
  const handleReloadLocalBuckets = async () => {
    markForRefresh();
    await fetchBuckets(true);
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

    try {
      const updatedBucketInfo = await invoke<BucketInfo>('get_bucket_info', {
        bucketName: bucketName,
      });

      if (updatedBucketInfo && updatedBucketInfo.name === bucketName) {
        const currentBuckets = buckets();
        const updatedBuckets = currentBuckets.map((bucket: BucketInfo) =>
          bucket.name === bucketName ? updatedBucketInfo : bucket
        );
        updateBucketsCache(updatedBuckets);
      } else {
        throw new Error('Invalid bucket info received');
      }
    } catch (error) {
      console.error('Failed to get updated bucket info:', error);
      if (error instanceof Error && !error.message.includes('cancelled')) {
        markForRefresh();
        await fetchBuckets(true);
      }
    }
  };

  const cleanupTimers = () => {
    resultTimerIds.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    resultTimerIds.clear();

    if (stateTimerId) {
      window.clearTimeout(stateTimerId);
      stateTimerId = null;
    }
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
          buckets={buckets().map((b) => ({ name: b.name, is_git_repo: b.is_git_repo }))}
          updateState={updateState}
          onUpdateStateChange={handleUpdateStateChange}
          onClose={handleCloseBulkUpdate}
          onRefreshBuckets={() => fetchBuckets(true, true)}
          onUpdateBucket={handleUpdateBucket}
          errorDetails={getErrorDetails}
          showErrorDetails={showErrorDetails}
          onToggleErrorDetails={() => setShowErrorDetails(!showErrorDetails())}
          onSetCancelling={setIsCancelling}
          onFailedResultsChange={handleFailedResultsChange}
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
              onCloseBulkUpdate={handleCloseBulkUpdate}
              updatingBuckets={updatingBuckets()}
              updateResults={updateResults()}
              updateResultStatuses={updateResultStatuses()}
              loading={loading() && updateState().status !== 'updating'} // Only show loading when not updating specific buckets
              isUpdatingAll={updateState().status === 'updating'}
              isCancelling={isCancelling()}
              bulkUpdateCompleted={updateState().status === 'completed'}
              bulkUpdateMessage={updateState().message}
              isBulkUpdate={updateState().status === 'updating'}
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
              error={null}
              searchBucket={searchBucket || undefined}
              onClose={closeModal}
              onPackageClick={handlePackageClick}
              onBucketInstalled={handleBucketInstalled}
              onFetchManifests={(bucketName: string) => handleFetchManifests(bucketName)}
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
        onInstall={packageOperations.handleInstall}
        onUninstall={packageOperations.handleUninstall}
        onUpdate={packageOperations.handleUpdate}
        onForceUpdate={packageOperations.handleForceUpdate}
        showBackButton={true}
        onPackageStateChanged={async () => {
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
          }

          // Refresh bucket manifests to reflect installation changes
          const currentBucket = selectedBucket();
          if (currentBucket) {
            await handleFetchManifests(currentBucket.name);
          }
        }}
      />

      <OperationModal
        title={packageOperations.operationTitle()}
        onClose={async (_operationId: string, wasSuccess: boolean) => {
          await packageOperations.closeOperationModal(wasSuccess);
          if (wasSuccess) {
            const currentSelected = packageInfo.selectedPackage();
            if (currentSelected) {
              try {
                const response = await invoke<{ packages: ScoopPackage[]; is_cold: boolean }>(
                  'search_scoop',
                  {
                    term: currentSelected.name,
                  }
                );
                const match = response.packages.find(
                  (p) => p.name === currentSelected.name && p.source === currentSelected.source
                );
                if (match) {
                  const refreshedPackage = packageInfo.syncSelectedPackage(response.packages);
                  await packageInfo.refreshSelectedPackageInfo(refreshedPackage ?? currentSelected);
                }
              } catch (e) {
                console.error('Failed to check package status', e);
              }
            }
          }
        }}
        isScan={packageOperations.isScanning()}
        onInstallConfirm={packageOperations.handleInstallConfirm}
        nextStep={packageOperations.operationNextStep() ?? undefined}
      />
    </div>
  );
}

export default BucketPage;
