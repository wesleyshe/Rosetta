// os: app_info (Phase 3) + screenshot / action / readAxTree (Phase 4).
//
// Phase 4 implements macOS fully and stubs Windows / Linux. Cross-platform
// substep is Phase 7 polish, not Part 1.
//
// Screenshot: shells to `screencapture -x -t png` on macOS. The `nut-js`
// dep is wired in but used only for keyboard/mouse — its image-capture path
// would require a separate PNG-encode step that platform tools provide
// natively.
//
// Action: nut-js for `key`, `key_combo`, `type_text`, and coordinate `click`.
// `menu` walks System Events on macOS. `open_app` shells to `open -a`. The
// `click.target.ax_path` form is not implemented in v0 — use coordinates.
//
// AX tree (read_ax_tree): scoped to the named rules used by the seed
// shortcuts. Phase 4 implements `active_editor_filename` (window-title
// query). The other four rules (command_palette_visible, sidebar_visible,
// terminal_panel_visible, rename_widget_visible) return ok:false with a
// "fall back to interpret_check" hint until Phase 7 polish lands them.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { keyboard, mouse, Key, Point } from "@nut-tree-fork/nut-js";

import { backendUrl, currentPlatform, localRegistryPath, type Platform } from "./config.js";
import { listApps } from "./registry.js";

const execFileAsync = promisify(execFile);

// ===================== app_info (Phase 3) =====================

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

async function resolveAppMeta(app_name: string): Promise<MetaJson | null> {
  const tries = [app_name, app_name.toLowerCase(), app_name.toLowerCase().replace(/\s+/g, "")];
  for (const candidate of tries) {
    const meta = await readMetaByAppId(candidate);
    if (meta) return meta;
  }
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
      return stubAppInfoWindows(meta);
    case "linux":
      return stubAppInfoLinux(meta);
  }
}

