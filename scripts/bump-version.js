import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: node scripts/bump-version.js <new-version> [--pre <pre-id>] [--commit] [--tag] [--push] [--dry-run]');
  process.exit(1);
}

// Validate version format (basic)
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Version must be in format x.y.z');
  process.exit(1);
}

// Parse flags
let doCommit = false;
let doTag = false;
let doPush = false;
let preId = null;
let dryRun = false;
for (let i = 3; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--commit') doCommit = true;
  else if (arg === '--tag') doTag = true;
  else if (arg === '--push') doPush = true;
  else if (arg === '--dry-run') dryRun = true;
  else if (arg === '--pre') {
    if (i + 1 >= process.argv.length) {
      console.error('--pre requires a pre-release identifier');
      process.exit(1);
    }
    preId = process.argv[i + 1];
    i++; // skip next arg
  } else {
    console.error(`Unknown flag: ${arg}`);
    console.error('Usage: node scripts/bump-version.js <new-version> [--pre <pre-id>] [--commit] [--tag] [--push] [--dry-run]');
    process.exit(1);
  }
}

// Build full version
const fullVersion = preId ? `${newVersion}-${preId}` : newVersion;

// Update package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const oldPackageVersion = packageJson.version;
packageJson.version = fullVersion;
if (dryRun) {
  console.log(`[DRY RUN] Would update package.json version from ${oldPackageVersion} to ${fullVersion}`);
} else {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Updated package.json version to ${fullVersion}`);
}

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = "[^"]*"/m, `version = "${fullVersion}"`);
if (dryRun) {
  console.log(`[DRY RUN] Would update Cargo.toml version to ${fullVersion}`);
} else {
  fs.writeFileSync(cargoTomlPath, cargoToml);
  console.log(`Updated Cargo.toml version to ${fullVersion}`);
}

// Update tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
const oldTauriVersion = tauriConf.version;
tauriConf.version = fullVersion;
if (dryRun) {
  console.log(`[DRY RUN] Would update tauri.conf.json version from ${oldTauriVersion} to ${fullVersion}`);
} else {
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`Updated tauri.conf.json version to ${fullVersion}`);
}

console.log(dryRun ? 'Dry run completed successfully!' : 'Version bump completed successfully!');

// Perform Git operations if requested
if (doCommit || doTag || doPush) {
  console.log('Performing Git operations...');
  try {
    const filesToStage = [
      'package.json',
      'src-tauri/Cargo.toml',
      'src-tauri/tauri.conf.json'
    ];
    if (dryRun) {
      console.log(`[DRY RUN] Would run: git add ${filesToStage.join(' ')}`);
    } else {
      execSync(`git add ${filesToStage.join(' ')}`, { stdio: 'inherit' });
      console.log('Staged version files');
    }

    if (doCommit) {
      if (dryRun) {
        console.log(`[DRY RUN] Would run: git commit -m "Bump version to ${fullVersion}"`);
      } else {
        execSync(`git commit -m "Bump version to ${fullVersion}"`, { stdio: 'inherit' });
        console.log(`Committed with message: Bump version to ${fullVersion}`);
      }
    }

    if (doTag) {
      if (dryRun) {
        console.log(`[DRY RUN] Would run: git tag --force v${fullVersion}`);
      } else {
        execSync(`git tag --force v${fullVersion}`, { stdio: 'inherit' });
        console.log(`Created/updated tag v${fullVersion}`);
      }
    }

    if (doPush) {
      if (dryRun) {
        console.log(`[DRY RUN] Would run: git rev-parse --abbrev-ref HEAD`);
        console.log(`[DRY RUN] Assuming branch 'main', would run: git push origin main && git push --tags`);
      } else {
        const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        execSync(`git push origin ${branch}`, { stdio: 'inherit' });
        execSync('git push --tags', { stdio: 'inherit' });
        console.log(`Pushed branch ${branch} and tags to origin`);
      }
    }

    console.log('Git operations completed successfully!');
  } catch (error) {
    console.error('Git operation failed:', error.message);
    process.exit(1);
  }
}
