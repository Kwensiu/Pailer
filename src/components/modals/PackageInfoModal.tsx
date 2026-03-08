import { For, Show, createEffect, createSignal, createMemo, Switch, Match } from 'solid-js';
import { ScoopPackage, ScoopInfo, VersionedPackageInfo } from '../../types/scoop';
import Modal from '../common/Modal';
import BucketInfoModal from './BucketInfoModal';
import { useBuckets } from '../../hooks/useBuckets';
import hljs from 'highlight.js/lib/core';

import json from 'highlight.js/lib/languages/json';
import { Download, Ellipsis, FileText, ExternalLink } from 'lucide-solid';
import { invoke } from '@tauri-apps/api/core';
import ManifestModal from './ManifestModal';
import { openPath } from '@tauri-apps/plugin-opener';
import { t, locale } from '../../i18n';

hljs.registerLanguage('json', json);

interface PackageInfoModalProps {
  pkg?: ScoopPackage | null;
  info?: ScoopInfo | null;
  loading?: boolean;
  error?: string | null;
  autoShowVersions?: boolean;
  isPackageVersioned?: (packageName: string) => boolean;
  onClose: () => void;
  onInstall?: (pkg: ScoopPackage) => void;
  onUninstall?: (pkg: ScoopPackage) => void;
  onUpdate?: (pkg: ScoopPackage) => void;
  onForceUpdate?: (pkg: ScoopPackage) => void;
  onChangeBucket?: (pkg: ScoopPackage) => void;
  onPackageStateChanged?: () => void;
  setOperationTitle?: (title: string) => void;
  showBackButton?: boolean;
  context?: 'installed' | 'search'; // Add context property to distinguish page source
  onBucketClick?: (bucketName: string) => void; // Add callback for bucket name clicks
  fromPackageModal?: boolean; // Whether this modal is opened from another PackageInfoModal
}

// Component to render detail values. If it's a JSON string of an object/array, it pretty-prints and highlights it.
function DetailValue(props: { value: string }) {
  const parsed = createMemo(() => {
    try {
      const p = JSON.parse(props.value);
      if (p && typeof p === 'object') {
        return p;
      }
    } catch (e) {
      // Not a JSON object string
    }
    return null;
  });

  let codeRef: HTMLElement | undefined;
  createEffect(() => {
    if (parsed() && codeRef) {
      hljs.highlightElement(codeRef);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (codeRef && codeRef.firstChild) {
        // Remove all child nodes instead of setting innerHTML
        while (codeRef.firstChild) {
          codeRef.removeChild(codeRef.firstChild);
        }
      }
    };
  });

  return (
    <Show when={parsed()} fallback={<span class="wrap-break-word">{props.value}</span>}>
      <pre class="bg-base-100 max-h-60 overflow-y-auto rounded-lg p-2 font-mono text-xs whitespace-pre-wrap">
        <code ref={codeRef} class="language-json">
          {JSON.stringify(parsed(), null, 2)}
        </code>
      </pre>
    </Show>
  );
}

// Component to render long "Includes" lists in a compact, scrollable form
function IncludesValue(props: { value: string }) {
  const items = createMemo(() => props.value.split(/,\s*/).filter((s) => s.length > 0));
  return (
    <div class="max-h-18 overflow-y-auto">
      <ul class="list-inside list-disc space-y-0.5 text-xs">
        <For each={items()}>{(item) => <li class="break-all">{item}</li>}</For>
      </ul>
    </div>
  );
}

function LicenseValue(props: { value: string }) {
  const license = createMemo(() => {
    try {
      const p = JSON.parse(props.value);
      if (p && typeof p === 'object' && p.identifier) {
        return {
          identifier: p.identifier as string,
          url: p.url as string | undefined,
        };
      }
    } catch (e) {
      // Not a JSON object string
    }
    return null;
  });

  return (
    <Show when={license()} fallback={<DetailValue value={props.value} />}>
      <Switch>
        <Match when={license()?.url}>
          <a
            href={license()?.url}
            target="_blank"
            rel="noopener noreferrer"
            class="link link-primary"
          >
            {license()?.identifier}
          </a>
        </Match>
        <Match when={!license()?.url}>
          <span class="wrap-break-word">{license()?.identifier}</span>
        </Match>
      </Switch>
    </Show>
  );
}

