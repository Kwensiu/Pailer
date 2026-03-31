import type { ScoopPackage } from '../../../types/scoop';
import type { ContextMenuItem } from './types';
import {
  createOpenFolderItem,
  createSwitchBucketItem,
  createViewInfoItem,
  createUninstallItem,
  createInstallAction,
  createManifestAction,
} from './actions';
import heldStore from '../../../stores/held';
import { t } from '../../../i18n';
import { CircleArrowUp, RefreshCw, Lock, LockOpen } from 'lucide-solid';

export interface InstalledVersionMenuState {
  hasVersions: boolean;
  loading: boolean;
  error: string | null;
  versions: Array<{
    version: string;
    isCurrent: boolean;
  }>;
}

export interface InstalledCbs {
  onUpdate: (pkg: ScoopPackage) => void;
  onOpenFolder: (pkg: ScoopPackage) => void;
  onViewInfoForVersions: (pkg: ScoopPackage) => void;
  onSwitchVersion?: (pkg: ScoopPackage, version: string) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  onHold: (pkgName: string) => void;
  onUnhold: (pkgName: string) => void;
  onUninstall: (pkg: ScoopPackage) => void;
}

export function createInstalledItems(
  pkg: ScoopPackage,
  confirmingPkg: string | null,
  operatingOn: string | null,
  callbacks: InstalledCbs,
  versionMenu?: InstalledVersionMenuState
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  const disabled = () => operatingOn === pkg.name;

  const switchVersionChildren: ContextMenuItem[] = versionMenu?.loading
    ? [
        {
          label: t('contextMenu.processing'),
          onClick: () => {},
          disabled: true,
          closeOnSelect: false,
        },
      ]
    : versionMenu?.error
      ? [
          {
            label: versionMenu.error,
            onClick: () => callbacks.onViewInfoForVersions(pkg),
            closeOnSelect: true,
          },
        ]
      : (versionMenu?.versions ?? []).map((version) => {
          const isCurrent = version.isCurrent;
          return {
            key: `${version.version}-${isCurrent ? 'current' : 'other'}`,
            label: isCurrent ? `•  ${version.version}` : version.version,
            onClick: () => callbacks.onSwitchVersion?.(pkg, version.version),
            disabled: disabled() || isCurrent,
            closeOnSelect: true,
          };
        });

  if (pkg.available_version && !heldStore.isHeld(pkg.name) && pkg.installation_type !== 'custom') {
    items.push({
      label: t('installed.list.update'),
      icon: CircleArrowUp,
      onClick: () => callbacks.onUpdate(pkg),
      disabled: disabled(),
      class: 'text-info',
    });
  }

  items.push(createOpenFolderItem(pkg, callbacks.onOpenFolder, { disabled }));

  if (callbacks.onSwitchVersion && versionMenu?.hasVersions) {
    items.push({
      label: t('installed.list.switchVersion'),
      icon: RefreshCw,
      onClick: () => callbacks.onViewInfoForVersions(pkg),
      disabled: disabled(),
      closeOnSelect: false,
      children: switchVersionChildren,
    });
  }

  items.push(createSwitchBucketItem(pkg, callbacks.onChangeBucket, { disabled }));

  if (pkg.installation_type !== 'custom') {
    items.push({
      label: () => {
        if (operatingOn === pkg.name) return t('contextMenu.processing');
        return heldStore.isHeld(pkg.name)
          ? t('installed.list.unholdPackage')
          : t('installed.list.holdPackage');
      },
      icon: heldStore.isHeld(pkg.name) ? LockOpen : Lock,
      onClick: () =>
        heldStore.isHeld(pkg.name) ? callbacks.onUnhold(pkg.name) : callbacks.onHold(pkg.name),
      disabled: disabled(),
    });
  }

  items.push(
    createUninstallItem(pkg, callbacks.onUninstall, {
      disabled: disabled(),
      confirmingPkg,
    })
  );

  return items;
}

export interface SearchCbs {
  onInstall: (pkg: ScoopPackage) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onSwitchBucket: (pkg: ScoopPackage) => void;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewManifest?: (pkg: ScoopPackage) => void;
}

export function createSearchItems(
  pkg: ScoopPackage,
  canSwitch: boolean,
  confirmingPkg: string | null,
  callbacks: SearchCbs
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  items.push(createInstallAction(pkg, callbacks.onInstall));

  if (canSwitch) {
    items.push(createSwitchBucketItem(pkg, callbacks.onSwitchBucket));
  }

  items.push(createViewInfoItem(pkg, callbacks.onViewInfo));

  if (pkg.is_installed) {
    items.push(createUninstallItem(pkg, callbacks.onUninstall, { confirmingPkg }));
  }

  const manifestAction = createManifestAction(pkg, callbacks.onViewManifest);
  if (manifestAction) {
    items.push(manifestAction);
  }

  return items;
}
