import { CloudOff, ListOrdered } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import SettingsToggle from '../../common/SettingsToggle';
import Card from '../../common/Card';
import { t } from '../../../i18n';

export default function ScoopUpdateSettings() {
  const { settings, setScoopSettings } = settingsStore;
  const setOperationMode = async (operationMode: 'queue' | 'concurrent') => {
    if (settings.scoop.operationMode === operationMode) {
      return;
    }

    await setScoopSettings({ operationMode });
  };

  return (
    <>
      <Card
        title={t('settings.scoopUpdate.skipPreUpdateRefresh')}
        icon={CloudOff}
        description={t('settings.scoopUpdate.skipPreUpdateRefreshDescription')}
        headerAction={
          <SettingsToggle
            checked={settings.scoop.skipPreUpdateRefresh}
            onChange={async (checked) => await setScoopSettings({ skipPreUpdateRefresh: checked })}
            showStatusLabel={true}
          />
        }
      />
      <Card
        title={t('settings.scoopUpdate.operationMode')}
        icon={ListOrdered}
        description={t('settings.scoopUpdate.operationModeDescription')}
        headerAction={
          <div
            class="bg-base-200 border-base-300 relative grid h-8 w-32 grid-cols-2 rounded-full border p-0.5"
            role="radiogroup"
            aria-label={t('settings.scoopUpdate.operationMode')}
          >
            <div
              class="bg-base-100 absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full shadow-sm transition-transform duration-200"
              classList={{
                'translate-x-full': settings.scoop.operationMode === 'concurrent',
              }}
            />
            <button
              type="button"
              class="relative z-1 rounded-full px-2 text-xs font-medium transition-colors"
              classList={{
                'text-base-content': settings.scoop.operationMode === 'queue',
                'text-base-content/60': settings.scoop.operationMode !== 'queue',
              }}
              role="radio"
              aria-checked={settings.scoop.operationMode === 'queue'}
              onClick={() => void setOperationMode('queue')}
            >
              {t('settings.scoopUpdate.operationModeQueue')}
            </button>
            <button
              type="button"
              class="relative z-1 rounded-full px-2 text-xs font-medium transition-colors"
              classList={{
                'text-base-content': settings.scoop.operationMode === 'concurrent',
                'text-base-content/60': settings.scoop.operationMode !== 'concurrent',
              }}
              role="radio"
              aria-checked={settings.scoop.operationMode === 'concurrent'}
              onClick={() => void setOperationMode('concurrent')}
            >
              {t('settings.scoopUpdate.operationModeConcurrent')}
            </button>
          </div>
        }
      />
    </>
  );
}