function PackageInfoModal(props: PackageInfoModalProps) {
  const { buckets } = useBuckets();
  let codeRef: HTMLElement | undefined;
  // Format date display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return dateString;

      // Use locale-specific date format
      const localeString = locale() === 'zh' ? 'zh-CN' : 'en-US';
      return date.toLocaleDateString(localeString, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };

  const orderedDetails = createMemo(() => {
    if (!props.info?.details) return [];

    const desiredOrder = [
      { key: 'Name', label: t('packageInfo.name') },
      { key: 'Description', label: t('packageInfo.description') },
      { key: 'Bucket', label: t('packageInfo.bucket') },
      { key: 'Installed Version', label: t('packageInfo.installedVersion') },
      { key: 'Latest Version', label: t('packageInfo.latestVersion') },
      { key: 'Version', label: t('packageInfo.version') },
      // Add date info based on context
      ...(props.pkg && props.context === 'installed'
        ? [{ key: 'Install Date', label: t('packageInfo.installDate') }]
        : []),
      ...(props.pkg && props.context === 'search'
        ? [{ key: 'Update Date', label: t('packageInfo.updateDate') }]
        : []),
      { key: 'Includes', label: t('packageInfo.includes') },
      { key: 'Installed', label: t('packageInfo.installed') },
      { key: 'Homepage', label: t('packageInfo.homepage') },
      { key: 'License', label: t('packageInfo.license') },
    ];

    const detailsMap = new Map(props.info.details);
    const result: [string, string, string][] = []; // [label, value, originalKey]

    for (const { key, label } of desiredOrder) {
      if (detailsMap.has(key)) {
        result.push([label, detailsMap.get(key)!, key]);
      } else if (key === 'Install Date' && props.pkg) {
        // Add install date info and format
        result.push([label, formatDate(props.pkg.updated), 'Install Date']);
      } else if (key === 'Update Date' && props.pkg) {
        // Add update date info and format
        result.push([label, formatDate(props.pkg.updated), 'Update Date']);
      }
    }

    return result;
  });

  // State for version switching
  const [versionInfo, setVersionInfo] = createSignal<VersionedPackageInfo | null>(null);
  const [versionLoading, setVersionLoading] = createSignal(false);
  const [versionError, setVersionError] = createSignal<string | null>(null);
  const [switchingVersion, setSwitchingVersion] = createSignal<string | null>(null);

  // State for manifest modal
  const [manifestContent, setManifestContent] = createSignal<string | null>(null);
  const [manifestLoading, setManifestLoading] = createSignal(false);
  const [manifestError, setManifestError] = createSignal<string | null>(null);

  // State for version switcher sidebar
  const [showVersionSwitcher, setShowVersionSwitcher] = createSignal(false);
  const [animatingOut, setAnimatingOut] = createSignal(false);
  const [animatingIn, setAnimatingIn] = createSignal(false);

  // State for bucket info modal
  const [selectedBucket, setSelectedBucket] = createSignal<any>(null);
  const [showBucketInfo, setShowBucketInfo] = createSignal(false);
  const [bucketManifests, setBucketManifests] = createSignal<string[]>([]);
  const [bucketManifestsLoading, setBucketManifestsLoading] = createSignal(false);
  const [bucketError, setBucketError] = createSignal<string | null>(null);

  // Default bucket click handler
  const handleBucketClick = async (bucketName: string) => {
    let isMounted = true;

    try {
      setBucketManifestsLoading(true);
      setBucketError(null);

      // For fromPackageModal, try to use existing buckets data first to avoid backend calls
      if (props.fromPackageModal) {
        const existingBucket = buckets().find((b) => b.name === bucketName);
        if (existingBucket) {
          // Use existing bucket data, no backend call needed
          setSelectedBucket(existingBucket);
          setBucketManifests([]); // Empty manifests since we won't show them
          setShowBucketInfo(true);
        } else {
          // Fallback to backend call if bucket not found in existing data
          const bucketInfo = await invoke<any>('get_bucket_info', { bucketName });
          if (isMounted) {
            setSelectedBucket(bucketInfo);
            setBucketManifests([]);
            setShowBucketInfo(true);
          }
        }
      } else {
        // For other cases, fetch both info and manifests
        const bucketInfo = await invoke<any>('get_bucket_info', { bucketName });
        const manifests = await invoke<string[]>('get_bucket_manifests', { bucketName });

        if (isMounted) {
          setSelectedBucket(bucketInfo);
          setBucketManifests(manifests);
          setShowBucketInfo(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bucket info:', error);
      if (isMounted) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setBucketError(errorMessage);
        // Fallback to parent handler if available
        props.onBucketClick?.(bucketName);
      }
    } finally {
      if (isMounted) {
        setBucketManifestsLoading(false);
      }
    }
  };

  // Close bucket info modal
  const closeBucketInfo = () => {
    setShowBucketInfo(false);
    setSelectedBucket(null);
    setBucketManifests([]);
    setBucketError(null);
  };

  // Handle version switcher close with animation
  const closeVersionSwitcher = () => {
    setAnimatingOut(true);
    setAnimatingIn(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setShowVersionSwitcher(false);
      setAnimatingOut(false);
    }, 300); // Match the transition duration
  };

  // Handle version switcher open with animation
  const openVersionSwitcher = () => {
    setShowVersionSwitcher(true);
    // Start animation in the next render cycle
    setTimeout(() => {
      setAnimatingIn(true);
    }, 10); // Small delay to ensure the element is rendered first
  };

  // Check if a detail key is version-related
  const isVersionRelated = (key: string) => {
    return ['Version', 'Installed Version'].includes(key);
  };

  // State for uninstall confirmation
  const [uninstallConfirm, setUninstallConfirm] = createSignal(false);
  const [uninstallTimer, setUninstallTimer] = createSignal<number | null>(null);

  // State for update button
  const [updateConfirm, setUpdateConfirm] = createSignal(false);
  const [updateTimer, setUpdateTimer] = createSignal<number | null>(null);

  createEffect(() => {
    if (props.info?.notes && codeRef) {
      hljs.highlightElement(codeRef);

      // Clean up highlight on effect dispose
      return () => {
        if (codeRef && codeRef.firstChild) {
          // Remove all child nodes instead of setting innerHTML
          while (codeRef.firstChild) {
            codeRef.removeChild(codeRef.firstChild);
          }
        }
      };
    }
  });

  // Auto-fetch version info for versioned packages
  createEffect(() => {
    if (props.pkg?.is_installed) {
      fetchVersionInfo(props.pkg);
    }
  });

  // Clear version info when package changes or autoShowVersions becomes false
  createEffect(() => {
    if (!props.autoShowVersions || !props.pkg) {
      setVersionInfo(null);
      setVersionError(null);
      setVersionLoading(false);
      setSwitchingVersion(null);
    }
  });

  // Clear info when switching to a different package
  createEffect((prevPackageName) => {
    const currentPackageName = props.pkg?.name;
    if (prevPackageName !== undefined && prevPackageName !== currentPackageName) {
      setVersionInfo(null);
      setVersionError(null);
      setVersionLoading(false);
      setSwitchingVersion(null);
      // Reset uninstall confirmation state when switching packages
      setUninstallConfirm(false);
      if (uninstallTimer()) {
        window.clearTimeout(uninstallTimer()!);
        setUninstallTimer(null);
      }
      // Reset update confirmation state when switching packages
      setUpdateConfirm(false);
      if (updateTimer()) {
        window.clearTimeout(updateTimer()!);
        setUpdateTimer(null);
      }
    }
    return currentPackageName;
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
    setVersionError(null);
    setVersionInfo(null);

    try {
      const result = await invoke<VersionedPackageInfo>('get_package_versions', {
        packageName: pkg.name,
        global: false, // TODO: Add support for global packages
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
        global: false, // TODO: Add support for global packages
      });

      // Refresh version info after switching
      await fetchVersionInfo(pkg);

      // Notify parent that package state may have changed
      props.onPackageStateChanged?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setVersionError(
        t('packageInfo.errorSwitchingVersion', { version: targetVersion, error: errorMsg })
      );
      console.error(`Failed to switch ${pkg.name} to version ${targetVersion}:`, errorMsg);
    } finally {
      setSwitchingVersion(null);
    }
  };

  // Header action component (dropdown menu)
  const headerAction = (
    <div class="dropdown dropdown-end">
      <label tabindex="0" class="btn btn-ghost btn-sm btn-circle">
        <Ellipsis class="h-5 w-5" />
      </label>
      <ul tabindex="0" class="dropdown-content menu w-52 p-2">
        <li>
          <a onClick={() => props.pkg && fetchManifest(props.pkg)}>
            <FileText class="mr-2 h-4 w-4" />
            {t('packageInfo.viewManifest')}
          </a>
        </li>
        <Show when={props.pkg?.is_installed}>
          <li>
            <a
              onClick={async () => {
                if (props.pkg) {
                  try {
                    const debug = await invoke<string>('debug_package_structure', {
                      packageName: props.pkg.name,
                      global: false,
                    });
                    console.log('Package structure debug:', debug);
                    alert(debug);
                  } catch (error) {
                    console.error('Failed to debug package info:', error);
                  }
                }
              }}
            >
              <FileText class="mr-2 h-4 w-4" />
              {t('packageInfo.debugStructure')}
            </a>
          </li>
        </Show>
        <Show when={props.pkg?.is_installed}>
          <li>
            <button
              type="button"
              onClick={async () => {
                if (props.pkg) {
                  try {
                    const packagePath = await invoke<string>('get_package_path', {
                      packageName: props.pkg.name,
                    });
                    await openPath(packagePath);
                  } catch (error) {
                    console.error('Failed to open package path:', error);
                  }
                }
              }}
            >
              <ExternalLink class="mr-2 h-4 w-4" />
              {t('packageInfo.openInExplorer')}
            </button>
          </li>
        </Show>
      </ul>
    </div>
  );

  // Footer component (buttons)
  const footer = (
    <div class="flex w-full items-center justify-between">
      <div class="flex space-x-2">
        {/* Uninstall Bottom in PackageInfoModal - moved from right */}
        <Show when={props.pkg?.is_installed}>
          <button
            type="button"
            class="btn btn-error"
            classList={{ 'btn-warning': uninstallConfirm() }}
            onClick={() => {
              if (uninstallConfirm()) {
                // Execute uninstall
                if (uninstallTimer()) {
                  window.clearTimeout(uninstallTimer()!);
                  setUninstallTimer(null);
                }
                setUninstallConfirm(false);
                if (props.pkg) {
                  props.onUninstall?.(props.pkg);
                  // Notify parent that package state may change
                  props.onPackageStateChanged?.();
                }
              } else {
                // First click - show confirmation
                setUninstallConfirm(true);
                const timer = window.setTimeout(() => {
                  setUninstallConfirm(false);
                  setUninstallTimer(null);
                }, 3000);
                setUninstallTimer(timer);
              }
            }}
          >
            {uninstallConfirm() ? t('packageInfo.sure') : t('buttons.uninstall')}
          </button>
        </Show>
        {/* Change Bucket Bottom in PackageInfoModal */}
        <Show when={props.pkg?.is_installed && props.onChangeBucket}>
          <button
            type="button"
            class="btn btn-info"
            onClick={() => {
              if (props.pkg) {
                props.onChangeBucket!(props.pkg);
              }
            }}
          >
            {t('packageInfo.changeBucket')}
          </button>
        </Show>
      </div>
      <div class="flex space-x-2">
        <form method="dialog">
          <Show when={!props.pkg?.is_installed && props.onInstall}>
            <button
              type="button"
              class="btn btn-primary mr-2"
              onClick={() => {
                if (props.pkg) {
                  props.onInstall!(props.pkg);
                  // Notify parent that package state may change
                  props.onPackageStateChanged?.();
                }
              }}
            >
              <Download class="mr-2 h-4 w-4" />
              {t('buttons.install')}
            </button>
          </Show>
          {/* Update (Force Update) Bottom in PackageInfoModal - moved from left */}
          <Show when={props.pkg?.is_installed}>
            <button
              type="button"
              class="btn mr-2"
              classList={{
                'btn-primary': !!props.pkg?.available_version && !updateConfirm(),
                'btn-soft text-base-content/50': !props.pkg?.available_version && !updateConfirm(),
                'btn-warning min-w-24': updateConfirm(),
              }}
              onClick={() => {
                if (updateConfirm()) {
                  // Execute force update
                  if (updateTimer()) {
                    window.clearTimeout(updateTimer()!);
                    setUpdateTimer(null);
                  }
                  setUpdateConfirm(false);
                  if (props.pkg) {
                    // Implement force update functionality and show in OperationModal
                    // Use the dedicated handleForceUpdate function if available
                    if (props.onForceUpdate) {
                      props.onForceUpdate(props.pkg);
                    } else if (props.setOperationTitle) {
                      // Fallback to direct invocation with proper UI feedback
                      props.setOperationTitle(`Force Updating ${props.pkg.name}`);
                      invoke('update_package', {
                        packageName: props.pkg.name,
                        force: true,
                      }).catch((err) => {
                        console.error('Failed to force update package:', err);
                      });
                    } else {
                      console.warn(
                        'Neither onForceUpdate nor setOperationTitle is provided for force update operation'
                      );
                    }
                    props.onPackageStateChanged?.();
                  }
                } else {
                  if (props.pkg?.available_version) {
                    // Normal update - use package operations hook for consistency
                    if (props.pkg && props.onUpdate) {
                      props.onUpdate(props.pkg);
                      // Notify parent that package state may change
                      props.onPackageStateChanged?.();
                    } else if (props.pkg) {
                      // Fallback to direct invocation if onUpdate is not provided
                      // We should not directly call setOperationTitle, but use the hook function
                      // This ensures the operationTitle signal is properly updated
                      if (props.setOperationTitle) {
                        props.setOperationTitle(`Updating ${props.pkg.name}`);
                      }
                      invoke('update_package', {
                        packageName: props.pkg.name,
                      }).catch((err) => {
                        console.error('Failed to update package:', err);
                      });
                      props.onPackageStateChanged?.();
                    }
                  } else {
                    // No update available, show force update confirmation
                    setUpdateConfirm(true);
                    const timer = window.setTimeout(() => {
                      setUpdateConfirm(false);
                      setUpdateTimer(null);
                    }, 3000);
                    setUpdateTimer(timer);
                  }
                }
              }}
            >
              {updateConfirm() ? t('packageInfo.forceUpdate') : t('packageInfo.update')}
            </button>
          </Show>
          <button class="btn btn-soft" data-modal-close>
            {props.showBackButton ? t('packageInfo.backToBucket') : t('packageInfo.close')}
          </button>
        </form>
      </div>
    </div>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{props.error}</span>
          </div>
        </Show>
        <Show when={props.info}>
          <div class="flex gap-6">
            {/* Package details - always full width */}
            <div class="min-w-0 flex-1">
              <h4 class="mb-3 border-b pb-2 text-lg font-medium">{t('packageInfo.details')}</h4>
              <div class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm">
                <For each={orderedDetails()}>
                  {([label, value, originalKey]) => (
                    <div class="border-base-content/10 grid grid-cols-3 gap-2 border-b py-1">
                      <div class="text-base-content/70 col-span-1 font-semibold capitalize">
                        {label}:
                      </div>
                      <div class="col-span-2">
                        <Switch fallback={<DetailValue value={value} />}>
                          <Match when={originalKey === 'Homepage'}>
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="link link-primary break-all"
                            >
                              {value}
                            </a>
                          </Match>
                          <Match when={originalKey === 'Bucket'}>
                            <div
                              class="link-primary tooltip tooltip-top cursor-pointer rounded break-all"
                              data-tip={t('packageInfo.viewBucketInfo')}
                              onClick={() => handleBucketClick(value)}
                            >
                              {value}
                            </div>
                          </Match>
                          <Match when={originalKey === 'License'}>
                            <LicenseValue value={value} />
                          </Match>
                          <Match when={originalKey === 'Includes'}>
                            <IncludesValue value={value} />
                          </Match>
                          <Match when={isVersionRelated(originalKey)}>
                            <div class="flex items-center gap-2">
                              <DetailValue value={value} />
                              <Show
                                when={
                                  props.pkg?.is_installed &&
                                  (props.isPackageVersioned?.(props.pkg.name) ||
                                    (versionInfo() && versionInfo()!.available_versions.length > 1))
                                }
                              >
                                <button
                                  class="btn btn-xs btn-primary"
                                  onClick={openVersionSwitcher}
                                >
                                  {t('packageInfo.switch')}
                                </button>
                              </Show>
                            </div>
                          </Match>
                          <Match when={originalKey === 'Installed'}>
                            <div
                              class="link-primary tooltip tooltip-top inline-block cursor-pointer break-all"
                              data-tip={t('packageInfo.openInExplorer')}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await openPath(value);
                                } catch (error) {
                                  console.error('Failed to open installed path:', error);
                                }
                              }}
                            >
                              {value}
                            </div>
                          </Match>
                        </Switch>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Floating Version Switcher */}
            <Show when={showVersionSwitcher() || animatingOut()}>
              <div class="fixed inset-0 z-70" onClick={closeVersionSwitcher}>
                <div
                  class="bg-base-175 border-base-300 absolute top-18 right-0 bottom-20 max-w-[400px] min-w-[300px] overflow-y-auto rounded-2xl border p-4 shadow-lg transition-transform duration-300 ease-in-out"
                  classList={{
                    'translate-x-[-1.5rem]':
                      showVersionSwitcher() && !animatingOut() && animatingIn(),
                    'translate-x-[calc(100%+1.5rem)]': animatingOut() || !animatingIn(),
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div class="mb-4 flex items-center justify-between">
                    <h3 class="text-lg font-semibold">{t('packageInfo.versionSwitch')}</h3>
                    <button class="btn btn-sm btn-ghost" onClick={closeVersionSwitcher}>
                      ✕
                    </button>
                  </div>

                  <Show
                    when={versionLoading()}
                    fallback={
                      <div class="space-y-3">
                        <Show when={versionError()}>
                          <div role="alert" class="alert alert-error mb-3">
                            <span>{versionError()}</span>
                          </div>
                        </Show>
                        <For each={versionInfo()?.available_versions || []}>
                          {(version) => (
                            <div
                              class="card bg-base-100 border-base-content/10 border p-4 transition-all hover:shadow-md"
                              classList={{
                                'border-primary bg-primary/5': version.is_current,
                              }}
                            >
                              <div class="flex items-center justify-between">
                                <div>
                                  <div class="font-semibold">{version.version}</div>
                                  <Show when={version.is_current}>
                                    <div class="text-primary text-sm font-medium">
                                      {t('packageInfo.current')}
                                    </div>
                                  </Show>
                                </div>
                                <Show when={!version.is_current}>
                                  <button
                                    class="btn btn-sm btn-primary"
                                    disabled={switchingVersion() === version.version}
                                    onClick={() =>
                                      props.pkg && switchVersion(props.pkg, version.version)
                                    }
                                  >
                                    <Show
                                      when={switchingVersion() === version.version}
                                      fallback={t('packageInfo.switch')}
                                    >
                                      <span class="loading loading-spinner loading-xs"></span>
                                    </Show>
                                  </button>
                                </Show>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    }
                  >
                    <div class="flex items-center justify-center py-8">
                      <span class="loading loading-spinner loading-lg"></span>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
            <ManifestModal
              packageName={props.pkg?.name ?? ''}
              manifestContent={manifestContent()}
              loading={manifestLoading()}
              error={manifestError()}
              onClose={closeManifestModal}
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
          fromPackageModal={props.fromPackageModal}
          zIndex="z-[60]"
        />
      </Show>
    </>
  );
}

export default PackageInfoModal;
