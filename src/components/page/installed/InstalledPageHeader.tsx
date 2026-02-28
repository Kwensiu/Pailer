import { For, Show, Accessor, Setter, createSignal, createEffect, onCleanup } from 'solid-js';
import {
  Funnel,
  LayoutGrid,
  List,
  CircleArrowUp,
  Search,
  X,
  CircleCheckBig,
  CircleAlert,
  RefreshCw,
} from 'lucide-solid';
import { t } from '../../../i18n';
import { useGlobalSearchHotkey } from '../../../hooks/useGlobalHotkey';

interface InstalledHeaderProps {
  updatableCount: Accessor<number>;
  onUpdateAll: () => void;
  onCheckStatus?: () => void;
  statusLoading?: Accessor<boolean>;
  scoopStatus?: Accessor<any>;

  uniqueBuckets: Accessor<string[]>;
  selectedBucket: Accessor<string>;
  setSelectedBucket: Setter<string>;

  viewMode: Accessor<'grid' | 'list'>;
  setViewMode: Setter<'grid' | 'list'>;

  isCheckingForUpdates: Accessor<boolean>;
  onCheckForUpdates: () => void;

  searchQuery: Accessor<string>;
  setSearchQuery: Setter<string>;
  onRefresh: () => void;
}

function InstalledPageHeader(props: InstalledHeaderProps) {
  let searchInputRef: HTMLInputElement | undefined;
  let focusTimeoutId: ReturnType<typeof setTimeout> | undefined;
  const [isExpanded, setIsExpanded] = createSignal(false);

  useGlobalSearchHotkey({
    shouldClear: () => props.searchQuery().length > 0,
    onSearchStart: (char: string) => {
      setIsExpanded(true);
      props.setSearchQuery(char);
    },
    onClearSearch: () => {
      props.setSearchQuery('');
    },
  });

  // Auto-expand when there's search content, collapse when empty
  createEffect(() => {
    if (props.searchQuery()) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  });

  createEffect(() => {
    if (isExpanded() && searchInputRef) {
      focusTimeoutId = setTimeout(() => {
        searchInputRef?.focus();
        focusTimeoutId = undefined;
      }, 0);
    }

    onCleanup(() => {
      if (focusTimeoutId) {
        clearTimeout(focusTimeoutId);
        focusTimeoutId = undefined;
      }
    });
  });

  const toggleViewMode = () => {
    props.setViewMode(props.viewMode() === 'grid' ? 'list' : 'grid');
  };

  return (
    <div class="mb-6 flex items-center">
      <h2 class="mr-4 shrink-0 text-3xl font-bold">{t('installed.header.title')}</h2>
      <div
        class="join mr-4 flex-1"
        style={{
          opacity: isExpanded() ? '1' : '0',
          transition: 'opacity 0.15s ease-in-out',
          'pointer-events': isExpanded() ? 'auto' : 'none',
          position: 'relative',
        }}
      >
        <input
          ref={searchInputRef}
          type="text"
          placeholder={t('installed.header.searchPlaceholder')}
          class="input input-bordered join-item bg-base-200 w-full"
          value={props.searchQuery()}
          onInput={(e) => props.setSearchQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              searchInputRef?.blur();
              if (e.key === 'Escape') {
                props.setSearchQuery('');
              }
            }
          }}
          onBlur={() => {
            if (!props.searchQuery()) {
              setIsExpanded(false);
            }
          }}
        />
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Show
          when={!isExpanded()}
          fallback={
            <button
              class="btn btn-ghost bg-base-100 btn-circle"
              onClick={() => {
                props.setSearchQuery('');
                setIsExpanded(false);
              }}
            >
              <X class="h-4 w-4" />
            </button>
          }
        >
          <button class="btn btn-ghost bg-base-100 btn-circle" onClick={() => setIsExpanded(true)}>
            <Search class="h-4 w-4" />
          </button>
        </Show>
        {/* Update All Button or Status Button */}
        <Show
          when={props.updatableCount() > 0}
          fallback={
            <button
              class="btn btn-ghost bg-base-100 btn-circle tooltip tooltip-bottom"
              data-tip={t('installed.header.checkStatus')}
              onClick={props.onCheckStatus}
              disabled={props.statusLoading?.()}
            >
              <Show
                when={props.statusLoading?.()}
                fallback={
                  <Show
                    when={props.scoopStatus?.()?.is_everything_ok}
                    fallback={<CircleAlert class="h-4 w-4" />}
                  >
                    <CircleCheckBig class="h-4 w-4" />
                  </Show>
                }
              >
                <span class="loading loading-spinner loading-sm"></span>
              </Show>
            </button>
          }
        >
          <button class="btn btn-secondary gap-2" onClick={props.onUpdateAll}>
            <CircleArrowUp class="h-4 w-4" />
            <span class="hidden md:inline">{t('installed.header.updateAll')}&nbsp;</span>
            <span>({props.updatableCount()})</span>
          </button>
        </Show>

        {/* Refresh Button */}
        <button
          class="btn btn-ghost bg-base-100 btn-circle tooltip tooltip-bottom"
          data-tip={t('installed.header.refresh')}
          onClick={() => props.onRefresh()}
        >
          <RefreshCw class="h-5 w-5" />
        </button>

        {/* Filters and View Toggle Group */}
        <div class="join">
          {/* Filters Dropdown */}
          <div class="dropdown dropdown-end z-10">
            <button
              tabindex="0"
              class="join-item btn btn-soft bg-base-100 tooltip tooltip-bottom"
              data-tip={t('installed.header.filter')}
            >
              <Funnel class="h-4 w-4" />
            </button>
            <div
              tabindex="0"
              class="dropdown-content menu bg-base-content-bg rounded-box z-10 w-64 p-4 shadow"
            >
              <div class="form-control">
                <label class="label">
                  <span class="label-text">{t('installed.header.bucketLabel')}</span>
                </label>
                <select
                  class="select select-bordered select-sm bg-base-300"
                  value={props.selectedBucket()}
                  onChange={(e) => props.setSelectedBucket(e.currentTarget.value)}
                >
                  <For each={props.uniqueBuckets()}>
                    {(bucket) => (
                      <option value={bucket}>
                        {bucket === 'all' ? t('installed.header.allBuckets') : bucket}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </div>
          </div>

          {/* View Toggle Button */}
          <button
            class="join-item btn btn-soft bg-base-100 tooltip tooltip-bottom z-10"
            data-tip={
              props.viewMode() === 'grid'
                ? t('installed.header.switchToListView')
                : t('installed.header.switchToGridView')
            }
            onClick={toggleViewMode}
          >
            <Show when={props.viewMode() === 'grid'}>
              <List class="h-4 w-4" />
            </Show>
            <Show when={props.viewMode() === 'list'}>
              <LayoutGrid class="h-4 w-4" />
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstalledPageHeader;
