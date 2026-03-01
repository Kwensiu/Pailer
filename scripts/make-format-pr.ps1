# scripts/make-format-pr.ps1

# 1. Collect all changed files compared to origin/develop (staged + unstaged)
$files = git diff --name-only origin/develop | ForEach-Object {
    $filePath = $_.Trim()
    if (Test-Path $filePath) {
        return $filePath
    }
}

# 2. Add untracked files
$untrackedFiles = git ls-files --others --exclude-standard | ForEach-Object {
    $filePath = $_.Trim()
    if (Test-Path $filePath) {
        return $filePath
    }
}

# 3. Combine and filter by extensions
$allFiles = ($files + $untrackedFiles) | Where-Object { $_ -match '\.(js|ts|jsx|tsx|json|css|scss|md|html|vue|solid)$' } | Select-Object -Unique

# 4. Execute Prettier once for all files
if ($allFiles) {
    Write-Host "Formatting all changed files compared to origin/develop..." -ForegroundColor Cyan
    # Passing the array directly to npx prettier
    npx prettier --write $allFiles
} else {
    Write-Host "No changed files detected to format." -ForegroundColor Yellow
}
