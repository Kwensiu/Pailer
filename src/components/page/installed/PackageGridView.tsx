import { For, Show, createSignal, Accessor, createMemo, createEffect, onCleanup } from 'solid-js';
import {
  CircleArrowUp,
  Folder,
  RefreshCw,
  ArrowLeftRight,
  Trash2,
  Lock,
  LockOpen,
  Ellipsis,
} from 'lucide-solid';
import type { ScoopPackage } from '../../../types/scoop';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import type { ContextMenuItem } from '../../../components/common/context-menu';
import heldStore from '../../../stores/held';
import { t } from '../../../i18n';
import HighlightText from '../../common/HighlightText';
import Dropdown, { type DropdownItem } from '../../common/Dropdown';
import ContextMenu from '../../common/ContextMenu';
import {
  ContextMenuRenderer,
  createPackageContextMenuItems,
} from '../../../components/common/context-menu';
import { formatIsoDate } from '../../../utils/date';
import { useConfirmAction } from '../../../hooks';

interface PackageGridViewProps {
  packages: Accessor<DisplayPackage[]>;
  searchQuery: Accessor<string>;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  onUpdate: (pkg: ScoopPackage) => void;
  onOpenFolder: (pkg: ScoopPackage) => void;
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  operatingOn: Accessor<string | null>;
  isPackageVersioned: (packageName: string) => boolean;
}

// Single package card component
const PackageCard = (props: {
  pkg: DisplayPackage;
  searchQuery: string;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  onUpdate: (pkg: ScoopPackage) => void;
  onOpenFolder: (pkg: ScoopPackage) => void;
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  operatingOn: string | null;
  isPackageVersioned: (packageName: string) => boolean;
  isContextMenuActive: (pkgName: string) => boolean;
  isDropdownOpen: (pkgName: string) => boolean;
  onDropdownOpen: (pkgName: string) => void;
  onDropdownClose: () => void;
  onContextMenuOpen: (pkg: ScoopPackage, x: number, y: number) => void;
  uninstallConfirm: Accessor<boolean>;
  onUninstallConfirm: (confirm: boolean) => void;
}) => {
  const { pkg } = props;

  const items = createMemo(() => {
    const result: DropdownItem[] = [];

    // Update (only when available and not held and not custom)
    if (
      pkg.available_version &&
      !heldStore.isHeld(pkg.name) &&
      pkg.installation_type !== 'custom'
    ) {
      result.push({
        label: t('installed.list.update'),
        onClick: () => props.onUpdate(pkg),
        disabled: () => false,
        icon: CircleArrowUp,
        align: 'start' as const,
        class: 'text-info',
      });
    }

    // Open folder
    result.push({
      label: t('installed.list.openFolder'),
      onClick: () => props.onOpenFolder(pkg),
      disabled: () => false,
      icon: Folder,
      align: 'start' as const,
    });

    // Switch version (only for versioned apps)
    if (props.isPackageVersioned(pkg.name)) {
      result.push({
        label: t('installed.list.switchVersion'),
        onClick: () => props.onViewInfoForVersions(pkg),
        disabled: () => false,
        icon: RefreshCw,
        align: 'start' as const,
      });
    }

    // Change bucket
    result.push({
      label: t('installed.list.changeBucket'),
      onClick: () => props.onChangeBucket(pkg),
      disabled: () => props.operatingOn === pkg.name,
      icon: ArrowLeftRight,
      align: 'start' as const,
    });

    // Hold/Unhold (only for non-custom installations)
    if (pkg.installation_type !== 'custom') {
      result.push({
        label: () => {
          if (props.operatingOn === pkg.name) return t('installed.list.processing');
          if (props.isPackageVersioned(pkg.name)) return t('installed.list.cannotUnhold');
          return heldStore.isHeld(pkg.name)
            ? t('installed.list.unholdPackage')
            : t('installed.list.holdPackage');
        },
        onClick: () => {
          if (heldStore.isHeld(pkg.name)) {
            props.onUnhold(pkg.name);
          } else {
            props.onHold(pkg.name);
          }
        },
        disabled: () => props.operatingOn === pkg.name || props.isPackageVersioned(pkg.name),
        icon: heldStore.isHeld(pkg.name) ? LockOpen : Lock,
        align: 'start' as const,
      });
    }

    // Uninstall with confirmation
    const uninstallClass = props.uninstallConfirm() ? 'text-warning' : 'text-error';
    result.push({
      label: () => (props.uninstallConfirm() ? t('buttons.sure') : t('installed.list.uninstall')),
      onClick: () => {
        if (props.uninstallConfirm()) {
          props.onUninstallConfirm(false);
          props.onUninstall(pkg);
        } else {
          props.onUninstallConfirm(true);
        }
      },
      disabled: () => props.operatingOn === pkg.name,
      icon: Trash2,
      align: 'start' as const,
      class: uninstallClass,
      closeOnSelect: props.uninstallConfirm(),
    });

    return result;
  });

  // Detect if it's a CI version (beta/alpha/rc followed by additional suffix)
  const isCiVersion = (version: string): boolean => {
    return (
      /beta\.\d+\..+/.test(version) || /alpha\.\d+\..+/.test(version) || /rc\.\d+\..+/.test(version)
    );
  };

  const isCardActive = () => {
    return props.isContextMenuActive(pkg.name) || props.isDropdownOpen(pkg.name);
  };

  return (
    <div
      class={`card bg-base-card transform cursor-pointer shadow-md transition-all hover:scale-101 ${
        isCardActive() ? 'bg-base-content-bg z-50 scale-101' : ''
      }`}
      data-context-menu-allow="true"
      onClick={() => props.onViewInfo(pkg)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onContextMenuOpen(pkg, e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          props.onContextMenuOpen(pkg, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      }}
      tabIndex={0}
      aria-label={`${pkg.name} package actions`}
      data-no-close-search
    >
      <div
        class={`card-body rounded-2xl transition-colors hover:bg-white/4 ${
          isCardActive() ? 'bg-white/4' : ''
        }`}
      >
        <div class="mb-2 flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <h2 class="card-title">
              <button
                class="overflow-hidden hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onViewInfo(pkg);
                }}
              >
                <div class="truncate" style="max-width: 10rem;">
                  <HighlightText text={pkg.name} query={props.searchQuery} />
                </div>
              </button>
              <Show
                when={
                  pkg.available_version &&
                  !heldStore.isHeld(pkg.name) &&
                  pkg.installation_type !== 'custom'
                }
              >
                <div
                  class="tooltip tooltip-bottom"
                  data-tip={
                    t('installed.list.updateAvailableTooltip', { version: pkg.available_version }) +
                    (isCiVersion(pkg.available_version || '')
                      ? t('installed.list.ciVersionNote')
                      : '')
                  }
                >
                  <CircleArrowUp
                    class="text-info mr-1 h-4 w-4 cursor-pointer transition-transform hover:scale-125"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onUpdate(pkg);
                    }}
                  />
                </div>
              </Show>
              <Show when={pkg.installation_type === 'custom'}>
                <div
                  class="tooltip tooltip-bottom"
                  data-tip={t('installed.list.customInstallTooltip')}
                >
                  <Lock class="h-4 w-4 text-cyan-400" />
                </div>
              </Show>
              <Show when={heldStore.isHeld(pkg.name) && pkg.installation_type !== 'custom'}>
                <div class="tooltip tooltip-bottom" data-tip={t('installed.list.heldTooltip')}>
                  <Lock class="text-warning h-4 w-4" />
                </div>
              </Show>
            </h2>
          </div>
          <Dropdown
            position="end"
            trigger={<Ellipsis class="h-4 w-4" />}
            triggerClass="btn btn-ghost btn-xs btn-circle bg-base-content-bg"
            triggerDisabled={props.operatingOn === pkg.name}
            items={items()}
            onOpen={() => props.onDropdownOpen(pkg.name)}
            onClose={() => props.onDropdownClose()}
          />
        </div>
        <p class="text-base-content/70 text-sm">
          {t('installed.grid.version')} {pkg.version}
        </p>
        <p class="text-base-content/70 text-xs">
          {t('installed.grid.bucket')} {pkg.source}
        </p>
        <p class="text-base-content/50 text-xs" title={pkg.updated}>
          {t('installed.grid.updatedOn')} {formatIsoDate(pkg.updated)}
        </p>
      </div>
    </div>
  );
};

