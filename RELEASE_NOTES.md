# Release Notes 1.5.6

## [1.5.6] - 2025-02-10

Features:

feat: implement auto-cleanup feature for settings page
- Resolve display and interaction issues when components are minimized
- Add MultiInstanceWarning component to alert users of concurrent operations
- Include CSS styles for minimized indicators in src/styles/minimized-indicator.css
- Add localization strings for warnings and buttons in src/locales/
- Add dotted notation support for nested settings access in get_config_value
- Auto-cleanup now triggers after package install/update/uninstall operations
- Supports cleaning old versions (with configurable preserve count) and cache