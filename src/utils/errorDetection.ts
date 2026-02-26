// PowerShell error patterns that should be highlighted as errors even when they appear in stdout
// These patterns are more specific to avoid false positives with info messages
export const PS_ERROR_PATTERNS = [
  'access to the path.*is denied',
  'permission denied',
  'cannot.*access',
  'failed.*with error',
  'error:',
  'error occurred',
  'terminate batch',
  'remove-item.*cannot',
  'command not found',
  'file not found',
  'network error',
  'connection failed',
  'unauthorized',
  'forbidden',
];

/**
 * Checks if a line contains PowerShell error patterns
 * @param line - The line to check for error patterns
 * @returns true if the line contains PowerShell error keywords
 */
export function hasPSError(line: string): boolean {
  const cleanLine = line.toLowerCase();

  // First check for explicit error patterns
  for (const pattern of PS_ERROR_PATTERNS) {
    if (cleanLine.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Additional context checks for ambiguous patterns
  // Look for common scoop info messages that might contain "error" but are actually info
  const knownInfoPatterns = [
    'installing',
    'checking hash',
    'downloaded',
    'extracting',
    'linking',
    'running installer script',
    'already installed',
    'is up to date',
    'manifests found',
    'updating',
    'uninstalling',
    'removing older version',
  ];

  // If the line contains known scoop info patterns, don't treat it as error even if it has "error"
  const hasInfoContext = knownInfoPatterns.some((pattern) =>
    cleanLine.includes(pattern.toLowerCase())
  );

  if (hasInfoContext) {
    return false;
  }

  // For remaining cases, check if "error" appears in a known false positive context
  const falsePositivePatterns = [
    'verifying error',
    'error checking', // Usually informational
    'no error',
    'without error',
    'error handling', // About error handling mechanism
  ];

  const isFalsePositive = falsePositivePatterns.some((pattern) =>
    cleanLine.includes(pattern.toLowerCase())
  );

  if (isFalsePositive) {
    return false;
  }

  return false;
}

/**
 * Determines if a line should be displayed as an error
 * @param line - The line to check
 * @param isStderr - Whether the line came from stderr stream
 * @returns true if the line should be displayed as an error
 */
export function isErrorLine(line: string, isStderr?: boolean): boolean {
  // If it's from stderr, it's likely an error but still do some filtering
  if (isStderr) {
    // Some stderr messages are actually warnings or info, not errors
    const stderrInfoPatterns = ['warning:', 'note:', 'info:'];

    const cleanLine = line.toLowerCase();
    const isStderrInfo = stderrInfoPatterns.some((pattern) =>
      cleanLine.startsWith(pattern.toLowerCase())
    );

    return !isStderrInfo;
  }

  // For stdout lines, use the enhanced detection
  return hasPSError(line);
}

/**
 * Enhanced error detection with context awareness
 * @param line - The line to check
 * @param previousLines - Previous lines for context (optional)
 * @param isStderr - Whether the line came from stderr stream
 * @returns true if the line should be displayed as an error
 */
export function isErrorLineWithContext(
  line: string,
  previousLines: string[] = [],
  isStderr?: boolean
): boolean {
  const basicCheck = isErrorLine(line, isStderr);

  // If basic check already says it's not an error, don't do further checks
  if (!basicCheck) {
    return false;
  }

  const cleanLine = line.toLowerCase();

  // Analyze previous lines for context patterns
  const recentContext = previousLines.slice(-5).join(' ').toLowerCase(); // Check last 5 lines

  // Context 1: If we're in an installation/update process and see error messages that are actually status updates
  const installationContext = [
    'installing',
    'extracting',
    'downloading',
    'checking',
    'verifying',
    'linking',
    'running',
  ];

  const isInInstallationProcess = installationContext.some((context) =>
    recentContext.includes(context)
  );

  // If we're in installation and this line looks like a status update, don't treat as error
  if (isInInstallationProcess) {
    const statusUpdatePatterns = [
      'error', // Might be part of "error checking", "no error found", etc.
      'failed', // Might be "failed to connect to cache" (normal)
      'cannot', // Might be "cannot remove temporary file" (normal cleanup)
    ];

    const isStatusUpdate = statusUpdatePatterns.some((pattern) => cleanLine.includes(pattern));

    // Additional check: if the line contains installation-related keywords, it's likely a status update
    const hasInstallationKeywords = [
      'hash',
      'download',
      'extract',
      'install',
      'cache',
      'temp',
      'version',
      'manifest',
    ].some((keyword) => cleanLine.includes(keyword));

    if (isStatusUpdate && hasInstallationKeywords) {
      return false;
    }
  }

  // Context 2: Check if this error follows a known success pattern
  const previousLine = previousLines[previousLines.length - 1]?.toLowerCase() || '';
  const successIndicators = ['successfully', 'completed', 'finished', 'done'];

  const followsSuccess = successIndicators.some((indicator) => previousLine.includes(indicator));

  if (followsSuccess) {
    // If it follows success, this "error" might be about cleanup or verification
    const cleanupPatterns = ['removing', 'cleaning', 'deleting'];

    const isCleanupRelated = cleanupPatterns.some((pattern) => cleanLine.includes(pattern));

    if (isCleanupRelated) {
      return false;
    }
  }

  // Context 3: Check if we're in a dependency resolution or update process
  const dependencyContext = ['dependency', 'update', 'upgrade', 'resolve', 'check'];

  const isInDependencyProcess = dependencyContext.some((context) =>
    recentContext.includes(context)
  );

  if (isInDependencyProcess) {
    // In dependency processes, some "errors" are actually expected behavior
    const expectedErrorPatterns = [
      'not found', // May be expected when checking optional dependencies
      'cannot find', // May be expected in version checks
      'missing', // May be expected for optional components
    ];

    const isExpectedError = expectedErrorPatterns.some((pattern) => cleanLine.includes(pattern));

    if (isExpectedError) {
      return false;
    }
  }

  // Context 4: Check if this is part of a multi-line error message where the first line is the real error
  const hasPreviousError = previousLines.some((prevLine) => isErrorLine(prevLine, isStderr));

  if (hasPreviousError) {
    // If we already have an error, subsequent lines with similar patterns might be stack traces
    // or continuation of the same error - we still want to show them as errors
    return true;
  }

  // If no context rules apply, fall back to the basic check
  return true;
}
