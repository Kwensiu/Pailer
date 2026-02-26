import { Bug } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import SettingsToggle from '../../common/SettingsToggle';
import Card from '../../common/Card';
import { t } from '../../../i18n';

function DebugSettings() {
  const { settings, setDebugSettings } = settingsStore;

  return (
    <Card
      title={t('settings.debug.title')}
      icon={Bug}
      description={t('settings.debug.description')}
      headerAction={
        <SettingsToggle
          checked={settings.debug.enabled}
          onChange={async (checked) => await setDebugSettings({ enabled: checked })}
          showStatusLabel={true}
        />
      }
    />
  );
}

export default DebugSettings;
