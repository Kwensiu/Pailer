use crate::models::ScoopPackage;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock as StdRwLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock as AsyncRwLock};

#[derive(Clone)]
pub struct InstalledPackagesCache {
    pub packages: Vec<ScoopPackage>,
    pub fingerprint: String,
    pub cached_at_ms: u64,
}

#[derive(Clone, Debug)]
pub struct PackageVersionsCache {
    pub fingerprint: String,
    pub versions_map: HashMap<String, Vec<String>>,
}

#[derive(Clone)]
pub struct LnkSourceIndexCache {
    pub cache_key: String,
    pub index: HashMap<String, crate::commands::package_icon::ResolvedPackageIconSource>,
}

/// Shared application state managed by Tauri.
pub struct AppState {
    /// The resolved path to the Scoop installation directory.
    scoop_path: StdRwLock<PathBuf>,
    /// Whether Scoop is properly configured
    scoop_configured: StdRwLock<bool>,
    /// A cache for the list of installed packages and their fingerprint.
    pub installed_packages: Mutex<Option<InstalledPackagesCache>>,
    /// A cache for package versions, invalidated when installed packages change
    pub package_versions: Mutex<Option<PackageVersionsCache>>,
    /// A cache for LNK shortcut index used for icon resolution
    pub lnk_source_index: AsyncRwLock<Option<LnkSourceIndexCache>>,
    /// Timestamp (ms) of the last installed packages refresh to prevent rapid consecutive calls
    last_refresh_time: AtomicU64,
}

impl AppState {
    /// Creates new application state with the provided Scoop root path.
    pub fn new(initial_scoop_path: PathBuf, configured: bool) -> Self {
        Self {
            scoop_path: StdRwLock::new(initial_scoop_path),
            scoop_configured: StdRwLock::new(configured),
            installed_packages: Mutex::new(None),
            package_versions: Mutex::new(None),
            lnk_source_index: AsyncRwLock::new(None),
            last_refresh_time: AtomicU64::new(0),
        }
    }

    /// Returns the current Scoop root path stored in the application state.
    pub fn scoop_path(&self) -> PathBuf {
        self.scoop_path.read().unwrap().clone()
    }

    /// Updates the Scoop root path stored in the application state.
    ///
    /// Returns whether the path changed. When it does, path-dependent caches
    /// are cleared so later reads cannot reuse data from the old Scoop root.
    pub async fn set_scoop_path(&self, new_path: PathBuf) -> bool {
        let changed = {
            let mut current_path = self.scoop_path.write().unwrap();
            if *current_path == new_path {
                false
            } else {
                *current_path = new_path;
                true
            }
        };

        if changed {
            *self.installed_packages.lock().await = None;
            *self.package_versions.lock().await = None;
            *self.lnk_source_index.write().await = None;
        }

        changed
    }

    /// Updates the Scoop configuration status
    pub fn set_scoop_configured(&self, configured: bool) {
        *self.scoop_configured.write().unwrap() = configured;
    }

    /// Returns whether Scoop has a configured root path.
    pub fn is_scoop_configured(&self) -> bool {
        *self.scoop_configured.read().unwrap()
    }

    /// Gets the timestamp of the last installed packages refresh in milliseconds
    pub fn last_refresh_time(&self) -> u64 {
        self.last_refresh_time.load(Ordering::Relaxed)
    }

    /// Updates the timestamp of the last installed packages refresh
    pub fn update_refresh_time(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        self.last_refresh_time.store(now, Ordering::Relaxed);
    }

    /// Checks if a refresh should be debounced (less than 1 second since last refresh)
    pub fn should_debounce_refresh(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let last_refresh = self.last_refresh_time();

        // If last_refresh is 0, it's the first run, so don't debounce
        if last_refresh == 0 {
            return false;
        }

        now.saturating_sub(last_refresh) < 1000 // Debounce within 1 second
    }

    pub fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::{AppState, InstalledPackagesCache, LnkSourceIndexCache, PackageVersionsCache};
    use crate::models::ScoopPackage;
    use std::collections::HashMap;
    use std::path::PathBuf;

    #[tokio::test]
    async fn set_scoop_path_clears_path_dependent_caches_on_change() {
        let state = AppState::new(PathBuf::from("C:\\scoop-old"), true);
        seed_path_caches(&state).await;

        let changed = state.set_scoop_path(PathBuf::from("D:\\scoop-new")).await;

        assert!(changed);
        assert_eq!(state.scoop_path(), PathBuf::from("D:\\scoop-new"));
        assert!(state.installed_packages.lock().await.is_none());
        assert!(state.package_versions.lock().await.is_none());
        assert!(state.lnk_source_index.read().await.is_none());
    }

    #[tokio::test]
    async fn set_scoop_path_keeps_caches_when_path_is_unchanged() {
        let state = AppState::new(PathBuf::from("C:\\scoop"), true);
        seed_path_caches(&state).await;

        let changed = state.set_scoop_path(PathBuf::from("C:\\scoop")).await;

        assert!(!changed);
        assert!(state.installed_packages.lock().await.is_some());
        assert!(state.package_versions.lock().await.is_some());
        assert!(state.lnk_source_index.read().await.is_some());
    }

    async fn seed_path_caches(state: &AppState) {
        *state.installed_packages.lock().await = Some(InstalledPackagesCache {
            packages: vec![ScoopPackage {
                name: "example".to_string(),
                ..Default::default()
            }],
            fingerprint: "fingerprint".to_string(),
            cached_at_ms: AppState::now_ms(),
        });

        *state.package_versions.lock().await = Some(PackageVersionsCache {
            fingerprint: "fingerprint".to_string(),
            versions_map: HashMap::from([("example".to_string(), vec!["1.0.0".to_string()])]),
        });

        *state.lnk_source_index.write().await = Some(LnkSourceIndexCache {
            cache_key: "shortcuts".to_string(),
            index: HashMap::new(),
        });
    }
}
