import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';

// Get git hash for BUILD_VERSION
let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  console.warn('Could not get git hash for SW:', error.message);
}

// Read service worker template
const swContent = readFileSync('./service-worker.js', 'utf-8');

// Replace __BUILD_VERSION__ placeholder with actual version
const processedSW = swContent.replace(/__BUILD_VERSION__/g, gitHash);

// Write processed service worker to dist
writeFileSync('./dist/service-worker.js', processedSW);

console.log(`✅ Copied service-worker.js to dist/ with BUILD_VERSION=${gitHash}`);
