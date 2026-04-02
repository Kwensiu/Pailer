import { Show } from 'solid-js';
import { Download, ChevronUp } from 'lucide-solid';
import Dropdown from '../../common/Dropdown';
import { t } from '../../../i18n';
import type { PackageInfoModalProps } from './types';

interface ConfirmActionReturn {
  isConfirming: (key: string) => boolean;
  startConfirm: (key: string) => void;
  cancelConfirm: (key?: string) => void;
}

interface PackageInfoModalFooterProps {
  pkg: PackageInfoModalProps['pkg'];
  isInstalled: () => boolean;
  hasUpdate: () => boolean;
  showBackButton: PackageInfoModalProps['showBackButton'];
  uninstallConfirm: ConfirmActionReturn;
  updateConfirm: ConfirmActionReturn;
  onInstall?: PackageInfoModalProps['onInstall'];
  onUninstall?: PackageInfoModalProps['onUninstall'];
  onUpdate?: PackageInfoModalProps['onUpdate'];
  onForceUpdate?: PackageInfoModalProps['onForceUpdate'];
  onPackageStateChanged?: PackageInfoModalProps['onPackageStateChanged'];
}

export function PackageInfoModalFooter(props: PackageInfoModalFooterProps) {
  return (
    <div class="flex w-full items-center justify-between">
      <div class="flex space-x-2">
        <Show when={props.isInstalled()}>
          <button
            type="button"
            class="btn btn-soft btn-footer btn-error"
            classList={{ 'btn-warning': props.uninstallConfirm.isConfirming('uninstall') }}
            onClick={() => {
              if (props.uninstallConfirm.isConfirming('uninstall')) {
                props.uninstallConfirm.cancelConfirm('uninstall');
                if (props.pkg) {
                  props.onUninstall?.(props.pkg);
                  props.onPackageStateChanged?.();
                }
              } else {
                props.uninstallConfirm.startConfirm('uninstall');
              }
            }}
          >
            {props.uninstallConfirm.isConfirming('uninstall')
              ? t('buttons.sure')
              : t('buttons.uninstall')}
          </button>
        </Show>
      </div>
      <div class="flex space-x-2">
        <form method="dialog">
          <Show when={!props.isInstalled() && props.onInstall}>
            <button
              type="button"
              class="btn btn-footer btn-primary mr-2"
              onClick={() => {
                if (props.pkg) {
                  props.onInstall!(props.pkg);
                  props.onPackageStateChanged?.();
                }
              }}
            >
              <Download class="mr-2 h-4 w-4" />
              {t('buttons.install')}
            </button>
          </Show>
          <Show when={props.isInstalled()}>
            <div class="join mr-2">
              <button
                type="button"
                class="btn join-item btn-l-split"
                classList={{
                  'btn-info btn-soft':
                    props.hasUpdate() && !props.updateConfirm.isConfirming('update'),
                  'btn-soft text-base-content/50':
                    !props.hasUpdate() && !props.updateConfirm.isConfirming('update'),
                  'btn-warning min-w-24': props.updateConfirm.isConfirming('update'),
                }}
                onClick={() => {
                  if (props.updateConfirm.isConfirming('update')) {
                    props.updateConfirm.cancelConfirm('update');
                    if (props.pkg) {
                      if (props.onForceUpdate) {
                        props.onForceUpdate(props.pkg);
                      } else {
                        console.warn('onForceUpdate is not provided for force update operation');
                      }
                      props.onPackageStateChanged?.();
                    }
                  } else if (props.hasUpdate()) {
                    if (props.pkg && props.onUpdate) {
                      props.onUpdate(props.pkg);
                      props.onPackageStateChanged?.();
                    } else {
                      console.warn('onUpdate is not provided for update operation');
                    }
                  } else {
                    props.updateConfirm.startConfirm('update');
                  }
                }}
              >
                {props.updateConfirm.isConfirming('update')
                  ? t('packageInfo.forceUpdate')
                  : t('packageInfo.update')}
              </button>
              <Dropdown
                direction="up"
                position="end"
                trigger={
                  <button type="button" class="btn btn-soft join-item btn-r-split">
                    <ChevronUp class="h-4 w-4 shrink-0" />
                  </button>
                }
                triggerClass="btn-square"
                items={[
                  {
                    label: t('packageInfo.forceUpdate'),
                    onClick: () => {
                      if (props.pkg) {
                        if (props.onForceUpdate) {
                          props.onForceUpdate(props.pkg);
                        } else {
                          console.warn('onForceUpdate is not provided for force update operation');
                        }
                        props.onPackageStateChanged?.();
                      }
                    },
                  },
                ]}
              />
            </div>
          </Show>
          <button class="btn btn-soft" data-modal-close>
            {props.showBackButton ? t('packageInfo.backToBucket') : t('packageInfo.close')}
          </button>
        </form>
      </div>
    </div>
  );
}
