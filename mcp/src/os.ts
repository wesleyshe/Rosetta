// os: app_info (Phase 3) + screenshot / action / readAxTree (Phase 4).
//
// Phase 4 implements macOS fully and stubs Windows / Linux. Cross-platform
// substep is Phase 7c+ polish, not Part 1.
//
// Screenshot: shells to `screencapture -x -t png` on macOS.
//
// Action (macOS): all six action types (`key`, `key_combo`, `type_text`,
// coordinate `click`, `menu`, `open_app`) route through osascript and
// `tell application "System Events"`, except `open_app` which shells to
// `open -a`. See `docs/design-rationale.md` § "Why macOS action dispatch
// goes through AppleScript" for the TCC-attribution rationale. The
// `click.target.ax_path` form is not implemented in v0 — use coordinates.
//
// AX tree (read_ax_tree): scoped to the named rules used by the seed
// shortcuts. Phase 4 implements `active_editor_filename` (window-title
// query). The other four rules (command_palette_visible, sidebar_visible,
// terminal_panel_visible, rename_widget_visible) return ok:false with a
// "fall back to interpret_check" hint until Phase 7 polish lands them.
//
// Windows / Linux remain stubbed for Phase 7c+.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

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

// ---------- AppleScript helpers ----------

/** Escape a string for embedding inside an AppleScript double-quoted literal. */
function escapeAppleScriptString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Translation of a key name into an AppleScript-emittable form.
 *
 * `code` keys go out as `key code N` (position-based macOS virtual key
 * codes, used only for special keys whose location is fixed across
 * keyboard layouts). `char` keys go out as `keystroke "x"` and respect
 * the user's active layout, which is critical for non-QWERTY users
 * (Dvorak `cmd+s` must hit the Save shortcut, not whichever physical
 * key happens to sit at QWERTY-S).
 */
type KeyTranslation =
  | { form: "code"; value: number }
  | { form: "char"; value: string };

const SPECIAL_KEY_CODES: Record<string, number> = {
  enter: 36,
  return: 36,
  tab: 48,
  space: 49,
  spacebar: 49,
  backspace: 51,
  delete: 117,
  del: 117,
  escape: 53,
  esc: 53,
  up: 126,
  uparrow: 126,
  down: 125,
  downarrow: 125,
  left: 123,
  leftarrow: 123,
  right: 124,
  rightarrow: 124,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
};

// F1..F19, indexed at [n-1]. Apple's virtual key codes for function keys
// are not contiguous, so this is a literal table.
const FUNCTION_KEY_CODES: number[] = [
  122, 120, 99, 118, 96, 97, 98, 100, 101, 109,
  103, 111, 105, 107, 113, 106, 64, 79, 80,
];

/** Printable punctuation accepted as key names. The value is the literal
 *  character that gets emitted via `keystroke`. */
const PUNCT_CHARS: Record<string, string> = {
  "`": "`",
  backtick: "`",
  grave: "`",
  "-": "-",
  minus: "-",
  "=": "=",
  equal: "=",
  "[": "[",
  leftbracket: "[",
  "]": "]",
  rightbracket: "]",
  "\\": "\\",
  backslash: "\\",
  ";": ";",
  semicolon: ";",
  "'": "'",
  quote: "'",
  ",": ",",
  comma: ",",
  ".": ".",
  period: ".",
  "/": "/",
  slash: "/",
};

function translateKey(name: string): KeyTranslation {
  const n = name.trim().toLowerCase();
  if (n in SPECIAL_KEY_CODES) {
    return { form: "code", value: SPECIAL_KEY_CODES[n] };
  }
  const fmatch = /^f(\d+)$/.exec(n);
  if (fmatch) {
    const num = parseInt(fmatch[1], 10);
    if (num >= 1 && num <= FUNCTION_KEY_CODES.length) {
      return { form: "code", value: FUNCTION_KEY_CODES[num - 1] };
    }
  }
  if (/^[a-z]$/.test(n)) return { form: "char", value: n };
  if (/^\d$/.test(n)) return { form: "char", value: n };
  if (n in PUNCT_CHARS) return { form: "char", value: PUNCT_CHARS[n] };
  throw new Error(`unknown key: "${name}"`);
}

/** Translate a list of modifier names into an AppleScript `using { ... }`
 *  clause. Returns the empty string when there are no modifiers, otherwise
 *  a string with a leading space (e.g. ` using {command down, shift down}`).
 *  Throws on unknown names. */
