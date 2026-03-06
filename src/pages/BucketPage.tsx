import { createSignal, onMount, Show, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { useBuckets, type BucketInfo } from '../hooks/useBuckets';
import { usePackageInfo } from '../hooks/usePackageInfo';
import { usePackageOperations } from '../hooks/usePackageOperations';
import { createTauriSignal } from '../hooks/createTauriSignal';
import { ScoopPackage } from '../types/scoop';
import BucketInfoModal from '../components/BucketInfoModal';
import PackageInfoModal from '../components/PackageInfoModal';
import OperationModal from '../components/OperationModal';
import BucketSearch from '../components/page/buckets/BucketSearch';
import BucketGrid from '../components/page/buckets/BucketGrid';
import BucketSearchResults from '../components/page/buckets/BucketSearchResults';
import BulkUpdateProgress, { BulkUpdateState } from '../components/page/buckets/BulkUpdateProgress';
import { SearchableBucket } from '../hooks/useBucketSearch';
import { t } from '../i18n';

interface BucketUpdateResult {
  success: boolean;
  message: string;
  bucket_name: string;
  bucket_path?: string;
  manifest_count?: number;
}

type UpdateState = BulkUpdateState;

function BucketPage() {
  const { buckets, loading, error, fetchBuckets, markForRefresh, getBucketManifests, cleanup } =
    useBuckets();
  const packageInfo = usePackageInfo();
  const packageOperations = usePackageOperations();

  const [selectedBucket, setSelectedBucket] = createSignal<BucketInfo | null>(null);
  const [selectedBucketDescription, setSelectedBucketDescription] = createSignal<
    string | undefined
  >(undefined);
  const [manifests, setManifests] = createSignal<string[]>([]);
  const [manifestsLoading, setManifestsLoading] = createSignal(false);

  // Search state
  const [isSearchActive, setIsSearchActive] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<SearchableBucket[]>([]);
  const [searchTotalCount, setSearchTotalCount] = createSignal(0);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [isExpandedSearch, setIsExpandedSearch] = createTauriSignal('bucketExpandedSearch', false);

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
    fetchBuckets();
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
    }
  };

  const handleSearchResults = (results: any) => {
    setSearchResults(results.results || []);
    setSearchTotalCount(results.totalCount || 0);
    setSearchLoading(results.isSearching || false);
    setSearchError(results.error || null);
    setIsExpandedSearch(results.isExpandedSearch || false);
  };

  const handleViewBucket = async (bucket: BucketInfo) => {
    setSelectedBucket(bucket);
    setSelectedBucketDescription(undefined); // Clear description for regular buckets
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
      setSelectedBucketDescription(searchBucket.description); // Store description for external buckets
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
    setSelectedBucketDescription(undefined);
    setManifests([]);
    setManifestsLoading(false);
  };

  const handlePackageClick = async (packageName: string, bucketName: string) => {
    // Create a ScoopPackage object for the package info modal
    const pkg: ScoopPackage = {
      name: packageName,
      version: '', // Will be fetched by package info
      source: bucketName,
      updated: '',
      is_installed: false, // Will be determined by package info
      info: '',
      match_source: 'name',
    };

    // Simply open package info modal - bucket modal stays open underneath
    await packageInfo.fetchPackageInfo(pkg);
  };

  // Handle bucket installation/removal - refresh bucket list
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

      // Only store result message if not in cancelled bulk update
      if (!isBulkUpdateCancelling) {
        // Determine status based on result
        let status: 'success' | 'info' | 'error' | 'default' = 'default';
        if (result.success) {
          if (result.message.includes('already up to date')) {
            status = 'info';
          } else {
            status = 'success';
          }
        } else {
          status = 'error';
        }

        setUpdateResults((prev) => ({
          ...prev,
          [bucketName]: result.message,
        }));

        setUpdateResultStatuses((prev) => ({
          ...prev,
          [bucketName]: status,
        }));
      }

      if (result.success) {
        // If this bucket is currently selected, refresh its manifests
        const currentBucket = selectedBucket();
        if (currentBucket && currentBucket.name === bucketName) {
          await handleFetchManifests(bucketName);
        }

        // Conditionally refresh bucket list to avoid excessive refreshes during batch updates
        if (shouldRefreshBuckets && !isBulkUpdateCancelling) {
          // Refresh bucket list without showing loading screen
          markForRefresh();
          // Use quiet mode to refresh without showing loading state
          await fetchBuckets(true, true);
        }
      }

      // Only set timer if not cancelled and we have a result
      if (!isBulkUpdateCancelling) {
        // Clear result message after 2 seconds to avoid long display
        const timerId = window.setTimeout(() => {
          setUpdateResults((prev) => {
            const newResults = { ...prev };
            delete newResults[bucketName];
            return newResults;
          });
          resultTimerIds.delete(bucketName);
        }, 2000);

        resultTimerIds.set(bucketName, timerId);
      }

      return result; // Return the result
    } catch (error) {
      // Check if operation was aborted
      if (abortSignal?.aborted) {
        return { success: false, message: 'Operation cancelled', bucket_name: bucketName };
      }

      console.error('Failed to update bucket:', bucketName, error);

      // Only store error result if not in cancelled bulk update
      if (!isBulkUpdateCancelling) {
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
        }, 2000);

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

  return (
    <div class="p-6">
      <div class="mx-auto">
        {/* Header Section */}
        <div
          class={`relative mb-6 transition-all duration-300 ${isSearchActive() ? 'mb-32' : 'mb-6'}`}
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
            <div class="card bg-base-100">
              <div class="card-body">
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
                />
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Modals */}
      <Show when={selectedBucket()}>
        <BucketInfoModal
          bucket={selectedBucket()!}
          description={selectedBucketDescription()}
          manifests={manifests()}
          manifestsLoading={manifestsLoading()}
          error={null}
          searchBucket={selectedSearchBucket() || undefined}
          onClose={closeModal}
          onPackageClick={handlePackageClick}
          onBucketInstalled={handleBucketInstalled}
          onFetchManifests={(bucketName: string) => handleFetchManifests(bucketName)}
        />
      </Show>

      <PackageInfoModal
        pkg={packageInfo.selectedPackage()}
        info={packageInfo.info()}
        loading={packageInfo.loading()}
        error={packageInfo.error()}
        onClose={packageInfo.closeModal}
        onInstall={packageOperations.handleInstall}
        onUninstall={packageOperations.handleUninstall}
        showBackButton={true}
        onPackageStateChanged={() => {
          // Refresh bucket manifests to reflect installation changes
          const currentBucket = selectedBucket();
          if (currentBucket) {
            handleFetchManifests(currentBucket.name);
          }
        }}
      />

      <OperationModal
        title={packageOperations.operationTitle()}
        onClose={(_operationId: string, wasSuccess: boolean) => {
          packageOperations.closeOperationModal(wasSuccess);
          if (wasSuccess) {
            const currentSelected = packageInfo.selectedPackage();
            if (currentSelected) {
              (async () => {
                try {
                  const response = await invoke<{ packages: ScoopPackage[]; is_cold: boolean }>(
                    'search_scoop',
                    {
                      term: currentSelected.name,
                    }
                  );
                  const match = response.packages.find((p) => p.name === currentSelected.name);
                  if (match) {
                    packageInfo.updateSelectedPackage(match);
                  }
                } catch (e) {
                  console.error('Failed to check package status', e);
                }
              })();
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
