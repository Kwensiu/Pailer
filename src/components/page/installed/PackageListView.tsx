import { For, Show, createEffect, onCleanup, Accessor } from 'solid-js';
import { CircleArrowUp, Lock, ArrowUp, ArrowDown, Package } from 'lucide-solid';
import type { ScoopPackage } from '../../../types/scoop';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import type { ContextMenuItem } from '../../../components/common/context-menu';
import heldStore from '../../../stores/held';
import { formatIsoDate } from '../../../utils/date';
import { t } from '../../../i18n';
import HighlightText from '../../../components/common/HighlightText';
import ContextMenu from '../../../components/common/ContextMenu';
import { ContextMenuRenderer } from '../../../components/common/context-menu';
import { createInstalledItems } from '../../../components/common/context-menu/menuItems';
import { useConfirmAction, useContextMenuState, usePackageIcons } from '../../../hooks';

type SortKey = 'name' | 'version' | 'source' | 'updated';

interface PackageListViewProps {
  packages: Accessor<DisplayPackage[]>;
  packageNames: Accessor<string[]>;
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
  hasVersions: (packageName: string) => boolean;
  operatingOn: Accessor<string | null>;
  searchQuery: Accessor<string>;
}

const SortableHeader = (props: {
  key: SortKey;
  title: string;
  onSort: (key: SortKey) => void;
  sortKey: Accessor<SortKey>;
  sortDirection: Accessor<'asc' | 'desc'>;
  class?: string;
}) => (
  <th
    class={`cursor-pointer select-none ${props.class || ''}`}
    onClick={() => props.onSort(props.key)}
    scope="col"
    aria-sort={
      props.sortKey() === props.key
        ? props.sortDirection() === 'asc'
          ? 'ascending'
          : 'descending'
        : 'none'
    }
  >
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

  const contextMenu = useContextMenuState<ScoopPackage>({
    getKey: (pkg) => pkg.name,
  });
  const { icons: packageIcons } = usePackageIcons({
    packageNames: props.packageNames,
  });
  const { confirmingItem, startConfirm, cancelConfirm } = useConfirmAction();

  const isContextMenuActive = (pkgName: string) => {
    return contextMenu.isActive(pkgName);
  };

  const closeContextMenu = () => {
    contextMenu.close();
    cancelConfirm();
  };

  createEffect(() => {
    onCleanup(() => {
      cancelConfirm();
    });
  });

  const openContextMenu = (pkg: ScoopPackage, x: number, y: number) => {
    contextMenu.open(pkg, x, y);
    cancelConfirm(pkg.name);
  };

  const getContextMenuItems = (pkg: ScoopPackage): ContextMenuItem[] => {
    return createInstalledItems(pkg, confirmingItem(), props.operatingOn(), props.hasVersions, {
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
    });
  };

  return (
    <div class="bg-base-card overflow-hidden rounded-xl shadow-xl">
      <div class="overflow-x-auto">
        <table class="table w-full table-fixed">
          <thead>
            <tr>
              <SortableHeader
                key="name"
                title={t('installed.list.name')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
                class="w-[35%]"
              />
              <SortableHeader
                key="version"
                title={t('installed.list.version')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
                class="w-[20%]"
              />
              <SortableHeader
                key="source"
                title={t('installed.list.bucket')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
                class="w-[25%]"
              />
              <SortableHeader
                key="updated"
                title={t('installed.list.updated')}
                onSort={props.onSort}
                sortKey={props.sortKey}
                sortDirection={props.sortDirection}
                class="w-[20%]"
              />
            </tr>
          </thead>
          <tbody>
            <For each={props.packages()}>
              {(pkg) => (
                <tr
                  class="package-list-row cursor-pointer transition-colors"
                  classList={{ 'package-list-row-active': isContextMenuActive(pkg.name) }}
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
                  <td class="w-[35%]">
                    <div class="flex min-w-0 items-center gap-2">
                      <div class="flex min-w-0 items-center gap-1">
                        <div class="mr-2 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden">
                          <Show
                            when={packageIcons()[pkg.name]}
                            fallback={
                              <Package class="text-base-content/40 h-5 w-5" aria-hidden="true" />
                            }
                          >
                            <img
                              src={packageIcons()[pkg.name]}
                              alt=""
                              class="h-6 w-6 object-contain"
                              loading="lazy"
                            />
                          </Show>
                        </div>
                        <div
                          class="hover:text-primary min-w-0 cursor-pointer truncate font-bold transition-colors"
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
                            class="tooltip tooltip-right shrink-0"
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
                              class="text-primary h-4 w-4 cursor-pointer transition-transform hover:scale-125"
                              onClick={() => props.onUpdate(pkg)}
                            />
                          </div>
                        </Show>
                        <Show when={pkg.installation_type === 'custom'}>
                          <div
                            class="tooltip tooltip-right shrink-0"
                            data-tip={t('installed.list.customInstallTooltip')}
                          >
                            <Lock class="h-4 w-4 text-cyan-400" />
                          </div>
                        </Show>
                        <Show
                          when={heldStore.isHeld(pkg.name) && pkg.installation_type !== 'custom'}
                        >
                          <div
                            class="tooltip tooltip-right ml-1 shrink-0"
                            data-tip={t('installed.list.heldTooltip')}
                          >
                            <Lock class="text-warning h-4 w-4" />
                          </div>
                        </Show>
                      </div>
                    </div>
                  </td>
                  <td class="w-[20%]">
                    <div class="flex h-full items-center truncate" title={pkg.version}>
                      <HighlightText text={pkg.version} query={props.searchQuery()} />
                    </div>
                  </td>
                  <td class="w-[25%]">
                    <div class="flex h-full items-center">
                      <span
                        class="hover:text-primary cursor-pointer truncate transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onViewBucketInfo(pkg.source);
                        }}
                        title={pkg.source}
                      >
                        <HighlightText text={pkg.source} query={props.searchQuery()} />
                      </span>
                    </div>
                  </td>
                  <td class="w-[20%]">
                    <div class="flex h-full items-center truncate" title={pkg.updated}>
                      {formatIsoDate(pkg.updated)}
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        ariaLabel="Package actions menu"
      >
        <Show when={contextMenu.target()}>
          <ContextMenuRenderer
            items={getContextMenuItems(contextMenu.target()!)}
            onClose={closeContextMenu}
          />
        </Show>
      </ContextMenu>
    </div>
  );
}

export default PackageListView;
