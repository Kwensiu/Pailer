import { Show } from 'solid-js';
import { Download, Trash2, LoaderCircle } from 'lucide-solid';
import { t } from '../../../i18n';
import { useMultiConfirmAction } from '../../../hooks/ui/useConfirmAction';
import type { BucketInfoModalProps } from './types';

interface BucketInstallReturn {
  isBucketBusy: (name: string) => boolean;
  isBucketInstalling: (name: string) => boolean;
  isBucketRemoving: (name: string) => boolean;
}

interface BucketInfoModalFooterProps {
  bucketName: () => string | undefined;
  searchBucket: BucketInfoModalProps['searchBucket'];
  isInstalled: () => boolean;
  bucketInstall: BucketInstallReturn;
  onInstallBucket: () => void;
  onRemoveBucket: () => void;
}

export function BucketInfoModalFooter(props: BucketInfoModalFooterProps) {
  const removeConfirm = useMultiConfirmAction(3000);

  const handleRemoveClick = () => {
    if (removeConfirm.isConfirming('remove')) {
      props.onRemoveBucket();
    } else {
      removeConfirm.startConfirm('remove');
    }
  };

  return (
    <div class="flex w-full items-center justify-between">
      <div class="flex space-x-2">
        <Show when={!props.isInstalled() && props.searchBucket}>
          <button
            type="button"
            class="btn btn-primary btn-footer"
            onClick={props.onInstallBucket}
            disabled={props.bucketInstall.isBucketBusy(props.bucketName() || '')}
          >
            <Show
              when={props.bucketInstall.isBucketInstalling(props.bucketName() || '')}
              fallback={
                <>
                  <Download class="mr-2 h-4 w-4" />
                  {t('bucketInfo.install')}
                </>
              }
            >
              <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
              {t('bucketInfo.installing')}
            </Show>
          </button>
        </Show>
        <Show when={props.isInstalled()}>
          <button
            type="button"
            class="btn btn-error btn-soft btn-footer"
            classList={{ 'btn-warning': removeConfirm.isConfirming('remove') }}
            onClick={handleRemoveClick}
            disabled={props.bucketInstall.isBucketBusy(props.bucketName() || '')}
          >
            <Show
              when={props.bucketInstall.isBucketRemoving(props.bucketName() || '')}
              fallback={
                <>
                  <Trash2 class="mr-2 h-4 w-4" />
                  {removeConfirm.isConfirming('remove') ? t('buttons.sure') : t('buttons.remove')}
                </>
              }
            >
              <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
              {t('bucketInfo.removing')}
            </Show>
          </button>
        </Show>
      </div>
      <button class="btn btn-soft btn-footer w-18" data-modal-close>
        {t('bucketInfo.close')}
      </button>
    </div>
  );
}
