import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base locale file path (en.json)
const baseLocalePath = path.join(__dirname, '..', '..', 'src', 'locales', 'en.json');

// Recursively generate interface string
function generateInterface(obj, indent = '') {
  let result = '';
  for (const [key, value] of Object.entries(obj)) {
    // Check if key needs quotes
    const needsQuotes = !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
    const quotedKey = needsQuotes ? `"${key}"` : key;
    if (needsQuotes) {
      console.warn(`Warning: Key "${key}" may be invalid TypeScript identifier, quotes added.`);
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object
      result += `${indent}${quotedKey}: {\n${generateInterface(value, indent + '  ')}${indent}};\n`;
    } else {
      // String or function type (assuming string or template function)
      result += `${indent}${quotedKey}: string;\n`;
    }
  }
  return result;
}

// Main function
function generateTypes() {
  try {
    const baseData = JSON.parse(fs.readFileSync(baseLocalePath, 'utf-8'));
    const interfaceStr = `export interface Dict {\n${generateInterface(baseData, '  ')}  [key: string]: string | ((...args: any[]) => string) | any;\n}\n`;

    const outputPath = path.join(__dirname, '..', '..', 'src', 'types', 'dict-types.ts');
    fs.writeFileSync(outputPath, interfaceStr, 'utf-8');

    // Format the generated file with Prettier
    try {
      execSync(`pnpm prettier --write "${outputPath}"`, { stdio: 'inherit' });
      console.log(`Type file generated and formatted: ${outputPath}`);
    } catch (error) {
      console.warn(`Failed to format generated file: ${error.message}`);
      console.log(`Type file generated: ${outputPath}`);
    }
  } catch (error) {
    console.error('Type generation failed:', error.message);
  }
}

generateTypes();
