import type { BucketInfo } from '../../../hooks/buckets/useBuckets';
import type { SearchableBucket } from '../../../hooks/buckets/useBucketSearch';

export interface BucketInfoModalProps {
  bucket: BucketInfo | null;
  bucketName?: string;
  manifests: string[];
  manifestsLoading: boolean;
  manifestsLoadingMore?: boolean;
  manifestsTotal?: number;
  manifestsHasMore?: boolean;
  loading?: boolean;
  error: string | null;
  searchBucket?: SearchableBucket;
  isInstalled?: boolean;
  installedBuckets?: BucketInfo[];
  onClose: () => void;
  onPackageClick?: (packageName: string, bucketName: string) => void;
  onBucketInstalled?: () => void;
  onFetchManifests?: (bucketName: string, query?: string) => Promise<void>;
  onLoadMoreManifests?: (bucketName: string, query?: string) => Promise<void>;
  onBucketUpdated?: (bucketName: string, newBranch?: string) => void;
  zIndex?: string;
  fromPackageModal?: boolean;
}
