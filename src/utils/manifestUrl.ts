/**
 * Utility functions for constructing GitHub manifest URLs
 */

/**
 * Validate package name to prevent malicious URL construction
 * @param name - Package name to validate
 * @returns True if the package name is safe to use
 */
function isValidPackageName(name: string): boolean {
  // Package names should only contain alphanumeric characters, dots, hyphens, and underscores
  // This prevents path traversal and other URL injection attacks
  return /^[a-zA-Z0-9._-]+$/.test(name) && !name.includes('..');
}

/**
 * Build GitHub manifest file URL
 * @param gitUrl - Git repository URL
 * @param packageName - Package name
 * @param branch - Git branch name (defaults to 'master')
 * @returns Full GitHub URL to the manifest file, or null if gitUrl is not provided
 */
export function buildManifestFileUrl(
  gitUrl: string | null | undefined,
  packageName: string,
  branch?: string | null
): string | null {
  if (!gitUrl || !isValidPackageName(packageName)) return null;
  const baseUrl = gitUrl.replace(/\.git$/, '');
  const resolvedBranch = detectDefaultBranch(branch);
  return `${baseUrl}/blob/${resolvedBranch}/bucket/${packageName}.json`;
}

/**
 * Build GitHub manifest commit history URL
 * @param gitUrl - Git repository URL
 * @param packageName - Package name
 * @param branch - Git branch name (defaults to 'master')
 * @returns Full GitHub URL to the manifest commit history, or null if gitUrl is not provided
 */
export function buildManifestCommitUrl(
  gitUrl: string | null | undefined,
  packageName: string,
  branch?: string | null
): string | null {
  if (!gitUrl || !isValidPackageName(packageName)) return null;
  const baseUrl = gitUrl.replace(/\.git$/, '');
  const resolvedBranch = detectDefaultBranch(branch);
  return `${baseUrl}/commits/${resolvedBranch}/bucket/${packageName}.json`;
}

/**
 * Detect the likely default branch from git URL or bucket info
 * Modern GitHub repos use 'main', older ones use 'master'
 * @param bucketBranch - Branch from bucket info (if available)
 * @returns The branch name to use
 */
export function detectDefaultBranch(bucketBranch?: string | null): string {
  if (bucketBranch && bucketBranch.trim()) {
    return bucketBranch;
  }
  return 'master';
}
