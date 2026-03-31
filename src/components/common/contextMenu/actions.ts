import { Folder, ArrowLeftRight, Trash2, Info, FileText, Download } from 'lucide-solid';
import { t } from '../../../i18n';
import type { ScoopPackage } from '../../../types/scoop';
import type { ContextMenuItem } from './types';

export interface MenuCbs {
  onOpenFolder: (pkg: ScoopPackage) => void;
  onChangeBucket: (pkg: ScoopPackage) => void;
  onUninstall: (pkg: ScoopPackage) => void;
  onViewInfo?: (pkg: ScoopPackage) => void;
}

export interface BaseItemOptions {
  disabled?: boolean | (() => boolean);
}

export function createOpenFolderItem(
  pkg: ScoopPackage,
  onOpenFolder: (pkg: ScoopPackage) => void,
  options?: BaseItemOptions
): ContextMenuItem {
  return {
    label: t('contextMenu.openFolder'),
    icon: Folder,
    onClick: () => onOpenFolder(pkg),
    disabled: options?.disabled,
  };
}

export function createSwitchBucketItem(
  pkg: ScoopPackage,
  onSwitchBucket: (pkg: ScoopPackage) => void,
  options?: BaseItemOptions
): ContextMenuItem {
  return {
    label: t('buttons.switchBucket'),
    icon: ArrowLeftRight,
    onClick: () => onSwitchBucket(pkg),
    disabled: options?.disabled,
  };
}

export function createViewInfoItem(
  pkg: ScoopPackage,
  onViewInfo: (pkg: ScoopPackage) => void,
  options?: BaseItemOptions
): ContextMenuItem {
  return {
    label: t('packageInfo.details'),
    icon: Info,
    onClick: () => onViewInfo(pkg),
    disabled: options?.disabled,
  };
}

export interface UninstallOptions extends BaseItemOptions {
  confirmingPkg?: string | null;
}

export function createUninstallItem(
  pkg: ScoopPackage,
  onUninstall: (pkg: ScoopPackage) => void,
  options?: UninstallOptions
): ContextMenuItem {
  const isConfirming = options?.confirmingPkg === pkg.name;
  return {
    label: () => (isConfirming ? t('buttons.sure') : t('buttons.uninstall')),
    icon: Trash2,
    onClick: () => onUninstall(pkg),
    disabled: options?.disabled,
    closeOnSelect: isConfirming,
    class: isConfirming ? 'text-warning' : 'text-error',
  };
}

export function createBaseMenuItems(
  pkg: ScoopPackage,
  callbacks: MenuCbs,
  options?: {
    showOpenFolder?: boolean;
    showSwitch?: boolean;
    showViewInfo?: boolean;
    showUninstall?: boolean;
    confirmingPkg?: string | null;
    operatingOn?: string | null;
  }
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  const disabled = () => options?.operatingOn === pkg.name;

  if (options?.showOpenFolder) {
    items.push(createOpenFolderItem(pkg, callbacks.onOpenFolder, { disabled }));
  }

  if (options?.showSwitch) {
    items.push(createSwitchBucketItem(pkg, callbacks.onChangeBucket, { disabled }));
  }

  if (options?.showViewInfo && callbacks.onViewInfo) {
    items.push(createViewInfoItem(pkg, callbacks.onViewInfo, { disabled }));
  }

  if (options?.showUninstall) {
    items.push(
      createUninstallItem(pkg, callbacks.onUninstall, {
        disabled,
        confirmingPkg: options.confirmingPkg,
      })
    );
  }

  return items;
}

export function createInstallAction(
  pkg: ScoopPackage,
  onInstall: (pkg: ScoopPackage) => void
): ContextMenuItem {
  return {
    label: t('buttons.install'),
    icon: Download,
    class: 'text-info',
    showWhen: () => !pkg.is_installed,
    onClick: () => onInstall(pkg),
  };
}

export function createManifestAction(
  pkg: ScoopPackage,
  onViewManifest?: (pkg: ScoopPackage) => void
): ContextMenuItem | null {
  if (!onViewManifest) return null;
  return {
    label: t('packageInfo.viewManifest'),
    icon: FileText,
    onClick: () => onViewManifest(pkg),
  };
}
