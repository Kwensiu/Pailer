import { TriangleAlert, Download, Database, Info } from 'lucide-solid';
import Modal from '../../../common/Modal';
import { useOperations } from '../../../../stores/operations';
import { t } from '../../../../i18n';
import { BUCKET_SEARCH_CONFIG } from './constants';

interface LargeDatasetWarningProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Large dataset warning modal for bucket search
const LargeDatasetWarning = (props: LargeDatasetWarningProps) => {
  const { dismissLargeDatasetWarning } = useOperations();

  // Permanently dismiss warning and proceed
  const handleDismissAndConfirm = () => {
    dismissLargeDatasetWarning();
    props.onConfirm();
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title=""
      size="medium"
      hideHeader={true}
      animation="scale"
    >
      <div class="space-y-5">
        {/* Warning Header */}
        <div class="flex items-center gap-3">
          <div class="bg-warning/20 rounded-lg p-2">
            <TriangleAlert class="text-warning h-6 w-6" />
          </div>
          <div>
            <h3 class="text-warning text-lg font-bold">{t('bucket.search.largeDatasetWarning')}</h3>
            <p class="text-base-content/50 text-xs">{t('bucket.search.expandSearchTitle')}</p>
          </div>
        </div>

        {/* Info Cards */}
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-base-200/50 flex items-center gap-3 rounded-lg p-3">
            <Download class="text-info h-4 w-4 shrink-0" />
            <div>
              <div class="text-base-content/50 text-xs">
                ~{BUCKET_SEARCH_CONFIG.expandedSearch.estimatedSizeMb} MB
              </div>
              <div class="text-sm font-medium">{t('bucket.search.estimatedDownloadSize')}</div>
            </div>
          </div>
          <div class="bg-base-200/50 flex items-center gap-3 rounded-lg p-3">
            <Database class="text-success h-4 w-4 shrink-0" />
            <div>
              <div class="text-base-content/50 text-xs">
                ~{BUCKET_SEARCH_CONFIG.expandedSearch.totalBuckets.toLocaleString()}+
              </div>
              <div class="text-sm font-medium">{t('bucket.search.totalBuckets')}</div>
            </div>
          </div>
        </div>

        {/* Warning Note */}
        <div class="bg-warning/10 border-warning/20 flex gap-3 rounded-lg border p-3">
          <Info class="text-warning mt-0.5 h-4 w-4 shrink-0" />
          <p class="text-base-content/70 text-sm leading-relaxed">
            {t('bucket.search.expandNote')}
          </p>
        </div>

        {/* Action Buttons */}
        <div class="border-base-200 flex justify-end gap-2 border-t pt-2">
          <button class="btn btn-ghost btn-sm" onClick={props.onClose}>
            {t('bucket.search.cancel')}
          </button>
          <button class="btn btn-secondary btn-sm" onClick={handleDismissAndConfirm}>
            {t('warnings.multiInstance.dontShowAgain')}
          </button>
          <button class="btn btn-primary btn-sm" onClick={props.onConfirm}>
            {t('bucket.search.enableExpandedSearch')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LargeDatasetWarning;
