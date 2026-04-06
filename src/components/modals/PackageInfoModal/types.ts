import type { ScoopPackage, ScoopInfo, VersionedPackageInfo } from '../../../types/scoop';

export interface PackageRunEntry {
  name: string;
}

export interface PackageInfoModalProps {
  pkg?: ScoopPackage | null;
  info?: ScoopInfo | null;
  loading?: boolean;
  error?: string | null;
  autoShowVersions?: boolean;
  hasVersions?: (packageName: string) => boolean;
  onClose: () => void;
  onInstall?: (pkg: ScoopPackage) => void;
  onUninstall?: (pkg: ScoopPackage) => void;
  onUpdate?: (pkg: ScoopPackage) => void;
  onForceUpdate?: (pkg: ScoopPackage) => void;
  onChangeBucket?: (pkg: ScoopPackage) => void;
  onPackageStateChanged?: () => void;
  showBackButton?: boolean;
  context?: 'installed' | 'search';
  onBucketClick?: (bucketName: string) => void;
  bucketGitUrl?: string | null;
  bucketGitBranch?: string | null;
}

export type { VersionedPackageInfo };
