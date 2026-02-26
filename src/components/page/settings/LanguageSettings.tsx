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
      headerAction={
        <select
          class="select select-bordered select-sm min-w-[140px]"
          value={settings.language}
          onChange={(e) => {
            const newLang = e.target.value;
            if (newLang !== settings.language) {
              setLanguage(newLang as 'en' | 'zh');
            }
          }}
        >
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      }
    ></Card>
  );
}

export default LanguageSettings;
