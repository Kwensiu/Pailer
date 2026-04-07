import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage, ScoopInfo } from '../../types/scoop';

interface UsePackageInfoReturn {
  selectedPackage: () => ScoopPackage | null;
  info: () => ScoopInfo | null;
  loading: () => boolean;
  error: () => string | null;
  fetchPackageInfo: (pkg: ScoopPackage) => Promise<void>;
  refreshSelectedPackageInfo: (pkg?: ScoopPackage | null) => Promise<void>;
  closeModal: () => void;
  updateSelectedPackage: (pkg: ScoopPackage) => void;
  syncSelectedPackage: (packages: ScoopPackage[]) => ScoopPackage | null;
}

export function usePackageInfo(): UsePackageInfoReturn {
  const [selectedPackage, setSelectedPackage] = createSignal<ScoopPackage | null>(null);
  const [info, setInfo] = createSignal<ScoopInfo | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let activeInfoRequestToken = 0;

  const packageKey = (pkg: ScoopPackage | null) => (pkg ? `${pkg.name}::${pkg.source}` : null);

  const loadPackageInfo = async (
    pkg: ScoopPackage,
    options?: {
      replaceSelectedPackage?: boolean;
      resetInfo?: boolean;
    }
  ) => {
    const requestToken = ++activeInfoRequestToken;
    const replaceSelectedPackage = options?.replaceSelectedPackage ?? false;
    const resetInfo = options?.resetInfo ?? true;

    if (replaceSelectedPackage) {
      setSelectedPackage(pkg);
    }
    setLoading(true);
    setError(null);
    if (resetInfo) {
      setInfo(null);
    }

    try {
      const infoResponse = await invoke<ScoopInfo>('get_package_info', {
        packageName: pkg.name,
        bucket: pkg.source,
      });
      if (requestToken !== activeInfoRequestToken) {
        return;
      }
      setInfo(infoResponse);
    } catch (err) {
      if (requestToken !== activeInfoRequestToken) {
        return;
      }
      setError(String(err));
    } finally {
      if (requestToken === activeInfoRequestToken) {
        setLoading(false);
      }
    }
  };

  const fetchPackageInfo = async (pkg: ScoopPackage) => {
    if (packageKey(selectedPackage()) === packageKey(pkg)) {
      closeModal();
      return;
    }

    await loadPackageInfo(pkg, {
      replaceSelectedPackage: true,
      resetInfo: true,
    });
  };

  const refreshSelectedPackageInfo = async (pkg?: ScoopPackage | null) => {
    const targetPackage = pkg ?? selectedPackage();
    if (!targetPackage) {
      return;
    }

    await loadPackageInfo(targetPackage, {
      replaceSelectedPackage: false,
      resetInfo: false,
    });
  };

  const closeModal = () => {
    setSelectedPackage(null);
    setInfo(null);
    setLoading(false);
    setError(null);
  };

  const updateSelectedPackage = (pkg: ScoopPackage) => {
    // Only update if it's the same package (by name + bucket)
    if (packageKey(selectedPackage()) === packageKey(pkg)) {
      setSelectedPackage(pkg);
    }
  };

  const syncSelectedPackage = (packages: ScoopPackage[]) => {
    const currentSelected = selectedPackage();
    if (!currentSelected) {
      return null;
    }

    const matchedPackage =
      packages.find((pkg) => packageKey(pkg) === packageKey(currentSelected)) ?? null;

    if (matchedPackage) {
      setSelectedPackage(matchedPackage);
    }

    return matchedPackage;
  };

  return {
    selectedPackage,
    info,
    loading,
    error,
    fetchPackageInfo,
    refreshSelectedPackageInfo,
    closeModal,
    updateSelectedPackage,
    syncSelectedPackage,
  };
}
