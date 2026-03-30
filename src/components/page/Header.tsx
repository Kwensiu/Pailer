import { Component, For, onMount, onCleanup, Show, createSignal } from 'solid-js';
import { View } from '../../types/scoop.ts';
import {
  Package,
  Search,
  Settings,
  Stethoscope,
  FolderOpen,
  CircleArrowUp,
  Languages,
  Sun,
  Moon,
} from 'lucide-solid';
import installedPackagesStore from '../../stores/installedPackagesStore.ts';
import { t, locale, toggleLanguage } from '../../i18n.ts';
import { updateStore } from '../../stores/updateStore.ts';
import settingsStore from '../../stores/settings.ts';
import UpdateModal from './settings/UpdateModal.tsx';

interface HeaderProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const Header: Component<HeaderProps> = (props) => {
  const [showUpdateModal, setShowUpdateModal] = createSignal(false);
  const { setTheme, effectiveTheme } = settingsStore;

  const navItems = [
    { view: 'search' as const, icon: Search, labelKey: 'app.search' },
    { view: 'bucket' as const, icon: FolderOpen, labelKey: 'app.buckets' },
    { view: 'installed' as const, icon: Package, labelKey: 'app.packages' },
    { view: 'doctor' as const, icon: Stethoscope, labelKey: 'app.doctor' },
    { view: 'settings' as const, icon: Settings, labelKey: 'app.settings' },
  ];

  const handleInstallUpdate = async () => {
    setShowUpdateModal(false);
    await updateStore.installUpdate();
  };

  const toggleTheme = () => {
    const currentTheme = effectiveTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const handleCloseModal = () => {
    setShowUpdateModal(false);
    // Dismiss update notification for current session
    updateStore.dismissUpdate();
  };

  const handleModalClosed = () => {
    setShowUpdateModal(false);
  };

  const toggleCommandPalette = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      // The command palette component handles its own visibility
    }
  };

  onMount(() => {
    document.addEventListener('keydown', toggleCommandPalette);
    onCleanup(() => document.removeEventListener('keydown', toggleCommandPalette));
  });

  return (
    <div class="navbar bg-base-100 border-base-300 overflow-x-hidden overflow-y-hidden border-b shadow-sm">
      <div class="flex-1">
        <div class="flex items-center">
          <a class="btn btn-ghost ml-1 rounded-lg px-2 text-2xl font-bold">{t('app.title')}</a>
          <Show when={import.meta.env.DEV}>
            <button
              class="btn btn-ghost btn-sm ml-2"
              onClick={toggleLanguage}
              title={`Switch to ${locale() === 'en' ? 'Chinese' : 'English'}`}
            >
              <Languages class="h-4 w-4" />
              <span class="ml-1">{locale() === 'en' ? 'EN' : '中'}</span>
            </button>
            <button
              class="btn btn-ghost btn-sm ml-1"
              onClick={toggleTheme}
              title={`Switch to ${effectiveTheme() === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Show when={effectiveTheme() === 'dark'}>
                <Sun class="h-4 w-4" />
              </Show>
              <Show when={effectiveTheme() === 'light'}>
                <Moon class="h-4 w-4" />
              </Show>
            </button>
          </Show>
          <Show when={updateStore.getUpdateInfo() && !updateStore.isDismissed()}>
            <button
              class="py-0.2 ml-2 inline-flex items-center gap-1 rounded-lg border border-green-500 bg-green-600 px-2 text-xs font-medium text-white transition-colors duration-200 hover:bg-green-700"
              onClick={() => setShowUpdateModal(true)}
            >
              <CircleArrowUp class="h-3 w-3" />
              <span>v{updateStore.getUpdateInfo()?.version}</span>
            </button>
          </Show>
        </div>
      </div>
      <div class="flex-none">
        <ul class="menu menu-horizontal gap-1">
          <For each={navItems} fallback={<div>{t('status.loading')}</div>}>
            {(item) => (
              <li>
                <button
                  class="btn btn-sm btn-ghost transition-colors duration-200"
                  classList={{
                    'bg-base-300/70 text-info font-semibold': props.currentView === item.view,
                    'hover:bg-base-300/50': props.currentView !== item.view,
                  }}
                  onClick={() => props.onNavigate(item.view)}
                  onMouseEnter={() => {
                    if (item.view === 'installed') {
                      installedPackagesStore.fetch();
                    }
                  }}
                >
                  <div class="flex items-center justify-center">
                    <item.icon class="h-4 w-4" />
                    <span class="nav-text">{t(item.labelKey)}</span>
                  </div>
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>

      {/* Update Modal */}
      <Show when={showUpdateModal() && updateStore.getUpdateInfo()}>
        <UpdateModal
          updateInfo={updateStore.getUpdateInfo()!}
          isDownloading={updateStore.getUpdateStatus() === 'downloading'}
          onInstall={handleInstallUpdate}
          onCancel={handleCloseModal}
          onClose={handleModalClosed}
          isOpen={showUpdateModal()}
          releaseNotesHtml={updateStore.getReleaseNotesHtml()}
          downloadProgress={updateStore.getDownloadProgress()}
        />
      </Show>
    </div>
  );
};

export default Header;
