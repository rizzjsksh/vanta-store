import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = 'https://vanta-store-8kn.pages.dev';

// Ansi styling
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

let totalChecks = 0;
let passedChecks = 0;
let errors = [];
let warnings = [];

function pass(name, detail = '') {
  totalChecks++;
  passedChecks++;
  console.log(`  ${GREEN}✓${RESET} ${name} ${detail ? GRAY + '(' + detail + ')' + RESET : ''}`);
}

function fail(name, reason) {
  totalChecks++;
  errors.push({ name, reason });
  console.log(`  ${RED}✗${RESET} ${name}: ${RED}${reason}${RESET}`);
}

function warn(name, message) {
  warnings.push({ name, message });
  console.log(`  ${YELLOW}⚠${RESET} ${name}: ${YELLOW}${message}${RESET}`);
}

console.log(`\n${BOLD}${CYAN}=== VANTA BUILD-TIME SEO & METADATA VERIFICATION ===${RESET}`);
console.log(`${GRAY}Target Base URL: ${BASE_URL}${RESET}\n`);

// 1. Robots.txt Check
console.log(`${BOLD}[ 1 / 4 ] Checking robots.txt...${RESET}`);
const robotsPath = path.join(rootDir, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  fail('robots.txt', 'robots.txt file is missing in root directory');
} else {
  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!robots.includes(`Sitemap: ${BASE_URL}/sitemap.xml`)) {
    fail('robots.txt sitemap reference', `Missing directive: "Sitemap: ${BASE_URL}/sitemap.xml"`);
  } else {
    pass('robots.txt contains correct sitemap URL');
  }

  if (!robots.includes('Disallow: /admin.html')) {
    fail('robots.txt admin protection', 'Missing directive: "Disallow: /admin.html"');
  } else {
    pass('robots.txt disallows /admin.html');
  }
}

// 2. Sitemap.xml Check
console.log(`\n${BOLD}[ 2 / 4 ] Checking sitemap.xml URLs...${RESET}`);
const sitemapPath = path.join(rootDir, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  fail('sitemap.xml', 'sitemap.xml file is missing');
} else {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const locMatches = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

  if (locMatches.length === 0) {
    fail('sitemap URLs', 'No <loc> URLs found in sitemap.xml');
  } else {
    pass(`Found ${locMatches.length} URLs in sitemap.xml`);
  }

  // Check each URL in sitemap
  for (const urlStr of locMatches) {
    if (!urlStr.startsWith(BASE_URL)) {
      fail(`sitemap URL domain: ${urlStr}`, `URL does not start with expected base "${BASE_URL}"`);
      continue;
    }

    const relPath = urlStr.slice(BASE_URL.length).replace(/^\//, '');
    const cleanPath = relPath.split('?')[0];

    // Determine corresponding file
    let expectedFile = cleanPath === '' ? 'index.html' : cleanPath;
    const targetFile = path.join(rootDir, expectedFile);

    if (!fs.existsSync(targetFile)) {
      fail(`sitemap target exists: ${urlStr}`, `Referenced file does not exist: ${expectedFile}`);
    } else {
      pass(`Sitemap route exists: ${urlStr}`);
    }

    // Verify sitemap URLs do NOT have noindex tag
    if (fs.existsSync(targetFile)) {
      const content = fs.readFileSync(targetFile, 'utf8');
      if (content.includes('name="robots"') && content.includes('noindex')) {
        fail(
          `sitemap URL noindex violation: ${urlStr}`,
          `Page ${expectedFile} has <meta name="robots" content="...noindex..."> but is listed in sitemap.xml!`
        );
      }
    }
  }

  // Ensure essential storefront pages are present in sitemap
  const requiredSitemapPaths = [
    `${BASE_URL}/`,
    `${BASE_URL}/shop.html`,
    `${BASE_URL}/about.html`,
    `${BASE_URL}/contact.html`,
  ];
  for (const reqPath of requiredSitemapPaths) {
    if (locMatches.includes(reqPath)) {
      pass(`Required sitemap route present: ${reqPath}`);
    } else {
      fail(`Required sitemap route missing: ${reqPath}`, `Expected ${reqPath} to be listed in sitemap.xml`);
    }
  }
}

// 3. Storefront Pages Canonical Links Check
console.log(`\n${BOLD}[ 3 / 4 ] Checking Canonical Links...${RESET}`);
const publicPages = [
  { file: 'index.html', expectedCanonical: `${BASE_URL}/` },
  { file: 'shop.html', expectedCanonical: `${BASE_URL}/shop.html` },
  { file: 'product.html', expectedCanonical: `${BASE_URL}/product.html` },
  { file: 'about.html', expectedCanonical: `${BASE_URL}/about.html` },
  { file: 'contact.html', expectedCanonical: `${BASE_URL}/contact.html` },
  { file: 'cart.html', expectedCanonical: `${BASE_URL}/cart.html` },
  { file: 'checkout.html', expectedCanonical: `${BASE_URL}/checkout.html` },
];

for (const page of publicPages) {
  const filePath = path.join(rootDir, page.file);
  if (!fs.existsSync(filePath)) {
    fail(`file exists: ${page.file}`, `Page file does not exist`);
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) ||
                         html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i);

  if (!canonicalMatch) {
    fail(`canonical link in ${page.file}`, `Missing <link rel="canonical" href="...">`);
  } else {
    const actualCanonical = canonicalMatch[1];
    if (actualCanonical === page.expectedCanonical) {
      pass(`Canonical link in ${page.file}`, actualCanonical);
    } else {
      fail(
        `canonical link in ${page.file}`,
        `Mismatch: found "${actualCanonical}", expected "${page.expectedCanonical}"`
      );
    }
  }
}

