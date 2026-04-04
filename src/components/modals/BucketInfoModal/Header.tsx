import { Show, createMemo } from 'solid-js';
import { Ellipsis, RefreshCw, FolderOpen, Globe } from 'lucide-solid';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import Dropdown, { type DropdownItem } from '../../common/Dropdown';
import { t } from '../../../i18n';
import type { BucketInfoModalProps } from './types';

interface BucketInfoModalHeaderProps {
  bucket: BucketInfoModalProps['bucket'];
  searchBucket: BucketInfoModalProps['searchBucket'];
  isExternalBucket: () => boolean;
  isInstalled: () => boolean;
  bucketName: () => string | undefined;
  onBucketUpdated: BucketInfoModalProps['onBucketUpdated'];
}

export function BucketInfoModalHeader(props: BucketInfoModalHeaderProps) {
  const menuItems = createMemo(() => {
    const items: DropdownItem[] = [];

    if (props.isInstalled()) {
      items.push({
        label: t('bucketInfo.refreshBucket'),
        onClick: () => {
          const name = props.bucketName();
          if (name) props.onBucketUpdated?.(name);
        },
        icon: RefreshCw,
      });
    }

    const path = props.bucket?.path;
    if (path) {
      items.push({
        label: t('bucketInfo.openFolder'),
        onClick: async () => {
          try {
            await openPath(path);
          } catch (error) {
            console.error('Failed to open folder:', error);
          }
        },
        icon: FolderOpen,
      });
    }

    const url = props.bucket?.git_url || props.searchBucket?.url;
    items.push({
      label: t('bucketInfo.viewOnGithub'),
      onClick: async () => {
        if (url) {
          try {
            await openUrl(url);
          } catch (error) {
            console.error('Failed to open URL:', error);
          }
        }
      },
      icon: Globe,
      disabled: !url,
    });

    return items;
  });

  return (
    <div class="flex items-center gap-2">
      <Show when={props.isExternalBucket()}>
        <div class="badge badge-warning badge-sm">{t('bucketInfo.external')}</div>
      </Show>
      <Dropdown
        position="end"
        items={menuItems()}
        trigger={<Ellipsis class="h-5 w-5 shrink-0" />}
        triggerClass="btn btn-ghost btn-sm btn-circle"
      />
    </div>
  );
}
