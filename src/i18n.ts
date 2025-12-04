import { createSignal, createResource, createEffect, createRoot } from 'solid-js';
import * as i18n from '@solid-primitives/i18n';

export type Locale = 'en' | 'zh';

// Export the dictionary interface
export interface Dict {
  welcome: string;
  greeting: string;
  language: string;
  switch_to_chinese: string;
  switch_to_english: string;
  app: {
    title: string;
    subtitle: string;
    buckets: string;
    packages: string;
    doctor: string;
    settings: string;
  };
  buttons: {
    install: string;
    uninstall: string;
    update: string;
    search: string;
    cancel: string;
    confirm: string;
    close: string;
  };
  status: {
    installed: string;
    not_installed: string;
    update_available: string;
    loading: string;
    error: string;
    success: string;
  };
  messages: {
    install_success: string;
    uninstall_success: string;
    update_success: string;
    confirm_uninstall: string;
    no_packages_found: string;
    search_placeholder: string;
    loading: string;
    init_timeout: string;
    init_timeout_reason: string;
    init_timeout_show: string;
  };
  package_info: {
    name: string;
    description: string;
    bucket: string;
    installed_version: string;
    latest_version: string;
    version: string;
    includes: string;
    installed: string;
    homepage: string;
    license: string;
    title: string;
    details: string;
    notes: string;
    version_manager: string;
    available_versions: string;
    current: string;
    switch: string;
    view_manifest: string;
    open_in_explorer: string;
    switch_version: string;
    debug_structure: string;
    change_bucket: string;
    force_update: string;
    update: string;
    sure: string;
    uninstall: string;
    back_to_bucket: string;
    close: string;
    error_loading_manifest: string;
    error_loading_versions: string;
    error_switching_version: string;
    failed_to_open_path: string;
    debug_failed: string;
  };
  settings: {
    window_behavior: {
      title: string;
      description: string;
    };
    virustotal: {
      title: string;
      description: string;
      api_key: string;
      api_key_placeholder: string;
      loading: string;
      save: string;
      auto_scan_packages: string;
      invalid_api_key: string;
      save_error: string;
      save_success: string;
      load_error: string;
    };
    theme: {
      title: string;
      description: string;
      switch_to_light: string;
      switch_to_dark: string;
    };
    startup: {
      title: string;
      description: string;
    };
    scoop_configuration: {
      title: string;
      description: string;
      path_label: string;
      path_placeholder: string;
      save: string;
      auto: string;
      test: string;
      auto_detect_description: string;
      load_error: string;
      save_error: string;
      save_success: string;
      detect_error: string;
      detect_success: string;
      valid_directory: string;
      invalid_directory: string;
      validation_error: string;
      validation_failed: string;
    };
    held_packages: {
      title: string;
      description: string;
      no_packages_held: string;
      unhold: string;
    };
    default_launch_page: {
      title: string;
      description: string;
      search: string;
      buckets: string;
      installed: string;
      doctor: string;
      settings: string;
    };
    debug: {
      title: string;
      description: string;
    };
    bucket_auto_update: {
      title: string;
      description: string;
      off: string;
      every_24_hours: string;
      every_week: string;
      off_description: string;
      every_24_hours_description: string;
      every_week_description: string;
      custom_interval: string;
      custom_interval_description: string;
      quantity: string;
      unit: string;
      minutes: string;
      hours: string;
      days: string;
      weeks: string;
      saving: string;
      saved: string;
      save: string;
      interval_too_short: string;
      minimum_interval: string;
      active: string;
      auto_update_packages: string;
      auto_update_packages_description: string;
      auto_update_packages_note: string;
      error: string;
      debug: string;
      debug_description: string;
    };
    auto_cleanup: {
      title: string;
      description: string;
      clean_old_versions: string;
      clean_old_versions_description: string;
      versions_to_keep: string;
      clean_outdated_cache: string;
      clean_outdated_cache_description: string;
    };
    about: {
      title: string;
      description: string;
      customized_version: string;
      please_report_issues: string;
      update_status: string;
      managed_by_scoop: string;
      scoop_update_instruction: string;
      check_now: string;
      checking_for_updates: string;
      update_available: string;
      update_ready: string;
      install: string;
      release_notes: string;
      downloading_update: string;
      installing_update: string;
      update_failed: string;
      retry: string;
      no_updates_available: string;
      latest_version: string;
      update_via_scoop: string;
      updates_via_scoop: string;
      update_available_dialog: string;
      update_complete: string;
      restart_now: string;
      my_fork: string;
      upstream: string;
      docs: string;
      copyright: string;
    };

  };
  [key: string]: string | ((...args: any[]) => string) | any;
}

// Create a resource to load the dictionary for the current locale
const getInitialLocale = (): Locale => {
  // Check if a locale is saved in localStorage
  const savedLocale = localStorage.getItem('rscoop-language');
  if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh')) {
    return savedLocale as Locale;
  }
  
  // If no saved locale, default to English to avoid system language detection
  return 'en';
};

// Wrap reactive elements in createRoot to prevent memory leak warnings
const { locale, setLocale, dict, t } = createRoot(() => {
  const [locale, setLocale] = createSignal<Locale>(getInitialLocale());

  // Save the current locale to localStorage when it changes
  createEffect(() => {
    const currentLocale = locale();
    localStorage.setItem('rscoop-language', currentLocale);
  });

  // Create a resource to load the dictionary for the current locale
  const [dict] = createResource(locale, async (lang) => {
    const dictModule = await import(`./locales/${lang}.json`);
    return i18n.flatten(dictModule.default) as Dict;
  }, {
    initialValue: {} as Dict,
  });

  const t = i18n.translator(dict, i18n.resolveTemplate);

  return { locale, setLocale, dict, t };
});

export { locale, setLocale, dict, t };

export const toggleLanguage = () => {
  const newLocale = locale() === 'zh' ? 'en' : 'zh';
  setLocale(newLocale);
};