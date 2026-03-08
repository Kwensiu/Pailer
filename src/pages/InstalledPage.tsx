import { Show, createSignal, createMemo, onMount, createEffect } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import PackageInfoModal from '../components/modals/PackageInfoModal';
import BucketInfoModal from '../components/modals/BucketInfoModal';
import ScoopStatusModal from '../components/page/installed/ScoopStatusModal';
import OperationModal from '../components/modals/OperationModal';
import { useInstalledPackages } from '../hooks/useInstalledPackages';
import { usePackageOperations } from '../hooks/usePackageOperations';
import InstalledPageHeader from '../components/page/installed/InstalledPageHeader';
import PackageListView from '../components/page/installed/PackageListView';
import PackageGridView from '../components/page/installed/PackageGridView';
import { View } from '../types/scoop';
import ChangeBucketModal from '../components/modals/ChangeBucketModal';
import { handleBucketPackageClick } from '../hooks/useBucketPackageClick';
import { t } from '../i18n';

interface InstalledPageProps {
  onNavigate?: (view: View) => void;
}

function InstalledPage(props: InstalledPageProps) {
  const {
    loading,
    error,
    processedPackages,
    updatableCount,
    uniqueBuckets,
    isCheckingForUpdates,
    viewMode,
    setViewMode,
    sortKey,
    sortDirection,
    selectedBucket,
    setSelectedBucket,
    selectedPackage,
    info,
    infoLoading,
    infoError,
    setOperationTitle,
    operationTitle,
    operationNextStep,
    operatingOn,
    scoopStatus,
    statusLoading,
    statusError,
    isPackageVersioned,
    checkScoopStatus,
    handleSort,
    handleUpdate,
    handleForceUpdate,
    handleUpdateAll,
    handleUninstall,
    handleOpenChangeBucket,
    handleFetchPackageInfo,
    handleFetchPackageInfoForVersions,
    handleCloseInfoModalWithVersions,
    autoShowVersions,
    fetchInstalledPackages,
    checkForUpdates,
    handleHold,
    handleUnhold,
    // Change bucket states
    changeBucketModalOpen,
    currentPackageForBucketChange,
    newBucketName,
    setNewBucketName,
    handleChangeBucketConfirm,
    handleChangeBucketCancel,
    handleCloseOperationModal,
    // Buckets for selection
    buckets,
  } = useInstalledPackages();

  const { handleInstall } = usePackageOperations();

  const [searchQuery, setSearchQuery] = createSignal<string>(
    sessionStorage.getItem('installedSearchQuery') || ''
  );
  const [showStatusModal, setShowStatusModal] = createSignal(false);
  const [selectedBucketForInfo, setSelectedBucketForInfo] = createSignal<string | null>(null);

  // Bucket manifests state
  const [bucketManifests, setBucketManifests] = createSignal<string[]>([]);
  const [bucketManifestsLoading, setBucketManifestsLoading] = createSignal(false);
  const [bucketManifestsError, setBucketManifestsError] = createSignal<string | null>(null);

  // Fetch bucket manifests
  const fetchBucketManifests = async (bucketName: string) => {
    setBucketManifestsLoading(true);
    setBucketManifestsError(null);
    try {
      const manifests = await invoke<string[]>('get_bucket_manifests', { bucketName });
      setBucketManifests(manifests);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setBucketManifestsError(errorMsg);
      console.error(`Failed to fetch manifests for bucket ${bucketName}:`, errorMsg);
    } finally {
      setBucketManifestsLoading(false);
    }
  };

  // Sync search content to sessionStorage
  createEffect(() => {
    const query = searchQuery();
    if (query) {
      sessionStorage.setItem('installedSearchQuery', query);
    } else {
      sessionStorage.removeItem('installedSearchQuery');
    }
  });

  // Execute a silent refresh when the component mounts
  onMount(() => {
    fetchInstalledPackages(true);
  });

  // Fetch bucket manifests when a bucket is selected for info
  createEffect(() => {
    const bucketName = selectedBucketForInfo();
    if (bucketName) {
      fetchBucketManifests(bucketName);
    }
  });

  const handleCheckStatus = async () => {
    await checkScoopStatus();
    setShowStatusModal(true);
  };

  const filteredPackages = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return processedPackages();

    return processedPackages().filter((p) => {
      // Support package name matching
      if (p.name.toLowerCase().includes(query)) return true;

      // Support source (bucket) matching
      if (p.source.toLowerCase().includes(query)) return true;

      // Support version matching
      if (p.version.toLowerCase().includes(query)) return true;

      return false;
    });
  });

  return (
    <div class="p-6">
      <InstalledPageHeader
        updatableCount={updatableCount}
        onUpdateAll={handleUpdateAll}
        onCheckStatus={handleCheckStatus}
        statusLoading={statusLoading}
        scoopStatus={scoopStatus}
        uniqueBuckets={uniqueBuckets}
        selectedBucket={selectedBucket}
        setSelectedBucket={setSelectedBucket}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isCheckingForUpdates={isCheckingForUpdates}
        onCheckForUpdates={checkForUpdates}
        onRefresh={fetchInstalledPackages}
      />

      <Show when={loading()}>
        <div class="flex h-64 items-center justify-center">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </Show>

      <Show when={error()}>
        <div role="alert" class="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Error: {error()}</span>
          <button class="btn btn-sm btn-primary" onClick={() => fetchInstalledPackages(false)}>
            Try Again
          </button>
        </div>
      </Show>

      <Show when={!loading() && !error() && filteredPackages().length === 0}>
        <div class="flex flex-col items-center justify-center pt-20 text-center">
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
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
              />
            </svg>
          </div>
          <h3 class="mb-2 text-2xl font-bold">{t('noPackagesFound.title')}</h3>
          <p class="text-base-content/70 mb-6 max-w-md text-lg">
            <Show when={searchQuery() || selectedBucket() !== 'all'}>
              {t('noPackagesFound.noMatchCriteria')}
            </Show>
            <Show when={!searchQuery() && selectedBucket() === 'all'}>
              {t('noPackagesFound.noInstalledYet')}
            </Show>
          </p>
          <Show when={searchQuery() || selectedBucket() !== 'all'}>
            <button
              class="btn btn-primary mb-4"
              onClick={() => {
                setSearchQuery('');
                setSelectedBucket('all');
              }}
            >
              {t('noPackagesFound.clearFilters')}
            </button>
          </Show>
          <Show when={!searchQuery() && selectedBucket() === 'all'}>
            <button class="btn btn-primary" onClick={() => props.onNavigate?.('search')}>
              {t('noPackagesFound.browsePackages')}
            </button>
          </Show>
        </div>
      </Show>

      <Show when={!loading() && !error() && filteredPackages().length > 0}>
        <Show
          when={viewMode() === 'list'}
          fallback={
            <PackageGridView
              packages={filteredPackages}
              searchQuery={searchQuery}
              onViewInfo={handleFetchPackageInfo}
              onViewInfoForVersions={handleFetchPackageInfoForVersions}
              onUpdate={handleUpdate}
              onHold={handleHold}
              onUnhold={handleUnhold}
              onUninstall={handleUninstall}
              onChangeBucket={handleOpenChangeBucket}
              operatingOn={operatingOn}
              isPackageVersioned={isPackageVersioned}
            />
          }
        >
          <PackageListView
            packages={filteredPackages}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onViewInfo={handleFetchPackageInfo}
            onViewBucketInfo={(bucketName) => setSelectedBucketForInfo(bucketName)}
            onViewInfoForVersions={handleFetchPackageInfoForVersions}
            onUpdate={handleUpdate}
            onHold={handleHold}
            onUnhold={handleUnhold}
            onUninstall={handleUninstall}
            onChangeBucket={handleOpenChangeBucket}
            operatingOn={operatingOn}
            isPackageVersioned={isPackageVersioned}
            searchQuery={searchQuery}
          />
        </Show>
      </Show>

      <ChangeBucketModal
        isOpen={changeBucketModalOpen()}
        package={currentPackageForBucketChange()}
        buckets={buckets()}
        newBucketName={newBucketName()}
        onNewBucketNameChange={setNewBucketName}
        onConfirm={async () => {
          await handleChangeBucketConfirm();
        }}
        onCancel={handleChangeBucketCancel}
      />

      <PackageInfoModal
        pkg={selectedPackage()}
        info={info()}
        loading={infoLoading()}
        error={infoError()}
        onClose={handleCloseInfoModalWithVersions}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        onUpdate={handleUpdate}
        onForceUpdate={handleForceUpdate}
        autoShowVersions={autoShowVersions()}
        isPackageVersioned={isPackageVersioned}
        onPackageStateChanged={() => fetchInstalledPackages()}
        context="installed"
        fromPackageModal={true}
        setOperationTitle={setOperationTitle}
      />
      <OperationModal
        title={operationTitle()}
        onClose={handleCloseOperationModal}
        nextStep={operationNextStep() ?? undefined}
      />
      <ScoopStatusModal
        isOpen={showStatusModal()}
        onClose={() => setShowStatusModal(false)}
        status={scoopStatus()}
        loading={statusLoading()}
        error={statusError()}
        onNavigate={props.onNavigate}
      />

      <Show when={selectedBucketForInfo()}>
        <BucketInfoModal
          bucket={buckets().find((b) => b.name === selectedBucketForInfo()) || null}
          manifests={bucketManifests()}
          manifestsLoading={bucketManifestsLoading()}
          error={bucketManifestsError()}
          zIndex="z-[70]"
          fromPackageModal={true}
          onClose={() => {
            setSelectedBucketForInfo(null);
            setBucketManifests([]);
            setBucketManifestsError(null);
          }}
          onPackageClick={async (packageName: string) => {
            // Use the shared hook for consistent behavior
            await handleBucketPackageClick(
              packageName,
              selectedBucketForInfo()!,
              async (pkg) => handleFetchPackageInfo(pkg),
              undefined, // Don't close bucket modal
              processedPackages() // Pass installed packages list
            );
          }}
        />
      </Show>
    </div>
  );
}

export default InstalledPage;
