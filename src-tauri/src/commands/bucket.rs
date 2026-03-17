//! Command for managing Scoop buckets - repositories containing package manifests.
use crate::models::BucketInfo;
use crate::state::AppState;
use crate::utils;
use git2::Repository;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Runtime, State};

/// Checks if a directory is a Git repository by looking for .git directory.
fn is_git_repo(path: &Path) -> bool {
    path.join(".git").exists()
}

/// Normalizes a branch name by removing remote prefixes
fn normalize_branch_name(name: &str) -> &str {
    if let Some(slash_pos) = name.find('/') {
        let prefix = &name[..slash_pos];
        if prefix == "origin" || prefix == "upstream" || prefix == "remotes" {
            return &name[slash_pos + 1..];
        }
        if prefix == "refs" {
            if let Some(second_slash) = name[slash_pos + 1..].find('/') {
                let full_prefix = &name[..slash_pos + 1 + second_slash];
                if full_prefix == "refs/remotes" || full_prefix == "refs/heads" {
                    if let Some(third_slash) = name[full_prefix.len() + 1..].find('/') {
                        return &name[full_prefix.len() + 1 + third_slash + 1..];
                    }
                    return &name[full_prefix.len() + 1..];
                }
            }
        }
    }
    name
}

/// Attempts to read Git repository information from the .git directory using git2.
fn get_git_info(bucket_path: &Path) -> (Option<String>, Option<String>) {
    let repo = match Repository::open(bucket_path) {
        Ok(r) => r,
        Err(_) => return (None, None),
    };

    let mut git_url = None;
    let mut git_branch = None;

    if let Ok(remote) = repo.find_remote("origin") {
        if let Some(url) = remote.url() {
            git_url = Some(url.to_string());
        }
    }

    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            git_branch = Some(normalize_branch_name(name).to_string());
        }
    }

    (git_url, git_branch)
}

/// Gets the last modified time of a bucket's bucket subdirectory.
fn get_last_updated(bucket_path: &Path) -> Option<String> {
    let bucket_subdir = bucket_path.join("bucket");
    
    if bucket_subdir.is_dir() {
        fs::metadata(&bucket_subdir)
            .and_then(|m| m.modified())
            .map(|t| {
                use chrono::{DateTime, Utc};
                DateTime::<Utc>::from(t)
                    .format("%Y-%m-%d %H:%M:%S UTC")
                    .to_string()
            })
            .ok()
    } else {
        fs::metadata(bucket_path)
            .and_then(|m| m.modified())
            .map(|t| {
                use chrono::{DateTime, Utc};
                DateTime::<Utc>::from(t)
                    .format("%Y-%m-%d %H:%M:%S UTC")
                    .to_string()
            })
            .ok()
    }
}

/// Loads information for a single bucket from its directory.
fn load_bucket_info(bucket_path: &Path) -> Result<BucketInfo, String> {
    let bucket_name = bucket_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Invalid bucket directory name: {:?}", bucket_path))?
        .to_string();

    if !bucket_path.is_dir() {
        return Err(format!("Bucket path is not a directory: {:?}", bucket_path));
    }

    let manifest_count = utils::count_manifests(bucket_path);
    let is_git_repo = is_git_repo(bucket_path);
    let (git_url, git_branch) = if is_git_repo {
        get_git_info(bucket_path)
    } else {
        (None, None)
    };
    let last_updated = get_last_updated(bucket_path);

    Ok(BucketInfo {
        name: bucket_name,
        path: bucket_path.to_string_lossy().to_string(),
        manifest_count,
        is_git_repo,
        git_url,
        git_branch,
        last_updated,
    })
}

/// Fetches a list of all Scoop buckets by scanning the buckets directory.
#[tauri::command]
pub async fn get_buckets<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<Vec<BucketInfo>, String> {
    log::info!("Fetching Scoop buckets from filesystem");

    let buckets_path = state.scoop_path().join("buckets");

    if !buckets_path.is_dir() {
        log::warn!(
            "Scoop buckets directory does not exist at: {}",
            buckets_path.display()
        );
        return Ok(vec![]);
    }

    let bucket_dirs = fs::read_dir(&buckets_path)
        .map_err(|e| format!("Failed to read buckets directory: {}", e))?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .collect::<Vec<_>>();

    let mut buckets = Vec::new();

    for entry in bucket_dirs {
        let path = entry.path();
        match load_bucket_info(&path) {
            Ok(bucket) => buckets.push(bucket),
            Err(e) => {
                log::warn!("Skipping bucket at '{}': {}", path.display(), e);
            }
        }
    }

    log::info!("Found {} buckets", buckets.len());
    Ok(buckets)
}

/// Gets detailed information about a specific bucket.
#[tauri::command]
pub async fn get_bucket_info<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    bucket_name: String,
) -> Result<BucketInfo, String> {
    log::info!("Getting info for bucket: {}", bucket_name);

    let bucket_path = state.scoop_path().join("buckets").join(&bucket_name);

    if !bucket_path.exists() {
        return Err(format!("Bucket '{}' does not exist", bucket_name));
    }

    load_bucket_info(&bucket_path)
}