// 4. Required Social Metadata Check (OG & Twitter)
console.log(`\n${BOLD}[ 4 / 4 ] Checking Required Social Metadata...${RESET}`);
const indexableStorefrontPages = [
  'index.html',
  'shop.html',
  'product.html',
  'about.html',
  'contact.html',
];

const requiredMetaTags = [
  { type: 'property', name: 'og:title' },
  { type: 'property', name: 'og:description' },
  { type: 'property', name: 'og:url' },
  { type: 'property', name: 'og:type' },
  { type: 'property', name: 'og:site_name' },
  { type: 'property', name: 'og:image' },
  { type: 'name', name: 'twitter:card' },
  { type: 'name', name: 'twitter:title' },
  { type: 'name', name: 'twitter:description' },
  { type: 'name', name: 'twitter:image' },
];

for (const fileName of indexableStorefrontPages) {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) continue;

  const html = fs.readFileSync(filePath, 'utf8');
  console.log(`\n  ${BOLD}${fileName}:${RESET}`);

  // Title tag check
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) {
    fail(`${fileName} <title>`, 'Missing or empty <title> tag');
  } else {
    pass(`${fileName} has <title>`, titleMatch[1].trim().slice(0, 45) + '...');
  }

  // Meta description check
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (!descMatch || !descMatch[1].trim()) {
    fail(`${fileName} meta description`, 'Missing or empty meta description');
  } else {
    pass(`${fileName} has meta description`);
  }

  // Social tags
  for (const tag of requiredMetaTags) {
    const attr = tag.type;
    const regex = new RegExp(`<meta\\s+${attr}=["']${tag.name}["']\\s+content=["']([^"']*)["']`, 'i');
    const regexRev = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+${attr}=["']${tag.name}["']`, 'i');
    const match = html.match(regex) || html.match(regexRev);

    if (!match || !match[1].trim()) {
      fail(`${fileName} missing ${tag.name}`, `Required tag <meta ${attr}="${tag.name}"> is missing or empty`);
    } else {
      const val = match[1].trim();
      if (tag.name.endsWith(':image')) {
        // Verify image URL is HTTPS absolute and points to existing local file if local
        if (!val.startsWith('https://')) {
          fail(`${fileName} ${tag.name} protocol`, `Image URL must be absolute HTTPS, got "${val}"`);
        } else {
          // If points to BASE_URL, check if file exists
          if (val.startsWith(BASE_URL)) {
            const imgRel = val.slice(BASE_URL.length).replace(/^\//, '');
            const localImg = path.join(rootDir, imgRel);
            if (!fs.existsSync(localImg)) {
              fail(`${fileName} ${tag.name} local file`, `Image referenced at "${imgRel}" does not exist in root`);
            } else {
              pass(`${fileName} ${tag.name}`, val);
            }
          } else {
            pass(`${fileName} ${tag.name}`, val);
          }
        }
      } else {
        pass(`${fileName} ${tag.name}`);
      }
    }
  }
}

// 5. 404 Page Check
console.log(`\n${BOLD}[ 5 / 5 ] Checking 404 Page Specifications...${RESET}`);
const errorPagePath = path.join(rootDir, '404.html');
if (!fs.existsSync(errorPagePath)) {
  fail('404.html exists', 'Branded 404.html is missing in root directory');
} else {
  const errorHtml = fs.readFileSync(errorPagePath, 'utf8');
  if (!errorHtml.includes('noindex')) {
    fail('404.html noindex', '404 page must contain <meta name="robots" content="noindex, follow">');
  } else {
    pass('404.html contains noindex directive');
  }

  if (!errorHtml.includes('shop.html')) {
    fail('404.html shop link', '404 page must provide navigation back to shop.html');
  } else {
    pass('404.html provides link to shop.html');
  }

  if (!errorHtml.includes('VANTA')) {
    fail('404.html branding', '404 page is missing VANTA brand wordmark');
  } else {
    pass('404.html is branded with VANTA design system');
  }
}

// Summary
console.log(`\n${BOLD}====================================================${RESET}`);
if (errors.length === 0) {
  console.log(`${BOLD}${GREEN}✔ ALL SEO & METADATA CHECKS PASSED! (${passedChecks}/${totalChecks})${RESET}`);
  if (warnings.length > 0) {
    console.log(`${YELLOW}Completed with ${warnings.length} warning(s).${RESET}`);
  }
  process.exit(0);
} else {
  console.log(`${BOLD}${RED}✖ FAILED: ${errors.length} error(s) found across storefront pages.${RESET}`);
  errors.forEach((e, idx) => {
    console.log(`  ${idx + 1}. [${e.name}]: ${e.reason}`);
  });
  process.exit(1);
}
