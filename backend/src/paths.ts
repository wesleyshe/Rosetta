// Resolve filesystem paths relative to the repo root, regardless of where
// the process is started from. dist/index.js sits at <repo>/backend/dist/,
// so repoRoot is two levels above this module.
//
// Importing this from src/* during tsx-watch dev mode resolves to
// <repo>/backend/src/paths.ts, which is also two levels deep — same answer.
// If we ever flatten the tree, update REPO_ROOT_OFFSET.

import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const REPO_ROOT = resolve(__dirname, "..", "..");
export const SITE_DIR = join(REPO_ROOT, "site");
export const REGISTRY_DIR = join(REPO_ROOT, "registry");
export const REGISTRY_APPS_DIR = join(REGISTRY_DIR, "apps");
export const REGISTRY_SCHEMAS_DIR = join(REGISTRY_DIR, "schemas");

export function appDir(app_id: string): string {
  return join(REGISTRY_APPS_DIR, app_id);
}
