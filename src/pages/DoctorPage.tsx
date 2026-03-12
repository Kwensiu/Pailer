import { createSignal, onMount, createMemo, Show, onCleanup } from 'solid-js';
import { TriangleAlert } from 'lucide-solid';
import { invoke } from '@tauri-apps/api/core';
import Checkup, { CheckupItem } from '../components/page/doctor/Checkup';
import CacheManager from '../components/page/doctor/CacheManager';
import VersionedAppsManager from '../components/page/doctor/VersionedAppsManager';
import ShimManager from '../components/page/doctor/ShimManager';
import ScoopInfo from '../components/page/doctor/ScoopInfo';
import ScoopProxySettings from '../components/page/doctor/ScoopProxySettings';
import CommandInputField from '../components/page/doctor/CommandInputField';
import installedPackagesStore from '../stores/installedPackagesStore';
import { t } from '../i18n';

function DoctorPage() {
  const [installingHelper, setInstallingHelper] = createSignal<string | null>(null);

  // State lifted from Checkup.tsx
  const [checkupResult, setCheckupResult] = createSignal<CheckupItem[]>([]);
  const [isCheckupLoading, setIsCheckupLoading] = createSignal(true);
  const [checkupError, setCheckupError] = createSignal<string | null>(null);
  const [isRetrying, setIsRetrying] = createSignal(false);

  // Check if there are issues in the checkup result
  const hasIssues = createMemo(() => {
    return (
      !isCheckupLoading() &&
      !checkupError() &&
      checkupResult().length > 0 &&
      checkupResult().some((item) => !item.status)
    );
  });

  let checkupRef: HTMLDivElement | undefined;

  const scrollToCheckup = () => checkupRef?.scrollIntoView({ behavior: 'smooth' });

  const runCheckup = async (isRetry = false) => {
    if (isRetry) {
      setIsRetrying(true);
    } else {
      setIsCheckupLoading(true);
    }
    setCheckupError(null);
    try {
      const result = await invoke<CheckupItem[]>('run_scoop_checkup');
      setCheckupResult(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to run health check:', errorMsg);
      setCheckupError('Could not run health check. Please ensure your Scoop setup is correct.');
      setCheckupResult([]);
    } finally {
      if (isRetry) {
        setIsRetrying(false);
      } else {
        setIsCheckupLoading(false);
      }
    }
  };

  onMount(() => {
    runCheckup();
  });

  const handleInstallHelper = async (helperId: string) => {
    setInstallingHelper(helperId);
    try {
      await invoke('install_package', { packageName: helperId, bucket: '' });
      await runCheckup();
      installedPackagesStore.refetch();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to install ${helperId}:`, errorMsg);
    } finally {
      setInstallingHelper(null);
    }
  };

  onCleanup(() => {
    // Cleanup is handled by the global store
  });

  const checkupComponent = (
    <Checkup
      checkupResult={checkupResult()}
      isLoading={isCheckupLoading()}
      isRetrying={isRetrying()}
      error={checkupError()}
      onRerun={() => runCheckup(true)}
      onInstallHelper={handleInstallHelper}
      installingHelper={installingHelper()}
    />
  );

  return (
    <>
      <div class="p-6">
        <div class="mb-7 flex items-center justify-between">
          <h1 class="text-3xl font-bold">{t('doctor.title')}</h1>
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
    </>
  );
}

export default DoctorPage;
