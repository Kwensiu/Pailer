import { For, Show, Accessor } from 'solid-js';
import {
  Ellipsis,
  ArrowUpCircle,
  Trash2,
  Lock,
  RefreshCw,
  ArrowLeftRight,
  LockOpen,
} from 'lucide-solid';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import type { ScoopPackage } from '../../../types/scoop';
import heldStore from '../../../stores/held';
import { formatIsoDate } from '../../../utils/date';
import { t } from '../../../i18n';

interface PackageGridViewProps {
  packages: Accessor<DisplayPackage[]>;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  onUpdate: (pkg: ScoopPackage) => void;
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
  onSwitchVersion: (pkgName: string, version: string) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  operatingOn: Accessor<string | null>;
  isPackageVersioned: (packageName: string) => boolean;
}

// 单个包卡片组件
const PackageCard = (props: {
  pkg: DisplayPackage;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  onUpdate: (pkg: ScoopPackage) => void;
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
  onSwitchVersion: (pkgName: string, version: string) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  operatingOn: string | null;
  isPackageVersioned: (packageName: string) => boolean;
}) => {
  const { pkg } = props;

  // 检测是否为 CI 版本（beta/alpha/rc 后有额外后缀）
  const isCiVersion = (version: string): boolean => {
    return (
      /beta\.\d+\..+/.test(version) || /alpha\.\d+\..+/.test(version) || /rc\.\d+\..+/.test(version)
    );
  };

  return (
    <div
      class="card bg-base-300 hover:bg-base-400 z-0 transform cursor-pointer shadow-xl transition-all focus-within:z-20 hover:z-20 hover:scale-101"
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
                  {pkg.name}
                </div>
              </button>
              <Show
                when={
                  pkg.available_version && !heldStore.isHeld(pkg.name) && !pkg.is_versioned_install
                }
              >
                <div
                  class="tooltip"
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
              <Show when={pkg.is_versioned_install}>
                <div class="tooltip" data-tip={t('installed.list.versionedTooltip')}>
                  <Lock class="h-4 w-4 text-cyan-400" />
                </div>
              </Show>
              <Show when={heldStore.isHeld(pkg.name) && !pkg.is_versioned_install}>
                <div class="tooltip" data-tip={t('installed.list.heldTooltip')}>
                  <Lock class="text-warning h-4 w-4" />
                </div>
              </Show>
            </h2>
          </div>
          <div class="dropdown dropdown-end shrink-0" onClick={(e) => e.stopPropagation()}>
            <label tabindex="0" class="btn btn-ghost btn-xs btn-circle bg-base-400">
              <Ellipsis class="h-4 w-4" />
            </label>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-400 rounded-box z-1 w-44 p-2 shadow"
            >
              <li>
                <HoldToggleButton
                  pkgName={pkg.name}
                  isHeld={heldStore.isHeld(pkg.name)}
                  isVersioned={pkg.is_versioned_install ?? false}
                  operatingOn={props.operatingOn}
                  onHold={props.onHold}
                  onUnhold={props.onUnhold}
                />
              </li>
              <SwitchVersionButton
                pkgName={pkg.name}
                isPackageVersioned={props.isPackageVersioned}
                onViewInfoForVersions={props.onViewInfoForVersions}
                pkg={pkg}
              />
              <li>
                <a onClick={() => props.onChangeBucket(pkg)}>
                  <ArrowLeftRight class="mr-2 h-4 w-4" />
                  {t('installed.list.changeBucket')}
                </a>
              </li>
              <li>
                <a class="text-error" onClick={() => props.onUninstall(pkg)}>
                  <Trash2 class="mr-2 h-4 w-4" />
                  {t('installed.list.uninstall')}
                </a>
              </li>
            </ul>
          </div>
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

// Extract operation button component to avoid repeated creation
const HoldToggleButton = (props: {
  pkgName: string;
  isHeld: boolean;
  isVersioned: boolean;
  operatingOn: string | null;
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
}) => {
  return (
    <Show
      when={props.operatingOn === props.pkgName}
      fallback={
        <Show
          when={props.isVersioned}
          fallback={
            <Show
              when={props.isHeld}
              fallback={
                <a onClick={() => props.onHold(props.pkgName)}>
                  <Lock class="mr-2 h-4 w-4" />
                  <span>{t('installed.list.holdPackage')}</span>
                </a>
              }
            >
              <a onClick={() => props.onUnhold(props.pkgName)}>
                <LockOpen class="mr-2 h-4 w-4" />
                <span>{t('installed.list.unholdPackage')}</span>
              </a>
            </Show>
          }
        >
          <a class="btn-disabled cursor-not-allowed">
            <Lock class="mr-2 h-4 w-4 text-cyan-400" />
            <span>{t('installed.list.cannotUnhold')}</span>
          </a>
        </Show>
      }
    >
      <span class="flex items-center justify-center p-2">
        <span class="loading loading-spinner loading-xs"></span>
      </span>
    </Show>
  );
};

// Extract version switch button component
const SwitchVersionButton = (props: {
  pkgName: string;
  isPackageVersioned: (packageName: string) => boolean;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  pkg: ScoopPackage;
}) => {
  return (
    <Show when={props.isPackageVersioned(props.pkgName)}>
      <li>
        <a onClick={() => props.onViewInfoForVersions(props.pkg)}>
          <RefreshCw class="mr-2 h-4 w-4" />
          {t('installed.list.switchVersion')}
        </a>
      </li>
    </Show>
  );
};

function PackageGridView(props: PackageGridViewProps) {
  return (
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <For each={props.packages()}>
        {(pkg) => (
          <PackageCard
            pkg={pkg}
            onViewInfo={props.onViewInfo}
            onViewInfoForVersions={props.onViewInfoForVersions}
            onUpdate={props.onUpdate}
            onHold={props.onHold}
            onUnhold={props.onUnhold}
            onSwitchVersion={props.onSwitchVersion}
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
