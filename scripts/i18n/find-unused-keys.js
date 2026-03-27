import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base locale directory
const localesDir = path.join(__dirname, '..', '..', 'src', 'locales');

// Get all locale files (.json)
function getLocaleFiles() {
  const files = fs.readdirSync(localesDir);
  return files.filter((file) => file.endsWith('.json')).map((file) => path.join(localesDir, file));
}

// Base locale file (assume en.json as base)
const baseLocalePath = path.join(localesDir, 'en.json');
const allLocalePaths = getLocaleFiles();

// Source root directory
const srcRoot = path.join(__dirname, '..', '..', 'src');

// Also scan Rust source directory
const rustSrcRoot = path.join(__dirname, '..', '..', 'src-tauri', 'src');

// Recursively flatten object to dot-separated keys
function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// Delete nested key from object
function deleteNestedKey(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      return false; // Path does not exist
    }
    current = current[keys[i]];
  }
  delete current[keys[keys.length - 1]];
  return true;
}

// Get list of source files
function getSourceFiles(dirs, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  function walk(currentDir, exts) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, exts);
      } else if (exts.includes(path.extname(fullPath))) {
        files.push(fullPath);
      }
    }
  }
  dirs.forEach((dir) => walk(dir, extensions));
  return files;
}

// Check if key is used in file
function isKeyUsed(key, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const isRust = filePath.endsWith('.rs');
  const isTypeDefinition = filePath.endsWith('dict-types.ts') || filePath.includes('types');

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedKey = escapeRegExp(key);
  const keyParts = key.split('.');
  const baseKey = keyParts[0];
  const quotePairPattern = (prefix, suffix = '') =>
    new RegExp(String.raw`${prefix}\(\s*(['\"])${escapedKey}\1${suffix}`);

  if (isRust) {
    // For Rust files, search for JSON property access like get("key") or ["key"]
    return content.includes(`get("${key}")`) || content.includes(`["${key}"]`);
  } else if (isTypeDefinition) {
    // Skip type definition files - they only contain type annotations, not actual usage
    return false;
  } else {
    // For TypeScript/JavaScript files, check for common usage patterns

    // Exact translation function calls: t('a.b.c') / t("a.b.c")
    const tCallPattern = quotePairPattern('\\bt', '\\s*[),]');

    // Dictionary-style access: dict['a.b.c'] / dict["a.b.c"]
    const dictAccessPattern = new RegExp(String.raw`\bdict\s*\.\s*${escapedKey}\b`);
    const dictBracketPattern = new RegExp(String.raw`\bdict\s*\[\s*(['\"])${escapedKey}\1\s*\]`);

    // Common error handling / logging patterns
    const setErrorPattern = quotePairPattern('\\bsetError');

    // Fallback: exact quoted/template literal appearance for known metadata fields.
    // This catches keys stored as menu / tab / label metadata values (e.g. labelKey: 'app.doctor').
    const metadataKeyPattern = new RegExp(
      String.raw`\b(?:labelKey|labelkey|titleKey|titlekey|descriptionKey|descriptionkey|key|textKey|textkey)\s*[:=]\s*(['\"])${escapedKey}\1`
    );

    // Known dynamic families: allow only the explicitly supported cases.
    const hasCheckupItemsPattern =
      key.startsWith('doctor.checkup.items.') &&
      (content.includes('doctor.checkup.items.${') ||
        content.includes("doctor.checkup.items.' +") ||
        (content.includes('items.') && content.includes('displayKey') && content.includes('t(')));

    const hasDynamicSubKey =
      content.includes(`t(\`${baseKey}.\${`) ||
      content.includes(`t('${baseKey}.' +`) ||
      content.includes(`t("${baseKey}." +`);

    const hasTemplateLiteralPattern =
      content.includes(`\`${baseKey}.\${`) && content.includes('t(');

    return (
      tCallPattern.test(content) ||
      dictAccessPattern.test(content) ||
      dictBracketPattern.test(content) ||
      setErrorPattern.test(content) ||
      metadataKeyPattern.test(content) ||
      hasCheckupItemsPattern ||
      hasDynamicSubKey ||
      hasTemplateLiteralPattern
    );
  }
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function
async function findUnusedKeys() {
  try {
    const baseData = JSON.parse(fs.readFileSync(baseLocalePath, 'utf-8'));
    const flattened = flatten(baseData);
    const allKeys = Object.keys(flattened);

    const tsFiles = getSourceFiles([srcRoot], ['.ts', '.tsx', '.js', '.jsx']);
    const rsFiles = getSourceFiles([rustSrcRoot], ['.rs']);
    const sourceFiles = tsFiles.concat(rsFiles);
    const usedKeys = new Set();

    for (const file of sourceFiles) {
      for (const key of allKeys) {
        if (isKeyUsed(key, file)) {
          usedKeys.add(key);
        }
      }
    }

    let unusedKeys = allKeys.filter((key) => !usedKeys.has(key));

    // Exclude backend-used keys (e.g., tray section used in Rust)
    unusedKeys = unusedKeys.filter(
      (key) => !key.startsWith('settings.tray.') && !key.startsWith('settings.bucketAutoUpdate.')
    );

    console.log('Unused keys:');
    unusedKeys.forEach((key) => console.log(`- ${key}`));
    console.log(`\nFound ${unusedKeys.length} unused keys.`);

    if (unusedKeys.length === 0) {
      rl.close();
      return;
    }

    const answer = await new Promise((resolve) => {
      rl.question('Do you want to delete these unused keys? (y/n): ', resolve);
    });

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      // Load all locale data
      const localeDataMap = {};
      for (const localePath of allLocalePaths) {
        const lang = path.basename(localePath, '.json');
        localeDataMap[lang] = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
      }

      let deletedCount = 0;
      for (const key of unusedKeys) {
        let keyDeleted = false;
        for (const lang in localeDataMap) {
          if (deleteNestedKey(localeDataMap[lang], key)) {
            keyDeleted = true;
          }
        }
        if (keyDeleted) {
          deletedCount++;
        }
      }

      // Write back all locale files
      for (const localePath of allLocalePaths) {
        const lang = path.basename(localePath, '.json');
        fs.writeFileSync(localePath, JSON.stringify(localeDataMap[lang], null, 2), 'utf-8');
      }

      console.log(`${deletedCount} keys deleted from all locale files.`);
    } else {
      console.log('No keys deleted.');
    }

    rl.close();
  } catch (error) {
    console.error('Detection failed:', error.message);
    rl.close();
  }
}

findUnusedKeys();
