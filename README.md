# optional-deps-validate

*(note: this package is almost entirely written by AI)*

> **Validate that all optional dependencies declared by installed packages are present in `package-lock.json`.**

When using Node.js and npm, certain packages declare OS- or architecture-specific sub-dependencies in their `optionalDependencies`. However, sometimes `npm` can generate a partial `package-lock.json` that excludes some or all of those optional deps. This can lead to problems on other machines or CI when `npm` fails to install required platform packages.

**`optional-deps-validate`** is a CLI tool that scans your local `node_modules` and compares each installed package's `optionalDependencies` against your `package-lock.json`. If any are missing, it warns you and exits with a non-zero status code.

## Installation

```bash
npm install -D @starcart.com/optional-deps-validate
# or
yarn add -D @starcart.com/optional-deps-validate
# or
pnpm add -D @starcart.com/optional-deps-validate
```

You can also install it globally:

```bash
npm install -g @starcart.com/optional-deps-validate
# or
yarn global add @starcart.com/optional-deps-validate
# or
pnpm add -g @starcart.com/optional-deps-validate
```

Then run it using:

```bash
npx @starcart.com/optional-deps-validate
```

## Usage

Run the command in any project directory that has both a package-lock.json and a node_modules directory:

```bash
cd /path/to/your/project
npx @starcart.com/optional-deps-validate
```

If everything is correct, you’ll see:

```
✅  All optional dependencies declared by installed packages appear in package-lock.json.
```

Otherwise, it will list warnings for each missing optional dependency and exit with status code 1.

### Example Warning

```
⚠️  [Warning] Package "@swc/core" declares optional dependency "@swc/core-darwin-arm64" but it is NOT listed in package-lock.json

One or more optional dependencies are missing from package-lock.json!
```

### How it works

1. **Scans node_modules:** Locates every installed package (including scoped packages) and reads its package.json.
2. **Collects Optional Deps:** For each package’s optionalDependencies, the tool records each optional dep name.
3. **Parses package-lock.json:** Gathers all package names listed in the lock file.
4. **Compares:** Any optional dep name that doesn’t appear in the lock file is flagged as missing.

### When to Use

* **Prevent Partial Lockfiles:** Whenever you suspect `npm install` might have generated an incomplete `package-lock.json` (for instance, if you re-installed without removing `node_modules`).
* **CI Enforcement:** Add `npx optional-deps-validate` as part of your build or test pipeline to ensure the lockfile is fully consistent before merging changes.

## License

MIT