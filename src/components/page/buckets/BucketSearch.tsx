import { Accessor, Show, createSignal, createEffect } from 'solid-js';
import { Search, X, TriangleAlert, LoaderCircle } from 'lucide-solid';
import { useBucketSearch } from '../../../hooks/useBucketSearch';
import { t } from '../../../i18n';

interface BucketSearchProps {
  isActive: Accessor<boolean>;
  onToggle: () => void;
  onSearchResults?: (results: any) => void;
}

function BucketSearch(props: BucketSearchProps) {
  const bucketSearch = useBucketSearch();
  const [searchInput, setSearchInput] = createSignal('');
  const [showExpandedDialog, setShowExpandedDialog] = createSignal(false);
  const [expandedInfo, setExpandedInfo] = createSignal<any>(null);
  const [tempDisableChineseBuckets, setTempDisableChineseBuckets] = createSignal(false);
  const [tempMinimumStars, setTempMinimumStars] = createSignal(2);

  // Input ref to maintain focus
  let inputRef: HTMLInputElement | undefined;

  // Simple search input handler like SearchBar.tsx
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    bucketSearch.setSearchQuery(value);
  };

  // Load defaults when search becomes active (simple like SearchPage)
  createEffect(() => {
    if (props.isActive() && !searchInput()) {
      bucketSearch.loadDefaults();
    }
  });

  // Watch search results and update parent (simple like SearchPage)
  createEffect(() => {
    if (props.onSearchResults) {
      props.onSearchResults({
        results: bucketSearch.searchResults(),
        totalCount: bucketSearch.totalCount(),
        isSearching: bucketSearch.isSearching(),
        error: bucketSearch.error(),
        isExpandedSearch: bucketSearch.isExpandedSearch(),
      });
    }
  });

  // Maintain focus during search operations
  createEffect(() => {
    if (
      !bucketSearch.isSearching() &&
      document.activeElement !== inputRef &&
      searchInput().length > 0
    ) {
      // Only restore focus if we were actively searching and input has content
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  const handleExpandedSearchClick = async () => {
    const info = await bucketSearch.getExpandedSearchInfo();
    if (info) {
      setExpandedInfo(info);
      setShowExpandedDialog(true);
    }
  };

  const confirmExpandedSearch = async () => {
    setShowExpandedDialog(false);
    bucketSearch.setIncludeExpanded(true);
    bucketSearch.setDisableChineseBuckets(tempDisableChineseBuckets());
    bucketSearch.setMinimumStars(tempMinimumStars());
    await bucketSearch.searchBuckets(
      searchInput(),
      true,
      undefined,
      undefined,
      tempDisableChineseBuckets(),
      tempMinimumStars()
    );
  };

  const closeSearch = () => {
    bucketSearch.clearSearch();
    setSearchInput('');
    bucketSearch.setSortBy('stars'); // Reset to stars sorting when closing search
    props.onToggle();
  };

  return (
    <>
      {/* Search Button */}
      <div class="flex items-center gap-3">
        <Show when={!props.isActive()}>
          <div class="border-primary/20 hover:border-primary/40 flex items-center gap-3 rounded-lg border px-4 py-2 transition-all duration-200">
            <div class="flex flex-col">
              <span class="text-primary text-sm font-semibold">
                {t('bucket.search.discoverNew')}
              </span>
              <span class="text-base-content/60 hidden text-xs sm:block">
                {t('bucket.search.discoverDescription')}
              </span>
            </div>
            <button
              onClick={props.onToggle}
              class="btn btn-circle btn-primary hover:btn-primary shadow-lg transition-all duration-200 hover:scale-110"
              aria-label={t('bucket.search.searchForBuckets')}
            >
              <Search class="h-5 w-5" />
            </button>
          </div>
        </Show>
      </div>

      {/* Search Bar - Slides in from top */}
      <div
        class={`absolute top-0 right-0 left-0 z-50 transition-all duration-300 ease-in-out ${
          props.isActive()
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-4 opacity-0'
        }`}
      >
        {/* Backdrop to ensure search bar stands out */}
        <div class="bg-base-100/80 absolute inset-0 -z-10 rounded-lg backdrop-blur-sm"></div>

        <div class="bg-base-100 border-base-300 relative mb-4 flex flex-col gap-4 rounded-lg border p-4 shadow-xl">
          {/* Search Input Row */}
          <div class="flex items-center gap-4">
            <div class="relative flex-1">
              <span class="absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                <Show
                  when={!bucketSearch.isSearching()}
                  fallback={<LoaderCircle class="h-5 w-5 animate-spin text-gray-400" />}
                >
                  <Search class="h-5 w-5 text-gray-400" />
                </Show>
              </span>

              <input
                ref={inputRef}
                type="text"
                placeholder={t('bucket.search.searchBuckets')}
                class="input input-bordered bg-base-300 w-full pr-4 pl-10 transition-colors duration-200"
                value={searchInput()}
                onInput={(e) => handleSearchInput(e.currentTarget.value)}
                disabled={bucketSearch.isSearching()}
              />
            </div>

            <Show when={searchInput().length > 0}>
              <button
                onClick={() => handleSearchInput('')}
                class="btn btn-circle btn-sm btn-ghost hover:btn-error"
                aria-label={t('bucket.search.clearSearch')}
                disabled={bucketSearch.isSearching()}
              >
                <X class="h-4 w-4" />
              </button>
            </Show>

            <button
              onClick={closeSearch}
              class="btn btn-circle btn-outline hover:btn-error transition-colors"
              aria-label={t('bucket.search.closeSearch')}
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          {/* Search Options Row */}
          <div class="flex items-center justify-between gap-4 text-sm">
            <div class="flex items-center gap-4">
              {/* Sort Options */}
              <div class="flex items-center gap-2">
                <span class="text-base-content/70">{t('bucket.search.sortBy')}</span>
                <select
                  class="select select-sm select-bordered"
                  value={bucketSearch.sortBy()}
                  onChange={async (e) => {
                    bucketSearch.setSortBy(e.currentTarget.value);
                    // Manually trigger search if we have a query
                    if (searchInput().trim()) {
                      await bucketSearch.searchBuckets(searchInput());
                    }
                    // Restore focus to input
                    inputRef?.focus();
                  }}
                >
                  <option value="stars">{t('bucket.search.sortStars')}</option>
                  <option value="relevance">{t('bucket.search.sortRelevance')}</option>
                  <option value="apps">{t('bucket.search.sortApps')}</option>
                  <option value="name">{t('bucket.search.sortName')}</option>
                </select>
              </div>

              {/* Results Count */}
              <Show when={bucketSearch.searchResults().length > 0 && !bucketSearch.isSearching()}>
                <div class="text-base-content/70">
                  {t('bucket.search.resultsCount', {
                    count: bucketSearch.searchResults().length,
                    total: bucketSearch.totalCount(),
                  })}
                </div>
              </Show>
            </div>

            {/* Expanded Search Controls */}
            <div class="flex items-center gap-2">
              <Show when={!bucketSearch.cacheExists() && !bucketSearch.isExpandedSearch()}>
                <button
                  onClick={async () => {
                    await handleExpandedSearchClick();
                  }}
                  class="btn btn-sm btn-outline btn-warning"
                  disabled={bucketSearch.isSearching()}
                >
                  <TriangleAlert class="mr-1 h-4 w-4" />
                  {t('bucket.search.communityBuckets')}
                </button>
              </Show>

              <Show when={bucketSearch.cacheExists() || bucketSearch.isExpandedSearch()}>
                <button
                  onClick={async () => {
                    await bucketSearch.disableExpandedSearch();
                    // The effect will handle updating parent results
                  }}
                  class="btn btn-sm btn-outline btn-error"
                  disabled={bucketSearch.isSearching()}
                  title={t('bucket.search.disableCommunityTitle')}
                >
                  <X class="mr-1 h-4 w-4" />
                  {t('bucket.search.disableCommunity')}
                </button>
              </Show>
            </div>
          </div>

          {/* Error Display */}
          <Show when={bucketSearch.error()}>
            <div class="alert alert-error alert-sm">
              <TriangleAlert class="h-4 w-4" />
              <span>{bucketSearch.error()}</span>
            </div>
          </Show>
        </div>
      </div>

      {/* Expanded Search Confirmation Dialog */}
      <Show when={showExpandedDialog()}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-200 max-h-[80vh] w-11/12 max-w-2xl overflow-y-auto">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-bold">{t('bucket.search.expandSearchTitle')}</h3>
              <Show when={expandedInfo()}>
                <div class="text-warning flex items-center gap-2">
                  <TriangleAlert class="h-5 w-5" />
                  <span class="text-sm font-medium">{t('bucket.search.largeDatasetWarning')}</span>
                </div>
              </Show>
            </div>

            <Show when={expandedInfo()}>
              <div class="space-y-4">
                <div class="bg-base-content-bg space-y-2 rounded-lg p-4">
                  <div class="flex justify-between">
                    <span>{t('bucket.search.estimatedDownloadSize')}</span>
                    <span class="font-bold">{expandedInfo()?.estimated_size_mb} MB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>{t('bucket.search.totalBuckets')}</span>
                    <span class="font-bold">~{expandedInfo()?.total_buckets}</span>
                  </div>
                </div>

                <p class="text-base-content/70 mr-2 ml-2 text-sm wrap-break-word">
                  {expandedInfo()?.description}
                </p>

                <div class="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950">
                  <p class="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>{t('bucket.search.note')}:</strong> {t('bucket.search.expandNote')}
                  </p>
                </div>

                {/* Filter Options */}
                <div class="bg-base-200 space-y-2 rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <span class="font-bold">{t('bucket.search.filterOptions')}</span>
                  </div>

                  {/* Disable Chinese Buckets */}
                  <div class="flex items-center justify-between">
                    <span class="text-sm">{t('bucket.search.disableChineseBuckets')}</span>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-primary"
                      checked={tempDisableChineseBuckets()}
                      onChange={(e) => setTempDisableChineseBuckets(e.currentTarget.checked)}
                    />
                  </div>

                  {/* Minimum Star Limit */}
                  <div class="flex items-center justify-between">
                    <span class="text-sm">{t('bucket.search.minimumGithubStars')}</span>
                    <input
                      type="number"
                      class="input input-bordered input-sm w-20"
                      min="0"
                      max="1000"
                      value={tempMinimumStars()}
                      onInput={(e) => setTempMinimumStars(parseInt(e.currentTarget.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </Show>

            <div class="modal-action">
              <button class="btn btn-outline" onClick={() => setShowExpandedDialog(false)}>
                {t('bucket.search.cancel')}
              </button>
              <button
                class="btn btn-secondary"
                onClick={confirmExpandedSearch}
                disabled={bucketSearch.isSearching()}
              >
                {t('bucket.search.enableExpandedSearch')}
              </button>
            </div>
          </div>
          <div class="modal-backdrop" onClick={() => setShowExpandedDialog(false)}></div>
        </div>
      </Show>
    </>
  );
}

export default BucketSearch;
