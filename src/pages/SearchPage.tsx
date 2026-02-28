import PackageInfoModal from '../components/PackageInfoModal';
import OperationModal from '../components/OperationModal';

import { useSearch } from '../hooks/useSearch';
import SearchBar from '../components/page/search/SearchBar';
import SearchResultsTabs from '../components/page/search/SearchResultsTabs';
import SearchResultsList from '../components/page/search/SearchResultsList';

import { createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { t } from '../i18n';
import { createTauriSignal } from '../hooks/createTauriSignal';
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

  onMount(() => {
    restoreSearchResults();
  });

  // 监听搜索结果变化来更新 buckets 列表
  createEffect(() => {
    const buckets = [...new Set([...packageResults(), ...binaryResults()].map((p) => p.source))];
    setUniqueBuckets(buckets);
  });

  // 重置分页到第一页当结果或标签变化时
  createEffect(() => {
    resultsToShow();
    activeTab();
    setCurrentPage(1);
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
  });

  return (
    <div class="p-4">
      <div class="mx-auto max-w-3xl">
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

        <SearchResultsList
          loading={loading()}
          results={resultsToShow()}
          searchTerm={searchTerm()}
          activeTab={activeTab()}
          onViewInfo={fetchPackageInfo}
          onInstall={handleInstall}
          onPackageStateChanged={() => {
            // This will be called when install buttons are clicked
            // The actual refresh will happen in closeOperationModal when the operation completes
          }}
          currentPage={currentPage()}
          onPageChange={setCurrentPage}
        />
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
    </div>
  );
}

export default SearchPage;
