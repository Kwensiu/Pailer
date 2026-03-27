import { Show } from 'solid-js';
import { Update } from '@tauri-apps/plugin-updater';
import Modal from '../../common/Modal';
import { t } from '../../../i18n';
import '../../../styles/github-markdown.css';
import { openUrl } from '@tauri-apps/plugin-opener';
import DOMPurify from 'dompurify';
import GithubIcon from '../../common/icons/GithubIcon';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void;
  updateInfo: Update;
  onInstall: () => void;
  isDownloading?: boolean;
  downloadProgress?: {
    downloaded: number;
    total: number | null;
  };
  releaseNotesHtml: string;
}

export default function UpdateModal(props: UpdateModalProps) {
  const handleGoToRelease = async () => {
    await openUrl('https://github.com/Kwensiu/Pailer/releases');
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t('settings.about.updateAvailable')}
      size="large"
      animation="scale"
      preventBackdropClose={props.isDownloading}
      footer={
        <div class="flex w-full justify-between">
          <button class="btn btn-circle btn-ghost" onClick={handleGoToRelease}>
            <GithubIcon class="h-6 w-6" />
          </button>
          <div class="flex gap-2">
            <button class="btn btn-soft" onClick={props.onCancel} disabled={props.isDownloading}>
              {props.isDownloading ? t('buttons.cancel') : t('buttons.later')}
            </button>
            <button
              class="btn btn-primary"
              onClick={props.onInstall}
              disabled={props.isDownloading}
            >
              {props.isDownloading ? t('settings.about.downloadingUpdate') : t('buttons.install')}
            </button>
          </div>
        </div>
      }
    >
      <div class="space-y-4">
        {/* Warning */}
        <div class="alert alert-warning">
          <span>{t('settings.about.installWarning')}</span>
        </div>

        {/* Release Notes */}
        <Show when={props.releaseNotesHtml}>
          <div class="bg-base-200 rounded-lg p-4">
            <h4 class="mt-1 font-semibold">{t('settings.about.releaseNotes')}</h4>
            <div class="divider my-2"></div>
            <div class="max-h-64 overflow-y-auto">
              <div
                class="prose prose-sm prose-headings:text-base-content prose-p:text-base-content prose-a:text-primary prose-strong:text-base-content prose-code:text-base-content prose-pre:bg-base-300 prose-pre:border prose-pre:border-base-content/10 max-w-none"
                innerHTML={DOMPurify.sanitize(props.releaseNotesHtml)}
              />
            </div>
          </div>
        </Show>

        {/* No Release Notes */}
        <Show when={!props.releaseNotesHtml}>
          <div class="bg-base-200 rounded-lg p-4">
            <h4 class="mt-1 font-semibold">{t('settings.about.releaseNotes')}</h4>
            <div class="text-base-content/70 text-sm">
              <p>{t('settings.about.noReleaseNotes')}</p>
            </div>
          </div>
        </Show>

        {/* Download Progress */}
        <Show when={props.isDownloading && props.downloadProgress}>
          <div class="bg-base-200 rounded-lg p-4">
            <div class="mb-2 flex justify-between text-sm">
              <span>{t('settings.about.downloadingUpdate')}</span>
              <span>
                {props.downloadProgress!.total
                  ? `${Math.round((props.downloadProgress!.downloaded / props.downloadProgress!.total) * 100)}%`
                  : t('settings.about.downloadingNoSize')}
              </span>
            </div>
            <progress
              class="progress progress-primary w-full"
              value={props.downloadProgress!.downloaded}
              max={props.downloadProgress!.total || undefined}
            />
          </div>
        </Show>
      </div>
    </Modal>
  );
}
