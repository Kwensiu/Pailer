import { For, Show, createEffect, createSignal, createMemo, onCleanup } from 'solid-js';
import { ScoopPackage, VersionedPackageInfo } from '../../../types/scoop';
import Modal from '../../common/Modal';
import BucketInfoModal from '../BucketInfoModal';
import { useBuckets, BucketInfo } from '../../../hooks/buckets/useBuckets';
import { getCurrentVersionInstallTime } from '../../../hooks/packages/getCurrentInstallTime';
import { invoke } from '@tauri-apps/api/core';
import ManifestModal from '../ManifestModal';
import { t, locale } from '../../../i18n';
import { searchCacheManager } from '../../../hooks/search/useSearchCache';
import { useMultiConfirmAction } from '../../../hooks/ui/useConfirmAction';
import DetailRenderer from './DetailRenderer';
import VersionSwitcher from './VersionSwitcher';
import { usePackageIcons } from '../../../hooks';
import { PackageInfoModalHeader } from './Header';
import { PackageInfoModalFooter } from './Footer';
import type { PackageInfoModalProps } from './types';

function PackageInfoModal(props: PackageInfoModalProps) {
  const { buckets } = useBuckets();
  const packageNames = createMemo(() => (props.pkg?.name ? [props.pkg.name] : []));
  const { icons: packageIcons } = usePackageIcons({ packageNames, size: 128 });

  const isInstalled = () => props.pkg?.is_installed ?? false;
  const hasUpdate = () => !!props.pkg?.available_version;

  const [versionInfo, setVersionInfo] = createSignal<VersionedPackageInfo | undefined>(undefined);
  const [versionLoading, setVersionLoading] = createSignal(false);
  const [versionError, setVersionError] = createSignal<string | undefined>(undefined);
  const [switchingVersion, setSwitchingVersion] = createSignal<string | undefined>(undefined);

  const [currentVersionInstallTime, setCurrentVersionInstallTime] = createSignal<string>('');

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const localeString = locale() === 'zh' ? 'zh-CN' : 'en-US';
      return date.toLocaleDateString(localeString, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const orderedDetails = createMemo(() => {
    if (!props.info?.details) return [];
    const detailsMap = new Map(props.info.details);
    const result: { key: string; label: string; value: string }[] = [];

    const currentVersionInfo = versionInfo();
    if (currentVersionInfo && currentVersionInfo.current_version) {
      if (detailsMap.has('Installed Version')) {
        detailsMap.set('Installed Version', currentVersionInfo.current_version);
      }
      if (detailsMap.has('Version')) {
        detailsMap.set('Version', currentVersionInfo.current_version);
      }
    }

    const fieldConfig = [
      { key: 'Name', label: t('packageInfo.name') },
      { key: 'Description', label: t('packageInfo.description') },
      { key: 'Bucket', label: t('packageInfo.bucket') + ' / Manifest' },
      { key: 'Installed Version', label: t('packageInfo.installedVersion') },
      { key: 'Latest Version', label: t('packageInfo.latestVersion') },
      { key: 'Version', label: t('packageInfo.version') },
      { key: 'Includes', label: t('packageInfo.includes') },
      { key: 'Installed', label: t('packageInfo.installed') },
      { key: 'Homepage', label: t('packageInfo.homepage') },
      { key: 'License', label: t('packageInfo.license') },
    ];

    const allFields =
      props.pkg && props.context === 'installed'
        ? [...fieldConfig, { key: 'Install Date', label: t('packageInfo.installDate') }]
        : props.pkg && props.context === 'search'
          ? [...fieldConfig, { key: 'Update Date', label: t('packageInfo.updateDate') }]
          : fieldConfig;

    for (const { key, label } of allFields) {
      if (detailsMap.has(key)) {
        result.push({ key, label, value: detailsMap.get(key)! });
      } else if (key === 'Bucket' && props.pkg?.source) {
        result.push({ key, label, value: props.pkg.source });
      } else if (key === 'Install Date' && props.pkg) {
        const installTime = currentVersionInstallTime() || props.pkg.updated;
        result.push({ key, label, value: formatDate(installTime) });
      } else if (key === 'Update Date' && props.pkg) {
        result.push({ key, label, value: formatDate(props.pkg.updated) });
      }
    }
    return result;
  });

  const detailByKey = createMemo(() => {
    const map = new Map<string, { key: string; label: string; value: string }>();
    for (const item of orderedDetails()) {
      map.set(item.key, item);
    }
    return map;
  });

  const primaryDetailKeys = createMemo(() => {
    const keys = ['Name', 'License'];
    if (props.pkg && props.context === 'installed') {
      keys.push('Install Date');
    } else if (props.pkg && props.context === 'search') {
      keys.push('Update Date');
    }
    keys.push('Homepage');
    return keys;
  });

  const secondaryDetailKeys = createMemo(() => ['Bucket', 'Version', 'Installed', 'Includes']);

  const primaryDetails = createMemo(() => {
    const map = detailByKey();
    return primaryDetailKeys()
      .map((key) => map.get(key))
      .filter((item): item is { key: string; label: string; value: string } => !!item);
  });

  type VersionDetailItem = { key: string; label: string; value: string; latestVersion: string };

  const secondaryDetails = createMemo(() => {
    const map = detailByKey();
    const items: ({ key: string; label: string; value: string } | VersionDetailItem)[] =
      secondaryDetailKeys()
        .map((key) => map.get(key))
        .filter((item): item is { key: string; label: string; value: string } => !!item);

    const vi = versionInfo();
    if (vi && vi.available_versions && vi.available_versions.length > 0) {
      const latestVersion = map.get('Latest Version')?.value || vi.current_version;
      items.splice(1, 0, {
        key: 'Version',
        label: t('packageInfo.version'),
        value: vi.current_version,
        latestVersion: latestVersion,
      });
    }
    return items;
  });

  const [manifestContent, setManifestContent] = createSignal<string | null>(null);
  const [manifestLoading, setManifestLoading] = createSignal(false);
  const [manifestError, setManifestError] = createSignal<string | null>(null);
  const packageKey = () => (props.pkg ? `${props.pkg.name}::${props.pkg.source}` : null);

  const [showVersionSwitcher, setShowVersionSwitcher] = createSignal(false);

  const [selectedBucket, setSelectedBucket] = createSignal<BucketInfo | null>(null);
  const [showBucketInfo, setShowBucketInfo] = createSignal(false);
  const [bucketManifests, setBucketManifests] = createSignal<string[]>([]);
  const [bucketManifestsLoading, setBucketManifestsLoading] = createSignal(false);
  const [bucketError, setBucketError] = createSignal<string | null>(null);
  let activeBucketRequestToken = 0;

  const handleBucketClick = async (bucketName: string) => {
    const requestToken = ++activeBucketRequestToken;
    try {
      setBucketManifestsLoading(true);
      setBucketError(null);

      const existingBucket = buckets().find((b) => b.name === bucketName);
      const bucketInfo = existingBucket ?? (await invoke<any>('get_bucket_info', { bucketName }));

      // NEVER auto-load manifests when opening BucketInfoModal from PackageInfoModal.
      // This is because we only need a summary, and loading all manifests is heavy.
      // The user can manually click the "Load Package List" button in the modal if needed.
      const manifests: string[] = [];

      if (requestToken !== activeBucketRequestToken) {
        return;
      }

      setSelectedBucket(bucketInfo);
      setBucketManifests(manifests);
      setShowBucketInfo(true);
    } catch (error) {
      if (requestToken !== activeBucketRequestToken) {
        return;
      }

      console.error('Failed to fetch bucket info:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setBucketError(errorMessage);
      props.onBucketClick?.(bucketName);
    } finally {
      if (requestToken === activeBucketRequestToken) {
        setBucketManifestsLoading(false);
      }
    }
  };

  const closeBucketInfo = () => {
    activeBucketRequestToken += 1;
    setShowBucketInfo(false);
    setSelectedBucket(null);
    setBucketManifests([]);
    setBucketManifestsLoading(false);
    setBucketError(null);
  };

  const closeVersionSwitcher = () => setShowVersionSwitcher(false);
  const openVersionSwitcher = () => setShowVersionSwitcher(true);

  const uninstallConfirm = useMultiConfirmAction(3000);
  const updateConfirm = useMultiConfirmAction(3000);
  const deleteVersionConfirm = useMultiConfirmAction(3000);

  createEffect(() => {
    if (props.pkg?.is_installed) {
      fetchVersionInfo(props.pkg);
    }
  });

  createEffect(() => {
    let cancelled = false;
    const packageName = props.pkg?.name;
    if (!props.pkg?.is_installed || !packageName) {
      setCurrentVersionInstallTime('');
      return;
    }
    setCurrentVersionInstallTime('');
    getCurrentVersionInstallTime(packageName)
      .then((installTime: string) => {
        if (!cancelled && props.pkg?.name === packageName) {
          setCurrentVersionInstallTime(installTime);
        }
      })
      .catch(console.error);
    onCleanup(() => {
      cancelled = true;
    });
  });

  createEffect(() => {
    if (!props.autoShowVersions || !props.pkg) {
      setVersionInfo(undefined);
      setVersionError(undefined);
      setVersionLoading(false);
      setSwitchingVersion(undefined);
    }
  });

  createEffect((prevPackageKey) => {
    const currentPackageKey = packageKey();
    if (prevPackageKey !== undefined && prevPackageKey !== currentPackageKey) {
      setCurrentVersionInstallTime('');
      setVersionInfo(undefined);
      setVersionError(undefined);
      setVersionLoading(false);
      setSwitchingVersion(undefined);
      setManifestContent(null);
      setManifestError(null);
      setManifestLoading(false);
      uninstallConfirm.cancelConfirm();
      updateConfirm.cancelConfirm();
      deleteVersionConfirm.cancelConfirm();
    }
    return currentPackageKey;
  });

  const fetchManifest = async (pkg: ScoopPackage) => {
    setManifestLoading(true);
    setManifestError(null);
    setManifestContent(null);
    try {
      const result = await invoke<string>('get_package_manifest', {
        packageName: pkg.name,
        bucket: pkg.source,
      });
      setManifestContent(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setManifestError(t('packageInfo.errorLoadingManifest', { name: pkg.name, error: errorMsg }));
      console.error(`Failed to fetch manifest for ${pkg.name}:`, errorMsg);
    } finally {
      setManifestLoading(false);
    }
  };

  const closeManifestModal = () => {
    setManifestContent(null);
    setManifestLoading(false);
    setManifestError(null);
  };

  const fetchVersionInfo = async (pkg: ScoopPackage) => {
    setVersionLoading(true);
    setVersionError(undefined);
    try {
      const result = await invoke<VersionedPackageInfo>('get_package_versions', {
        packageName: pkg.name,
        global: false,
      });
      setVersionInfo(result);
      setVersionLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setVersionError(t('packageInfo.errorLoadingVersions', { name: pkg.name, error: errorMsg }));
      setVersionLoading(false);
      console.error(`Failed to fetch versions for ${pkg.name}:`, errorMsg);
    }
  };

  const switchVersion = async (pkg: ScoopPackage, targetVersion: string) => {
    setSwitchingVersion(targetVersion);
    try {
      await invoke<string>('switch_package_version', {
        packageName: pkg.name,
        targetVersion,
        global: false,
      });
      await fetchVersionInfo(pkg);
      props.onPackageStateChanged?.();
      searchCacheManager.invalidateCache();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setVersionError(
        t('packageInfo.errorSwitchingVersion', { version: targetVersion, error: errorMsg })
      );
      console.error(`Failed to switch ${pkg.name} to version ${targetVersion}:`, errorMsg);
    } finally {
      setSwitchingVersion(undefined);
    }
  };

  const deleteVersion = async (pkg: ScoopPackage, versionToDelete: string) => {
    if (deleteVersionConfirm.isConfirming(versionToDelete)) {
      deleteVersionConfirm.cancelConfirm(versionToDelete);
      try {
        await invoke('delete_app_version', {
          appName: pkg.name,
          version: versionToDelete,
        });
        await fetchVersionInfo(pkg);
        props.onPackageStateChanged?.();
        searchCacheManager.invalidateCache();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setVersionError(
          t('packageInfo.errorDeletingVersion', { version: versionToDelete, error: errorMsg })
        );
        console.error(`Failed to delete version ${versionToDelete} for ${pkg.name}:`, errorMsg);
      }
    } else {
      deleteVersionConfirm.startConfirm(versionToDelete);
    }
  };

  const headerAction = (
    <PackageInfoModalHeader
      pkg={props.pkg}
      isInstalled={isInstalled}
      hasUpdate={hasUpdate}
      onFetchManifest={fetchManifest}
      onForceUpdate={props.onForceUpdate}
    />
  );

  const footer = (
    <PackageInfoModalFooter
      pkg={props.pkg}
      isInstalled={isInstalled}
      hasUpdate={hasUpdate}
      showBackButton={props.showBackButton}
      uninstallConfirm={uninstallConfirm}
      updateConfirm={updateConfirm}
      onInstall={props.onInstall}
      onUninstall={props.onUninstall}
      onUpdate={props.onUpdate}
      onForceUpdate={props.onForceUpdate}
      onPackageStateChanged={props.onPackageStateChanged}
    />
  );

  return (
    <>
      <Modal
        isOpen={!!props.pkg}
        onClose={props.onClose}
        title={t('packageInfo.title', { name: props.pkg?.name })}
        size="large"
        animation="scale"
        headerAction={headerAction}
        footer={footer}
        preventBackdropClose={false}
        zIndex="z-[60]"
      >
        <Show when={props.loading}>
          <div class="flex h-40 items-center justify-center">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </Show>
        <Show when={props.error}>
          <div role="alert" class="alert alert-error">
            <span>{props.error}</span>
          </div>
        </Show>
        <Show when={props.info}>
          <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div class="bg-base-200/35 border-base-content/8 min-w-0 rounded-2xl border p-4">
              <div class="space-y-3">
                <For each={primaryDetails()}>
                  {(item) => (
                    <div class="min-w-0 text-sm">
                      <DetailRenderer
                        key={item.key}
                        value={item.value}
                        label={item.label}
                        description={
                          item.key === 'Name' ? detailByKey().get('Description')?.value : undefined
                        }
                        pkg={props.pkg}
                        iconSrc={props.pkg?.name ? packageIcons()[props.pkg.name] : undefined}
                        onBucketClick={handleBucketClick}
                        onVersionSwitch={openVersionSwitcher}
                        disableBucketClick={props.showBackButton}
                      />
                    </div>
                  )}
                </For>
                <Show when={props.info?.notes}>
                  <div class="min-w-0 text-sm">
                    <div class="border-base-content/10 bg-base-100/70 overflow-hidden rounded-xl border">
                      <pre class="m-0 max-h-64 overflow-auto p-3 text-sm leading-6 wrap-break-word whitespace-pre-wrap">
                        <DetailRenderer
                          key="notes"
                          value={props.info?.notes ?? ''}
                          label={t('packageInfo.notes')}
                        />
                      </pre>
                    </div>
                  </div>
                </Show>
              </div>
            </div>

            <div class="bg-base-200/35 border-base-content/8 min-w-0 rounded-2xl border p-4">
              <div class="space-y-3">
                <For each={secondaryDetails()}>
                  {(item) => (
                    <div class="min-w-0 text-sm">
                      <DetailRenderer
                        key={item.key}
                        value={item.value}
                        label={item.label}
                        latestVersion={'latestVersion' in item ? item.latestVersion : undefined}
                        pkg={props.pkg}
                        iconSrc={props.pkg?.name ? packageIcons()[props.pkg.name] : undefined}
                        versionInfo={versionInfo()}
                        onBucketClick={handleBucketClick}
                        onChangeBucket={props.onChangeBucket}
                        onManifestClick={(pkg) => fetchManifest(pkg)}
                        onVersionSwitch={openVersionSwitcher}
                        onVersionClick={(version) => props.pkg && switchVersion(props.pkg, version)}
                        disableBucketClick={props.showBackButton}
                      />
                    </div>
                  )}
                </For>
              </div>
            </div>

            <Show when={props.pkg}>
              <VersionSwitcher
                show={showVersionSwitcher()}
                loading={versionLoading()}
                error={versionError()}
                versionInfo={versionInfo()}
                switchingVersion={switchingVersion()}
                onClose={closeVersionSwitcher}
                onSwitchVersion={switchVersion}
                onDeleteVersion={deleteVersion}
                pkg={props.pkg!}
              />
            </Show>
            <ManifestModal
              packageName={props.pkg?.name ?? ''}
              manifestContent={manifestContent()}
              loading={manifestLoading()}
              error={manifestError()}
              onClose={closeManifestModal}
              bucketSource={props.pkg?.source}
              bucketGitUrl={props.bucketGitUrl}
              bucketGitBranch={props.bucketGitBranch}
            />
          </div>
        </Show>
      </Modal>

      <Show when={showBucketInfo()}>
        <BucketInfoModal
          bucket={selectedBucket()}
          manifests={bucketManifests()}
          manifestsLoading={bucketManifestsLoading()}
          error={bucketError()}
          onClose={closeBucketInfo}
          zIndex="z-[60]"
          fromPackageModal={true}
        />
      </Show>
    </>
  );
}

export default PackageInfoModal;
export type { PackageInfoModalProps } from './types';
