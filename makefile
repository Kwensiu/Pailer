# Detect OS
ifeq ($(OS),Windows_NT)
    PLATFORM := windows
else
    PLATFORM := linux
endif

.PHONY: help i18n bump format format-pr check all

# Default target
help:
	@echo "Pailer Project Development Commands:"
	@echo "  make all          - Run i18n, format-pr, and check (full workflow)"
	@echo "  make i18n         - Sync locales and generate dict types"
	@echo "  make bump v=x.y.z [pre=pre-id] [commit=1] [tag=1] [push=1] [dry_run=1] - Bump project version (updates package.json, Cargo.toml, tauri.conf.json)"
	@echo "  make format       - Format (un)staged files only"
	@echo "  make format-pr    - Format all files in the project"
	@echo "  make check        - Check TypeScript formatting for all files"

# 1. Locale Processing
i18n:
	@node scripts/i18n/generate-dict-types.js

# 2. Versioning
bump:
	@node scripts/bump-version.js $(v) $(if $(pre),--pre $(pre)) $(if $(commit),--commit) $(if $(tag),--tag) $(if $(push),--push) $(if $(dry_run),--dry-run)

# 3. Smart Formatting (Staged + Modified + Untracked)
format:
ifeq ($(PLATFORM),windows)
	@powershell -ExecutionPolicy Bypass -File scripts/make-format.ps1
else
	@# Linux: Collect all changed/new files and filter by extensions
	@echo -e "\033[36mFormatting all uncommitted changes...\033[0m"
	@git status --porcelain | grep -E '^.[AMRC?]|^[AMRC?].' | sed -E 's/^.{3}//;s/.* -> //' | while IFS= read -r file; do \
		if [ -f "$$file" ] && echo "$$file" | grep -qE '\.(js|ts|jsx|tsx|json|css|scss|md|html|vue|solid)$$'; then \
			echo "$$file"; \
		fi \
	done | xargs -r npx prettier --write || echo -e "\033[33mNo changes detected to format.\033[0m"
endif

# 4. Full Project Formatting
format-pr:
ifeq ($(PLATFORM),windows)
	@powershell -ExecutionPolicy Bypass -File scripts/make-format-pr.ps1
else
	@npx prettier --write .
endif

# 5. Full Workflow (i18n + format-pr + check)
all: i18n format-pr check

# 6. Full Check
check:
ifeq ($(PLATFORM),windows)
	@powershell -Command "Write-Host 'Start TypeScript and Prettier check...' -ForegroundColor Cyan"
	@powershell -Command "Write-Host 'Checking TypeScript types...'"
	@npx tsc --noEmit
	@npx prettier --check .
else
	@echo -e "\033[36mStart TypeScript and Prettier check...\033[0m"
	@echo -e "Checking TypeScript types..."
	@npx tsc --noEmit
	@npx prettier --check .
endif