import { createSignal, onCleanup } from 'solid-js';
import { t } from '../../i18n';
import type { BucketInfo } from '../buckets/useBuckets';
import { searchCacheManager } from './useSearchCache';

interface CachedBucketInfo {
  info: BucketInfo;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

export function useSearchBucketInfo(
  getBucketInfo: (bucketName: string) => Promise<BucketInfo | null>
) {
  const [selectedBucket, setSelectedBucket] = createSignal<string | null>(null);
  const [bucketInfo, setBucketInfo] = createSignal<BucketInfo | null>(null);
  const [bucketInfoLoading, setBucketInfoLoading] = createSignal(false);
  const [bucketInfoError, setBucketInfoError] = createSignal<string | null>(null);

  const bucketInfoCache = new Map<string, CachedBucketInfo>();
  let currentBucketController: AbortController | null = null;

  const abortBucketRequest = () => {
    if (currentBucketController) {
      currentBucketController.abort();
      currentBucketController = null;
    }
  };

  const trimCache = () => {
    if (bucketInfoCache.size < MAX_CACHE_SIZE) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    bucketInfoCache.forEach((value, key) => {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      bucketInfoCache.delete(oldestKey);
    }
  };

  const handleViewBucket = async (bucketName: string) => {
    abortBucketRequest();

    const cached = bucketInfoCache.get(bucketName);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSelectedBucket(bucketName);
      setBucketInfoLoading(false);
      setBucketInfoError(null);
      setBucketInfo(cached.info);
      return;
    }

    trimCache();

    setSelectedBucket(bucketName);
    setBucketInfoLoading(true);
    setBucketInfo(null);
    setBucketInfoError(null);

    currentBucketController = new AbortController();
    const { signal } = currentBucketController;

    try {
      const info = await getBucketInfo(bucketName);
      if (signal.aborted) return;

      if (info) {
        setBucketInfo(info);
        bucketInfoCache.set(bucketName, { info, timestamp: Date.now() });
      } else {
        setBucketInfoError(t('search.bucketInfo.notFound'));
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error('Failed to get bucket info:', error);
      setBucketInfoError(t('search.bucketInfo.loadFailed'));
    } finally {
      if (!signal.aborted) {
        setBucketInfoLoading(false);
        currentBucketController = null;
      }
    }
  };

  const closeBucketModal = () => {
    abortBucketRequest();
    setSelectedBucket(null);
    setBucketInfo(null);
    setBucketInfoError(null);
  };

  const unsubscribe = searchCacheManager.subscribe(() => {
    bucketInfoCache.clear();
  });

  onCleanup(() => {
    unsubscribe();
    abortBucketRequest();
  });

  return {
    selectedBucket,
    bucketInfo,
    bucketInfoLoading,
    bucketInfoError,
    handleViewBucket,
    closeBucketModal,
  };
}