function PackageGridView(props: PackageGridViewProps) {
  const [contextMenuPackage, setContextMenuPackage] = createSignal<ScoopPackage | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = createSignal<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [dropdownOpenPackage, setDropdownOpenPackage] = createSignal<string | null>(null);
  const { confirmingItem, startConfirm, cancelConfirm, isConfirming } = useConfirmAction();

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
    setDropdownOpenPackage(null);
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

  const handleDropdownClose = () => {
    setDropdownOpenPackage(null);
  };

  return (
    <>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <For each={props.packages()}>
          {(pkg) => (
            <PackageCard
              pkg={pkg}
              searchQuery={props.searchQuery()}
              onViewInfo={props.onViewInfo}
              onViewInfoForVersions={props.onViewInfoForVersions}
              onUpdate={props.onUpdate}
              onHold={props.onHold}
              onOpenFolder={props.onOpenFolder}
              onUnhold={props.onUnhold}
              onChangeBucket={props.onChangeBucket}
              onUninstall={props.onUninstall}
              operatingOn={props.operatingOn()}
              isPackageVersioned={props.isPackageVersioned}
              isContextMenuActive={(pkgName) => contextMenuPackage()?.name === pkgName}
              isDropdownOpen={(pkgName) => dropdownOpenPackage() === pkgName}
              onDropdownOpen={(pkgName) => {
                setContextMenuPackage(null);
                setDropdownOpenPackage(pkgName);
              }}
              onDropdownClose={handleDropdownClose}
              onContextMenuOpen={openContextMenu}
              uninstallConfirm={() => isConfirming(pkg.name)}
              onUninstallConfirm={(confirm) =>
                confirm ? startConfirm(pkg.name) : cancelConfirm(pkg.name)
              }
            />
          )}
        </For>
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
    </>
  );
}

export default PackageGridView;
