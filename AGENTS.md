# Pailer - Copilot Instructions

## Project Overview

Pailer is a Tauri + SolidJS desktop application providing a GUI for Scoop package manager.

Solution entry points:
- `src/App.tsx` - Main application component
- `src/index.tsx` - Application entry point

## Architecture

The codebase follows a feature-based folder structure:

- **`src/components/common/`** - Shared UI components (ContextMenu, Dropdown, Modal, etc.)
- **`src/components/common/contextmenu/`** - Context menu infrastructure (actions, types, renderer)
- **`src/components/page/`** - Page-level components (installed, search, buckets, settings, doctor)
- **`src/components/modals/`** - Reusable modal components
- **`src/hooks/`** - Custom SolidJS hooks organized by domain
- **`src/stores/`** - SolidJS stores for global state
- **`src/types/`** - TypeScript type definitions
- **`src/utils/`** - Utility functions
- **`src/locales/`** - i18n translation files (en.json, zh.json)

## Key Patterns

### Design Principles

- **YAGNI** - Only implement what is explicitly needed. Avoid speculative abstractions.
- **KISS** - Prefer simple, direct solutions over complex ones. Single-line fixes when sufficient.
- **Root cause** - Fix problems at their source, not symptoms. Avoid explicit workaround patches.

### Context Menu Architecture

Context menu functionality is centralized in `src/components/common/contextmenu/`:

- `actions.ts` - Shared menu action builders (`createBaseMenuItems`, `createInstallAction`, `createManifestAction`)
- `menuItems.ts` - Page-specific menu item factories (`createInstalledItems`, `createSearchItems`)
- `types.ts` - TypeScript interfaces for menu items
- `ContextMenu.tsx` - Core context menu component
- `ContextMenuRenderer.tsx` - Recursive menu item renderer

### Hooks Organization

Hooks are grouped by domain in `src/hooks/`:

- `ui/` - UI state management (useContextMenuState, useConfirmAction, useTabNav, useCloseHandlers)
- `packages/` - Package operations (useInstalled, usePackageInfo, usePackageOps, usePackageIcons)
- `buckets/` - Bucket management (useBuckets, useBucketInstall, useBucketSearch)
- `search/` - Search functionality (useSearch, useSearchCache)
- `storage/` - Storage utilities (createLocalStorageSignal, createSessionStorage, createTauriSignal)
- `global/` - Global features (useGlobalHotkey, useGlobalSearchHotkey)

### Stores

Global state managed via SolidJS stores in `src/stores/`:

- `installedPackagesStore.ts` - Installed packages state
- `operations.ts` - Package operations (install/update/uninstall)
- `settings.ts` - User settings
- `updateStore.ts` - Update checking state
- `held.ts` - Held packages state
- `versionedPackagesStore.ts` - Versioned packages state

### Naming Conventions

- Components: **PascalCase** (e.g., `PackageListView.tsx`)
- Hooks: **camelCase** with `use` prefix (e.g., `useContextMenuState`)
- Stores: camelCase with `Store` suffix (e.g., `installedPackagesStore`)
- Types/Interfaces: **PascalCase** (e.g., `InstalledCbs`)
- Menu item factory functions: `createXxxItems` (e.g., `createInstalledItems`)

### i18n

- Use `t('key.path')` for translations
- Shared context menu keys under `buttons.contextMenu.*`
- Page-specific keys under respective sections (e.g., `installed.list.*`)

## Build & Run

```shell
# Development
pnpm dev

# Build
pnpm build

# Tauri development
pnpm tauri:dev

# Tauri build
pnpm tauri:build

# i18n generation
pnpm i18n

# Format
pnpm format
```

## Key Files

| Purpose | Path |
|---------|------|
| Main app | `src/App.tsx` |
| Context menu actions | `src/components/common/contextmenu/actions.ts` |
| Menu item factories | `src/components/common/contextmenu/menuItems.ts` |
| Context menu state hook | `src/hooks/ui/useContextMenuState.ts` |
| Installed packages store | `src/stores/installedPackagesStore.ts` |
| Package operations | `src/stores/operations.ts` |
| Hooks barrel | `src/hooks/index.ts` |
| Locales | `src/locales/en.json`, `src/locales/zh.json` |
