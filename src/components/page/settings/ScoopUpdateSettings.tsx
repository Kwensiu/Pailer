import { CloudOff } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import SettingsToggle from '../../common/SettingsToggle';
import Card from '../../common/Card';
import { t } from '../../../i18n';

export default function ScoopUpdateSettings() {
  const { settings, setScoopSettings } = settingsStore;

  return (
    <Card
      title={t('settings.scoopUpdate.title')}
      icon={CloudOff}
      description={t('settings.scoopUpdate.description')}
      headerAction={
        <SettingsToggle
          checked={settings.scoop.bypassSelfUpdate}
          onChange={async (checked) => await setScoopSettings({ bypassSelfUpdate: checked })}
          showStatusLabel={true}
        />
      }
    />
  );
}
