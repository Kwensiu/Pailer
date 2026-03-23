import { House, Search, FolderOpen, Package, Stethoscope, Settings } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import Card from '../../common/Card';
import { View } from '../../../types/scoop';
import { t } from '../../../i18n';
import { createMemo, type Component } from 'solid-js';

function DefaultLaunchPageSettings() {
  const { settings, setDefaultLaunchPage } = settingsStore;

  const pages = createMemo<{ value: View; label: string; icon: Component<{ class?: string }> }[]>(
    () => [
      { value: 'search', label: t('settings.defaultLaunchPage.search'), icon: Search },
      { value: 'bucket', label: t('settings.defaultLaunchPage.buckets'), icon: FolderOpen },
      { value: 'installed', label: t('settings.defaultLaunchPage.installed'), icon: Package },
      { value: 'doctor', label: t('settings.defaultLaunchPage.doctor'), icon: Stethoscope },
      { value: 'settings', label: t('settings.defaultLaunchPage.settings'), icon: Settings },
    ]
  );

  const handlePageChange = async (e: Event) => {
    const target = e.currentTarget as HTMLSelectElement;
    await setDefaultLaunchPage(target.value as View);
  };

  return (
    <Card
      title={t('settings.defaultLaunchPage.title')}
      icon={House}
      description={t('settings.defaultLaunchPage.description')}
      headerSelect={{
        value: settings.defaultLaunchPage || 'search',
        onChange: handlePageChange,
        options: pages(),
      }}
    />
  );
}

export default DefaultLaunchPageSettings;
