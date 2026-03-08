import { For, Show, Accessor, createSignal, createEffect } from 'solid-js';
import {
  CircleArrowUp,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  RefreshCw,
  ArrowLeftRight,
} from 'lucide-solid';
import type { ScoopPackage } from '../../../types/scoop';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import heldStore from '../../../stores/held';
import { formatIsoDate } from '../../../utils/date';
import { t } from '../../../i18n';
import HighlightText from '../../../components/common/HighlightText';

type SortKey = 'name' | 'version' | 'source' | 'updated';

interface PackageListViewProps {
  packages: Accessor<DisplayPackage[]>;
  sortKey: Accessor<SortKey>;
  sortDirection: Accessor<'asc' | 'desc'>;
  onSort: (key: SortKey) => void;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewBucketInfo: (bucketName: string) => void;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  onUpdate: (pkg: ScoopPackage) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
  isPackageVersioned: (packageName: string) => boolean;
  operatingOn: Accessor<string | null>;
  searchQuery: Accessor<string>;
}

const SortableHeader = (props: {
  key: SortKey;
  title: string;
  onSort: (key: SortKey) => void;
  sortKey: Accessor<SortKey>;
  sortDirection: Accessor<'asc' | 'desc'>;
}) => (
  <th class="cursor-pointer select-none" onClick={() => props.onSort(props.key)}>
    <div class="flex items-center gap-2">
      {props.title}
      <Show when={props.sortKey() === props.key}>
        <Show when={props.sortDirection() === 'asc'} fallback={<ArrowDown class="h-4 w-4" />}>
          <ArrowUp class="h-4 w-4" />
        </Show>
      </Show>
    </div>
  </th>
);

