import { Accessor, Show, createSignal, createEffect } from 'solid-js';
import {
  Search,
  X,
  TriangleAlert,
  LoaderCircle,
  Settings2,
  Globe,
  ShieldCheck,
  RefreshCw,
} from 'lucide-solid';
import { useBucketSearch } from '../../../../hooks';
import { useOperations } from '../../../../stores/operations';
import { t } from '../../../../i18n';
import LargeDatasetWarning from './WarningModal';

interface BucketSearchProps {
  isActive: Accessor<boolean>;
  onToggle: () => void;
  onSearchResults?: (results: any) => void;
}

function BucketSearch(props: BucketSearchProps) {
  const bucketSearch = useBucketSearch();
  const { checkLargeDatasetWarning } = useOperations();
  const [searchInput, setSearchInput] = createSignal('');
  const [showOptions, setShowOptions] = createSignal(false);
  const [showWarningModal, setShowWarningModal] = createSignal(false);

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
        hasMore: bucketSearch.hasMore(),
        isLoadingMore: bucketSearch.isLoadingMore(),
        loadMore: bucketSearch.loadMore,
      });
    }
  });

  // Maintain focus during search operations
  createEffect(() => {
    if (
      !bucketSearch.isSearching() &&
      document.activeElement !== inputRef &&
      searchInput().length > 0 &&
      props.isActive()
    ) {
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  const handleCommunityToggle = async () => {
    if (bucketSearch.isSearching() || bucketSearch.isRefreshingCache()) {
      return;
    }

    if (bucketSearch.includeExpanded()) {
      await bucketSearch.disableExpandedSearch();
      return;
    }

    // Show warning modal if not dismissed
    if (checkLargeDatasetWarning()) {
      setShowWarningModal(true);
      return;
    }

    // Proceed directly if already dismissed
    await proceedWithExpandedSearch();
  };

  const proceedWithExpandedSearch = async () => {
    setShowWarningModal(false);

    // Capture search params at start to prevent stale values
    const queryAtStart = searchInput().trim() || undefined;
    const disableChineseAtStart = bucketSearch.disableChineseBuckets();
    const minimumStarsAtStart = bucketSearch.minimumStars();

    try {
      // Prepare cache before setting expanded mode
      if (!bucketSearch.cacheExists()) {
        const result = await bucketSearch.refreshCommunityCache();
        if (!result) {
          // Cache refresh failed, don't enable expanded search
          return;
        }
      } else {
        const info = await bucketSearch.fetchCacheInfo();
        if (!info) {
          // Failed to fetch cache info, don't enable expanded search
          return;
        }
      }

      // Only set expanded mode after cache is ready
      bucketSearch.setIncludeExpanded(true);

      await bucketSearch.searchBuckets(
        queryAtStart,
        true,
        undefined,
        undefined,
        disableChineseAtStart,
        minimumStarsAtStart
      );
    } catch (err) {
      // On any error, ensure we don't leave expanded mode enabled without valid cache
      console.error('Failed to enable expanded search:', err);
    }
  };

  const handleRefreshCommunityCache = async () => {
    if (bucketSearch.isSearching() || bucketSearch.isRefreshingCache()) {
      return;
    }

    await bucketSearch.refreshCommunityCache();
  };

  const communityCacheDate = () => {
    const date = bucketSearch.cacheInfo()?.local_updated_at;
    if (!date) {
      return t('bucket.search.noCacheDate');
    }

    return date.split(' ')[0];
  };

  const closeSearch = () => {
    bucketSearch.clearSearch();
    setSearchInput('');
    bucketSearch.setSortBy('stars'); // Reset to stars sorting when closing search
    setShowOptions(false);
    props.onToggle();
  };

  return (
    <>
      {/* Search Button / Trigger Area */}
      <div class="flex items-center gap-3">
        <Show when={!props.isActive()}>
          <div
            onClick={props.onToggle}
            class="group border-primary/10 hover:border-primary/30 bg-primary/5 hover:bg-primary/10 flex cursor-pointer items-center gap-4 rounded-xl border px-5 py-3 transition-all duration-300 active:scale-95"
          >
            <div class="flex flex-col">
              <span class="text-primary text-sm font-bold tracking-tight">
                {t('bucket.search.discoverNew')}
              </span>
              <span class="text-base-content/50 hidden text-xs sm:block">
                {t('bucket.search.discoverDescription')}
              </span>
            </div>
            <div class="bg-primary group-hover:bg-primary-focus flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-colors duration-300">
              <Search class="h-5 w-5 text-white" />
            </div>
          </div>
        </Show>
      </div>

      {/* Search Bar Container */}
      <div
        class={`absolute top-0 right-0 left-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          props.isActive()
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-12 opacity-0'
        }`}
      >
        {/* Backdrop blur effect */}
        <div class="bg-base-100/60 absolute inset-0 -z-10 rounded-2xl shadow-md backdrop-blur-xl"></div>

        <div class="bg-base-100/80 border-base-content/5 relative flex flex-col overflow-hidden rounded-2xl border p-2 shadow-md">
          {/* Main Search Row */}
          <div class="flex items-center gap-2 p-1">
            <div class="group relative flex-1">
              <div class="absolute inset-y-0 left-0 flex items-center pl-4">
                <Show
                  when={!bucketSearch.isSearching()}
                  fallback={<LoaderCircle class="text-primary/60 h-5 w-5 animate-spin" />}
                >
                  <Search class="text-base-content/30 group-focus-within:text-primary h-5 w-5 transition-colors" />
                </Show>
              </div>

              <input
                ref={inputRef}
                type="text"
                placeholder={t('bucket.search.searchBuckets')}
                class="input input-lg bg-base-content/5 hover:bg-base-content/10 focus:bg-base-100 focus:ring-primary/20 w-full rounded-xl border-none pr-12 pl-12 text-lg transition-all duration-300 focus:ring-2"
                value={searchInput()}
                onInput={(e) => handleSearchInput(e.currentTarget.value)}
                disabled={bucketSearch.isSearching()}
              />

              <Show when={searchInput().length > 0}>
                <button
                  onClick={() => handleSearchInput('')}
                  class="text-base-content/30 hover:text-error absolute inset-y-0 right-0 flex items-center pr-4 transition-colors"
                  aria-label={t('bucket.search.clearSearch')}
                >
                  <X class="h-5 w-5" />
                </button>
              </Show>
            </div>

            <div class="flex items-center gap-1">
              <button
                onClick={() => setShowOptions(!showOptions())}
                class={`btn btn-circle btn-ghost transition-all duration-300 ${
                  showOptions() ? 'bg-primary/10 text-primary rotate-90' : 'text-base-content/50'
                }`}
                title={t('bucket.search.filterOptions')}
              >
                <Settings2 class="h-5 w-5" />
              </button>

              <div class="bg-base-content/10 mx-1 h-8 w-px"></div>

              <button
                onClick={closeSearch}
                class="btn btn-circle btn-ghost text-base-content/50 hover:bg-error/10 hover:text-error transition-all duration-300"
                aria-label={t('bucket.search.closeSearch')}
              >
                <X class="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Collapsible Options Row */}
          <div
            class={`grid transition-all duration-300 ease-in-out ${
              showOptions() ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div class="overflow-hidden">
              <div class="bg-base-content/5 flex flex-col gap-4 rounded-xl p-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                  {/* Sort & Stats */}
                  <div class="flex flex-wrap items-center gap-6">
                    <div class="flex items-center gap-3">
                      <span class="text-base-content/50 text-xs font-bold tracking-wider uppercase">
                        {t('bucket.search.sortBy')}
                      </span>
                      <div class="join">
                        <select
                          class="select select-sm join-item bg-base-100 border-none text-xs focus:ring-0"
                          value={bucketSearch.sortBy()}
                          onChange={async (e) => {
                            bucketSearch.setSortBy(e.currentTarget.value);
                            if (searchInput().trim()) {
                              await bucketSearch.searchBuckets(searchInput());
                            }
                            inputRef?.focus();
                          }}
                        >
                          <option value="stars">{t('bucket.search.sortStars')}</option>
                          <option value="relevance">{t('bucket.search.sortRelevance')}</option>
                          <option value="apps">{t('bucket.search.sortApps')}</option>
                          <option value="name">{t('bucket.search.sortName')}</option>
                        </select>
                      </div>
                    </div>

                    <Show
                      when={bucketSearch.searchResults().length > 0 && !bucketSearch.isSearching()}
                    >
                      <div class="bg-base-100 flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-sm">
                        <span class="text-primary text-xs font-bold">
                          {bucketSearch.searchResults().length}
                        </span>
                        <span class="text-base-content/30 text-[10px] font-medium uppercase">
                          / {bucketSearch.totalCount()} {t('app.buckets')}
                        </span>
                      </div>
                    </Show>
                  </div>

                  {/* Expanded Search Controls - Reimagined */}
                  <div class="flex items-center gap-2">
                    <div class="join">
                      <button
                        onClick={handleRefreshCommunityCache}
                        class="btn btn-sm btn-info btn-soft join-item gap-2 px-3"
                        disabled={
                          bucketSearch.isSearching() ||
                          bucketSearch.isRefreshingCache() ||
                          // Disable if expanded search not enabled AND no cache exists
                          // This prevents downloading large dataset without warning confirmation
                          (!bucketSearch.includeExpanded() && !bucketSearch.cacheExists())
                        }
                        title={
                          !bucketSearch.includeExpanded() && !bucketSearch.cacheExists()
                            ? t('bucket.search.enableExpandedSearch') + ' first'
                            : t('bucket.search.refreshCommunityData')
                        }
                      >
                        <Show
                          when={bucketSearch.isRefreshingCache()}
                          fallback={<RefreshCw class="h-3.5 w-3.5" />}
                        >
                          <LoaderCircle class="h-3.5 w-3.5 animate-spin" />
                        </Show>
                        <span>{communityCacheDate()}</span>
                      </button>

                      <button
                        onClick={handleCommunityToggle}
                        class={`btn btn-sm btn-warning join-item gap-2 transition-all ${
                          bucketSearch.includeExpanded() ? '' : 'btn-soft'
                        }`}
                        disabled={bucketSearch.isSearching() || bucketSearch.isRefreshingCache()}
                        title={
                          bucketSearch.includeExpanded()
                            ? t('bucket.search.backToVerifiedTitle')
                            : t('bucket.search.communityBuckets')
                        }
                      >
                        <Globe class="h-4 w-4" />
                        <span>{t('bucket.search.communityBuckets')}</span>
                        <ShieldCheck class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Filters - Only shown when expanded or explicitly needed */}
                <Show when={bucketSearch.includeExpanded() || showOptions()}>
                  <div class="border-base-content/5 flex flex-wrap items-center gap-6 border-t pt-4">
                    <label class="group flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm checkbox-primary rounded-md transition-all group-hover:scale-110"
                        checked={bucketSearch.disableChineseBuckets()}
                        onChange={(e) =>
                          bucketSearch.setDisableChineseBuckets(e.currentTarget.checked)
                        }
                      />
                      <span class="text-base-content/70 text-xs font-medium">
                        {t('bucket.search.disableChineseBuckets')}
                      </span>
                    </label>

                    <div class="flex items-center gap-3">
                      <span class="text-base-content/50 text-xs font-medium">
                        {t('bucket.search.minimumGithubStars')}
                      </span>
                      <input
                        type="number"
                        class="input input-sm bg-base-100 focus:ring-primary/20 w-20 rounded-md border-none text-center text-xs focus:ring-2"
                        min="0"
                        max="1000"
                        value={bucketSearch.minimumStars()}
                        onInput={(e) =>
                          bucketSearch.setMinimumStars(parseInt(e.currentTarget.value) || 0)
                        }
                      />
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          {/* Error Display - More compact and integrated */}
          <Show when={bucketSearch.error()}>
            <div class="animate-in fade-in slide-in-from-top-2 m-2 duration-300">
              <div class="alert alert-error bg-error/10 text-error rounded-xl border-none px-4 py-2 shadow-sm">
                <TriangleAlert class="h-4 w-4" />
                <span class="text-xs font-medium">{bucketSearch.error()}</span>
                <Show when={bucketSearch.isRetryable()}>
                  <button
                    class="btn btn-ghost btn-xs underline decoration-dotted"
                    onClick={() => bucketSearch.retry()}
                    disabled={bucketSearch.isSearching()}
                  >
                    {t('bucket.search.retry')}
                  </button>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Large Dataset Warning Modal */}
      <LargeDatasetWarning
        isOpen={showWarningModal()}
        onConfirm={proceedWithExpandedSearch}
        onClose={() => setShowWarningModal(false)}
      />
    </>
  );
}

export default BucketSearch;
