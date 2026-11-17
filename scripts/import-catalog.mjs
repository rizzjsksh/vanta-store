#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const catalogFile = process.argv[2] || path.join(rootDir, 'catalog', 'products.json');

console.log(`\n\x1b[1m\x1b[36m=== XANTA REFORMIA CATALOG IMPORTER & VALIDATOR ===\x1b[0m`);
console.log(`Reading: ${catalogFile}\n`);

if (!fs.existsSync(catalogFile)) {
  console.error(`\x1b[31mError: Catalog file not found at ${catalogFile}\x1b[0m`);
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
} catch (err) {
  console.error(`\x1b[31mError: Invalid JSON format: ${err.message}\x1b[0m`);
  process.exit(1);
}

const products = Array.isArray(raw) ? raw : (raw.products || []);
if (!products.length) {
  console.error(`\x1b[31mError: No products array found in ${catalogFile}\x1b[0m`);
  process.exit(1);
}

let errors = 0;
let validated = [];

products.forEach((p, index) => {
  const prefix = `Product #${index + 1} (${p.id || 'unnamed'}):`;
  const issues = [];

  if (!p.id || typeof p.id !== 'string') issues.push('Missing or invalid "id" (must be string slug)');
  if (!p.name || typeof p.name !== 'string') issues.push('Missing "name"');
  if (typeof p.price !== 'number' || p.price <= 0) issues.push('Invalid "price" (must be number > 0)');
  if (!p.category) issues.push('Missing "category"');
  if (!Array.isArray(p.colourways) || p.colourways.length === 0) {
    issues.push('Missing "colourways" array (must have at least one colourway)');
  } else {
    p.colourways.forEach((cw, cwIdx) => {
      if (!cw.colour) issues.push(`Colourway #${cwIdx + 1} missing "colour" name`);
      if (!Array.isArray(cw.images) || cw.images.length === 0) {
        issues.push(`Colourway #${cwIdx + 1} (${cw.colour || 'unnamed'}) has no images`);
      }
    });
  }

  if (issues.length) {
    console.log(`\x1b[31m✖ ${prefix}\x1b[0m`);
    issues.forEach(i => console.log(`    - ${i}`));
    errors++;
  } else {
    const totalImages = p.colourways.reduce((sum, cw) => sum + (cw.images?.length || 0), 0);
    console.log(`\x1b[32m✔ ${p.name}\x1b[0m (\x1b[90m${p.id}\x1b[0m) — \x1b[33m$${p.price.toFixed(2)}\x1b[0m [${p.category}] · ${p.colourways.length} colourways, ${totalImages} images`);
    validated.push(p);
  }
});

console.log(`\n----------------------------------------------------`);
if (errors > 0) {
  console.error(`\x1b[31mValidation failed with ${errors} error(s). Please correct the catalog file.\x1b[0m\n`);
  process.exit(1);
} else {
  console.log(`\x1b[32m✔ All ${validated.length} products successfully validated!\x1b[0m\n`);

  // Update fallback catalog in app.js if requested with --sync-fallback
  if (process.argv.includes('--sync-fallback')) {
    const appJsPath = path.join(rootDir, 'app.js');
    if (fs.existsSync(appJsPath)) {
      let appCode = fs.readFileSync(appJsPath, 'utf8');
      const fallbackSnippet = `const fallbackProducts = ${JSON.stringify(validated, null, 2)};`;
      appCode = appCode.replace(/const fallbackProducts = \[[\s\S]*?\];/, fallbackSnippet);
      fs.writeFileSync(appJsPath, appCode, 'utf8');
      console.log(`\x1b[32m✔ Synchronized ${validated.length} products to app.js fallback catalog!\x1b[0m\n`);
    }
  }
}
