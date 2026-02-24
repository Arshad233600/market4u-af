import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Generate version info
const timestamp = new Date().toISOString();
let gitHash = 'unknown';

try {
  gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  console.warn('Could not get git hash:', error.message);
}

const version = {
  version: gitHash,
  buildDate: timestamp,
  buildNumber: Date.now()
};

// Write version.json to public folder
writeFileSync('./public/version.json', JSON.stringify(version, null, 2));

console.log('✅ Generated version.json:', JSON.stringify(version, null, 2));

// Export BUILD_VERSION for service worker
export const BUILD_VERSION = gitHash;