function PackageListView(props: PackageListViewProps) {
  // Detect if it's a CI version (beta/alpha/rc followed by additional suffix)
  const isCiVersion = (version: string): boolean => {
    return (
      /beta\.\d+\..+/.test(version) || /alpha\.\d+\..+/.test(version) || /rc\.\d+\..+/.test(version)
    );
  };

  const [contextMenuPackage, setContextMenuPackage] = createSignal<ScoopPackage | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = createSignal<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const adjustPosition = (x: number, y: number) => {
    const menuWidth = 200; // Estimated menu width
    const menuHeight = 200; // Estimated menu height
    const adjustedX = Math.min(x, window.innerWidth - menuWidth);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight);
    return { x: Math.max(0, adjustedX), y: Math.max(0, adjustedY) };
  };

  const handleContextMenu = (e: MouseEvent, pkg: ScoopPackage) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPackage(pkg);
    setContextMenuPosition(adjustPosition(e.clientX, e.clientY));
  };

  const closeContextMenu = () => {
    setContextMenuPackage(null);
  };

  // Close context menu when clicking outside
  createEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  });

  return (
    <div class="bg-base-card overflow-hidden rounded-xl shadow-xl">
      <div class="overflow-x-auto">
        <table class="table-compact my-2 table">
          <thead>
            <tr>
              <SortableHeader
                key="name"
                title={t('installed.list.name')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
              />
              <SortableHeader
                key="version"
                title={t('installed.list.version')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
              />
              <SortableHeader
                key="source"
                title={t('installed.list.bucket')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
              />
              <SortableHeader
                key="updated"
                title={t('installed.list.updated')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
              />
            </tr>
          </thead>
          <tbody>
            <For each={props.packages()}>
              {(pkg) => (
                <tr
                  class="hover:bg-base-200 transition-all duration-200"
                  data-no-close-search
                  onDblClick={() => props.onViewInfo(pkg)}
                  onContextMenu={(e) => handleContextMenu(e, pkg)}
                >
                  <td class="max-w-[160px]">
                    <div class="flex items-center gap-2">
                      <div
                        class="hover:text-primary cursor-pointer truncate font-medium transition-colors"
                        onClick={() => props.onViewInfo(pkg)}
                        title={pkg.name}
                      >
                        <HighlightText text={pkg.name} query={props.searchQuery()} />
                      </div>
                      <Show
                        when={
                          pkg.available_version &&
                          !heldStore.isHeld(pkg.name) &&
                          !pkg.is_versioned_install
                        }
                      >
                        <div
                          class="tooltip tooltip-right"
                          data-tip={
                            t('installed.list.updateAvailableTooltip', {
                              version: pkg.available_version,
                            }) +
                            (isCiVersion(pkg.available_version || '')
                              ? t('installed.list.ciVersionNote')
                              : '')
                          }
                        >
                          <CircleArrowUp
                            class="text-primary mr-1 h-4 w-4 cursor-pointer transition-transform hover:scale-125"
                            onClick={() => props.onUpdate(pkg)}
                          />
                        </div>
                      </Show>
                      <Show when={pkg.is_versioned_install}>
                        <div
                          class="tooltip tooltip-right"
                          data-tip={t('installed.list.versionedTooltip')}
                        >
                          <Lock class="h-4 w-4 text-cyan-400" />
                        </div>
                      </Show>
                      <Show when={heldStore.isHeld(pkg.name) && !pkg.is_versioned_install}>
                        <div
                          class="tooltip tooltip-right"
                          data-tip={t('installed.list.heldTooltip')}
                        >
                          <Lock class="text-warning h-4 w-4" />
                        </div>
                      </Show>
                    </div>
                  </td>
                  <td class="max-w-[120px] truncate" title={pkg.version}>
                    <HighlightText text={pkg.version} query={props.searchQuery()} />
                  </td>
                  <td class="max-w-[150px]">
                    <span
                      class="hover:text-primary inline-block max-w-full cursor-pointer truncate font-medium transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onViewBucketInfo(pkg.source);
                      }}
                      title={pkg.source}
                    >
                      <HighlightText text={pkg.source} query={props.searchQuery()} />
                    </span>
                  </td>
                  <td class="max-w-[120px] whitespace-nowrap" title={pkg.updated}>
                    {formatIsoDate(pkg.updated)}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      <Show when={contextMenuPackage()}>
        <div
          class="bg-base-100 rounded-box border-base-200 fixed z-9999 min-w-[150px] border py-2 shadow-lg"
          style={`left: ${contextMenuPosition().x}px; top: ${contextMenuPosition().y}px;`}
          onClick={(e) => e.stopPropagation()}
        >
          <Show
            when={
              contextMenuPackage() &&
              !heldStore.isHeld(contextMenuPackage()!.name) &&
              !contextMenuPackage()!.is_versioned_install
            }
            fallback={
              <Show
                when={
                  contextMenuPackage() &&
                  heldStore.isHeld(contextMenuPackage()!.name) &&
                  !contextMenuPackage()!.is_versioned_install
                }
              >
                <div class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm">
                  <Lock class="text-warning h-4 w-4" />
                  <span>Package on hold</span>
                </div>
              </Show>
            }
          >
            <div
              class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
              onClick={() => {
                props.onHold(contextMenuPackage()!.name);
                closeContextMenu();
              }}
            >
              <Lock class="h-4 w-4" />
              <span>{t('installed.list.holdPackage')}</span>
            </div>
          </Show>

          <Show when={contextMenuPackage() && props.isPackageVersioned(contextMenuPackage()!.name)}>
            <div
              class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
              onClick={() => {
                props.onViewInfoForVersions(contextMenuPackage()!);
                closeContextMenu();
              }}
            >
              <RefreshCw class="h-4 w-4" />
              <span>{t('installed.list.switchVersion')}</span>
            </div>
          </Show>

          <div
            class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
            onClick={() => {
              props.onChangeBucket(contextMenuPackage()!);
              closeContextMenu();
            }}
          >
            <ArrowLeftRight class="h-4 w-4" />
            <span>{t('installed.list.changeBucket')}</span>
          </div>

          <div
            class="hover:bg-base-200 text-error flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
            onClick={() => {
              props.onUninstall(contextMenuPackage()!);
              closeContextMenu();
            }}
          >
            <Trash2 class="h-4 w-4" />
            <span>{t('installed.list.uninstall')}</span>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default PackageListView;
