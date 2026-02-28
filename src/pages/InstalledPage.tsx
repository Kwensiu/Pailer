import { Show, createSignal, createMemo, onMount, createEffect, onCleanup } from 'solid-js';
import PackageInfoModal from '../components/PackageInfoModal';
import ScoopStatusModal from '../components/ScoopStatusModal';
import OperationModal from '../components/OperationModal';
import { useInstalledPackages } from '../hooks/useInstalledPackages';
import InstalledPageHeader from '../components/page/installed/InstalledPageHeader';
import PackageListView from '../components/page/installed/PackageListView';
import PackageGridView from '../components/page/installed/PackageGridView';
import { View } from '../types/scoop';
import ChangeBucketModal from '../components/ChangeBucketModal';
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
    handleSwitchVersion,
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

  const [searchQuery, setSearchQuery] = createSignal<string>(
    sessionStorage.getItem('installedSearchQuery') || ''
  );
  const [showStatusModal, setShowStatusModal] = createSignal(false);

  // 同步搜索内容到 sessionStorage
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

    // Global ESC key handler to clear search when not focused
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery()) {
        // Check if any input is focused
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

        if (!isInputFocused) {
          e.preventDefault();
          setSearchQuery('');
          // Also clear sessionStorage to ensure search box collapses
          sessionStorage.removeItem('installedSearchQuery');
        }
      }
    };

    document.addEventListener('keydown', handleGlobalEsc);
    onCleanup(() => {
      document.removeEventListener('keydown', handleGlobalEsc);
    });
  });

  const handleCheckStatus = async () => {
    await checkScoopStatus();
    setShowStatusModal(true);
  };

  const filteredPackages = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return processedPackages();

    return processedPackages().filter((p) => p.name.toLowerCase().includes(query));
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
        <div class="flex flex-col items-center justify-center py-16 text-center">
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
              onViewInfo={handleFetchPackageInfo}
              onViewInfoForVersions={handleFetchPackageInfoForVersions}
              onUpdate={handleUpdate}
              onHold={handleHold}
              onUnhold={handleUnhold}
              onSwitchVersion={handleSwitchVersion}
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
            onViewInfoForVersions={handleFetchPackageInfoForVersions}
            onUpdate={handleUpdate}
            onHold={handleHold}
            onUnhold={handleUnhold}
            onSwitchVersion={handleSwitchVersion}
            onUninstall={handleUninstall}
            onChangeBucket={handleOpenChangeBucket}
            operatingOn={operatingOn}
            isPackageVersioned={isPackageVersioned}
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
        context="installed"
        loading={infoLoading()}
        error={infoError()}
        onClose={handleCloseInfoModalWithVersions}
        onUninstall={handleUninstall}
        onUpdate={handleUpdate}
        onForceUpdate={handleForceUpdate}
        onSwitchVersion={(pkg, version) => {
          console.log(`Switched ${pkg.name} to version ${version}`);
          // The PackageInfoModal already calls onPackageStateChanged which triggers a refresh
        }}
        autoShowVersions={autoShowVersions()}
        isPackageVersioned={isPackageVersioned}
        onPackageStateChanged={() => fetchInstalledPackages()}
        onChangeBucket={handleOpenChangeBucket}
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
    </div>
  );
}

export default InstalledPage;
