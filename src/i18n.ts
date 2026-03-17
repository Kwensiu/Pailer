import { createSignal, createResource, createEffect, createRoot } from 'solid-js';
import * as i18n from '@solid-primitives/i18n';
import { invoke } from '@tauri-apps/api/core';
import settingsStore from './stores/settings';
import { Dict } from './types/dict-types';

export type Locale = string;

const SUPPORTED_LOCALES = ['en', 'zh'] as const;
const DEFAULT_LANGUAGE = 'en' as const;

function sysLang(): Locale {
  const systemLang = (navigator.language || navigator.languages?.[0] || DEFAULT_LANGUAGE).split(
    '-'
  )[0];
  return SUPPORTED_LOCALES.includes(systemLang as any) ? systemLang : DEFAULT_LANGUAGE;
}

async function getInitialLocale(): Promise<Locale> {
  let attempts = 0;
  while (attempts < 30) {
    const settings = settingsStore.settings;
    if (settings.scoopPath) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
    attempts++;
  }

  const settings = settingsStore.settings;

  if (
    settings.language &&
    settings.language.trim() !== '' &&
    SUPPORTED_LOCALES.includes(settings.language as any)
  ) {
    return settings.language;
  }

  const detectedLang = sysLang();

  try {
    await settingsStore.setCoreSettings({ language: detectedLang });
  } catch (error) {
    console.error('Failed to save detected language:', error);
  }

  return detectedLang;
}

const { locale, setLocale, dict, t } = createRoot(() => {
  const [locale, setLocale] = createSignal<Locale>(DEFAULT_LANGUAGE);

  getInitialLocale()
    .then((initialLocale) => {
      setLocale(initialLocale);
    })
    .catch((error) => {
      console.error('Failed to initialize locale:', error);
    });

  createEffect(() => {
    const settingsLang = settingsStore.settings.language;
    if (settingsLang && settingsLang.trim() !== '' && settingsLang !== locale()) {
      setLocale(settingsLang as Locale);
    }
  });

  const [dict] = createResource(
    locale,
    async (lang: string) => {
      try {
        const localeModule = await import(`./locales/${lang}.json`);
        const flatDict = i18n.flatten(localeModule.default as Record<string, any>) as Dict;

        updateBackendTrayStrings(lang, localeModule.default).catch(console.error);

        return flatDict;
      } catch (error) {
        console.error(`Failed to load locale ${lang}, falling back to en:`, error);
        const enModule = await import('./locales/en.json');
        return i18n.flatten(enModule.default as Record<string, any>) as Dict;
      }
    },
    {
      initialValue: i18n.flatten({
        'app.title': 'Pailer',
        'messages.loading': 'Loading...',
        'status.error': 'Error',
        'buttons.close': 'Close',
      } as Record<string, any>) as Dict,
    }
  );

  const t = i18n.translator(dict, i18n.resolveTemplate);

  return { locale, setLocale, dict, t };
});

export { locale, setLocale, dict, t, sysLang };

async function updateBackendTrayStrings(language: string, localeData: any) {
  try {
    await invoke('update_backend_tray_strings', {
      language,
      trayStrings: localeData.settings?.tray || {},
    });
  } catch (error) {
    console.error('Failed to update backend tray strings:', error);
  }
}

export const setLanguage = async (lang: Locale) => {
  if (!SUPPORTED_LOCALES.includes(lang as any)) {
    console.error('Unsupported language:', lang);
    return;
  }

  try {
    await settingsStore.setCoreSettings({ language: lang });
  } catch (error) {
    console.error('Failed to save language:', error);
  }
};

export const toggleLanguage = async () => {
  const newLocale = locale() === 'zh' ? 'en' : 'zh';
  await setLanguage(newLocale);
};
