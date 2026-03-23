import { For, Show, createSignal, createEffect, onCleanup, Accessor } from 'solid-js';
import { CircleArrowUp, Lock, ArrowUp, ArrowDown } from 'lucide-solid';
import type { ScoopPackage } from '../../../types/scoop';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import type { ContextMenuItem } from '../../../components/common/context-menu';
import heldStore from '../../../stores/held';
import { formatIsoDate } from '../../../utils/date';
import { t } from '../../../i18n';
import HighlightText from '../../../components/common/HighlightText';
import ContextMenu from '../../../components/common/ContextMenu';
import {
  ContextMenuRenderer,
  createPackageContextMenuItems,
} from '../../../components/common/context-menu';
import { useConfirmAction } from '../../../hooks';

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
  onOpenFolder: (pkg: ScoopPackage) => void;
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
  const { confirmingItem, startConfirm, cancelConfirm } = useConfirmAction();

  const isContextMenuActive = (pkgName: string) => {
    return contextMenuPackage()?.name === pkgName;
  };

  const closeContextMenu = () => {
    setContextMenuPackage(null);
    cancelConfirm();
  };

  createEffect(() => {
    onCleanup(() => {
      cancelConfirm();
    });
  });

  const openContextMenu = (pkg: ScoopPackage, x: number, y: number) => {
    setContextMenuPackage(pkg);
    setContextMenuPosition({ x, y });
    cancelConfirm(pkg.name);
  };

  const getContextMenuItems = (pkg: ScoopPackage): ContextMenuItem[] => {
    return createPackageContextMenuItems(
      pkg,
      confirmingItem(),
      props.operatingOn(),
      props.isPackageVersioned,
      {
        onUpdate: props.onUpdate,
        onOpenFolder: props.onOpenFolder,
        onViewInfoForVersions: props.onViewInfoForVersions,
        onChangeBucket: props.onChangeBucket,
        onHold: props.onHold,
        onUnhold: props.onUnhold,
        onUninstall: (pkg) => {
          if (confirmingItem() === pkg.name) {
            cancelConfirm(pkg.name);
            props.onUninstall(pkg);
            closeContextMenu();
          } else {
            startConfirm(pkg.name);
          }
        },
      }
    );
  };

  return (
    <div class="bg-base-card overflow-hidden rounded-xl shadow-xl">
      <div class="overflow-x-auto">
        <table class="table">
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
                  class="cursor-pointer transition-colors hover:bg-black/24"
                  classList={{ 'bg-black/24': isContextMenuActive(pkg.name) }}
                  data-context-menu-allow="true"
                  data-no-close-search
                  onDblClick={() => props.onViewInfo(pkg)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openContextMenu(pkg, e.clientX, e.clientY);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
                      e.preventDefault();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      openContextMenu(pkg, rect.left + rect.width / 2, rect.top + rect.height / 2);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`${pkg.name} package actions`}
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
                          pkg.installation_type !== 'custom'
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
                      <Show when={pkg.installation_type === 'custom'}>
                        <div
                          class="tooltip tooltip-right"
                          data-tip={t('installed.list.customInstallTooltip')}
                        >
                          <Lock class="h-4 w-4 text-cyan-400" />
                        </div>
                      </Show>
                      <Show when={heldStore.isHeld(pkg.name) && pkg.installation_type !== 'custom'}>
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

      <ContextMenu
        isOpen={() => !!contextMenuPackage()}
        position={contextMenuPosition}
        onClose={closeContextMenu}
        ariaLabel="Package actions menu"
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

export default PackageListView;
