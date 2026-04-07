import { For, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { Trash2 } from 'lucide-solid';
import { t } from '../../../i18n';
import { useMultiConfirmAction } from '../../../hooks/ui/useConfirmAction';
import type { ScoopPackage, VersionedPackageInfo } from '../../../types/scoop';

interface VersionSwitcherProps {
  show: boolean;
  loading: boolean;
  error?: string;
  versionInfo?: VersionedPackageInfo;
  switchingVersion?: string;
  deletingVersion?: string;
  onClose: () => void;
  onSwitchVersion: (pkg: ScoopPackage, version: string) => void;
  onDeleteVersion: (pkg: ScoopPackage, version: string) => void;
  pkg: ScoopPackage;
}

export default function VersionSwitcher(props: VersionSwitcherProps) {
  const [animatingOut, setAnimatingOut] = createSignal(false);
  const [animatingIn, setAnimatingIn] = createSignal(false);
  const [isClosing, setIsClosing] = createSignal(false);
  const { isConfirming, startConfirm, cancelConfirm } = useMultiConfirmAction(3000);

  let closeTimer: number | undefined;

  const handleShow = () => {
    if (props.show && !animatingIn()) {
      setTimeout(() => {
        setAnimatingIn(true);
      }, 10);
    }
  };

  const handleClose = () => {
    if (isClosing()) return;
    setIsClosing(true);
    cancelConfirm();
    setAnimatingOut(true);
    setAnimatingIn(false);
    closeTimer = window.setTimeout(() => {
      props.onClose();
      setAnimatingOut(false);
      setAnimatingIn(false);
      setIsClosing(false);
    }, 300);
  };

  onCleanup(() => {
    if (closeTimer) clearTimeout(closeTimer);
  });

  const handleSwitchVersion = (version: string) => {
    props.onSwitchVersion(props.pkg, version);
  };

  const handleDeleteVersion = (version: string) => {
    if (isConfirming(version)) {
      cancelConfirm(version);
      props.onDeleteVersion(props.pkg, version);
    } else {
      startConfirm(version);
    }
  };

  createEffect(() => {
    handleShow();
  });

  return (
    <Show when={props.show || animatingOut()}>
      <div class="fixed inset-0 z-70" onClick={handleClose}>
        <div
          class="bg-base-175 border-base-300 absolute top-18 right-0 bottom-20 max-w-[400px] min-w-[300px] overflow-y-auto rounded-2xl border p-4 shadow-lg transition-transform duration-300 ease-in-out"
          classList={{
            'translate-x-[-1.5rem]': props.show && !animatingOut() && animatingIn(),
            'translate-x-[calc(100%+1.5rem)]': animatingOut() || !animatingIn(),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold">{t('packageInfo.versionSwitch')}</h3>
            <button class="btn btn-sm btn-ghost" onClick={handleClose}>
              ✕
            </button>
          </div>

          <Show
            when={props.loading}
            fallback={
              <div class="space-y-3">
                <Show when={props.error}>
                  <div role="alert" class="alert alert-error mb-3">
                    <span>{props.error}</span>
                  </div>
                </Show>
                <For each={props.versionInfo?.available_versions || []}>
                  {(version) => (
                    <div
                      class="card bg-base-100 border-base-content/10 border p-4 transition-all hover:shadow-md"
                      classList={{
                        'border-primary bg-primary/5': version.is_current,
                      }}
                    >
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="font-semibold">{version.version}</div>
                          <Show when={version.is_current}>
                            <div class="text-primary text-sm font-medium">
                              {t('packageInfo.current')}
                            </div>
                          </Show>
                        </div>
                        <div class="flex gap-2">
                          <Show when={!version.is_current}>
                            <button
                              class="btn btn-sm btn-primary"
                              disabled={!!props.switchingVersion || !!props.deletingVersion}
                              onClick={() => handleSwitchVersion(version.version)}
                            >
                              <Show
                                when={props.switchingVersion === version.version}
                                fallback={t('buttons.switch')}
                              >
                                <span class="loading loading-spinner loading-xs"></span>
                              </Show>
                            </button>
                          </Show>
                          <Show when={!version.is_current}>
                            <button
                              class="btn btn-sm btn-error"
                              classList={{
                                'btn-warning': isConfirming(version.version),
                              }}
                              disabled={!!props.switchingVersion || !!props.deletingVersion}
                              onClick={() => handleDeleteVersion(version.version)}
                            >
                              <Show
                                when={props.deletingVersion === version.version}
                                fallback={
                                  <Show
                                    when={isConfirming(version.version)}
                                    fallback={<Trash2 class="h-4 w-4" />}
                                  >
                                    {t('buttons.sure')}
                                  </Show>
                                }
                              >
                                <span class="loading loading-spinner loading-xs"></span>
                              </Show>
                            </button>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <div class="flex items-center justify-center py-8">
              <span class="loading loading-spinner loading-lg"></span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
