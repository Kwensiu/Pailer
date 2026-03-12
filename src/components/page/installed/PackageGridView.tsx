import { For, Show, Accessor, createMemo } from 'solid-js';
import {
  Ellipsis,
  ArrowUpCircle,
  Lock,
  RefreshCw,
  ArrowLeftRight,
  Trash2,
  LockOpen,
} from 'lucide-solid';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import type { ScoopPackage } from '../../../types/scoop';
import heldStore from '../../../stores/held';
import { formatIsoDate } from '../../../utils/date';
import { t } from '../../../i18n';
import HighlightText from '../../common/HighlightText';
import { Dropdown } from '../../common/Dropdown';

interface PackageGridViewProps {
  packages: Accessor<DisplayPackage[]>;
  searchQuery: Accessor<string>;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  onUpdate: (pkg: ScoopPackage) => void;
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
      onClick={() => props.onViewInfo(pkg)}
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
                  <ArrowUpCircle
                    class="text-primary mr-1 h-4 w-4 cursor-pointer transition-transform hover:scale-125"
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
  return (
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
          />
        )}
      </For>
    </div>
  );
}

export default PackageGridView;
