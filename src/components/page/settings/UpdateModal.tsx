import { Show } from 'solid-js';
import { Update } from '@tauri-apps/plugin-updater';
import Modal from '../../common/Modal';
import { t } from '../../../i18n';
import '../../../styles/github-markdown.css';
import DOMPurify from 'dompurify';

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
  // No local state needed - release notes are handled in AboutSection

  // Remove automatic fetching - fetch should happen when update is detected, not when modal opens

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t('settings.about.updateAvailable')}
      size="large"
      animation="scale"
      preventBackdropClose={props.isDownloading}
      footer={
        <div class="flex justify-end gap-2">
          <button class="btn btn-outline" onClick={props.onCancel} disabled={props.isDownloading}>
            {props.isDownloading ? t('buttons.cancel') : t('buttons.later')}
          </button>
          <button class="btn btn-primary" onClick={props.onInstall} disabled={props.isDownloading}>
            {props.isDownloading ? t('settings.about.downloadingUpdate') : t('buttons.install')}
          </button>
        </div>
      }
    >
      <div class="space-y-4">
        {/* Warning */}
        <div class="alert alert-warning">
          <span>{t('settings.about.installWarning')}</span>
        </div>
        {/* Version Info */}
        <div class="bg-base-200 rounded-lg p-4">
          <h3 class="mb-2 text-lg font-semibold">
            {t('settings.about.updateReady', { version: props.updateInfo?.version })}
          </h3>
          <Show when={props.updateInfo?.date}>
            <p class="text-base-content/70 text-sm">
              {t('settings.about.releasedOn', {
                date: props.updateInfo?.date
                  ? new Date(props.updateInfo.date).toLocaleDateString()
                  : '',
              })}
            </p>
          </Show>
        </div>

        {/* Release Notes */}
        <Show when={props.releaseNotesHtml}>
          <div class="bg-base-200 rounded-lg p-4">
            <h4 class="mb-3 font-semibold">{t('settings.about.releaseNotes')}</h4>
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
            <h4 class="mb-3 font-semibold">{t('settings.about.releaseNotes')}</h4>
            <div class="text-base-content/70 text-sm">
              <p>No release notes available for this version.</p>
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
