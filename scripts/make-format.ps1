# scripts/format-staged.ps1

# 1. Collect all changed/new files
$files = git status --porcelain | ForEach-Object {
    $line = $_
    if ($line -match '^.[AMRC?]|^[AMRC?].') {
        $filePath = $line.Substring(3).Trim()
        if ($filePath -match ' -> ') {
            $filePath = ($filePath -split ' -> ')[1]
        }
        if (Test-Path $filePath) {
            return $filePath
        }
    }
} | Where-Object { $_ -match '\.(js|ts|jsx|tsx|json|css|scss|md|html|vue|solid)$' } | Select-Object -Unique

# 2. Execute Prettier once for all files
if ($files) {
    Write-Host "Formatting all uncommitted changes..." -ForegroundColor Cyan
    # Passing the array directly to npx prettier
    npx prettier --write $files
} else {
    Write-Host "No changes detected to format." -ForegroundColor Yellow
}