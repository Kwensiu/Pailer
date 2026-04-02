import { Ellipsis, FileText, Braces, FolderOpen, CircleFadingArrowUp } from 'lucide-solid';
import Dropdown from '../../common/Dropdown';
import { t } from '../../../i18n';
import type { ScoopPackage } from '../../../types/scoop';
import type { PackageInfoModalProps } from './types';

interface PackageInfoModalHeaderProps {
  pkg: PackageInfoModalProps['pkg'];
  isInstalled: () => boolean;
  hasUpdate: () => boolean;
  onFetchManifest: (pkg: ScoopPackage) => void;
  onForceUpdate: PackageInfoModalProps['onForceUpdate'];
}

export function PackageInfoModalHeader(props: PackageInfoModalHeaderProps) {
  return (
    <Dropdown
      position="end"
      trigger={<Ellipsis class="h-5 w-5 shrink-0" />}
      triggerClass="btn btn-ghost btn-sm btn-circle"
      items={[
        {
          label: t('packageInfo.viewManifest'),
          onClick: () => props.pkg && props.onFetchManifest(props.pkg),
          icon: FileText,
        },
        ...(props.isInstalled()
          ? [
              {
                label: t('packageInfo.debugStructure'),
                onClick: async () => {
                  if (props.pkg) {
                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      const debug = await invoke<string>('debug_package_structure', {
                        packageName: props.pkg!.name,
                        global: false,
                      });
                      console.log('Package structure debug:', debug);
                      alert(debug);
                    } catch (error) {
                      console.error('Failed to debug package info:', error);
                    }
                  }
                },
                icon: Braces,
              },
            ]
          : []),
        ...(props.isInstalled()
          ? [
              {
                label: t('packageInfo.openFolder'),
                onClick: async () => {
                  if (props.pkg) {
                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      const { openPath } = await import('@tauri-apps/plugin-opener');
                      const packagePath = await invoke<string>('get_package_path', {
                        packageName: props.pkg!.name,
                      });
                      await openPath(packagePath);
                    } catch (error) {
                      console.error('Failed to open package path:', error);
                    }
                  }
                },
                icon: FolderOpen,
              },
            ]
          : []),
        ...(props.isInstalled() && props.hasUpdate()
          ? [
              {
                label: t('buttons.forceUpdate'),
                onClick: () => {
                  props.onForceUpdate?.(props.pkg!);
                },
                icon: CircleFadingArrowUp,
              },
            ]
          : []),
      ]}
      contentClass="p-2"
    />
  );
}
