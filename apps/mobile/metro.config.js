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

module.exports = config;
