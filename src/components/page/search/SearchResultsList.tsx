import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Download, ArrowLeftRight, Info, FileText, Trash2 } from 'lucide-solid';
import { ScoopPackage } from '../../../types/scoop';
import { t } from '../../../i18n';
import SearchResultCard from './SearchResultCard';
import ContextMenu from '../../common/ContextMenu';
import type { ContextMenuItem } from '../../common/context-menu';
import { ContextMenuRenderer } from '../../common/context-menu';
import installedPackagesStore from '../../../stores/installedPackagesStore';

interface SearchResultsListProps {
  loading: boolean;
  results: ScoopPackage[];
  searchTerm: string;
  activeTab: 'packages' | 'includes';
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewManifest?: (pkg: ScoopPackage) => void;
  onInstall: (pkg: ScoopPackage) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onSwitchBucket: (pkg: ScoopPackage) => void;
  onViewBucket?: (bucketName: string) => void;
  onPackageStateChanged?: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  bucketGitUrlMap?: Map<string, string>;
  bucketGitBranchMap?: Map<string, string>;
}

function SearchResultsList(props: SearchResultsListProps) {
  const ITEMS_PER_PAGE = 8;
  const [pageInput, setPageInput] = createSignal('');
  const [editingPage, setEditingPage] = createSignal<number | null>(null);
  const [contextMenuPackage, setContextMenuPackage] = createSignal<ScoopPackage | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = createSignal<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  let editInputRef: HTMLInputElement | undefined;

  const totalPages = () => Math.ceil(props.results.length / ITEMS_PER_PAGE);

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

  const paginatedResults = () => {
    const startIndex = (props.currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return props.results.slice(startIndex, endIndex);
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

  const closeContextMenu = () => {
    setContextMenuPackage(null);
  };

  const openContextMenu = (pkg: ScoopPackage, x: number, y: number) => {
    setContextMenuPackage(pkg);
    setContextMenuPosition({ x, y });
  };

  const getInstalledBucket = (pkg: ScoopPackage) => {
    const normalizedName = pkg.name.toLowerCase();
    const installed = installedPackagesStore
      .packages()
      .find((item) => item.name.toLowerCase() === normalizedName);
    return installed?.source ?? null;
  };

  const getContextMenuItems = (pkg: ScoopPackage): ContextMenuItem[] => {
    const installedBucket = getInstalledBucket(pkg);
    const canSwitchBucket =
      pkg.is_installed &&
      !!installedBucket &&
      installedBucket.toLowerCase() !== pkg.source.toLowerCase();

    return [
      {
        label: t('buttons.install'),
        icon: Download,
        class: 'text-info',
        showWhen: () => !pkg.is_installed,
        onClick: () => props.onInstall(pkg),
      },
      {
        label: `${t('buttons.switchBucket')}`,
        icon: ArrowLeftRight,
        showWhen: () => canSwitchBucket,
        onClick: () => props.onSwitchBucket(pkg),
      },
      {
        label: t('packageInfo.details'),
        icon: Info,
        onClick: () => props.onViewInfo(pkg),
      },
      {
        label: t('packageInfo.viewManifest'),
        icon: FileText,
        onClick: () => props.onViewManifest?.(pkg),
      },
      {
        label: t('buttons.uninstall'),
        icon: Trash2,
        class: 'text-error',
        showWhen: () => pkg.is_installed,
        onClick: () => props.onUninstall(pkg),
      },
    ];
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
              onViewManifest={props.onViewManifest}
              onInstall={props.onInstall}
              onContextMenuOpen={openContextMenu}
              onViewBucket={props.onViewBucket}
              bucketGitUrl={props.bucketGitUrlMap?.get(pkg.source)}
              bucketGitBranch={props.bucketGitBranchMap?.get(pkg.source)}
            />
          )}
        </For>
      </div>

      {/* Pagination controls */}
      <Show when={props.results.length > ITEMS_PER_PAGE}>
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

      <ContextMenu
        isOpen={() => !!contextMenuPackage()}
        position={contextMenuPosition}
        onClose={closeContextMenu}
        ariaLabel="Search package actions menu"
      >
        <Show when={contextMenuPackage()}>
          <ContextMenuRenderer
            items={getContextMenuItems(contextMenuPackage()!)}
            onClose={closeContextMenu}
          />
        </Show>
      </ContextMenu>
    </div>
  );
}

export default SearchResultsList;
