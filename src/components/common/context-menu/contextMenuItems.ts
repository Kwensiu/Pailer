import type { ScoopPackage } from '../../../types/scoop';
import type { ContextMenuItem } from './types';
import heldStore from '../../../stores/held';
import { t } from '../../../i18n';
import {
  CircleArrowUp,
  Folder,
  RefreshCw,
  ArrowLeftRight,
  Trash2,
  Lock,
  LockOpen,
} from 'lucide-solid';

/**
 * Generate context menu items for a package
 * @param pkg Package information
 * @param uninstallConfirmPkg Package name currently requiring uninstall confirmation
 * @param operatingOn Package name currently being operated on
 * @param isPackageVersioned Function to check if package is a versioned package
 * @param callbacks Various operation callback functions
 * @returns Array of menu items
 */
export function createPackageContextMenuItems(
  pkg: ScoopPackage,
  uninstallConfirmPkg: string | null,
  operatingOn: string | null,
  isPackageVersioned: (packageName: string) => boolean,
  callbacks: {
    onUpdate: (pkg: ScoopPackage) => void;
    onOpenFolder: (pkg: ScoopPackage) => void;
    onViewInfoForVersions: (pkg: ScoopPackage) => void;
    onChangeBucket: (pkg: ScoopPackage) => void;
    onHold: (pkgName: string) => void;
    onUnhold: (pkgName: string) => void;
    onUninstall: (pkg: ScoopPackage) => void;
  }
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  // Update (only when available version exists and not held and not custom install)
  if (pkg.available_version && !heldStore.isHeld(pkg.name) && pkg.installation_type !== 'custom') {
    items.push({
      label: t('installed.list.update'),
      icon: CircleArrowUp,
      onClick: () => callbacks.onUpdate(pkg),
      disabled: () => operatingOn === pkg.name,
      class: 'text-info',
    });
  }

  // Open folder
  items.push({
    label: t('installed.list.openFolder'),
    icon: Folder,
    onClick: () => callbacks.onOpenFolder(pkg),
  });

  // Switch version (versioned apps only)
  if (isPackageVersioned(pkg.name)) {
    items.push({
      label: t('installed.list.switchVersion'),
      icon: RefreshCw,
      onClick: () => callbacks.onViewInfoForVersions(pkg),
      disabled: () => operatingOn === pkg.name,
    });
  }

  // Change bucket
  items.push({
    label: t('installed.list.changeBucket'),
    icon: ArrowLeftRight,
    onClick: () => callbacks.onChangeBucket(pkg),
    disabled: () => operatingOn === pkg.name,
  });

  // Hold/Unhold (non-custom installs only)
  if (pkg.installation_type !== 'custom') {
    items.push({
      label: () => {
        if (operatingOn === pkg.name) return t('installed.list.processing');
        if (isPackageVersioned(pkg.name)) return t('installed.list.cannotUnhold');
        return heldStore.isHeld(pkg.name)
          ? t('installed.list.unholdPackage')
          : t('installed.list.holdPackage');
      },
      icon: heldStore.isHeld(pkg.name) ? LockOpen : Lock,
      onClick: () =>
        heldStore.isHeld(pkg.name) ? callbacks.onUnhold(pkg.name) : callbacks.onHold(pkg.name),
      disabled: () => operatingOn === pkg.name || isPackageVersioned(pkg.name),
    });
  }

  // Uninstall (with confirmation)
  items.push({
    label: () =>
      uninstallConfirmPkg === pkg.name ? t('buttons.sure') : t('installed.list.uninstall'),
    icon: Trash2,
    onClick: () => callbacks.onUninstall(pkg),
    disabled: () => operatingOn === pkg.name,
    closeOnSelect: uninstallConfirmPkg === pkg.name,
    class: uninstallConfirmPkg === pkg.name ? 'text-warning' : 'text-error',
  });

  return items;
}
