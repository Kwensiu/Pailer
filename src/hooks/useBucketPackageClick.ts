import { ScoopPackage } from '../types/scoop';

/**
 * Create a temporary ScoopPackage object for displaying package info
 * This is used when clicking on packages in bucket manifests that may not be installed
 */
export function createTemporaryPackage(packageName: string, bucketName: string): ScoopPackage {
  return {
    name: packageName,
    version: '', // Will be fetched by package info
    source: bucketName,
    updated: '', // Will be fetched by package info
    is_installed: false, // Will be determined by package info
    info: '', // Will be fetched by package info
    match_source: 'name',
    available_version: undefined,
    installation_type: 'standard',
    has_multiple_versions: false,
  };
}

/**
 * Handle package click from bucket manifests
 * Creates a temporary package object and opens package info modal
 */
export async function handleBucketPackageClick(
  packageName: string,
  bucketName: string,
  fetchPackageInfo: (pkg: ScoopPackage) => Promise<void>,
  closeBucketModal?: () => void,
  installedPackages?: ScoopPackage[] // Optional list of installed packages to check
) {
  // Check if package is already installed
  const installedPkg = installedPackages?.find((p) => p.name === packageName);

  // Create package object with correct installation status
  const pkg: ScoopPackage = installedPkg || {
    name: packageName,
    version: '', // Will be fetched by package info
    source: bucketName,
    updated: '', // Will be fetched by package info
    is_installed: !!installedPkg,
    info: '', // Will be fetched by package info
    match_source: 'name',
    available_version: undefined,
    installation_type: 'standard',
    has_multiple_versions: false,
  };

  // Fetch package info (this will open the PackageInfoModal)
  await fetchPackageInfo(pkg);

  // Optionally close the bucket modal (for InstalledPage behavior)
  if (closeBucketModal) {
    closeBucketModal();
  }
}
