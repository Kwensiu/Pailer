#[cfg(windows)]
use super::model::{
    extract_package_name, has_multiple_installed_versions, has_stable_group_aumid,
    logical_identity, resolve_current_target_for_path, resolve_current_target_original_path,
    NotifyIconEntry,
};
#[cfg(windows)]
use super::{NotifyIconDedupePair, TrayMigrationRecord, TrayMigrationSnapshot};

#[cfg(windows)]
use std::collections::{HashMap, HashSet};

#[cfg(windows)]
fn group_entries_by_identity(
    entries: Vec<NotifyIconEntry>,
    prefixes: &[String],
) -> HashMap<String, Vec<NotifyIconEntry>> {
    let mut groups: HashMap<String, Vec<NotifyIconEntry>> = HashMap::new();
    for entry in entries {
        let Some(identity) = logical_identity(&entry.path_norm, prefixes) else {
            continue;
        };
        groups.entry(identity).or_default().push(entry);
    }
    groups
}

#[cfg(windows)]
pub(super) struct DedupePlan {
    pub failed: Vec<String>,
    pub pairs: Vec<NotifyIconDedupePair>,
}

#[cfg(windows)]
pub(super) struct MigrationPlan {
    pub rewrites: Vec<PathRewrite>,
    pub propagations: Vec<PromotionPropagation>,
    pub deletions: Vec<SubkeyDeletion>,
    pub skipped_multi_version: usize,
    pub failed: Vec<String>,
}

#[cfg(windows)]
pub(super) struct PathRewrite {
    pub subkey: String,
    pub path: String,
}

#[cfg(windows)]
pub(super) struct PromotionPropagation {
    pub subkey: String,
    pub value: u32,
}

#[cfg(windows)]
pub(super) struct SubkeyDeletion {
    pub subkey: String,
}

#[cfg(windows)]
pub(super) fn collect_tray_migration_records(
    entries: Vec<NotifyIconEntry>,
    prefixes: &[String],
    target_package: Option<&str>,
) -> Vec<TrayMigrationRecord> {
    let mut records = Vec::new();

    for entry in entries {
        let Some(package_name) = extract_package_name(&entry.path_norm, prefixes) else {
            continue;
        };
        if let Some(target_package) = target_package {
            if package_name != target_package {
                continue;
            }
        }
        let Some(identity) = logical_identity(&entry.path_norm, prefixes) else {
            continue;
        };
        records.push(TrayMigrationRecord {
            package_name,
            identity,
            subkey: entry.subkey,
            executable_path: entry.path,
            promoted: entry.promoted,
        });
    }

    records
}

#[cfg(windows)]
pub(super) fn build_dedupe_plan(
    entries: Vec<NotifyIconEntry>,
    prefixes: &[String],
    failed: Vec<String>,
) -> DedupePlan {
    let groups = group_entries_by_identity(entries, prefixes);

    let mut pairs = Vec::new();
    for (identity, group_entries) in groups {
        if group_entries.len() < 2 {
            continue;
        }
        if has_stable_group_aumid(&group_entries) {
            if cfg!(debug_assertions) {
                log::debug!(
                    "[notify_icon_settings][dedupe] skip identity={} reason=stable_aumid",
                    identity
                );
            }
            continue;
        }

        let keep_idx = group_entries.iter().enumerate().find_map(|(idx, entry)| {
            resolve_current_target_for_path(&entry.path_norm, prefixes)
                .filter(|current_target| current_target == &entry.path_norm)
                .map(|_| idx)
        });

        let Some(keep_idx) = keep_idx else {
            continue;
        };

        let keep = &group_entries[keep_idx];
        let fallback_promoted = group_entries
            .iter()
            .enumerate()
            .filter(|(idx, _)| *idx != keep_idx)
            .find_map(|(_, entry)| entry.promoted);
        let propagated = if keep.promoted.is_none() {
            fallback_promoted
        } else {
            None
        };

        for (idx, drop) in group_entries.iter().enumerate() {
            if idx == keep_idx {
                continue;
            }
            pairs.push(NotifyIconDedupePair {
                identity: identity.clone(),
                keep_subkey: keep.subkey.clone(),
                keep_path: keep.path.clone(),
                drop_subkey: drop.subkey.clone(),
                drop_path: drop.path.clone(),
                propagated_is_promoted: propagated,
            });
        }
    }

    DedupePlan { failed, pairs }
}

#[cfg(windows)]
pub(super) fn build_migration_plan(
    snapshot: &TrayMigrationSnapshot,
    entries: Vec<NotifyIconEntry>,
    scoop_root: &std::path::Path,
    prefixes: &[String],
    failed: Vec<String>,
) -> MigrationPlan {
    let by_identity = group_entries_by_identity(entries, prefixes);

    let mut rewrites = Vec::new();
    let mut propagations = Vec::new();
    let mut deletions = Vec::new();
    let mut skipped_multi_version = 0usize;
    let mut processed_identities: HashSet<String> = HashSet::new();

    for rec in &snapshot.records {
        if !processed_identities.insert(rec.identity.clone()) {
            continue;
        }
        let Some(group) = by_identity.get(&rec.identity) else {
            continue;
        };
        if has_stable_group_aumid(group) {
            if cfg!(debug_assertions) {
                log::debug!(
                    "[tray-migration] skip identity={} reason=stable_aumid",
                    rec.identity
                );
            }
            continue;
        }
        let Some(any_entry) = group.first() else {
            continue;
        };
        let Some(current_target_norm) =
            resolve_current_target_for_path(&any_entry.path_norm, prefixes)
        else {
            continue;
        };
        let current_target_raw =
            resolve_current_target_original_path(&any_entry.path_norm, prefixes)
                .unwrap_or_else(|| any_entry.path.clone());

        let keep_idx = group
            .iter()
            .position(|entry| entry.path_norm == current_target_norm)
            .unwrap_or(0);
        let keep_entry = &group[keep_idx];
        let identity_is_global = rec.identity.starts_with("global:");
        let fallback_promoted = group
            .iter()
            .enumerate()
            .filter(|(idx, _)| *idx != keep_idx)
            .find_map(|(_, entry)| entry.promoted)
            .or_else(|| {
                snapshot
                    .records
                    .iter()
                    .filter(|record| {
                        record.identity == rec.identity && record.subkey != keep_entry.subkey
                    })
                    .find_map(|record| record.promoted)
            });

        if snapshot.preserve_multi_version_installs
            && has_multiple_installed_versions(&scoop_root, &rec.package_name, identity_is_global)
        {
            skipped_multi_version += 1;
            if keep_entry.promoted.is_none() {
                if let Some(value) = fallback_promoted {
                    propagations.push(PromotionPropagation {
                        subkey: keep_entry.subkey.clone(),
                        value,
                    });
                }
            }
            continue;
        }

        if keep_entry.path_norm != current_target_norm {
            rewrites.push(PathRewrite {
                subkey: keep_entry.subkey.clone(),
                path: current_target_raw,
            });
        }
        if keep_entry.promoted.is_none() {
            if let Some(value) = fallback_promoted {
                propagations.push(PromotionPropagation {
                    subkey: keep_entry.subkey.clone(),
                    value,
                });
            }
        }

        for (idx, entry) in group.iter().enumerate() {
            if idx == keep_idx || entry.subkey == keep_entry.subkey {
                continue;
            }
            deletions.push(SubkeyDeletion {
                subkey: entry.subkey.clone(),
            });
        }
    }

    MigrationPlan {
        rewrites,
        propagations,
        deletions,
        skipped_multi_version,
        failed,
    }
}
