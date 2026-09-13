// Metro config for a pnpm monorepo (Expo docs: https://docs.expo.dev/guides/monorepos/).
//
// pnpm installs dependencies as symlinks into node_modules (see
// node_modules/expo -> ../../../node_modules/.pnpm/...), but Metro does not
// follow symlinks by default. Without this config, `expo start` fails with
// "Unable to resolve module ./node_modules/expo/AppEntry" even though the
// file exists on disk, because Metro's default resolver can't see past the
// symlink boundary.
//
// apps/mobile has no @passasorte/* workspace dependency today, but
// watchFolders/nodeModulesPaths are included anyway (the standard Expo +
// pnpm monorepo setup) so this keeps working if that changes later.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;
// Deliberately NOT setting disableHierarchicalLookup: true. pnpm stores each
// package's own resolved dependencies (e.g. @babel/runtime) inside that
// package's private node_modules under node_modules/.pnpm/<pkg>/node_modules
// - Metro's normal hierarchical lookup finds those by walking up from the
// requiring file, but disableHierarchicalLookup skips straight to the two
// paths above and never finds them, breaking `@babel/runtime/helpers/...`
// (used internally by expo's AppEntry.js) with "could not be found".
// Keep hierarchical lookup on; only symlink-following was the missing piece.
config.resolver.disableHierarchicalLookup = false;

// The rest of this monorepo (apps/api, apps/web, packages/*) writes relative
// imports with an explicit ".js" extension even though the source files are
// ".ts"/".tsx" - the TypeScript "moduleResolution": "bundler" convention this
// repo standardized on (tsconfig.json here matches). tsc, tsx and Node's own
// ESM loader all understand that convention, but Metro's default resolver
// does not: it looks for a file that literally ends in ".js" and fails with
// "Unable to resolve module ./src/whatever.js ... None of these files
// exist" even though whatever.tsx sits right there. This custom
// resolveRequest re-tries the same relative import without the extension
// when a ".js"/".jsx" specifier fails, letting Metro's own sourceExts list
// (.tsx/.ts/.jsx/.js/...) find the real file - falling back to the default
// resolver's original error for anything that still can't be found (e.g. a
// genuine missing module), so this never masks a real problem.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isRelative = moduleName.startsWith("./") || moduleName.startsWith("../");
  if (isRelative && (moduleName.endsWith(".js") || moduleName.endsWith(".jsx"))) {
    try {
      return context.resolveRequest(
        context,
        moduleName.replace(/\.jsx?$/, ""),
        platform,
      );
    } catch {
      // Fall through to the default resolver so the original, more useful
      // error (naming the extensions it tried) is what actually surfaces.
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
