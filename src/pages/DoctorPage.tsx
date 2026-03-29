import { createSignal, createMemo, Show, onMount, onCleanup } from 'solid-js';
import { TriangleAlert, RefreshCw } from 'lucide-solid';
import { invoke } from '@tauri-apps/api/core';
import Checkup, { CheckupItem } from '../components/page/doctor/Checkup';
import CacheManager from '../components/page/doctor/CacheManager';
import VersionedAppsManager from '../components/page/doctor/VersionedAppsManager';
import ShimManager from '../components/page/doctor/ShimManager';
import ScoopInfo from '../components/page/doctor/ScoopInfo';
import ScoopProxySettings from '../components/page/doctor/ScoopProxySettings';
import CommandInputField from '../components/page/doctor/CommandInputField';
import { createSessionStorage } from '../hooks';
import installedPackagesStore from '../stores/installedPackagesStore';
import { t } from '../i18n';

function DoctorPage() {
  const [installingHelper, setInstallingHelper] = createSignal<string | null>(null);
  const [isGlobalRefreshing, setIsGlobalRefreshing] = createSignal(false);

  // Use session cache for checkup data
  const checkupCache = createSessionStorage('checkupData', () =>
    invoke<CheckupItem[]>('run_scoop_checkup')
  );

  const forceRefreshCheckup = () => checkupCache.forceRefresh();

  const [isRetrying, setIsRetrying] = createSignal(false);

  // Global refresh function for all doctor components
  const refreshAllDoctorData = async () => {
    setIsGlobalRefreshing(true);
    try {
      // Manual refresh - no EventBus events needed
      await forceRefreshCheckup();
      installedPackagesStore.refetch();
    } finally {
      setIsGlobalRefreshing(false);
    }
  };

  // Check if there are issues in the checkup result
  const hasIssues = createMemo(() => {
    return (
      !checkupCache.loading() &&
      !checkupCache.error() &&
      checkupCache.data() &&
      checkupCache.data()!.length > 0 &&
      checkupCache.data()!.some((item: any) => !item.status)
    );
  });

  let checkupRef: HTMLDivElement | undefined;

  const scrollToCheckup = () => checkupRef?.scrollIntoView({ behavior: 'smooth' });

  const runCheckup = async (isRetry = false) => {
    if (isRetry) {
      setIsRetrying(true);
    }

    try {
      // Use force refresh to bypass cache
      await forceRefreshCheckup();
    } catch (err) {
      console.error('Checkup rerun failed:', err);
      // Set error to cache state so UI can display it
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      checkupCache.setError(errorMessage);
    } finally {
      if (isRetry) {
        setIsRetrying(false);
      }
    }
  };

  // Cache will be initialized automatically on first access
  // No need to force refresh on mount - createSessionCache handles this

  const handleInstallHelper = async (helperId: string) => {
    setInstallingHelper(helperId);
    try {
      await invoke('install_package', { packageName: helperId, bucket: '' });

      // Manual refresh after helper installation
      await forceRefreshCheckup();
      installedPackagesStore.refetch();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to install helper:', errorMsg);
    } finally {
      setInstallingHelper(null);
    }
  };

  onCleanup(() => {
    // Cleanup is handled by the global store
  });

  onMount(() => {
    // Data is preloaded on app cold start, so we don't force refresh on mount
    // The createSessionCache will use the cached data if available
    console.log('DoctorPage mounted - checkup data should be preloaded');

    // Listen for cache invalidation events
    const unsubscribe = checkupCache.onInvalidate(() => {
      forceRefreshCheckup();
    });

    return unsubscribe;
  });

  const checkupComponent = (
    <Checkup
      checkupResult={checkupCache.data() || []}
      isLoading={checkupCache.loading()}
      isRetrying={isRetrying()}
      error={checkupCache.error()}
      onRerun={() => runCheckup(true)}
      onInstallHelper={handleInstallHelper}
      installingHelper={installingHelper()}
    />
  );

  return (
    <>
      <div class="mx-auto max-w-7xl">
        <div class="p-6">
          <div class="mb-7 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-bold">{t('doctor.title')}</h1>
              <button
                class="btn btn-soft btn-circle btn-sm"
                onClick={refreshAllDoctorData}
                disabled={isGlobalRefreshing()}
                title={t('doctor.refreshAll')}
              >
                <RefreshCw class={`h-4 w-4 ${isGlobalRefreshing() ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div class="flex items-center gap-2">
              <Show when={hasIssues()}>
                <button
                  class="btn btn-warning btn-md"
                  onClick={scrollToCheckup}
                  title={t('doctor.checkup.scrollToIssues')}
                >
                  <TriangleAlert class="mr-1 h-4 w-4" />
                  {t('doctor.checkup.issuesFound')}
                </button>
              </Show>
            </div>
          </div>

          <div class="space-y-8">
            <ScoopInfo />
            <CommandInputField />
            <ScoopProxySettings />
            <CacheManager />
            <VersionedAppsManager />
            <ShimManager />
            <div ref={checkupRef}>{checkupComponent}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DoctorPage;
