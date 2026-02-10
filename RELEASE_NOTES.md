# Release Notes 1.5.8

## [1.5.8] - 2026-02-11

### Features
- **feat: refactor system tray with customizable shortcuts and i18n support**
  - Refactor tray module: Extract i18n logic to dedicated i18n.rs module for better separation of concerns
  - Add customizable tray shortcuts: Allow users to configure which Scoop apps appear in system tray context menu
  - Add trayAppsEnabled setting to control tray app functionality
  - Implement tray.appsList configuration for user-selected applications
  - Add comprehensive i18n support for tray menu items in both English and Chinese
  - Fix tray icon left-click behavior to properly restore minimized windows

### Performance Improvements
- Optimize settings API performance by reducing unnecessary clones
- Improve error handling and logging throughout tray functionality

### Code Quality
- Extract localization logic to dedicated i18n.rs module
- Clean up code duplication and improve maintainability
- Sync locale files to Tauri resources directory for proper packaging

### Breaking Changes
- Tray menu localization now requires locale files in resources directory
- Tray apps configuration uses new settings structure