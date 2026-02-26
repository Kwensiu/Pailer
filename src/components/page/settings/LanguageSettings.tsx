import { Globe } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import Card from '../../common/Card';
import { t, setLanguage } from '../../../i18n';

function LanguageSettings() {
  const { settings } = settingsStore;

  return (
    <Card
      title={t('language.title')}
      icon={Globe}
      description={t('language.description')}
      headerSelect={{
        value: settings.language,
        onChange: (e) => {
          const newLang = (e.currentTarget as HTMLSelectElement).value;
          if (newLang !== settings.language) {
            setLanguage(newLang as 'en' | 'zh');
          }
        },
        options: [
          { value: 'en', label: 'English' },
          { value: 'zh', label: '中文' },
        ],
      }}
    ></Card>
  );
}

export default LanguageSettings;
