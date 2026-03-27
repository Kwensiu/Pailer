import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ts from 'typescript';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const localesDir = path.join(__dirname, '..', '..', 'src', 'locales');
const baseLocalePath = path.join(localesDir, 'en.json');
const allLocalePaths = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => path.join(localesDir, file));

const srcRoot = path.join(__dirname, '..', '..', 'src');
const rustSrcRoot = path.join(__dirname, '..', '..', 'src-tauri', 'src');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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

function deleteNestedKey(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      return false;
    }
    current = current[keys[i]];
  }
  delete current[keys[keys.length - 1]];
  return true;
}

function getSourceFiles(dirs, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  const walk = (currentDir, exts) => {
    for (const item of fs.readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, exts);
      } else if (exts.includes(path.extname(fullPath))) {
        files.push(fullPath);
      }
    }
  };
  dirs.forEach((dir) => walk(dir, extensions));
  return files;
}

function groupKeysByNamespace(keys) {
  const groups = new Map();
  for (const key of keys) {
    const namespace = key.split('.')[0] || '(root)';
    if (!groups.has(namespace)) {
      groups.set(namespace, []);
    }
    groups.get(namespace).push(key);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function collectExactMentionsFromTsFile(filePath, keysSet) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const mentionedKeys = new Set();

  for (const key of keysSet) {
    if (content.includes(key)) {
      mentionedKeys.add(key);
    }
  }

  return mentionedKeys;
}

function isMetadataFieldName(name) {
  return /^(labelKey|labelkey|titleKey|titlekey|descriptionKey|descriptionkey|key|textKey|textkey)$/i.test(
    name
  );
}

function collectUsagesFromTsFile(filePath, keysSet) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const usedKeys = new Set();

  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = node.text;
      if (keysSet.has(value)) {
        const parent = node.parent;

        if (
          ts.isPropertyAssignment(parent) &&
          ts.isIdentifier(parent.name) &&
          isMetadataFieldName(parent.name.text)
        ) {
          usedKeys.add(value);
        }

        if (ts.isCallExpression(parent)) {
          const callee = parent.expression.getText(sourceFile);
          if (
            callee === 't' ||
            callee.endsWith('.t') ||
            callee === 'setError' ||
            callee.endsWith('.setError')
          ) {
            usedKeys.add(value);
          }
        }
      }
    }

    if (ts.isTemplateExpression(node)) {
      const fullText = node.getText(sourceFile);
      for (const key of keysSet) {
        // Stricter boundary checking to avoid substring matching false positives
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const strictMatch = new RegExp(`\\b${escapedKey}\\b`);

        if (strictMatch.test(fullText)) {
          usedKeys.add(key);
          continue;
        }

        // Special handling for doctor.checkup.items.* dynamic patterns
        if (
          key.startsWith('doctor.checkup.items.') &&
          (fullText.includes('doctor.checkup.items.${') || fullText.includes('displayKey'))
        ) {
          usedKeys.add(key);
        }

        // Check if used as error message in setError calls
        if (fullText.includes('setError(') && fullText.includes(key)) {
          // Further verify if actually passed as parameter
          const setErrorMatch = new RegExp(`setError\\s*\\([^,]*['"\`]${escapedKey}['"\`]`);
          if (setErrorMatch.test(fullText)) {
            usedKeys.add(key);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return usedKeys;
}

async function findUnusedKeys() {
  try {
    const baseData = JSON.parse(fs.readFileSync(baseLocalePath, 'utf-8'));
    const flattened = flatten(baseData);
    const allKeys = Object.keys(flattened);
    const keysSet = new Set(allKeys);

    const tsFiles = getSourceFiles([srcRoot], ['.ts', '.tsx', '.js', '.jsx']);
    const rsFiles = getSourceFiles([rustSrcRoot], ['.rs']);
    const sourceFiles = tsFiles.concat(rsFiles);

    const usedKeys = new Set();
    const mentionedKeys = new Set();

    for (const file of sourceFiles) {
      if (file.endsWith('.rs')) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const key of allKeys) {
          if (content.includes(`get("${key}")`) || content.includes(`["${key}"]`)) {
            usedKeys.add(key);
          }
          if (content.includes(key)) {
            mentionedKeys.add(key);
          }
        }
        continue;
      }

      const fileUsedKeys = collectUsagesFromTsFile(file, keysSet);
      for (const key of fileUsedKeys) {
        usedKeys.add(key);
      }

      const fileMentionedKeys = collectExactMentionsFromTsFile(file, keysSet);
      for (const key of fileMentionedKeys) {
        mentionedKeys.add(key);
      }
    }

    let unusedKeys = allKeys.filter((key) => !usedKeys.has(key));
    unusedKeys = unusedKeys.filter(
      (key) => !key.startsWith('settings.tray.') && !key.startsWith('settings.bucketAutoUpdate.')
    );

    const clearlyUnusedKeys = unusedKeys.filter((key) => !mentionedKeys.has(key));
    const possiblyUnusedKeys = unusedKeys.filter((key) => mentionedKeys.has(key));

    console.log('Unused keys (categorized):');

    console.log(`\n[Clearly Unused] (${clearlyUnusedKeys.length})`);
    clearlyUnusedKeys.sort((a, b) => a.localeCompare(b)).forEach((key) => console.log(`- ${key}`));

    console.log(`\n[Possibly Unused] (${possiblyUnusedKeys.length})`);
    possiblyUnusedKeys.sort((a, b) => a.localeCompare(b)).forEach((key) => console.log(`- ${key}`));

    if (possiblyUnusedKeys.length > 0) {
      console.log(
        '\nNote: Possibly Unused keys appear in source text but were not confirmed by AST usage patterns.'
      );
    }
    console.log(`\nFound ${unusedKeys.length} unused keys.`);

    if (unusedKeys.length === 0) {
      rl.close();
      return;
    }

    const answer = await new Promise((resolve) => {
      rl.question('Delete clearly unused keys only? (y/n): ', resolve);
    });

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      const localeDataMap = {};
      for (const localePath of allLocalePaths) {
        const lang = path.basename(localePath, '.json');
        localeDataMap[lang] = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
      }

      let deletedCount = 0;
      for (const key of clearlyUnusedKeys) {
        let keyDeleted = false;
        for (const lang in localeDataMap) {
          if (deleteNestedKey(localeDataMap[lang], key)) {
            keyDeleted = true;
          }
        }
        if (keyDeleted) deletedCount++;
      }

      for (const localePath of allLocalePaths) {
        const lang = path.basename(localePath, '.json');
        fs.writeFileSync(localePath, JSON.stringify(localeDataMap[lang], null, 2), 'utf-8');
      }

      console.log(`${deletedCount} clearly unused keys deleted from all locale files.`);
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
