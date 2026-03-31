import { For, Show, createSignal, Accessor, createMemo, createEffect, onCleanup } from 'solid-js';
import { CircleArrowUp, Lock, Ellipsis } from 'lucide-solid';
import type { ScoopPackage } from '../../../types/scoop';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import type { ContextMenuItem } from '../../../components/common/context-menu';
import heldStore from '../../../stores/held';
import { t } from '../../../i18n';
import HighlightText from '../../common/HighlightText';
import Dropdown from '../../common/Dropdown';
import ContextMenu from '../../common/ContextMenu';
import { ContextMenuRenderer } from '../../../components/common/context-menu';
import { createInstalledItems } from '../../../components/common/context-menu/menuItems';
import { formatIsoDate } from '../../../utils/date';
import { useConfirmAction, useContextMenuState } from '../../../hooks';

type ActiveMenuState = {
  type: 'dropdown' | 'context';
  packageName: string;
} | null;

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
  hasVersions: (packageName: string) => boolean;
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
  hasVersions: (packageName: string) => boolean;
  isMenuActive: (pkgName: string, type?: 'dropdown' | 'context') => boolean;
  onDropdownOpen: (pkgName: string) => void;
  onDropdownClose: (pkgName: string) => void;
  onContextMenuOpen: (pkg: ScoopPackage, x: number, y: number) => void;
  uninstallConfirm: Accessor<boolean>;
  onUninstallConfirm: (confirm: boolean) => void;
}) => {
  const { pkg } = props;

  const items = createMemo(() => {
    return createInstalledItems(
      pkg,
      props.uninstallConfirm() ? pkg.name : null,
      props.operatingOn,
      props.hasVersions,
      {
        onUpdate: props.onUpdate,
        onOpenFolder: props.onOpenFolder,
        onViewInfoForVersions: props.onViewInfoForVersions,
        onChangeBucket: props.onChangeBucket,
        onHold: props.onHold,
        onUnhold: props.onUnhold,
        onUninstall: () => {
          if (props.uninstallConfirm()) {
            props.onUninstallConfirm(false);
            props.onUninstall(pkg);
          } else {
            props.onUninstallConfirm(true);
          }
        },
      }
    )
      .filter((item) => (item.showWhen ? item.showWhen() : true))
      .map((item) => ({
        label: item.label,
        onClick: item.onClick,
        disabled: item.disabled,
        icon: item.icon,
        class: item.class,
        closeOnSelect: item.closeOnSelect,
        align: 'start' as const,
      }));
  });

  // Detect if it's a CI version (beta/alpha/rc followed by additional suffix)
  const isCiVersion = (version: string): boolean => {
    return (
      /beta\.\d+\..+/.test(version) || /alpha\.\d+\..+/.test(version) || /rc\.\d+\..+/.test(version)
    );
  };

  const isCardActive = () => {
    return props.isMenuActive(pkg.name);
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
            onClose={() => props.onDropdownClose(pkg.name)}
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
  const contextMenu = useContextMenuState<ScoopPackage>();
  const [activeMenu, setActiveMenu] = createSignal<ActiveMenuState>(null);
  const { confirmingItem, startConfirm, cancelConfirm, isConfirming } = useConfirmAction();

  const closeContextMenu = () => {
    contextMenu.close();
    setActiveMenu(null);
    cancelConfirm();
  };

  createEffect(() => {
    onCleanup(() => {
      cancelConfirm();
    });
  });

  const openContextMenu = (pkg: ScoopPackage, x: number, y: number) => {
    contextMenu.open(pkg, x, y);
    setActiveMenu({ type: 'context', packageName: pkg.name });
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

  const isMenuActive = (pkgName: string, type?: 'dropdown' | 'context') => {
    const current = activeMenu();
    if (!current || current.packageName !== pkgName) return false;
    return type ? current.type === type : true;
  };

  const handleDropdownClose = (pkgName: string) => {
    setActiveMenu((current) => {
      if (!current) return current;
      return current.type === 'dropdown' && current.packageName === pkgName ? null : current;
    });
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
              hasVersions={props.hasVersions}
              isMenuActive={isMenuActive}
              onDropdownOpen={(pkgName) => {
                contextMenu.close();
                setActiveMenu({ type: 'dropdown', packageName: pkgName });
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
    </>
  );
}

export default PackageGridView;
