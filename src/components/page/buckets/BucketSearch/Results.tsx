import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { SearchableBucket, BucketInfo } from '../../../../hooks';
import { Package, Shield, LoaderCircle, TriangleAlert } from 'lucide-solid';
import { t } from '../../../../i18n';
import BucketSearchResultCard from './ResultCard';

interface BucketSearchResultsProps {
  buckets: SearchableBucket[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  isExpandedSearch: boolean;
  installedBuckets: BucketInfo[];
  onBucketSelect?: (bucket: SearchableBucket) => void;
  onBucketInstalled?: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  // Infinite scroll
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: (neededCount?: number) => void;
}

function BucketSearchResults(props: BucketSearchResultsProps) {
  const ITEMS_PER_PAGE = 8;
  const [pageInput, setPageInput] = createSignal('');
  const [editingPage, setEditingPage] = createSignal<number | null>(null);
  let editInputRef: HTMLInputElement | undefined;

  // Calculate total pages from totalCount (backend), not from loaded results
  // This keeps pagination stable during infinite scroll
  const totalPages = () => {
    const total = props.totalCount;
    if (total === 0) return 1;
    return Math.ceil(total / ITEMS_PER_PAGE);
  };

  const paginationItems = () => {
    const total = totalPages();
    const current = props.currentPage;

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const items: Array<number | 'ellipsis'> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) items.push('ellipsis');

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < total - 1) items.push('ellipsis');

    items.push(total);
    return items;
  };

  const paginatedBuckets = () => {
    const startIndex = (props.currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return props.buckets.slice(startIndex, endIndex);
  };

  const commitPageInput = () => {
    const nextPage = Number.parseInt(pageInput(), 10);
    if (Number.isNaN(nextPage) || nextPage < 1) return;

    const total = totalPages();
    const clampedPage = Math.min(Math.max(nextPage, 1), total);
    props.onPageChange(clampedPage);
    setPageInput('');
    setEditingPage(null);
  };

  const cancelPageInput = () => {
    setPageInput('');
    setEditingPage(null);
  };

  createEffect(() => {
    const page = editingPage();
    if (page === null) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-pagination-editor]')) return;
      cancelPageInput();
    };

    document.addEventListener('mousedown', handleDocumentClick);
    onCleanup(() => document.removeEventListener('mousedown', handleDocumentClick));

    queueMicrotask(() => {
      editInputRef?.focus();
      editInputRef?.select();
    });
  });

  return (
    <div class="space-y-6">
      {/* Header - Refined */}
      <div class="border-base-content/5 flex items-center justify-between border-b pb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-2xl font-black tracking-tight">{t('bucket.searchResults.title')}</h2>
          <Show when={!props.loading}>
            <div class="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold">
              {props.buckets.length}
              {props.totalCount > props.buckets.length ? ` / ${props.totalCount}` : ''}
            </div>
          </Show>
        </div>

        <Show when={props.isExpandedSearch}>
          <div class="bg-warning/10 text-warning ring-warning/20 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ring-1 ring-inset">
            <Shield class="h-3.5 w-3.5" />
            {t('bucket.searchResults.expandedSearch')}
          </div>
        </Show>
      </div>

      {/* Loading State - Improved animation */}
      <Show when={props.loading}>
        <div class="flex flex-col items-center justify-center py-20">
          <div class="relative flex h-20 w-20 items-center justify-center">
            <div class="bg-primary/20 absolute inset-0 animate-ping rounded-full"></div>
            <div class="bg-primary/10 relative flex h-16 w-16 items-center justify-center rounded-full">
              <LoaderCircle class="text-primary h-8 w-8 animate-spin" />
            </div>
          </div>
          <span class="text-base-content/50 mt-6 text-sm font-medium tracking-wide">
            {t('bucket.searchResults.searchingBuckets')}
          </span>
        </div>
      </Show>

      {/* Error State */}
      <Show when={props.error}>
        <div class="alert alert-error bg-error/10 text-error rounded-2xl border-none shadow-sm">
          <TriangleAlert class="h-5 w-5" />
          <span class="font-medium">{props.error}</span>
        </div>
      </Show>

      {/* No Results - Reimagined */}
      <Show when={!props.loading && !props.error && props.buckets.length === 0}>
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="bg-base-content/5 mb-6 flex h-24 w-24 items-center justify-center rounded-full">
            <Package class="text-base-content/20 h-12 w-12" />
          </div>
          <h3 class="text-xl font-bold tracking-tight">
            {t('bucket.searchResults.noBucketsFound')}
          </h3>
          <p class="text-base-content/50 mt-2 max-w-xs text-sm leading-relaxed">
            {t('bucket.searchResults.tryAdjustTerms')}
          </p>
        </div>
      </Show>

      {/* Results List - Optimized spacing */}
      <Show when={!props.loading && !props.error && props.buckets.length > 0}>
        <div class="grid grid-cols-1">
          <For each={paginatedBuckets()}>
            {(bucket) => (
              <BucketSearchResultCard
                bucket={bucket}
                installedBuckets={props.installedBuckets}
                onBucketSelect={props.onBucketSelect}
                onBucketInstalled={props.onBucketInstalled}
              />
            )}
          </For>
        </div>

        <Show when={props.buckets.length > ITEMS_PER_PAGE}>
          <div class="mt-6 flex justify-center">
            <div class="bg-base-100 border-base-200 inline-flex items-stretch gap-0.5 rounded-full border p-1 shadow-sm backdrop-blur-sm">
              <button
                class="btn btn-ghost btn-sm h-10 min-h-10 min-w-10 rounded-full px-3"
                disabled={props.currentPage <= 1}
                onClick={() => props.onPageChange(props.currentPage - 1)}
                aria-label="Previous page"
              >
                ←
              </button>

              <For each={paginationItems()}>
                {(item) =>
                  item === 'ellipsis' ? (
                    <span class="text-base-content/45 flex h-10 min-w-10 items-center justify-center px-2 text-sm font-semibold select-none">
                      ...
                    </span>
                  ) : (
                    <button
                      class="btn btn-sm h-10 min-h-10 min-w-10 rounded-full px-3"
                      classList={{
                        'btn-info': props.currentPage === item && editingPage() !== item,
                        'btn-ghost': props.currentPage !== item,
                      }}
                      onClick={() => {
                        if (props.currentPage === item) {
                          setEditingPage(item);
                          setPageInput(String(item));
                          return;
                        }

                        props.onPageChange(item);
                      }}
                      aria-current={props.currentPage === item ? 'page' : undefined}
                      data-pagination-editor={
                        props.currentPage === item && editingPage() === item ? 'true' : undefined
                      }
                    >
                      {props.currentPage === item && editingPage() === item ? (
                        <input
                          ref={(el) => {
                            editInputRef = el;
                          }}
                          value={pageInput()}
                          onInput={(e) => setPageInput(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              commitPageInput();
                            }
                            if (e.key === 'Escape') {
                              cancelPageInput();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          class="w-6 bg-transparent text-center font-medium outline-none"
                          inputMode="numeric"
                          aria-label="Jump to page"
                        />
                      ) : (
                        item
                      )}
                    </button>
                  )
                }
              </For>

              <button
                class="btn btn-ghost btn-sm h-10 min-h-10 min-w-10 rounded-full px-3"
                disabled={props.currentPage >= totalPages()}
                onClick={() => props.onPageChange(props.currentPage + 1)}
                aria-label="Next page"
              >
                →
              </button>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}

export default BucketSearchResults;
