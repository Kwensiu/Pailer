// Central data model definitions shared across commands and services.
// By placing them in a dedicated module we reduce cross-module coupling and
// make the types easier to test.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// -----------------------------------------------------------------------------
// MatchSource
// -----------------------------------------------------------------------------
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MatchSource {
    Name,
    Binary,
    None,
}

impl Default for MatchSource {
    fn default() -> Self {
        MatchSource::None
    }
}

// -----------------------------------------------------------------------------
// Installation Types
// -----------------------------------------------------------------------------
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InstallationType {
    /// Standard installation from main/extras buckets
    Standard,
    /// Versioned installation from 'versions' bucket
    Versioned,
    /// Custom installation from 'Custom' bucket
    Custom,
}

impl Default for InstallationType {
    fn default() -> Self {
        InstallationType::Standard
    }
}

// -----------------------------------------------------------------------------
// ScoopPackage
// -----------------------------------------------------------------------------
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default)]
pub struct ScoopPackage {
    pub name: String,
    pub version: String,
    pub source: String,
    pub updated: String,
    pub is_installed: bool,
    pub info: String,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub match_source: MatchSource,
    /// Installation type based on bucket source
    #[serde(default)]
    pub installation_type: InstallationType,
    /// Whether the app has multiple version directories (technical state)
    #[serde(default)]
    pub has_multiple_versions: bool,
}

// -----------------------------------------------------------------------------
// SearchResult
// -----------------------------------------------------------------------------
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct SearchResult {
    pub packages: Vec<ScoopPackage>,
    pub is_cold: bool,
}

// -----------------------------------------------------------------------------
// BucketInfo
// -----------------------------------------------------------------------------
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BucketInfo {
    pub name: String,
    pub path: String,
    pub manifest_count: u32,
    pub is_git_repo: bool,
    pub git_url: Option<String>,
    pub git_branch: Option<String>,
    pub last_updated: Option<String>,
}

// -----------------------------------------------------------------------------
// Status Types
// -----------------------------------------------------------------------------
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppStatusInfo {
    pub name: String,
    pub installed_version: String,
    pub latest_version: Option<String>,
    pub missing_dependencies: Vec<String>,
    pub info: Vec<String>,
    pub is_outdated: bool,
    pub is_failed: bool,
    pub is_held: bool,
    pub is_deprecated: bool,
    pub is_removed: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScoopStatus {
    pub scoop_needs_update: bool,
    pub bucket_needs_update: bool,
    pub network_failure: bool,
    pub apps_with_issues: Vec<AppStatusInfo>,
    pub is_everything_ok: bool,
}

// -----------------------------------------------------------------------------
// Manifest Types (from installed.rs)
// -----------------------------------------------------------------------------
#[derive(Deserialize, Debug, Clone, Default)]
pub struct PackageManifest {
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

fn default_version() -> String {
    "unknown".to_string()
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct InstallManifest {
    pub bucket: Option<String>,
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/// Parses the notes field from a JSON value, handling different data types.
/// Notes can be a string, array of strings, or any other JSON value.
pub fn parse_notes_field(json: &Value) -> Option<String> {
    json.get("notes").map(|value| match value {
        Value::Array(arr) => arr
            .iter()
            .map(|v| {
                if let Some(s) = v.as_str() {
                    s.to_string()
                } else {
                    v.to_string().trim_matches('"').to_string()
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        Value::String(s) => s.to_string(),
        _ => value.to_string().trim_matches('"').to_string(),
    })
}
