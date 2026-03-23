// UI related
export {
  createMenuTabNavigation,
  createMenuFocusManagement,
  clearTabbedState,
} from './ui/useTabNav';
export { createMenuCloseHandlers } from './ui/useCloseHandlers';
export { useMultiConfirmAction as useConfirmAction } from './ui/useConfirmAction';

// Storage related
export { createLocalStorageSignal } from './storage/createLocalStorageSignal';
export {
  createSessionCache as createSessionStorage,
  invalidateCache,
} from './storage/createSessionStorage';
export { createTauriSignal } from './storage/createTauriSignal';

// Package management related
export { useInstalledPackages } from './packages/useInstalled';
export { usePackageInfo } from './packages/usePackageInfo';
export { usePackageOperations } from './packages/usePackageOps';

// Search related
export { useSearch } from './search/useSearch';
export { useSearchCache, searchCacheManager, localStorageUtils } from './search/useSearchCache';

// Bucket related
export {
  useBuckets,
  updateBucketsCache,
  clearManifestCache,
  getManifestCache,
  setManifestCache,
  createTemporaryPackage,
  handleBucketPackageClick,
} from './buckets/useBuckets';
export { useBucketInstall } from './buckets/useBucketInstall';
export { useBucketSearch } from './buckets/useBucketSearch';
export type { SearchableBucket } from './buckets/useBucketSearch';

// Global functionality
export { useGlobalHotkey, useGlobalSearchHotkey } from './global/useGlobalHotkey';

// Type exports
export type { BucketInfo } from './buckets/useBuckets';