function buildModifiersClause(modifiers: string[]): string {
  if (modifiers.length === 0) return "";
  const parts = modifiers.map((m) => {
    const n = m.trim().toLowerCase();
    if (n === "cmd" || n === "command" || n === "meta" || n === "win") return "command down";
    if (n === "shift") return "shift down";
    if (n === "alt" || n === "option" || n === "opt") return "option down";
    if (n === "ctrl" || n === "control") return "control down";
    throw new Error(`unknown modifier: "${m}"`);
  });
  return ` using {${parts.join(", ")}}`;
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

// ---------- macOS action helpers (osascript) ----------

async function keyMacos(name: string): Promise<ActionResult> {
  try {
    const t = translateKey(name);
    const stmt =
      t.form === "code"
        ? `key code ${t.value}`
        : `keystroke "${escapeAppleScriptString(t.value)}"`;
    const script = `tell application "System Events" to ${stmt}`;
    await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
    return { ok: true, details: { key: name } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function keyComboMacos(combo: string): Promise<ActionResult> {
  try {
    const tokens = combo.split("+").map((t) => t.toLowerCase());
    if (tokens.length === 0 || tokens[0] === "") {
      throw new Error(`empty key_combo: "${combo}"`);
    }
    const keyName = tokens[tokens.length - 1];
    const modifiers = tokens.slice(0, -1);
    const t = translateKey(keyName);
    const using = buildModifiersClause(modifiers);
    const stmt =
      t.form === "code"
        ? `key code ${t.value}${using}`
        : `keystroke "${escapeAppleScriptString(t.value)}"${using}`;
    const script = `tell application "System Events" to ${stmt}`;
    await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
    return { ok: true, details: { combo } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function typeTextMacos(text: string): Promise<ActionResult> {
  if (text.length === 0) {
    return { ok: true, details: { text_length: 0 } };
  }
  try {
    const script = `tell application "System Events" to keystroke "${escapeAppleScriptString(text)}"`;
    await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
    return { ok: true, details: { text_length: text.length } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function clickMacos(target: { x: number; y: number }): Promise<ActionResult> {
  const { x, y } = target;
  const script = `
    tell application "System Events"
      tell (first application process whose frontmost is true)
        click at {${x}, ${y}}
      end tell
    end tell
  `;
  try {
    await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
    return { ok: true, details: { x, y } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------- action dispatch ----------

// All six macOS action branches dispatch through `osascript` so the
// privileged synthetic-input call is attributed to System Events (which
// holds Accessibility entitlement by default), not to the calling node
// binary (which doesn't, when Claude.app spawns the MCP via its
// disclaimer helper). See `docs/design-rationale.md` § "Why macOS action
// dispatch goes through AppleScript" for the full TCC-attribution story.
//
// Note: coordinate `click` here is AX-mediated via System Events, not a
// pixel-level CGEventPost. Apps with clean AX trees (most native macOS
// apps, Electron) accept the click cleanly. Apps where the click point
// doesn't resolve to an AX element (e.g., the Photoshop canvas interior)
// may swallow the click silently. True pixel clicks would need cliclick
// or a signed native helper (parking-lot 7); not in scope for v0.
export async function action(spec: ActionSpec): Promise<ActionResult> {
  const platform = currentPlatform();
  if (platform !== "macos") {
    return {
      ok: false,
      error: `action not yet implemented on ${platform} (Phase 7c+ polish; macOS works in Phase 4)`,
    };
  }
  switch (spec.type) {
    case "key":
      return await keyMacos(spec.key);
    case "key_combo": {
      const combo = resolvePlatformKeys(spec.keys, platform);
      return await keyComboMacos(combo);
    }
    case "type_text":
      return await typeTextMacos(spec.text);
    case "click": {
      if ("ax_path" in spec.target) {
        return {
          ok: false,
          error:
            "click via ax_path is not implemented in v0 — pass {x, y} coordinates, or wait for Phase 7",
        };
      }
      return await clickMacos(spec.target);
    }
    case "menu":
      return await menuMacos(spec.path);
    case "open_app":
      return await openAppMacos(spec);
  }
}

async function menuMacos(path: string[]): Promise<ActionResult> {
  if (path.length === 0) return { ok: false, error: "menu path empty" };
  // For path ["A", "B", "C"], click:
  //   menu item "C" of menu "B" of menu item "B" of menu "A" of menu bar item "A" of menu bar 1
  const top = `menu bar item "${escapeAppleScriptString(path[0])}" of menu bar 1`;
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
  let chain = `menu "${escapeAppleScriptString(path[0])}" of ${top}`;
  for (let i = 1; i < path.length - 1; i++) {
    chain = `menu "${escapeAppleScriptString(path[i])}" of menu item "${escapeAppleScriptString(path[i])}" of ${chain}`;
  }
  const target = `menu item "${escapeAppleScriptString(path[path.length - 1])}" of ${chain}`;
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
