import { Trash2, Archive, BrushCleaning } from 'lucide-solid';
import Card from '../../common/Card';
import { t } from '../../../i18n';

interface CleanupProps {
  onCleanupApps: () => void;
  onCleanupCache: () => void;
}

function Cleanup(props: CleanupProps) {
  return (
    <Card
      title={t('doctor.cleanup.title')}
      icon={BrushCleaning}
      description={t('doctor.cleanup.description')}
    >
      <div class="mt-2 flex gap-2">
        <button class="btn btn-warning" onClick={props.onCleanupApps}>
          <Trash2 class="mr-2 h-4 w-4" />
          {t('doctor.cleanup.cleanupOldVersions')}
        </button>
        <button class="btn btn-accent" onClick={props.onCleanupCache}>
          <Archive class="mr-2 h-4 w-4" />
          {t('doctor.cleanup.cleanupOutdatedCache')}
        </button>
      </div>
    </Card>
  );
}

export default Cleanup;
