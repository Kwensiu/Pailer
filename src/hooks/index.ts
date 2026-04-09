// UI related
export {
  createMenuTabNavigation,
  createMenuFocusManagement,
  clearTabbedState,
} from './ui/useTabNav';
export { createMenuCloseHandlers } from './ui/useCloseHandlers';
export { useMultiConfirmAction as useConfirmAction } from './ui/useConfirmAction';
export { useContextMenuState } from './ui/useContextMenuState';
export {
  isRunning,
  isTerminal,
  isSuccessful,
  primaryAction,
  primaryButtonVariant,
} from './ui/useOperationSelectors';

// Storage related
export * from './storage/createLocalStorageSignal';
export * from './storage/createSessionStorage';
export * from './storage/createTauriSignal';

// Package management related
export { useInstalledPackages } from './packages/useInstalled';
export { usePackageInfo } from './packages/usePackageInfo';
export { usePackageOperations } from './packages/usePackageOps';
export { usePackageIcons } from './packages/usePackageIcons';
export { useVersionFetch } from './packages/useVersionFetch';

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
export { useBulkBucketUpdate } from './buckets/useBulkBucketUpdate';
export type { SearchableBucket } from './buckets/useBucketSearch';
export type { BulkUpdateResult, BulkUpdateState } from './buckets/useBulkBucketUpdate';

// Global functionality
export { useGlobalHotkey, useGlobalSearchHotkey } from './global/useGlobalHotkey';

// Type exports
export type { BucketInfo } from './buckets/useBuckets';
