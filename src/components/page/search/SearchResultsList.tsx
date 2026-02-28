import { For, Show } from 'solid-js';
import { ScoopPackage } from '../../../types/scoop';
import { Download } from 'lucide-solid';
import { t } from '../../../i18n';

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
            <div
              class="card bg-base-card transform cursor-pointer shadow-sm transition-all duration-200 hover:scale-101"
              onClick={() => props.onViewInfo(pkg)}
            >
              <div class="card-body">
                <div class="flex items-start justify-between">
                  <div class="min-w-0 grow">
                    <h3 class="card-title truncate">{pkg.name}</h3>
                    <p class="truncate">{t('search.results.fromBucket', { bucket: pkg.source })}</p>
                  </div>
                  <div class="ml-4 flex shrink-0 items-center gap-2 text-right">
                    <span class="badge badge-primary badge-soft whitespace-nowrap">
                      {pkg.version}
                    </span>
                    {pkg.is_installed ? (
                      <span class="badge badge-success whitespace-nowrap">Installed</span>
                    ) : (
                      <button
                        class="btn btn-sm btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onInstall(pkg);
                        }}
                      >
                        <Download class="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <Show when={pkg.info}>
                  <p class="text-base-content/70 mt-2 line-clamp-2 overflow-hidden">{pkg.info}</p>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* 分页控件 */}
      <Show when={props.results.length > ITEMS_PER_PAGE}>
        <div class="mt-6 flex items-center justify-center space-x-2">
          <button
            class="btn btn-sm"
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
            class="btn btn-sm"
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
