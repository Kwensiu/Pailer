import { CloudOff } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import SettingsToggle from '../../common/SettingsToggle';
import Card from '../../common/Card';
import { t } from '../../../i18n';

export default function ScoopUpdateSettings() {
  const { settings, setScoopSettings } = settingsStore;
  const updateAllModeLabel = () =>
    settings.scoop.updateAllMode === 'queue'
      ? t('settings.scoopUpdate.updateAllModeQueue')
      : t('settings.scoopUpdate.updateAllModeConcurrent');

  return (
    <Card
      title={t('settings.scoopUpdate.title')}
      icon={CloudOff}
      description={t('settings.scoopUpdate.description')}
      headerAction={
        <SettingsToggle
          checked={settings.scoop.skipPreUpdateRefresh}
          onChange={async (checked) => await setScoopSettings({ skipPreUpdateRefresh: checked })}
          showStatusLabel={true}
        />
      }
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="font-medium">{t('settings.scoopUpdate.updateAllMode')}</div>
          <div class="text-base-content/60 text-sm">
            {t('settings.scoopUpdate.updateAllModeDescription')}
          </div>
        </div>
        <button
          type="button"
          class="btn btn-sm"
          onClick={async () =>
            await setScoopSettings({
              updateAllMode: settings.scoop.updateAllMode === 'queue' ? 'concurrent' : 'queue',
            })
          }
        >
          {updateAllModeLabel()}
        </button>
      </div>
    </Card>
  );
}
