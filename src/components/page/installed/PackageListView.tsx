import { For, Show, Accessor } from 'solid-js';
import {
  Ellipsis,
  CircleArrowUp,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  RefreshCw,
  ArrowLeftRight,
} from 'lucide-solid';
import type { DisplayPackage } from '../../../stores/installedPackagesStore';
import type { ScoopPackage } from '../../../types/scoop';
import heldStore from '../../../stores/held';
import { formatIsoDate } from '../../../utils/date';
import { t } from '../../../i18n';

type SortKey = 'name' | 'version' | 'source' | 'updated';

interface PackageListViewProps {
  packages: Accessor<DisplayPackage[]>;
  onSort: (key: SortKey) => void;
  sortKey: Accessor<SortKey>;
  sortDirection: Accessor<'asc' | 'desc'>;
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
                <Unlock class="mr-2 h-4 w-4" />
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

function PackageListView(props: PackageListViewProps) {
  // 检测是否为 CI 版本（beta/alpha/rc 后有额外后缀）
  const isCiVersion = (version: string): boolean => {
    return (
      /beta\.\d+\..+/.test(version) || /alpha\.\d+\..+/.test(version) || /rc\.\d+\..+/.test(version)
    );
  };

  return (
    <div class="bg-base-card overflow-x-auto rounded-xl shadow-xl">
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
            <th
              class="text-center"
              style="position: sticky; right: 0; background: inherit; z-index: 2; "
            ></th>
          </tr>
        </thead>
        <tbody>
          <For each={props.packages()}>
            {(pkg, index) => (
              <tr data-no-close-search>
                <td class="max-w-xs whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <button
                      class="btn btn-soft bg-base-100 sm:btn-sm overflow-hidden transition-all duration-200 hover:shadow-md"
                      onClick={() => props.onViewInfo(pkg)}
                    >
                      <div class="max-w-[120px] truncate font-medium">{pkg.name}</div>
                    </button>
                    <Show
                      when={
                        pkg.available_version &&
                        !heldStore.isHeld(pkg.name) &&
                        !pkg.is_versioned_install
                      }
                    >
                      <div
                        class="tooltip"
                        data-tip={`Update available: ${pkg.available_version}${isCiVersion(pkg.available_version || '') ? ' (CI 版本，Scoop 可能无法自动更新)' : ''}`}
                      >
                        <CircleArrowUp
                          class="text-primary mr-1 h-4 w-4 cursor-pointer transition-transform hover:scale-125"
                          onClick={() => props.onUpdate(pkg)}
                        />
                      </div>
                    </Show>
                    <Show when={pkg.is_versioned_install}>
                      <div class="tooltip" data-tip="Versioned install - cannot be updated">
                        <Lock class="h-4 w-4 text-cyan-400" />
                      </div>
                    </Show>
                    <Show when={heldStore.isHeld(pkg.name) && !pkg.is_versioned_install}>
                      <div class="tooltip" data-tip="This package is on hold.">
                        <Lock class="text-warning h-4 w-4" />
                      </div>
                    </Show>
                  </div>
                </td>
                <td class="whitespace-nowrap">{pkg.version}</td>
                <td class="whitespace-nowrap">{pkg.source}</td>
                <td class="whitespace-nowrap" title={pkg.updated}>
                  {formatIsoDate(pkg.updated)}
                </td>
                <td class="text-center">
                  <div
                    class="dropdown dropdown-end"
                    classList={{
                      'dropdown-top': index() * 2 >= props.packages().length - 1,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label tabindex="0" class="btn btn-ghost btn-xs btn-circle bg-base-content-bg">
                      <Ellipsis class="h-4 w-4" />
                    </label>
                    <ul
                      tabindex="0"
                      class="dropdown-content menu bg-base-content-bg rounded-box z-100 w-44 p-2 shadow"
                    >
                      <li>
                        <HoldToggleButton
                          pkgName={pkg.name}
                          isHeld={heldStore.isHeld(pkg.name)}
                          isVersioned={!!pkg.is_versioned_install}
                          operatingOn={props.operatingOn()}
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
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

export default PackageListView;
