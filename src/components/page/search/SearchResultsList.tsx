import { For, Show } from 'solid-js';
import { ScoopPackage } from '../../../types/scoop';
import { t } from '../../../i18n';
import SearchResultCard from './SearchResultCard';

interface SearchResultsListProps {
  loading: boolean;
  results: ScoopPackage[];
  searchTerm: string;
  activeTab: 'packages' | 'includes';
  onViewInfo: (pkg: ScoopPackage) => void;
  onInstall: (pkg: ScoopPackage) => void;
  onPackageStateChanged?: () => void; // Callback for when package state changes
  currentPage: number;
  onPageChange: (page: number) => void;
}

function SearchResultsList(props: SearchResultsListProps) {
  const ITEMS_PER_PAGE = 8;

  const totalPages = () => Math.ceil(props.results.length / ITEMS_PER_PAGE);

  const paginatedResults = () => {
    const startIndex = (props.currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return props.results.slice(startIndex, endIndex);
  };

  return (
    <div class="relative">
      <Show when={!props.loading && props.results.length === 0 && props.searchTerm.length > 1}>
        <div class="py-16 text-center">
          <p class="text-xl">
            {t('search.results.noPackagesFound', {
              type: t(`search.tabs.${props.activeTab === 'packages' ? 'packages' : 'includes'}`),
              query: props.searchTerm,
            })}
          </p>
        </div>
      </Show>

      <div class="min-h-0 space-y-4">
        <For each={paginatedResults()}>
          {(pkg) => (
            <SearchResultCard
              pkg={pkg}
              searchTerm={props.searchTerm}
              onViewInfo={props.onViewInfo}
              onInstall={props.onInstall}
            />
          )}
        </For>
      </div>

      {/* Pagination controls */}
      <Show when={props.results.length > ITEMS_PER_PAGE}>
        <div class="mt-6 flex items-center justify-center space-x-2">
          <button
            class="btn btn-soft btn-sm rounded-xl"
            disabled={props.currentPage <= 1}
            onClick={() => props.onPageChange(props.currentPage - 1)}
          >
            &lt;
          </button>

          <span class="text-sm">
            {t('search.results.pageInfo', {
              current: props.currentPage,
              total: totalPages(),
            })}
          </span>

          <button
            class="btn btn-soft btn-sm rounded-xl"
            disabled={props.currentPage >= totalPages()}
            onClick={() => props.onPageChange(props.currentPage + 1)}
          >
            &gt;
          </button>
        </div>
      </Show>
    </div>
  );
}

export default SearchResultsList;
