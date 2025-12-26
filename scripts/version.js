#!/usr/bin/env node

/**
 * Version increment script
 *
 * Usage:
 *   node scripts/version.js [patch|minor|major]
 *   Default: patch
 *
 * This script increments the version in frontend/package.json
 * and optionally in root package.json
 */

import { appendFileSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const VERSION_TYPES = {
  patch: 2, // e.g., 1.0.0 -> 1.0.1
  minor: 1, // e.g., 1.0.0 -> 1.1.0
  major: 0, // e.g., 1.0.0 -> 2.0.0
};

function parseVersion(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(
      `Invalid version format: ${version}. Expected format: x.y.z`
    );
  }
  return parts;
}

function incrementVersion(version, type = 'patch') {
  const [major, minor, patch] = parseVersion(version);
  const index = VERSION_TYPES[type];

  if (index === undefined) {
    throw new Error(
      `Invalid version type: ${type}. Use: patch, minor, or major`
    );
  }

  const newVersion = [major, minor, patch];

  if (index === 0) {
    // Major: increment major, reset minor and patch
    newVersion[0] = major + 1;
    newVersion[1] = 0;
    newVersion[2] = 0;
  } else if (index === 1) {
    // Minor: increment minor, reset patch
    newVersion[1] = minor + 1;
    newVersion[2] = 0;
  } else {
    // Patch: increment patch
    newVersion[2] = patch + 1;
  }

  return newVersion.join('.');
}

function updatePackageJson(filePath, newVersion) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const packageJson = JSON.parse(content);
    const oldVersion = packageJson.version;

    if (!oldVersion) {
      console.warn(`⚠️  No version field found in ${filePath}, skipping...`);
      return false;
    }

    packageJson.version = newVersion;
    writeFileSync(
      filePath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf8'
    );

    console.log(`✅ Updated ${filePath}`);
    console.log(`   ${oldVersion} → ${newVersion}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  const versionType = process.argv[2] || 'patch';

  if (!VERSION_TYPES[versionType]) {
    console.error(`❌ Invalid version type: ${versionType}`);
    console.error(`   Usage: node scripts/version.js [patch|minor|major]`);
    process.exit(1);
  }

  // Read current version from frontend/package.json
  const frontendPackagePath = join(projectRoot, 'frontend', 'package.json');
  let currentVersion;

  try {
    const frontendPackage = JSON.parse(
      readFileSync(frontendPackagePath, 'utf8')
    );
    currentVersion = frontendPackage.version;

    if (!currentVersion) {
      console.error('❌ No version found in frontend/package.json');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error reading frontend/package.json:`, error.message);
    process.exit(1);
  }

  const newVersion = incrementVersion(currentVersion, versionType);

  console.log(`\n🔄 Incrementing version (${versionType})`);
  console.log(`   Current: ${currentVersion}`);
  console.log(`   New:     ${newVersion}\n`);

  // Update frontend/package.json
  const frontendUpdated = updatePackageJson(frontendPackagePath, newVersion);

  // Optionally update root package.json if it has a version
  const rootPackagePath = join(projectRoot, 'package.json');
  const rootUpdated = updatePackageJson(rootPackagePath, newVersion);

  if (!frontendUpdated && !rootUpdated) {
    console.error('\n❌ Failed to update any package.json files');
    process.exit(1);
  }

  console.log(`\n✨ Version updated successfully to ${newVersion}`);

  // Output the new version for use in CI/CD (GitHub Actions format)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `new_version=${newVersion}\nold_version=${currentVersion}\n`
    );
  }
}

main();
