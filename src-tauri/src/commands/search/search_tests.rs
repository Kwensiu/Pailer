use super::collect_candidate_buckets;
use std::fs;
use tempfile::tempdir;

#[test]
fn collects_candidate_buckets_from_root_and_nested_bucket_dirs() {
    let temp_dir = tempdir().expect("temp dir");
    let buckets_dir = temp_dir.path().join("buckets");
    fs::create_dir_all(buckets_dir.join("alpha").join("bucket")).expect("alpha bucket dir");
    fs::create_dir_all(buckets_dir.join("beta")).expect("beta dir");
    fs::create_dir_all(buckets_dir.join("gamma").join("bucket")).expect("gamma bucket dir");

    fs::write(
        buckets_dir.join("alpha").join("bucket").join("firefox.json"),
        "{}",
    )
    .expect("write alpha manifest");
    fs::write(buckets_dir.join("beta").join("firefox.json"), "{}").expect("write beta manifest");
    fs::write(
        buckets_dir.join("gamma").join("bucket").join("not-firefox.json"),
        "{}",
    )
    .expect("write gamma manifest");

    let candidates = collect_candidate_buckets(&buckets_dir, "firefox").expect("collect candidates");

    assert_eq!(candidates, vec!["alpha".to_string(), "beta".to_string()]);
}