/// Lists all manifest files in a specific bucket.
#[tauri::command]
pub async fn get_bucket_manifests<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    bucket_name: String,
) -> Result<Vec<String>, String> {
    log::info!("Getting manifests for bucket: {}", bucket_name);

    let bucket_path = state.scoop_path().join("buckets").join(&bucket_name);

    if !bucket_path.exists() {
        return Err(format!("Bucket '{}' does not exist", bucket_name));
    }

    let mut manifests = Vec::new();

    if let Ok(entries) = fs::read_dir(&bucket_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if !file_stem.starts_with('.') && file_stem != "bucket" {
                        manifests.push(format!("{} (root)", file_stem));
                    }
                }
            }
        }
    }

    let bucket_subdir = bucket_path.join("bucket");
    if bucket_subdir.is_dir() {
        if let Ok(entries) = fs::read_dir(bucket_subdir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                        manifests.push(file_stem.to_string());
                    }
                }
            }
        }
    }

    manifests.sort();
    log::info!(
        "Found {} manifests in bucket '{}'",
        manifests.len(),
        bucket_name
    );
    Ok(manifests)
}

/// Fetches all available branches for a git bucket.
#[tauri::command]
pub async fn get_bucket_branches<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    bucket_name: String,
) -> Result<Vec<String>, String> {
    log::info!("Getting branches for bucket: {}", bucket_name);

    let bucket_path = state.scoop_path().join("buckets").join(&bucket_name);

    if !bucket_path.exists() {
        return Err(format!("Bucket '{}' does not exist", bucket_name));
    }

    let repo = match Repository::open(&bucket_path) {
        Ok(r) => r,
        Err(e) => return Err(format!("Failed to open git repository: {}", e)),
    };

    if let Ok(mut remote) = repo.find_remote("origin") {
        let mut callbacks = git2::RemoteCallbacks::new();
        callbacks.credentials(|_url, username_from_url, allowed_types| {
            if allowed_types.contains(git2::CredentialType::USERNAME) {
                git2::Cred::username("git")
            } else if allowed_types.contains(git2::CredentialType::SSH_KEY) {
                let username = username_from_url.unwrap_or("git");
                git2::Cred::ssh_key_from_agent(username)
            } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
                git2::Cred::default()
            } else {
                git2::Cred::default()
            }
        });

        let mut fetch_options = git2::FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        if let Err(e) = remote.fetch(&[] as &[&str], Some(&mut fetch_options), None) {
            log::warn!("Failed to fetch from remote: {}, continuing with local branches", e);
        } else {
            log::info!("Successfully fetched latest branches from remote");
        }
    }

    let mut branches = Vec::new();

    let references = match repo.references() {
        Ok(refs) => refs,
        Err(e) => return Err(format!("Failed to get references: {}", e)),
    };

    for reference_result in references {
        if let Ok(reference) = reference_result {
            if let Some(name) = reference.name() {
                if name.starts_with("refs/heads/") {
                    let branch_name = &name[11..];
                    if branch_name != "HEAD" {
                        branches.push(branch_name.to_string());
                    }
                } else if name.starts_with("refs/remotes/origin/") {
                    let branch_name = &name[20..];
                    if branch_name != "HEAD" && !branches.contains(&branch_name.to_string()) {
                        branches.push(branch_name.to_string());
                    }
                }
            }
        }
    }

    branches.sort();
    branches.dedup();
    
    log::info!(
        "Found {} branches for bucket '{}': {:?}",
        branches.len(),
        bucket_name,
        branches
    );
    Ok(branches)
}

/// Switches to a different branch for a git bucket.
#[tauri::command]
pub async fn switch_bucket_branch<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    bucket_name: String,
    branch_name: String,
) -> Result<String, String> {
    log::info!("Switching bucket '{}' to branch '{}'", bucket_name, branch_name);

    let bucket_path = state.scoop_path().join("buckets").join(&bucket_name);

    if !bucket_path.exists() {
        return Err(format!("Bucket '{}' does not exist", bucket_name));
    }

    let repo = match Repository::open(&bucket_path) {
        Ok(r) => r,
        Err(e) => return Err(format!("Failed to open git repository: {}", e)),
    };

    let repo_status = match repo.statuses(None) {
        Ok(statuses) => statuses,
        Err(e) => return Err(format!("Failed to get repository status: {}", e)),
    };
    
    let has_changes = repo_status.iter().any(|entry| {
        entry.status() != git2::Status::CURRENT
    });
    
    if has_changes {
        log::warn!("Repository has uncommitted changes, switching branch may lose modifications");
        return Err("UNCOMMITTED_CHANGES".to_string());
    }

    let local_ref_name = format!("refs/heads/{}", branch_name);
    let remote_ref_name = format!("refs/remotes/origin/{}", branch_name);
    
    let (target_commit, is_remote_only) = match repo.find_reference(&local_ref_name) {
        Ok(local_ref) => {
            log::info!("Found local branch: {}", branch_name);
            let commit = local_ref.peel_to_commit()
                .map_err(|e| format!("Failed to get commit: {}", e))?;
            (commit, false)
        }
        Err(_) => {
            log::info!("Local branch not found, checking remote");
            match repo.find_reference(&remote_ref_name) {
                Ok(remote_ref) => {
                    log::info!("Found remote branch: {}", branch_name);
                    let commit = remote_ref.peel_to_commit()
                        .map_err(|e| format!("Failed to get commit: {}", e))?;
                    (commit, true)
                }
                Err(e) => return Err(format!("Branch '{}' not found: {}", branch_name, e)),
            }
        }
    };

    if is_remote_only {
        log::info!("Creating local tracking branch for remote branch '{}'", branch_name);
        repo.branch(&branch_name, &target_commit, false)
            .map_err(|e| format!("Failed to create local branch: {}", e))?;
    }

    repo.checkout_tree(&target_commit.as_object(), Some(git2::build::CheckoutBuilder::new().force()))
        .map_err(|e| format!("Failed to checkout tree: {}", e))?;

    repo.set_head(&local_ref_name)
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;

    log::info!("Successfully switched bucket '{}' to branch '{}'", bucket_name, branch_name);
    Ok(format!("Switched to branch '{}'", branch_name))
}
