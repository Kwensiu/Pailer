# I18N Architecture

This document describes the internationalization (i18n) architecture for Pailer.

## Overview

Pailer uses a streamlined i18n system:
- **Frontend**: SolidJS with `@solid-primitives/i18n` for UI translations
- **Backend**: Minimal tray string cache synchronized from frontend

## File Structure

```
src/
├── locales/
│   ├── en.json          # English translations (source of truth)
│   └── zh.json          # Chinese translations
├── i18n.ts              # Frontend i18n initialization and management
└── stores/settings.ts   # Settings store (includes language preference)

src-tauri/src/
├── i18n.rs              # Backend tray string cache
└── tray.rs              # Tray menu with localized strings
```

## Architecture Principles

1. **Single Source of Truth**: All translations live in `src/locales/*.json`
2. **Frontend-Driven**: Language detection and initialization happens in frontend
3. **Minimal Backend**: Backend only caches tray strings, reads language from settings
4. **No File Duplication**: No locale files copied to backend resources

## How It Works

### Frontend Initialization Flow

1. **Detect Language** (`src/i18n.ts`):
   - Check `settings.language` in settings store
   - If not found, detect system language via `navigator.language`
   - Fall back to `en` if system language not supported

2. **Load Locale**:
   - Dynamically import appropriate locale file
   - Flatten nested JSON for efficient lookup
   - Send tray strings to backend cache

3. **Save to Settings**:
   - Write detected/selected language to settings store
   - Settings store persists to `settings.json`

4. **Usage in Components**:
   ```tsx
   import { t } from './i18n';
   <h1>{t('app.title')}</h1>
   ```

### Backend Tray Strings

1. **Cache Update** (`src-tauri/src/i18n.rs`):
   - Frontend calls `update_backend_tray_strings` with tray section
   - Stored in static `HashMap<String, Value>`
   - Fallback to English defaults if cache miss

2. **Tray Menu Build** (`src-tauri/src/tray.rs`):
   - Read language from `settings.language`
   - Call `get_tray_locale_strings(language)`
   - Build menu with localized strings

3. **Language Change**:
   - Frontend updates settings
   - Sends new tray strings to backend
   - Tray menu auto-refreshes via settings change listener

## Settings Storage

Language is stored in `settings.json` as:
```json
{
  "settings": {
    "language": "en",
    "scoopPath": "...",
    ...
  }
}
```

**Important**: Only nested structure is used. No flat keys like `"settings.language"`.

## Adding a New Language

### Step 1: Create Locale File

Create `src/locales/[code].json` (e.g., `fr.json`):
```json
{
  "app": {
    "title": "Pailer",
    "buckets": "Dépôts"
  },
  "settings": {
    "tray": {
      "show": "Afficher Pailer",
      "quit": "Quitter"
    }
  }
}
```

### Step 2: Update Supported Locales

In `src/i18n.ts`:
```typescript
const SUPPORTED_LOCALES = ['en', 'zh', 'fr'] as const;
```

In `src/stores/settings.ts`:
```typescript
const supportedLocales = ['en', 'zh', 'fr'];
```

### Step 3: Translate

Copy structure from `en.json` and translate all strings. Use the i18n scripts to find missing keys:
```bash
node scripts/i18n/find-unused-keys.js
```

## Translation Key Structure

Use nested JSON for organization:
```json
{
  "app": { "title": "..." },
  "settings": {
    "title": "...",
    "tray": {
      "show": "...",
      "quit": "..."
    }
  }
}
```

Frontend access: `t('app.title')`, `t('settings.tray.show')`

Backend tray strings must be under `settings.tray.*`

## Language Detection Logic

```
1. Check settings.language
   ↓ (if not found)
2. Detect navigator.language
   ↓ (if not supported)
3. Fall back to 'en'
   ↓
4. Load locale file
   ↓
5. Save to settings
```

## Testing

### Frontend
- Change language in Settings > Language
- Verify UI updates immediately
- Check `settings.json` has correct nested structure

### Backend Tray
- Right-click tray icon
- Verify menu items are localized
- Change language and verify tray updates

### Fallback
- Remove language from settings
- Verify system language detection works
- Verify English fallback for unsupported languages

## Common Issues

### Duplicate Language Keys
**Problem**: `settings.json` has both `"settings.language"` and `"settings": {"language": ...}`

**Solution**: This implementation only uses nested structure. Old flat keys are ignored.

### Tray Not Updating
**Problem**: Tray menu shows old language after change

**Solution**: Ensure `update_backend_tray_strings` is called when locale loads (automatic in `src/i18n.ts`)

### Missing Translations
**Problem**: Some strings show keys instead of translations

**Solution**: Check console for warnings. Add missing keys to locale files.

## Maintenance Guidelines

### For Translators
- Only edit files in `src/locales/`
- Maintain same JSON structure across all languages
- Test in UI before committing

### For Developers
- Add new keys to `en.json` first
- Update all other locale files
- Use `t()` function, never hardcode strings
- Tray strings must be under `settings.tray.*`

### For Future i18n Work
- Supported locales defined in two places (keep in sync)
- Frontend drives language selection
- Backend is passive (reads from settings, uses cache)
- No build-time file copying needed
- **No File Copying**: Eliminated manual/automatic file synchronization
- **Auto Sync**: Frontend automatically updates backend cache
- **Memory Efficient**: Only cache necessary tray data
- **Backward Compatible**: Existing `t()` usage unchanged

```
src/
├── i18n.ts              # Frontend i18n system
└── locales/             # Only locale files location
    ├── en.json
    └── zh.json

src-tauri/src/
├── i18n.rs              # Backend cache and IPC commands
└── tray.rs              # Uses cached locale strings
```

### Migration Notes

- Removed all temporary files with suffixes
- Standard naming: `i18n.ts` and `i18n.rs`
- No build-time locale copying required
- Works in both dev and production environments

### Technical Specifications

- **Cache Strategy**: In-memory HashMap with Arc<Mutex<>> for thread safety
- **IPC Commands**: `update_backend_locale_cache`, `clear_backend_locale_cache`
- **Fallback**: Built-in default English strings for all tray elements
- **Performance**: Cache hit eliminates repeated IPC calls
