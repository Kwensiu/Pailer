import { createEffect, Show, createSignal } from 'solid-js';
import { Copy, Check } from 'lucide-solid';
import { toast } from '../common/ToastAlert';
import Modal from '../common/Modal';
import settingsStore from '../../stores/settings';
import { t } from '../../i18n';
import { highlightJson } from '../../utils/jsonHighlight';
import { openUrl } from '@tauri-apps/plugin-opener';
import { buildManifestFileUrl } from '../../utils/manifestUrl';
import GithubIcon from '../common/icons/GithubIcon';

interface ManifestModalProps {
  manifestContent: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  packageName: string;
  bucketSource?: string | null;
  bucketGitUrl?: string | null;
  bucketGitBranch?: string | null;
}

function ManifestModal(props: ManifestModalProps) {
  let codeRef: HTMLElement | undefined;
  const [copied, setCopied] = createSignal(false);
  const { effectiveTheme } = settingsStore;

  // Theme-specific colors
  const isDark = () => effectiveTheme() === 'dark';
  const buttonTextColor = () =>
    isDark() ? 'text-white/70 hover:text-white' : 'text-base-content/70 hover:text-base-content';
  const buttonBgHover = () => (isDark() ? 'hover:bg-white/10' : 'hover:bg-base-content/10');

  const openManifestUrl = async () => {
    const url = buildManifestFileUrl(props.bucketGitUrl, props.packageName, props.bucketGitBranch);
    if (!url) {
      toast.error(t('manifest.urlError'));
      return;
    }

    try {
      await openUrl(url);
    } catch (error) {
      console.error('Failed to open manifest URL:', error);
      toast.error(t('manifest.openFailed'));
    }
  };

  createEffect(() => {
    if (props.manifestContent && codeRef) {
      // Try to format as JSON if possible, otherwise use as-is
      try {
        const parsed = JSON.parse(props.manifestContent);
        if (typeof parsed === 'object' && parsed !== null) {
          const highlighted = highlightJson(parsed, isDark() ? 'dark' : 'light');
          codeRef.innerHTML = highlighted;
        } else {
          codeRef.textContent = props.manifestContent;
        }
      } catch (error) {
        codeRef.textContent = props.manifestContent;
      }
      // Set classes
      codeRef.className = 'language-json font-mono text-sm leading-relaxed bg-base-200';
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
        <div class="flex min-w-0 items-center gap-2">
          <span>{t('manifestModal.title')}</span>
          <span class="text-info min-w-0 truncate font-mono">{props.packageName}</span>
          <Show when={props.bucketSource}>
            <span class="bg-base-200 text-base-content/70 ring-base-content/10 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
              {props.bucketSource}
            </span>
          </Show>
        </div>
      }
      size="large"
      animation="scale"
      class="bg-base-100"
      zIndex="z-61"
      footer={
        <div class="flex w-full items-center justify-between gap-2">
          <Show when={props.bucketGitUrl}>
            <button class="btn btn-soft btn-primary" onClick={openManifestUrl}>
              <GithubIcon class="h-4 w-4 shrink-0" />
              GitHub
            </button>
          </Show>
          <button class="btn-close-outline ml-auto" data-modal-close>
            {t('buttons.close')}
          </button>
        </div>
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
        <div class="border-base-content/10 group bg-base-200 relative overflow-hidden rounded-xl border shadow-inner">
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
            <pre class="p-4">
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
