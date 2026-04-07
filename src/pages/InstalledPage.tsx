import { Show, createSignal, createMemo, createEffect, onMount, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openPath } from '@tauri-apps/plugin-opener';
import PackageInfoModal from '../components/modals/PackageInfoModal';
import BucketInfoModal from '../components/modals/BucketInfoModal';
import ScoopStatusModal from '../components/page/installed/ScoopStatusModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import OperationModal from '../components/modals/OperationModal';
import { useInstalledPackages, usePackageOperations, handleBucketPackageClick } from '../hooks';
import InstalledPageHeader from '../components/page/installed/InstalledPageHeader';
import PackageListView from '../components/page/installed/PackageListView';
import PackageGridView from '../components/page/installed/PackageGridView';
import { View, ScoopPackage } from '../types/scoop';
import ChangeBucketModal from '../components/modals/ChangeBucketModal';
import { t } from '../i18n';
import versionedPackagesStore from '../stores/versionedPackagesStore';
import installedPackagesStore from '../stores/installedPackagesStore';
import type { OperationResult } from '../types/operations';

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
    selectedVersionType,
    setSelectedVersionType,
    selectedPackage,
    updateSelectedPackage,
    refreshSelectedPackageInfo,
    info,
    operatingOn,
    scoopStatus,
    statusLoading,
    statusError,
    hasVersions,
    checkScoopStatus,
    handleSort,
    handleUpdate,
    handleForceUpdate,
    handleUpdateAll,
    handleUninstall,
    handleOpenChangeBucket,
    handleFetchPackageInfo,
    handleFetchPackageInfoForVersions,
    handleSwitchVersion,
    handleCloseInfoModalWithVersions,
    autoShowVersions,
    handleForceRefresh,
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
    // Buckets for selection
    buckets,
  } = useInstalledPackages();

  const {
    handleInstall,
    operationTitle,
    operationNextStep,
    isScanning,
    handleInstallConfirm,
    closeOperationModal,
    pailerUpdateConfirmOpen,
    pailerUpdateType,
    handlePailerUpdateConfirm,
    handlePailerUpdateCancel,
  } = usePackageOperations();

  const [searchQuery, setSearchQuery] = createSignal<string>(
    sessionStorage.getItem('installedSearchQuery') || ''
  );
  const [showStatusModal, setShowStatusModal] = createSignal(false);
  const [selectedBucketForInfo, setSelectedBucketForInfo] = createSignal<string | null>(null);

  // Bucket manifests state
  const [bucketManifests, setBucketManifests] = createSignal<string[]>([]);
  const [bucketManifestsLoading] = createSignal(false);
  const [bucketManifestsError, setBucketManifestsError] = createSignal<string | null>(null);

  // Sync search content to sessionStorage
  createEffect(() => {
    const query = searchQuery();
    if (query) {
      sessionStorage.setItem('installedSearchQuery', query);
    } else {
      sessionStorage.removeItem('installedSearchQuery');
    }
  });

  const [refreshing, setRefreshing] = createSignal(false);

  // Wrap the original handleForceRefresh to manage loading state
  const wrappedHandleForceRefresh = async () => {
    setRefreshing(true);
    try {
      await handleForceRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckStatus = async () => {
    await checkScoopStatus();
    setShowStatusModal(true);
  };

  const handleOpenFolder = async (pkg: ScoopPackage) => {
    try {
      const packagePath = await invoke<string>('get_package_path', { packageName: pkg.name });
      await openPath(packagePath);
    } catch (err) {
      console.error(`Failed to open folder for ${pkg.name}:`, err);
    }
  };

  const filteredPackages = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return processedPackages();

    return processedPackages().filter((p: any) => {
      // Support package name matching
      if (p.name.toLowerCase().includes(query)) return true;

      // Support source (bucket) matching
      if (p.source.toLowerCase().includes(query)) return true;

      // Support version matching
      if (p.version.toLowerCase().includes(query)) return true;

      return false;
    });
  });
  const installedPackageNames = createMemo(() =>
    installedPackagesStore
      .packages()
      .map((pkg) => pkg.name)
      .filter(Boolean)
  );
  const showInitialLoading = createMemo(
    () => loading() && !error() && processedPackages().length === 0
  );

  const isRefreshing = () => refreshing();

  onMount(() => {
    let disposed = false;
    let unlistenOperationFinished: (() => void) | undefined;

    const setupOperationFinishedListener = async () => {
      const unlisten = await listen('package-mutation-finished', (event) => {
        const payload = event.payload as OperationResult & {
          operation_name?: string;
          packageName?: string;
          packageSource?: string | null;
          packageState?: ScoopPackage;
        };

        const currentSelected = selectedPackage();
        if (!payload.success || !currentSelected) {
          return;
        }

        const packageState = payload.packageState;
        const matchesSelectedPackage = packageState
          ? packageState.name === currentSelected.name &&
            packageState.source === currentSelected.source
          : payload.packageName === currentSelected.name &&
            (!payload.packageSource || payload.packageSource === currentSelected.source);

        if (!matchesSelectedPackage) {
          return;
        }

        if (packageState) {
          updateSelectedPackage({
            ...currentSelected,
            ...packageState,
            available_version: undefined,
          });
          void refreshSelectedPackageInfo({
            ...currentSelected,
            ...packageState,
            available_version: undefined,
          });
          return;
        }

        updateSelectedPackage({
          ...currentSelected,
          is_installed: false,
          is_installed_from_current_bucket: false,
          available_version: undefined,
        });
        void refreshSelectedPackageInfo({
          ...currentSelected,
          is_installed: false,
          is_installed_from_current_bucket: false,
          available_version: undefined,
        });
      });

      if (disposed) {
        unlisten();
        return;
      }

      unlistenOperationFinished = unlisten;
    };

    void setupOperationFinishedListener();

    onCleanup(() => {
      disposed = true;
      unlistenOperationFinished?.();
    });
  });

  return (
    <div class="mx-auto max-w-7xl">
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
          selectedVersionType={selectedVersionType}
          setSelectedVersionType={setSelectedVersionType}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          isCheckingForUpdates={isCheckingForUpdates}
          onCheckForUpdates={checkForUpdates}
          isRefreshing={loading}
          onRefresh={wrappedHandleForceRefresh}
        />

        <Show when={showInitialLoading()}>
          <div class="flex h-64 items-center justify-center">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </Show>

        <Show when={!showInitialLoading() && error()}>
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
            <button class="btn btn-sm btn-primary" onClick={() => handleForceRefresh()}>
              Try Again
            </button>
          </div>
        </Show>

        <Show when={!showInitialLoading() && !error() && filteredPackages().length === 0}>
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
              <Show
                when={
                  searchQuery() || selectedBucket() !== 'all' || selectedVersionType() !== 'all'
                }
              >
                {t('noPackagesFound.noMatchCriteria')}
              </Show>
              <Show
                when={
                  !searchQuery() && selectedBucket() === 'all' && selectedVersionType() === 'all'
                }
              >
                {t('noPackagesFound.noInstalledYet')}
              </Show>
            </p>
            <Show
              when={searchQuery() || selectedBucket() !== 'all' || selectedVersionType() !== 'all'}
            >
              <button
                class="btn btn-primary mb-4"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBucket('all');
                  setSelectedVersionType('all');
                }}
              >
                {t('noPackagesFound.clearFilters')}
              </button>
            </Show>
            <Show
              when={!searchQuery() && selectedBucket() === 'all' && selectedVersionType() === 'all'}
            >
              <button class="btn btn-primary" onClick={() => props.onNavigate?.('search')}>
                {t('noPackagesFound.browsePackages')}
              </button>
            </Show>
          </div>
        </Show>

        <Show when={!showInitialLoading() && !error() && filteredPackages().length > 0}>
          <div
            classList={{
              'opacity-60': isRefreshing(),
              'pointer-events-none select-none': isRefreshing(),
              'transition-opacity duration-200': true,
            }}
            aria-busy={isRefreshing()}
          >
            <Show
              when={viewMode() === 'list'}
              fallback={
                <PackageGridView
                  packages={filteredPackages}
                  searchQuery={searchQuery}
                  onViewInfo={handleFetchPackageInfo}
                  onViewInfoForVersions={handleFetchPackageInfoForVersions}
                  onSwitchVersion={handleSwitchVersion}
                  onUpdate={handleUpdate}
                  onOpenFolder={handleOpenFolder}
                  onHold={handleHold}
                  onUnhold={handleUnhold}
                  onUninstall={handleUninstall}
                  onChangeBucket={handleOpenChangeBucket}
                  operatingOn={operatingOn}
                  hasVersions={hasVersions}
                />
              }
            >
              <PackageListView
                packages={filteredPackages}
                packageNames={installedPackageNames}
                onSort={handleSort}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onViewInfo={handleFetchPackageInfo}
                onViewBucketInfo={(bucketName) => setSelectedBucketForInfo(bucketName)}
                onViewInfoForVersions={handleFetchPackageInfoForVersions}
                onSwitchVersion={handleSwitchVersion}
                onUpdate={handleUpdate}
                onHold={handleHold}
                onUnhold={handleUnhold}
                onUninstall={handleUninstall}
                onChangeBucket={handleOpenChangeBucket}
                onOpenFolder={handleOpenFolder}
                operatingOn={operatingOn}
                hasVersions={hasVersions}
                searchQuery={searchQuery}
              />
            </Show>
          </div>
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
          loading={false}
          error={null}
          onClose={handleCloseInfoModalWithVersions}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onUpdate={handleUpdate}
          onForceUpdate={handleForceUpdate}
          onChangeBucket={handleOpenChangeBucket}
          autoShowVersions={autoShowVersions()}
          hasVersions={hasVersions}
          onPackageStateChanged={async () => {
            await installedPackagesStore.silentRefetch();

            const currentSelected = selectedPackage();
            if (currentSelected) {
              const refreshedPackage = installedPackagesStore
                .packages()
                .find(
                  (pkg) =>
                    pkg.name === currentSelected.name && pkg.source === currentSelected.source
                );
              if (refreshedPackage) {
                updateSelectedPackage(refreshedPackage);
              }

              await versionedPackagesStore.fetchPackageVersions(currentSelected.name, false);
            }
          }}
          context="installed"
        />
        <OperationModal
          title={operationTitle()}
          onClose={async (_operationId: string, wasSuccess: boolean) => {
            await closeOperationModal(wasSuccess);
          }}
          isScan={isScanning()}
          onInstallConfirm={handleInstallConfirm}
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
          {(() => {
            const bucket = buckets().find((b: any) => b.name === selectedBucketForInfo());

            return (
              <BucketInfoModal
                bucket={bucket || null}
                manifests={bucketManifests()}
                manifestsLoading={bucketManifestsLoading()}
                error={bucketManifestsError()}
                zIndex="z-[70]"
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
            );
          })()}
        </Show>

        {/* Pailer Self-Update Confirmation Modal */}
        <ConfirmationModal
          isOpen={pailerUpdateConfirmOpen()}
          title={t(
            pailerUpdateType() === 'force-update'
              ? 'pailerUpdate.forceUpdateTitle'
              : 'pailerUpdate.updateTitle'
          )}
          onConfirm={handlePailerUpdateConfirm}
          onCancel={handlePailerUpdateCancel}
          confirmText={t('pailerUpdate.updateButton')}
          cancelText={t('buttons.cancel')}
          type="pailer-update"
        >
          <div class="space-y-4">
            <div class="bg-base-200 border-base-300 rounded-lg border p-4">
              <div class="text-base-content/80 space-y-2 text-sm">
                <div class="text-base-content/90 mb-3 font-medium">
                  {t('pailerUpdate.updateSteps').split('\n')[0]}
                </div>
                <ul class="ml-2 list-inside list-disc space-y-2">
                  {t('pailerUpdate.updateSteps')
                    .split('\n')
                    .slice(1)
                    .map((step: string) => (
                      <li class="flex items-start gap-2">
                        <span class="bg-primary/60 mt-2 inline-block h-2 w-2 shrink-0 rounded-full"></span>
                        <span class="flex-1">{step.replace(/^\d+\.\s*/, '')}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        </ConfirmationModal>
      </div>
    </div>
  );
}

export default InstalledPage;