async function detectMacos(meta: MetaJson): Promise<AppInfo> {
  const detection = meta.detection.macos ?? {};
  const bundleId = detection.bundle_id;
  if (!bundleId) {
    return {
      installed: false,
      platform: "macos",
      app_id: meta.id,
      error: "meta.detection.macos.bundle_id missing — cannot probe",
    };
  }

  let appPath: string | undefined;
  try {
    const { stdout } = await execFileAsync(
      "mdfind",
      [`kMDItemCFBundleIdentifier == "${bundleId}"`],
      { timeout: 5000 }
    );
    appPath = stdout.split("\n").map((s) => s.trim()).filter(Boolean)[0];
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
    return { installed: false, platform: "macos", app_id: meta.id, bundle_id: bundleId };
  }

  let version: string | undefined;
  try {
    const { stdout } = await execFileAsync(
      "defaults",
      ["read", join(appPath, "Contents", "Info"), "CFBundleShortVersionString"],
      { timeout: 3000 }
    );
    version = stdout.trim() || undefined;
  } catch {
    // best-effort
  }

  let pid: number | undefined;
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", appPath], { timeout: 3000 });
    const first = parseInt(stdout.trim().split("\n")[0] ?? "", 10);
    if (!Number.isNaN(first) && first > 0) pid = first;
  } catch {
    // not running
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

function stubAppInfoWindows(meta: MetaJson): AppInfo {
  const det = meta.detection.windows ?? {};
  return {
    installed: false,
    platform: "windows",
    app_id: meta.id,
    process_name: det.process_name,
    binary: det.binary,
    error: "windows detection not yet implemented (Phase 7)",
  };
}

function stubAppInfoLinux(meta: MetaJson): AppInfo {
  const det = meta.detection.linux ?? {};
  return {
    installed: false,
    platform: "linux",
    app_id: meta.id,
    binary: det.binary,
    process_name: det.process_name,
    error: "linux detection not yet implemented (Phase 7)",
  };
}

// ===================== screenshot (Phase 4) =====================

export interface ScreenshotRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotResult {
  path: string;
  base64: string;
  bytes: number;
  region?: ScreenshotRegion;
}

export async function screenshot(region?: ScreenshotRegion): Promise<ScreenshotResult> {
  const platform = currentPlatform();
  if (platform !== "macos") {
    throw new Error(
      `screenshot not yet implemented on ${platform} (Phase 7 polish; macOS works in Phase 4)`
    );
  }
  const path = join(tmpdir(), `rosetta-screen-${randomUUID()}.png`);
  const args = ["-x", "-t", "png"];
  if (region) {
    args.push("-R", `${region.x},${region.y},${region.width},${region.height}`);
  }
  args.push(path);
  try {
    await execFileAsync("screencapture", args, { timeout: 8000 });
  } catch (e) {
    throw new Error(`screencapture failed: ${(e as Error).message}`);
  }
  const buf = readFileSync(path);
  return { path, base64: buf.toString("base64"), bytes: buf.length, region };
}

// ===================== action (Phase 4) =====================

export type ActionSpec =
  | { type: "key"; key: string }
  | { type: "key_combo"; keys: string | { macos?: string; windows?: string; linux?: string } }
  | { type: "type_text"; text: string }
  | { type: "click"; target: { x: number; y: number } | { ax_path: string } }
  | { type: "menu"; path: string[] }
  | { type: "open_app"; app_id?: string; platform_specific?: boolean };

export interface ActionResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

// ---------- key parsing ----------

const KEY_PUNCT: Record<string, string> = {
  "-": "Minus", "=": "Equal", "[": "LeftBracket", "]": "RightBracket",
  "\\": "Backslash", ";": "Semicolon", "'": "Quote", ",": "Comma",
  ".": "Period", "/": "Slash",
};

function parseKeyName(name: string): Key {
  const n = name.trim().toLowerCase();
  // Modifiers
  if (n === "cmd" || n === "command" || n === "meta" || n === "win") return Key.LeftCmd;
  if (n === "ctrl" || n === "control") return Key.LeftControl;
  if (n === "shift") return Key.LeftShift;
  if (n === "alt" || n === "option" || n === "opt") return Key.LeftAlt;
  // Named special keys
  const named: Record<string, Key> = {
    enter: Key.Return, return: Key.Return,
    escape: Key.Escape, esc: Key.Escape,
    tab: Key.Tab, space: Key.Space, spacebar: Key.Space,
    backspace: Key.Backspace, delete: Key.Delete, del: Key.Delete,
    up: Key.Up, uparrow: Key.Up,
    down: Key.Down, downarrow: Key.Down,
    left: Key.Left, leftarrow: Key.Left,
    right: Key.Right, rightarrow: Key.Right,
    home: Key.Home, end: Key.End,
    pageup: Key.PageUp, pagedown: Key.PageDown,
    "`": Key.Grave, backtick: Key.Grave, grave: Key.Grave,
  };
  if (n in named) return named[n];
  // Function keys F1..F24
  const fmatch = /^f(\d+)$/.exec(n);
  if (fmatch) {
    const num = parseInt(fmatch[1], 10);
    if (num >= 1 && num <= 24) {
      const k = (Key as unknown as Record<string, Key>)[`F${num}`];
      if (k !== undefined) return k;
    }
  }
  // Letter
  if (/^[a-z]$/.test(n)) {
    const k = (Key as unknown as Record<string, Key>)[n.toUpperCase()];
    if (k !== undefined) return k;
  }
  // Digit
  if (/^\d$/.test(n)) {
    const k = (Key as unknown as Record<string, Key>)[`Num${n}`];
    if (k !== undefined) return k;
  }
  // Punctuation
  if (n in KEY_PUNCT) {
    const k = (Key as unknown as Record<string, Key>)[KEY_PUNCT[n]];
    if (k !== undefined) return k;
  }
  throw new Error(`unknown key: "${name}"`);
}

function parseKeyCombo(combo: string): Key[] {
  return combo.split("+").map(parseKeyName);
}

function resolvePlatformKeys(
  keys: string | { macos?: string; windows?: string; linux?: string },
  platform: Platform
): string {
  if (typeof keys === "string") return keys;
  const k = keys[platform];
  if (!k) throw new Error(`key_combo missing keys for platform "${platform}"`);
  return k;
}

// ---------- action dispatch ----------

export async function action(spec: ActionSpec): Promise<ActionResult> {
  const platform = currentPlatform();
  if (platform !== "macos") {
    return {
      ok: false,
      error: `action not yet implemented on ${platform} (Phase 7 polish; macOS works in Phase 4)`,
    };
  }
  try {
    switch (spec.type) {
      case "key": {
        const k = parseKeyName(spec.key);
        await keyboard.type(k);
        return { ok: true, details: { key: spec.key } };
      }
      case "key_combo": {
        const combo = resolvePlatformKeys(spec.keys, platform);
        const keys = parseKeyCombo(combo);
        await keyboard.type(...keys);
        return { ok: true, details: { combo } };
      }
      case "type_text": {
        await keyboard.type(spec.text);
        return { ok: true, details: { text_length: spec.text.length } };
      }
      case "click": {
        if ("ax_path" in spec.target) {
          return {
            ok: false,
            error:
              "click via ax_path is not implemented in v0 — pass {x, y} coordinates, or wait for Phase 7",
          };
        }
        const { x, y } = spec.target;
        await mouse.setPosition(new Point(x, y));
        await mouse.leftClick();
        return { ok: true, details: { x, y } };
      }
      case "menu":
        return await menuMacos(spec.path);
      case "open_app":
        return await openAppMacos(spec);
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function menuMacos(path: string[]): Promise<ActionResult> {
  if (path.length === 0) return { ok: false, error: "menu path empty" };
  // For path ["A", "B", "C"], click:
  //   menu item "C" of menu "B" of menu item "B" of menu "A" of menu bar item "A" of menu bar 1
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const top = `menu bar item "${escape(path[0])}" of menu bar 1`;
  if (path.length === 1) {
    // Just hover/open the top-level menu — uncommon as a leaf, but handle it.
    const script = `
      tell application "System Events"
        tell (first application process whose frontmost is true)
          click ${top}
        end tell
      end tell
    `;
    try {
      await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
      return { ok: true, details: { path } };
    } catch (e) {
      return { ok: false, error: `menu navigation failed: ${(e as Error).message}` };
    }
  }
  // Build the chain from inside out.
  let chain = `menu "${escape(path[0])}" of ${top}`;
  for (let i = 1; i < path.length - 1; i++) {
    chain = `menu "${escape(path[i])}" of menu item "${escape(path[i])}" of ${chain}`;
  }
  const target = `menu item "${escape(path[path.length - 1])}" of ${chain}`;
  const script = `
    tell application "System Events"
      tell (first application process whose frontmost is true)
        click ${target}
      end tell
    end tell
  `;
  try {
    await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
    return { ok: true, details: { path } };
  } catch (e) {
    return { ok: false, error: `menu navigation failed: ${(e as Error).message}` };
  }
}

async function openAppMacos(
  spec: { app_id?: string; platform_specific?: boolean }
): Promise<ActionResult> {
  if (!spec.app_id) {
    return {
      ok: false,
      error: "open_app requires app_id in shortcut.actions[] form (workflow.open[] form is not yet wired into action())",
    };
  }
  const meta = await readMetaByAppId(spec.app_id);
  if (!meta) {
    return { ok: false, error: `open_app: app "${spec.app_id}" not found in registry` };
  }
  const display = meta.display_name;
  try {
    await execFileAsync("open", ["-a", display], { timeout: 8000 });
    return { ok: true, details: { app: display, app_id: spec.app_id } };
  } catch (e) {
    return { ok: false, error: `open -a "${display}" failed: ${(e as Error).message}` };
  }
}

// ===================== read_ax_tree (Phase 4, scoped) =====================

export type AxRule =
  | "active_editor_filename"
  | "command_palette_visible"
  | "sidebar_visible"
  | "terminal_panel_visible"
  | "rename_widget_visible";

export interface AxQuery {
  rule: AxRule;
  /** Optional: query a specific app's process instead of the frontmost. */
  app_id?: string;
}

export type AxResult =
  | { ok: true; rule: AxRule; matched?: boolean; value?: string; details?: unknown }
  | { ok: false; rule: AxRule; error: string };

export async function readAxTree(query: AxQuery): Promise<AxResult> {
  const platform = currentPlatform();
  if (platform === "windows") return { ok: false, rule: query.rule, error: "ax_not_implemented_windows" };
  if (platform === "linux") return { ok: false, rule: query.rule, error: "ax_not_implemented_linux" };
  // macOS:
  switch (query.rule) {
    case "active_editor_filename":
      return await axFrontWindowName(query.rule);
    case "command_palette_visible":
    case "rename_widget_visible":
    case "sidebar_visible":
    case "terminal_panel_visible":
      return {
        ok: false,
        rule: query.rule,
        error:
          `ax_rule_not_implemented_in_v0: ${query.rule}. ` +
          "Seed AX scope is limited to active_editor_filename in Phase 4; " +
          "fall back to interpret_check for visible-state verification (Phase 7 polish).",
      };
  }
}

async function axFrontWindowName(rule: AxRule): Promise<AxResult> {
  const script = `
    tell application "System Events"
      try
        set frontProc to (first application process whose frontmost is true)
        return name of front window of frontProc
      on error errMsg
        return "ROSETTA_AX_ERROR:" & errMsg
      end try
    end tell
  `;
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
    const value = stdout.trim();
    if (value.startsWith("ROSETTA_AX_ERROR:")) {
      return { ok: false, rule, error: value.replace("ROSETTA_AX_ERROR:", "") };
    }
    return { ok: true, rule, value };
  } catch (e) {
    return { ok: false, rule, error: `osascript failed: ${(e as Error).message}` };
  }
}
