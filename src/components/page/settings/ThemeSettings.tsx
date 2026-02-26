import { Sun, Moon } from 'lucide-solid';
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
            setTheme(newTheme as 'light' | 'dark');
          }
        },
        options: [
          { value: 'light', label: t('settings.theme.lightMode') },
          { value: 'dark', label: t('settings.theme.darkMode') },
        ],
      }}
    />
  );
}

export default ThemeSettings;
