// os.app_info: detect whether an app is installed on the local machine. Reads
// the registry's per-app meta.json (via local file or backend HTTP, depending
// on which is configured) and probes the OS using the platform-specific
// detection block.
//
// Phase 3 implements macOS fully. Windows and Linux are stubbed — they return
// installed: false with an explanatory error. Phase 4 covers cross-platform.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { backendUrl, currentPlatform, localRegistryPath, type Platform } from "./config.js";
import { listApps } from "./registry.js";

const execFileAsync = promisify(execFile);

export interface AppInfo {
  installed: boolean;
  platform: Platform;
  app_id: string;
  version?: string;
  bundle_id?: string;
  process_name?: string;
  binary?: string;
  app_path?: string;
  pid?: number;
  /** Diagnostic message — set when detection couldn't run cleanly (unknown
   *  platform, missing detection block, probe failure). */
  error?: string;
}

interface MetaJson {
  schema_version: number;
  id: string;
  display_name: string;
  detection: {
    macos?: { bundle_id?: string; binary?: string };
    windows?: { process_name?: string; binary?: string };
    linux?: { binary?: string; process_name?: string };
  };
}

// ---------- meta loading ----------

async function readMetaByAppId(app_id: string): Promise<MetaJson | null> {
  const url = backendUrl();
  if (url) {
    try {
      const r = await fetch(`${url}/registry/apps/${encodeURIComponent(app_id)}/meta.json`);
      if (!r.ok) return null;
      return (await r.json()) as MetaJson;
    } catch {
      return null;
    }
  }
  try {
    const root = localRegistryPath();
    return JSON.parse(
      readFileSync(join(root, "apps", app_id, "meta.json"), "utf8")
    ) as MetaJson;
  } catch {
    return null;
  }
}

/**
 * Resolve a user-supplied name to a registry app_id. Tries the name as-is, the
 * lowercased form, then a fuzzy match against display_name in index.json.
 * Returns the app's meta + canonical app_id, or null if no match.
 */
async function resolveAppMeta(app_name: string): Promise<MetaJson | null> {
  const tries = [app_name, app_name.toLowerCase(), app_name.toLowerCase().replace(/\s+/g, "")];
  for (const candidate of tries) {
    const meta = await readMetaByAppId(candidate);
    if (meta) return meta;
  }
  // Fall back to display-name search.
  try {
    const apps = await listApps();
    const wanted = app_name.toLowerCase();
    const match =
      apps.find((a) => a.id.toLowerCase() === wanted) ??
      apps.find((a) => a.display_name.toLowerCase() === wanted) ??
      apps.find((a) => a.display_name.toLowerCase().includes(wanted));
    if (match) return await readMetaByAppId(match.id);
  } catch {
    // ignore
  }
  return null;
}

// ---------- public entry point ----------

export async function appInfo(app_name: string): Promise<AppInfo> {
  const platform = currentPlatform();
  const meta = await resolveAppMeta(app_name);
  if (!meta) {
    return {
      installed: false,
      platform,
      app_id: app_name,
      error: `app "${app_name}" not found in the registry; cannot probe`,
    };
  }
  switch (platform) {
    case "macos":
      return await detectMacos(meta);
    case "windows":
      return stubWindows(meta);
    case "linux":
      return stubLinux(meta);
  }
}

// ---------- macOS detection (Phase 3 implementation) ----------

async function detectMacos(meta: MetaJson): Promise<AppInfo> {
  const detection = meta.detection.macos ?? {};
  const bundleId = detection.bundle_id;
  if (!bundleId) {
    return {
      installed: false,
      platform: "macos",
      app_id: meta.id,
      error: 'meta.detection.macos.bundle_id missing — cannot probe',
    };
  }

  // 1. Find the .app bundle by bundle id via Spotlight metadata.
  let appPath: string | undefined;
  try {
    const { stdout } = await execFileAsync(
      "mdfind",
      [`kMDItemCFBundleIdentifier == "${bundleId}"`],
      { timeout: 5000 }
    );
    const paths = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    appPath = paths[0];
  } catch (e) {
    return {
      installed: false,
      platform: "macos",
      app_id: meta.id,
      bundle_id: bundleId,
      error: `mdfind failed: ${(e as Error).message}`,
    };
  }

  if (!appPath) {
    return {
      installed: false,
      platform: "macos",
      app_id: meta.id,
      bundle_id: bundleId,
    };
  }

  // 2. Read CFBundleShortVersionString from Info.plist via `defaults`.
  let version: string | undefined;
  try {
    const { stdout } = await execFileAsync(
      "defaults",
      ["read", join(appPath, "Contents", "Info"), "CFBundleShortVersionString"],
      { timeout: 3000 }
    );
    version = stdout.trim() || undefined;
  } catch {
    // Best-effort; we still report installed without a version.
  }

  // 3. Detect a running process using the app bundle path.
  let pid: number | undefined;
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", appPath], { timeout: 3000 });
    const first = parseInt(stdout.trim().split("\n")[0] ?? "", 10);
    if (!Number.isNaN(first) && first > 0) pid = first;
  } catch {
    // pgrep exits non-zero when no match; that's fine — app just isn't running.
  }

  return {
    installed: true,
    platform: "macos",
    app_id: meta.id,
    bundle_id: bundleId,
    app_path: appPath,
    version,
    pid,
  };
}

// ---------- Windows / Linux stubs (Phase 4) ----------

function stubWindows(meta: MetaJson): AppInfo {
  const det = meta.detection.windows ?? {};
  return {
    installed: false,
    platform: "windows",
    app_id: meta.id,
    process_name: det.process_name,
    binary: det.binary,
    error: "windows detection not yet implemented (Phase 4)",
  };
}

function stubLinux(meta: MetaJson): AppInfo {
  const det = meta.detection.linux ?? {};
  return {
    installed: false,
    platform: "linux",
    app_id: meta.id,
    binary: det.binary,
    process_name: det.process_name,
    error: "linux detection not yet implemented (Phase 4)",
  };
}
