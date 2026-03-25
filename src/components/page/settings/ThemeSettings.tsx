import { Sun, Moon, Monitor } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import Card from '../../common/Card';
import { t } from '../../../i18n';

function ThemeSettings() {
  const { settings, setTheme } = settingsStore;

  return (
    <Card
      title={t('settings.theme.title')}
      icon={settings.theme === 'dark' ? Moon : Sun}
      description={t('settings.theme.description')}
      headerSelect={{
        value: settings.theme,
        onChange: (e) => {
          const newTheme = (e.currentTarget as HTMLSelectElement).value;
          if (newTheme !== settings.theme) {
            setTheme(newTheme as 'light' | 'dark' | 'system');
          }
        },
        options: [
          { value: 'system', label: t('settings.theme.systemMode'), icon: Monitor },
          { value: 'light', label: t('settings.theme.lightMode'), icon: Sun },
          { value: 'dark', label: t('settings.theme.darkMode'), icon: Moon },
        ],
      }}
    />
  );
}

export default ThemeSettings;
