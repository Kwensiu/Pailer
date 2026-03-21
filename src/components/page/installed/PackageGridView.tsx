import { For, Show, createSignal, Accessor, createMemo } from 'solid-js';
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
import heldStore from '../../../stores/held';
import { t } from '../../../i18n';
import HighlightText from '../../common/HighlightText';
import { Dropdown } from '../../common/Dropdown';
import ContextMenu, { ContextMenuItem } from '../../common/ContextMenu';
import { formatIsoDate } from '../../../utils/date';

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
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  operatingOn: string | null;
  isPackageVersioned: (packageName: string) => boolean;
  onContextMenu: (e: MouseEvent, pkg: ScoopPackage) => void;
  onKeyDown: (e: KeyboardEvent, pkg: ScoopPackage) => void;
  isContextMenuActive: (pkgName: string) => boolean;
}) => {
  const { pkg } = props;

  const items = createMemo(() => {
    const baseItems = [
      {
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
      },
      {
        label: t('installed.list.changeBucket'),
        onClick: () => props.onChangeBucket(pkg),
        disabled: () => props.operatingOn === pkg.name,
        icon: ArrowLeftRight,
        align: 'start' as const,
      },
      {
        label: t('installed.list.uninstall'),
        onClick: () => props.onUninstall(pkg),
        disabled: () => props.operatingOn === pkg.name,
        icon: Trash2,
        align: 'start' as const,
      },
    ];

    if (props.isPackageVersioned(pkg.name)) {
      baseItems.splice(1, 0, {
        label: t('installed.list.switchVersion'),
        onClick: () => props.onViewInfoForVersions(pkg),
        disabled: () => false,
        icon: RefreshCw,
        align: 'start' as const,
      });
    }

    return baseItems;
  });

  // Detect if it's a CI version (beta/alpha/rc followed by additional suffix)
  const isCiVersion = (version: string): boolean => {
    return (
      /beta\.\d+\..+/.test(version) || /alpha\.\d+\..+/.test(version) || /rc\.\d+\..+/.test(version)
    );
  };

  return (
    <div
      class="card bg-base-card hover:bg-base-content-bg transform cursor-pointer shadow-md transition-all hover:scale-101"
      classList={{ 'bg-base-content-bg scale-101': props.isContextMenuActive(pkg.name) }}
      onClick={() => props.onViewInfo(pkg)}
      onContextMenu={(e) => props.onContextMenu(e, pkg)}
      onKeyDown={(e) => props.onKeyDown(e, pkg)}
      tabIndex={0}
      aria-label={`${pkg.name} package actions`}
      aria-haspopup="menu"
      data-no-close-search
    >
      <div class="card-body">
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
            trigger={
              <button
                class="btn btn-ghost btn-xs btn-circle bg-base-content-bg"
                onClick={(e) => e.stopPropagation()}
              >
                <Ellipsis class="h-4 w-4" />
              </button>
            }
            items={items()}
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
  const [uninstallConfirm, setUninstallConfirm] = createSignal(false);
  const [uninstallTimer, setUninstallTimer] = createSignal<number | null>(null);

  const adjustPosition = (x: number, y: number) => {
    const defaultWidth = 200;
    const defaultHeight = 200;

    const menuEl = document.querySelector('[role="menu"]') as HTMLElement;
    const menuWidth = menuEl?.offsetWidth || defaultWidth;
    const menuHeight = menuEl?.offsetHeight || defaultHeight;

    const adjustedX = Math.min(x, window.innerWidth - menuWidth);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight);
    return { x: Math.max(0, adjustedX), y: Math.max(0, adjustedY) };
  };

  const handleContextMenu = (e: MouseEvent, pkg: ScoopPackage) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPackage(pkg);
    setContextMenuPosition(adjustPosition(e.clientX, e.clientY));
    setUninstallConfirm(false);
    if (uninstallTimer()) {
      clearTimeout(uninstallTimer()!);
      setUninstallTimer(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent, pkg: ScoopPackage) => {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      handleContextMenu(new MouseEvent('contextmenu', { clientX: x, clientY: y }), pkg);
    }
  };

  const closeContextMenu = () => {
    setContextMenuPackage(null);
    setUninstallConfirm(false);
    if (uninstallTimer()) {
      clearTimeout(uninstallTimer()!);
      setUninstallTimer(null);
    }
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
              onUnhold={props.onUnhold}
              onUninstall={props.onUninstall}
              onChangeBucket={props.onChangeBucket}
              operatingOn={props.operatingOn()}
              isPackageVersioned={props.isPackageVersioned}
              onContextMenu={handleContextMenu}
              onKeyDown={handleKeyDown}
              isContextMenuActive={(pkgName) => contextMenuPackage()?.name === pkgName}
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
        <Show
          when={
            contextMenuPackage() &&
            contextMenuPackage()!.available_version &&
            !heldStore.isHeld(contextMenuPackage()!.name) &&
            contextMenuPackage()!.installation_type !== 'custom'
          }
        >
          <ContextMenuItem
            onSelect={() => {
              props.onUpdate(contextMenuPackage()!);
              closeContextMenu();
            }}
            class="text-info"
          >
            <CircleArrowUp class="text-info h-4 w-4" />
            <span>{t('installed.list.update')}</span>
          </ContextMenuItem>
        </Show>

        <ContextMenuItem
          onSelect={() => {
            props.onOpenFolder(contextMenuPackage()!);
            closeContextMenu();
          }}
        >
          <Folder class="h-4 w-4" />
          <span>{t('installed.list.openFolder')}</span>
        </ContextMenuItem>

        <Show when={contextMenuPackage() && props.isPackageVersioned(contextMenuPackage()!.name)}>
          <ContextMenuItem
            onSelect={() => {
              props.onViewInfoForVersions(contextMenuPackage()!);
              closeContextMenu();
            }}
          >
            <RefreshCw class="h-4 w-4" />
            <span>{t('installed.list.switchVersion')}</span>
          </ContextMenuItem>
        </Show>

        <ContextMenuItem
          onSelect={() => {
            props.onChangeBucket(contextMenuPackage()!);
            closeContextMenu();
          }}
        >
          <ArrowLeftRight class="h-4 w-4" />
          <span>{t('installed.list.changeBucket')}</span>
        </ContextMenuItem>

        <Show when={contextMenuPackage() && contextMenuPackage()!.installation_type !== 'custom'}>
          <Show
            when={!heldStore.isHeld(contextMenuPackage()!.name)}
            fallback={
              <ContextMenuItem
                onSelect={() => {
                  props.onUnhold(contextMenuPackage()!.name);
                  closeContextMenu();
                }}
              >
                <LockOpen class="h-4 w-4" />
                <span>{t('installed.list.unholdPackage')}</span>
              </ContextMenuItem>
            }
          >
            <ContextMenuItem
              onSelect={() => {
                props.onHold(contextMenuPackage()!.name);
                closeContextMenu();
              }}
            >
              <Lock class="h-4 w-4" />
              <span>{t('installed.list.holdPackage')}</span>
            </ContextMenuItem>
          </Show>
        </Show>

        <ContextMenuItem
          onSelect={() => {
            if (uninstallConfirm()) {
              if (uninstallTimer()) {
                clearTimeout(uninstallTimer()!);
                setUninstallTimer(null);
              }
              setUninstallConfirm(false);
              props.onUninstall(contextMenuPackage()!);
              closeContextMenu();
            } else {
              setUninstallConfirm(true);
              const timer = window.setTimeout(() => {
                setUninstallConfirm(false);
                setUninstallTimer(null);
              }, 3000);
              setUninstallTimer(timer);
            }
          }}
          class={uninstallConfirm() ? 'text-warning' : 'text-error'}
          ariaLabel={uninstallConfirm() ? t('buttons.sure') : t('installed.list.uninstall')}
        >
          <Trash2 class="h-4 w-4" />
          <span>{uninstallConfirm() ? t('buttons.sure') : t('installed.list.uninstall')}</span>
        </ContextMenuItem>
      </ContextMenu>
    </>
  );
}

export default PackageGridView;
