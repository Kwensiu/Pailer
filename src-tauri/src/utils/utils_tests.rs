use super::{get_installed_package_bucket, locate_current_install_dir};
use std::fs;
use tempfile::tempdir;

#[test]
fn reads_bucket_from_current_install_dir() {
    let temp_dir = tempdir().expect("temp dir");
    let scoop_dir = temp_dir.path();
    let install_dir = scoop_dir.join("apps").join("firefox").join("current");
    fs::create_dir_all(&install_dir).expect("create install dir");
    fs::write(
        install_dir.join("install.json"),
        r#"{ "bucket": "spc" }"#,
    )
    .expect("write install json");

    assert_eq!(
        get_installed_package_bucket(scoop_dir, "firefox"),
        Some("spc".to_string())
    );
}

#[test]
fn falls_back_to_latest_version_dir_when_current_is_missing() {
    let temp_dir = tempdir().expect("temp dir");
    let scoop_dir = temp_dir.path();
    let package_dir = scoop_dir.join("apps").join("firefox");
    let old_dir = package_dir.join("149.0");
    let new_dir = package_dir.join("149.0.2");

    fs::create_dir_all(&old_dir).expect("create old dir");
    fs::create_dir_all(&new_dir).expect("create new dir");
    fs::write(old_dir.join("install.json"), r#"{ "bucket": "extras" }"#)
        .expect("write old install json");
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(new_dir.join("install.json"), r#"{ "bucket": "spc" }"#)
        .expect("write new install json");

    let located_dir =
        locate_current_install_dir(scoop_dir, "firefox").expect("locate current install dir");
    assert_eq!(located_dir, new_dir);
    assert_eq!(
        get_installed_package_bucket(scoop_dir, "firefox"),
        Some("spc".to_string())
    );
}
