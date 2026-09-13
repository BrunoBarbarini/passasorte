// Custom entry point, replacing the default `node_modules/expo/AppEntry.js`.
//
// The generic AppEntry.js does `import App from '../../App'`, assuming it
// physically sits two directories below the project root
// (node_modules/expo/AppEntry.js -> ../../App). Under pnpm, node_modules/expo
// is a symlink into the pnpm store, and Metro resolves relative imports
// against a symlinked file's REAL on-disk location, not the symlink's
// position - so that `../../App` ends up pointing inside the pnpm store
// instead of at this project's App.tsx, failing with "Unable to resolve
// module ../../App". Registering the root component from a plain file at
// the project root (not reached through a symlink) sidesteps the issue
// entirely - this is Expo's own documented fix for monorepo/symlink setups.
import { registerRootComponent } from "expo";

import App from "./App";

registerRootComponent(App);
