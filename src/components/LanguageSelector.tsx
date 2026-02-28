import { Component } from 'solid-js';
import { Languages } from 'lucide-solid';
import { t, locale, toggleLanguage } from '../i18n';

const LanguageSelector: Component = () => {
  return (
    <div
      class="tooltip tooltip-left"
      data-tip={t('switch_to_' + (locale() === 'zh' ? 'english' : 'chinese'))}
    >
      <button class="btn btn-ghost btn-circle" onClick={toggleLanguage} title={t('language.title')}>
        <Languages class="h-5 w-5" />
      </button>
    </div>
  );
};

export default LanguageSelector;
