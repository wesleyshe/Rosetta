// Configuration: install_id, cross-platform paths, registry source resolution.
//
// The same config directory hosts install_id.json (Phase 3) and will host
// sessions/{app_id}.json (Phase 4). Decision baked in 2026-05-03; see the
// Phase 3 prompt and architecture.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform as osPlatform } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type Platform = "macos" | "windows" | "linux";

export function currentPlatform(): Platform {
  switch (osPlatform()) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      // Treat all other Unix-likes (linux, freebsd, openbsd, sunos, aix) as linux.
      // Acceptable for v0; revisit when a contributor reports breakage.
      return "linux";
  }
}

/**
 * Cross-platform location for MCP-local state. Mirrors the convention each
 * OS uses for application support, *not* env-paths or any other dep — the
 * project's "no premature framework adoption" rule applies here.
 *
 *   macOS:   ~/Library/Application Support/rosetta-mcp/
 *   Windows: %APPDATA%/rosetta-mcp/
 *   Linux:   $XDG_CONFIG_HOME/rosetta-mcp/  (fallback ~/.config/rosetta-mcp/)
 */
export function configDir(): string {
  const p = currentPlatform();
  if (p === "macos") {
    return join(homedir(), "Library", "Application Support", "rosetta-mcp");
  }
  if (p === "windows") {
    const appdata = process.env.APPDATA;
    if (!appdata || appdata.length === 0) {
      throw new Error(
        "rosetta-mcp: %APPDATA% is not set; cannot resolve config directory on Windows"
      );
    }
    return join(appdata, "rosetta-mcp");
  }
  // Linux + other unix-likes
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "rosetta-mcp");
}

export interface InstallIdRecord {
  install_id: string;
  created_at: string;
}

/**
 * Returns the install_id, creating one on first launch. Idempotent: subsequent
 * calls return the same record. Used as a sybil-resistance handle on the use
 * path (no GitHub auth required) — see docs/design-rationale.md.
 */
export function loadOrCreateInstallId(): InstallIdRecord {
  const dir = configDir();
  const file = join(dir, "install_id.json");

  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<InstallIdRecord>;
      if (
        parsed &&
        typeof parsed.install_id === "string" &&
        parsed.install_id.length > 0 &&
        typeof parsed.created_at === "string"
      ) {
        return parsed as InstallIdRecord;
      }
      // fall through and regenerate if malformed
    } catch {
      // fall through
    }
  }

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const record: InstallIdRecord = {
    install_id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  writeFileSync(file, JSON.stringify(record, null, 2) + "\n", { encoding: "utf8" });
  return record;
}

/**
 * Backend URL if configured. When set, registry tools call the Railway
 * backend; when unset, they fall back to the local registry path.
 */
export function backendUrl(): string | undefined {
  const url = process.env.ROSETTA_BACKEND_URL;
  if (!url || url.length === 0) return undefined;
  return url.replace(/\/+$/, ""); // strip trailing slashes once
}

/**
 * Path to a local registry/ checkout. Required when ROSETTA_BACKEND_URL is
 * unset. Throws if neither is set — there's nowhere to look up shortcuts.
 *
 * Decision (Phase 3): NO auto-discovery. Caller must opt in via env var.
 */
export function localRegistryPath(): string {
  const p = process.env.ROSETTA_REGISTRY_PATH;
  if (!p || p.length === 0) {
    throw new Error(
      "rosetta-mcp: neither ROSETTA_BACKEND_URL nor ROSETTA_REGISTRY_PATH is set. " +
        "Set ROSETTA_BACKEND_URL=<url> to use a hosted backend, or " +
        "ROSETTA_REGISTRY_PATH=<absolute path to a registry/ checkout> for local mode."
    );
  }
  return p;
}
