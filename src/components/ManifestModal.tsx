import { createEffect, Show, createSignal } from 'solid-js';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import { Copy, Check } from 'lucide-solid';
import Modal from './common/Modal';
import settingsStore from '../stores/settings';
import { t } from '../i18n';

hljs.registerLanguage('json', json);

interface ManifestModalProps {
  manifestContent: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  packageName: string;
}

function ManifestModal(props: ManifestModalProps) {
  let codeRef: HTMLElement | undefined;
  const [copied, setCopied] = createSignal(false);
  const { settings } = settingsStore;

  // Theme-specific colors
  const isDark = () => settings.theme === 'dark';
  const codeBgColor = () => (isDark() ? '#282c34' : '#f0f4f9');
  const buttonTextColor = () =>
    isDark() ? 'text-white/70 hover:text-white' : 'text-base-content/70 hover:text-base-content';
  const buttonBgHover = () => (isDark() ? 'hover:bg-white/10' : 'hover:bg-base-content/10');

  createEffect(() => {
    if (props.manifestContent && codeRef) {
      codeRef.textContent = props.manifestContent;
      // Remove existing hljs classes to allow re-highlighting
      codeRef.className = 'language-json font-mono text-sm leading-relaxed bg-transparent!';
      hljs.highlightElement(codeRef);
    }
  });

  const handleCopy = async () => {
    if (props.manifestContent) {
      await navigator.clipboard.writeText(props.manifestContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isOpen = () => props.loading || !!props.error || !!props.manifestContent;

  return (
    <Modal
      isOpen={isOpen()}
      onClose={props.onClose}
      title={
        <>
          {t('manifestModal.title')} <span class="text-info font-mono">{props.packageName}</span>
        </>
      }
      size="large"
      animation="scale"
      class="bg-base-100"
      zIndex="z-61" //Above PackageInfoModal(z-60)
      footer={
        <button class="btn-close-outline" data-modal-close>
          {t('buttons.close')}
        </button>
      }
    >
      <Show when={props.loading}>
        <div class="flex h-64 flex-col items-center justify-center gap-4">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <span class="text-base-content/60">{t('manifestModal.loading')}</span>
        </div>
      </Show>

      <Show when={props.error}>
        <div role="alert" class="alert alert-error shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{props.error}</span>
        </div>
      </Show>

      <Show when={props.manifestContent}>
        <div
          class="border-base-content/10 group relative overflow-hidden rounded-xl border shadow-inner"
          style={{ 'background-color': codeBgColor() }}
        >
          <div class="absolute top-2 right-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              class={`btn btn-sm btn-square btn-ghost ${buttonTextColor()} ${buttonBgHover()}`}
              onClick={handleCopy}
              title={t('buttons.copyToClipboard')}
            >
              <Show when={copied()} fallback={<Copy class="h-4 w-4" />}>
                <Check class="text-success h-4 w-4" />
              </Show>
            </button>
          </div>
          <div class="custom-scrollbar max-h-[65vh] overflow-y-auto">
            <pre class="m-0 p-4">
              <code
                ref={codeRef}
                class="language-json bg-transparent! font-mono text-sm leading-relaxed"
              ></code>
            </pre>
          </div>
        </div>
      </Show>
    </Modal>
  );
}

export default ManifestModal;
