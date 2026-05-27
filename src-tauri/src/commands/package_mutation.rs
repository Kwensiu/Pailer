use crate::commands::installed::{get_installed_package_state, invalidate_installed_cache};
use crate::commands::powershell::{CommandResult, FinalStatus};
use crate::commands::search::invalidate_manifest_cache;
use crate::models::ScoopPackage;
use crate::state::AppState;
use serde::Serialize;
use tauri::{Emitter, Runtime, State, Window};

pub const EVENT_PACKAGE_MUTATION_FINISHED: &str = "package-mutation-finished";
pub const EVENT_INSTALLED_PACKAGES_CHANGED: &str = "installed-packages-changed";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageMutationFinishedEvent {
    #[serde(flatten)]
    pub result: CommandResult,
    pub package_name: String,
    pub package_source: Option<String>,
    pub package_state: Option<ScoopPackage>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackagesChangedEvent {
    pub reason: String,
    pub operation_id: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackageMutationKind {
    Install,
    Update,
    ForceUpdate,
    Uninstall,
}

impl PackageMutationKind {
    fn operation_name(self, package_name: &str) -> String {
        match self {
            Self::Install => format!("Installing {}", package_name),
            Self::Update => format!("Updating {}", package_name),
            Self::ForceUpdate => format!("Force updating {}", package_name),
            Self::Uninstall => format!("Uninstalling {}", package_name),
        }
    }

    fn should_invalidate_manifest_cache(self) -> bool {
        matches!(self, Self::Install | Self::Uninstall)
    }

    fn should_resolve_final_package_state(self) -> bool {
        !matches!(self, Self::Uninstall)
    }
}

pub async fn finalize_single_package_mutation(
    window: &Window,
    state: State<'_, AppState>,
    kind: PackageMutationKind,
    package_name: &str,
    package_source_hint: Option<&str>,
    operation_id: String,
) {
    if kind.should_invalidate_manifest_cache() {
        invalidate_manifest_cache().await;
    }
    invalidate_installed_cache(state.clone()).await;

    let package_state = if kind.should_resolve_final_package_state() {
        let scoop_path = state.scoop_path();
        match get_installed_package_state(&scoop_path, package_name) {
            Ok(package_state) => package_state,
            Err(error) => {
                log::warn!(
                    "Failed to resolve final package state for '{}': {}",
                    package_name,
                    error
                );
                None
            }
        }
    } else {
        None
    };

    let package_source = package_state
        .as_ref()
        .map(|pkg| pkg.source.clone())
        .or_else(|| package_source_hint.map(|source| source.to_string()));

    let _ = window.emit(
        EVENT_PACKAGE_MUTATION_FINISHED,
        PackageMutationFinishedEvent {
            result: CommandResult {
                success: true,
                operation_id,
                operation_name: kind.operation_name(package_name),
                error_count: None,
                warning_count: None,
                final_status: FinalStatus::Success,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            },
            package_name: package_name.to_string(),
            package_source,
            package_state,
        },
    );
}

pub fn emit_installed_packages_changed<R: Runtime>(
    emitter: &impl Emitter<R>,
    reason: &str,
    operation_id: Option<String>,
) {
    let _ = emitter.emit(
        EVENT_INSTALLED_PACKAGES_CHANGED,
        InstalledPackagesChangedEvent {
            reason: reason.to_string(),
            operation_id,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::PackageMutationKind;

    #[test]
    fn operation_name_matches_existing_labels() {
        assert_eq!(
            PackageMutationKind::Install.operation_name("git"),
            "Installing git"
        );
        assert_eq!(
            PackageMutationKind::Update.operation_name("git"),
            "Updating git"
        );
        assert_eq!(
            PackageMutationKind::ForceUpdate.operation_name("git"),
            "Force updating git"
        );
        assert_eq!(
            PackageMutationKind::Uninstall.operation_name("git"),
            "Uninstalling git"
        );
    }

    #[test]
    fn manifest_cache_invalidation_is_limited_to_manifest_changing_mutations() {
        assert!(PackageMutationKind::Install.should_invalidate_manifest_cache());
        assert!(PackageMutationKind::Uninstall.should_invalidate_manifest_cache());
        assert!(!PackageMutationKind::Update.should_invalidate_manifest_cache());
        assert!(!PackageMutationKind::ForceUpdate.should_invalidate_manifest_cache());
    }

    #[test]
    fn final_package_state_is_not_resolved_after_uninstall() {
        assert!(PackageMutationKind::Install.should_resolve_final_package_state());
        assert!(PackageMutationKind::Update.should_resolve_final_package_state());
        assert!(PackageMutationKind::ForceUpdate.should_resolve_final_package_state());
        assert!(!PackageMutationKind::Uninstall.should_resolve_final_package_state());
    }
}
