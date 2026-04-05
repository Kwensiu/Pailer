import { createSignal, onMount, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import OperationModal from '../components/modals/OperationModal';
import * as SC from '../components/page/settings';
import heldStore from '../stores/held';
import { t } from '../i18n';
import { createLocalStorageSignal } from '../hooks';

interface SettingsPageProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isScoopInstalled?: boolean;
}

function SettingsPage(props: SettingsPageProps) {
  const { refetch: refetchHeldPackages } = heldStore;
  const [operationTitle, setOperationTitle] = createSignal<string | null>(null);
  const [isUnholding, setIsUnholding] = createSignal(false);

  const TABS = [
    { key: 'automation', labelkey: 'settings.category.automation' },
    { key: 'management', labelkey: 'settings.category.management' },
    { key: 'security', labelkey: 'settings.category.security' },
    { key: 'window', labelkey: 'settings.category.windowUi' },
    { key: 'about', labelkey: 'settings.category.about' },
  ];
  const [activeTab, setActiveTab] = createLocalStorageSignal<string>(
    'settingsActiveTab',
    'automation'
  );

  onMount(() => {
    // No automatic update checking - only manual checks allowed
  });

  const handleUnhold = (packageName: string) => {
    setIsUnholding(true);
    invoke('unhold_package', { packageName }).finally(() => {
      refetchHeldPackages();
      setIsUnholding(false);
    });
  };

  const handleCloseOperationModal = () => {
    setOperationTitle(null);
  };

  return (
    <>
      <div class="mx-auto max-w-7xl">
        <div class="p-6">
          <h1 class="mb-4 text-3xl font-bold">{t('settings.title')}</h1>
          {/* Tab Navigation */}
          <div role="tablist" aria-label="Settings Sections" class="tabs tabs-border mb-6">
            <For each={TABS}>
              {(tab) => (
                <button
                  type="button"
                  class="tab"
                  classList={{ 'tab-active': activeTab() === tab.key }}
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  aria-selected={activeTab() === tab.key}
                  tabindex={0}
                >
                  {t(tab.labelkey)}
                </button>
              )}
            </For>
          </div>

          <div class="space-y-6">
            {/* Automation Tab */}
            <Show when={activeTab() === 'automation'}>
              <div class="space-y-6">
                <SC.AutoCleanupSettings />
                <SC.BucketAutoUpdateSettings />
                <SC.AutoTrayConfigMigrationSettings />
              </div>
            </Show>

            {/* Management Tab */}
            <Show when={activeTab() === 'management'}>
              <div class="space-y-6">
                <SC.ScoopConfiguration />

                <SC.HeldPackagesManagement
                  onUnhold={handleUnhold}
                  operationInProgress={!!operationTitle() || isUnholding()}
                />
                <SC.ScoopUpdateSettings />
                <SC.PowerShellSettings />
              </div>
            </Show>

            {/* Security Tab */}
            <Show when={activeTab() === 'security'}>
              <div class="space-y-6">
                <SC.VirusTotalSettings />
              </div>
            </Show>

            {/* Window & UI Tab */}
            <Show when={activeTab() === 'window'}>
              <div class="space-y-6">
                <SC.ThemeSettings />
                <SC.LanguageSettings />
                <SC.TraySettings />
                <SC.StartupSettings />
                <SC.HotkeySettings />
                <SC.DefaultLaunchPageSettings />
                <SC.DebugSettings />
              </div>
            </Show>

            {/* About Tab */}
            <Show when={activeTab() === 'about'}>
              <SC.AboutSection isScoopInstalled={props.isScoopInstalled} />
              <SC.AppDataManagement />
            </Show>
          </div>
        </div>
      </div>
      <OperationModal title={operationTitle()} onClose={handleCloseOperationModal} />
    </>
  );
}

export default SettingsPage;
