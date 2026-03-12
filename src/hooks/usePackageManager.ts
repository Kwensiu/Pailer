import { useInstalledPackages } from './useInstalledPackages';
import { usePackageOperations } from './usePackageOperations';
import { usePackageInfo } from './usePackageInfo';
import { useBuckets } from './useBuckets';

/**
 * 组合 hook：为包管理页面提供所有必要的功能
 * 这是一个 convenience hook，避免在组件中重复调用多个相关 hooks
 */
export function usePackageManager() {
  const installedPackages = useInstalledPackages();
  const packageOperations = usePackageOperations();
  const packageInfo = usePackageInfo();
  const buckets = useBuckets();

  return {
    // 已安装包相关
    ...installedPackages,

    // 包操作相关
    ...packageOperations,

    // 包信息相关
    ...packageInfo,

    // 存储桶相关
    buckets: buckets.buckets,
    fetchBuckets: buckets.fetchBuckets,
    bucketLoading: buckets.loading,
    bucketError: buckets.error,
  };
}
