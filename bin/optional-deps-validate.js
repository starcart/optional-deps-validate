#!/usr/bin/env node
'use strict';

/**
 * optional-deps-validate
 *
 * A CLI tool to detect when a package in node_modules declares optional
 * dependencies that are missing from package-lock.json. Useful for
 * ensuring your lockfile is complete even for platform-specific
 * optional packages (e.g. @swc/core).
 */

const fs = require('fs');
const path = require('path');

// Simple function to read JSON from a file
function loadJson(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`[Error] Failed to read or parse JSON file: ${filePath}\n${e.message}`);
    process.exit(1);
  }
}

// Check if a file or directory exists
function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Gather all packages from package-lock.json
function gatherLockfileDeps(lockJson) {
  const lockfileVersion = lockJson.lockfileVersion || 1;
  const result = new Set();

  if (lockfileVersion >= 2 && lockJson.packages) {
    // npm 7+ style lockfile
    for (const pkgPath of Object.keys(lockJson.packages)) {
      if (!pkgPath) continue; // skip root
      const parts = pkgPath.split('node_modules/');
      const pkgName = parts[parts.length - 1];
      result.add(pkgName);
    }
  } else if (lockJson.dependencies) {
    // npm 6 style nested lockfile
    function recurseDeps(depObj) {
      for (const depName of Object.keys(depObj)) {
        result.add(depName);
        if (depObj[depName].dependencies) {
          recurseDeps(depObj[depName].dependencies);
        }
      }
    }
    recurseDeps(lockJson.dependencies);
  }

  return result;
}

/**
 * Recursively read node_modules to find all packages. For each package,
 * read its package.json and collect the optionalDependencies from that file.
 */
function gatherInstalledOptionalDeps(modulesDir) {
  // Map of packageName => set of optionalDeps
  const pkgOptionalDeps = new Map();

  function gatherPackage(packagePath) {
    const pkgJsonPath = path.join(packagePath, 'package.json');
    if (!fileExists(pkgJsonPath)) return;

    const pkgJson = loadJson(pkgJsonPath);
    const name = pkgJson.name || path.basename(packagePath);
    const optional = pkgJson.optionalDependencies || {};

    if (!pkgOptionalDeps.has(name)) {
      pkgOptionalDeps.set(name, new Set());
    }
    for (const optDepName of Object.keys(optional)) {
      pkgOptionalDeps.get(name).add(optDepName);
    }
  }

  function traverseNodeModules(dir) {
    if (!fileExists(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue; // skip hidden files
      }
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('@')) {
          // e.g. node_modules/@scope
          const scopeEntries = fs.readdirSync(entryPath, { withFileTypes: true });
          for (const scopedPkg of scopeEntries) {
            if (!scopedPkg.isDirectory()) continue;
            const pkgDir = path.join(entryPath, scopedPkg.name);
            gatherPackage(pkgDir);
            // Also check nested node_modules
            traverseNodeModules(path.join(pkgDir, 'node_modules'));
          }
        } else {
          // normal package
          gatherPackage(entryPath);
          // also check nested node_modules
          traverseNodeModules(path.join(entryPath, 'node_modules'));
        }
      }
    }
  }

  traverseNodeModules(modulesDir);
  return pkgOptionalDeps;
}

function showHelp() {
  console.log(`
Usage:
  optional-deps-validate

Checks if any installed package in node_modules has optional dependencies
that are missing from package-lock.json. Exits with code 1 if mismatches
are found.

Options:
  --help    Show this help message
`);
}

function main() {
  // Check for --help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Make sure we have package-lock.json
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  if (!fileExists(lockPath)) {
    console.error('[Error] No package-lock.json found in the current directory.');
    process.exit(1);
  }

  // Also ensure node_modules exists
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fileExists(nodeModulesPath)) {
    console.error('[Error] No node_modules/ directory found. Please run npm install first.');
    process.exit(1);
  }

  // 1. Load lock file
  const lockJson = loadJson(lockPath);
  const lockDeps = gatherLockfileDeps(lockJson);

  // 2. Gather optional deps from installed packages
  const installedOptionalDeps = gatherInstalledOptionalDeps(nodeModulesPath);

  // 3. Compare
  let allGood = true;
  for (const [pkgName, optSet] of installedOptionalDeps.entries()) {
    for (const optDepName of optSet) {
      if (!lockDeps.has(optDepName)) {
        allGood = false;
        console.warn(
          `⚠️  [Warning] Package "${pkgName}" declares optional dependency "${optDepName}" ` +
          `but it is NOT listed in package-lock.json`
        );
      }
    }
  }

  if (!allGood) {
    console.error('\nOne or more optional dependencies are missing from package-lock.json!');
    process.exit(1);
  } else {
    console.log('✅  All optional dependencies declared by installed packages appear in package-lock.json.');
  }
}

main();