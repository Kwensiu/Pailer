# Release Notes

## [1.6.1] - 2026-02-18

### Fixed
- **Startup Registry Cleanup**: Improved startup registry entry management to ensure complete cleanup during uninstallation
- **Path Normalization**: Fixed path comparison issues in auto-start detection by normalizing path separators
- **Error Handling**: Unified error handling across startup management functions for better reliability
- **Factory Reset**: Enhanced factory reset to include uninstall registry keys cleanup
- **Compilation Warning**: Removed duplicate windows_subsystem attribute to fix build warnings

### Improved
- **Scoop Integration**: Added complete Scoop bucket manifest for proper package management
- **Data Persistence**: Improved data persistence configuration for better user experience
- **Uninstallation**: Complete cleanup of registry entries and user data

This release focuses on bug fixes for startup management, improved Scoop integration, and enhanced uninstallation cleanup.

## [1.6.0] - 2026-02-18

### Added
- **AES Encryption**: Implemented AES encryption for VirusTotal API key storage to enhance security
- **Cache Clearing Logic**: Added cache clearing functionality and improved internationalization support

### Changed
- **Core Refactoring**: 
  - Renamed `createStoredSignal` to `createTauriSignal` for better naming consistency
  - Simplified AboutSection update system
  - Extracted command execution state to operations store
  - Unified bucket date formatting logic
- **UI/UX Improvements**:
  - Optimized installed packages page user experience
  - Persisted Scoop config in localStorage to prevent doctor page flickering
- **Internationalization**: Enhanced i18n support across the application

### Fixed
- **OperationModal Display**: Ensured OperationModal displays properly for cleanup commands
- **Version Comparison**: Fixed semantic version comparison in auto cleanup functionality

This release focuses on security enhancements, core refactoring for better maintainability, and improved user experience through UI optimizations and bug fixes.
