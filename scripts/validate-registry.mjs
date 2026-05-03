#!/usr/bin/env node
// Validates registry/ against the JSON schemas plus four cross-cutting checks
// that JSON Schema can't enforce on its own (see PLAN.md, Phase 1).
//
// Exits 0 on success, 1 on any error. Error list is printed to stderr.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = join(ROOT, "registry");
const SCHEMAS_DIR = join(REGISTRY, "schemas");
const APPS_DIR = join(REGISTRY, "apps");

const ACTION_DEF_KEYS = [
  "keyAction",
  "keyComboAction",
  "typeTextAction",
  "clickAction",
  "menuAction",
  "openAppAction"
];
const PLACEHOLDER_RE = /\{([a-z][a-z0-9_]*)\}/g;

const errors = [];
const err = (message) => errors.push(message);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const metaSchema = readJson(join(SCHEMAS_DIR, "meta.schema.json"));
const workflowSchema = readJson(join(SCHEMAS_DIR, "workflow.schema.json"));
const shortcutSchema = readJson(join(SCHEMAS_DIR, "shortcut.schema.json"));

// strictRequired: false because our meta.schema.json uses if/then with `required`
// in the `then` clause; ajv strict mode otherwise complains that command_palette_shortcut
// isn't declared in the local `then` scope (it is, at the parent level — that's the point).
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

const validateMeta = ajv.compile(metaSchema);
const validateWorkflow = ajv.compile(workflowSchema);
const validateShortcut = ajv.compile(shortcutSchema);

// Check 1: action $defs in workflow and shortcut schemas are byte-identical.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonicalize(value[k]);
    return out;
  }
  return value;
}
function pickActionDefs(schema, label) {
  const defs = schema.$defs ?? {};
  const out = {};
  for (const k of ACTION_DEF_KEYS) {
    if (!(k in defs)) {
      err(`${label}: missing required action $def "${k}"`);
    }
    out[k] = defs[k];
  }
  return out;
}
{
  const wf = JSON.stringify(canonicalize(pickActionDefs(workflowSchema, "workflow.schema.json")));
  const sc = JSON.stringify(canonicalize(pickActionDefs(shortcutSchema, "shortcut.schema.json")));
  if (wf !== sc) {
    err(
      "Action $defs in workflow.schema.json and shortcut.schema.json have drifted apart. " +
      "Re-sync them: any change to keyAction / keyComboAction / typeTextAction / clickAction / menuAction / openAppAction must touch BOTH files."
    );
  }
}

// Walk apps/ and validate each.
const indexPath = join(REGISTRY, "index.json");
const indexJson = existsSync(indexPath) ? readJson(indexPath) : null;
const indexedAppIds = new Set((indexJson?.apps ?? []).map((a) => a.id));

const appDirs = existsSync(APPS_DIR)
  ? readdirSync(APPS_DIR).filter((name) => statSync(join(APPS_DIR, name)).isDirectory())
  : [];

for (const appId of appDirs) {
  const appDir = join(APPS_DIR, appId);
  const metaPath = join(appDir, "meta.json");
  const wfPath = join(appDir, "workflow.json");
  const scPath = join(appDir, "shortcuts.json");

  let meta, wf, sc;
  try { meta = readJson(metaPath); } catch (e) { err(`${metaPath}: ${e.message}`); continue; }
  try { wf = readJson(wfPath); } catch (e) { err(`${wfPath}: ${e.message}`); continue; }
  try { sc = readJson(scPath); } catch (e) { err(`${scPath}: ${e.message}`); continue; }

  // Schema validation.
  if (!validateMeta(meta)) {
    for (const e of validateMeta.errors) {
      err(`${metaPath}: ${e.instancePath || "/"} ${e.message}`);
    }
  }
  if (!validateWorkflow(wf)) {
    for (const e of validateWorkflow.errors) {
      err(`${wfPath}: ${e.instancePath || "/"} ${e.message}`);
    }
  }
  if (!validateShortcut(sc)) {
    for (const e of validateShortcut.errors) {
      err(`${scPath}: ${e.instancePath || "/"} ${e.message}`);
    }
  }

  // Check 2: cross-file id consistency.
  if (meta.id !== appId) err(`${metaPath}: meta.id "${meta.id}" must equal folder name "${appId}"`);
  if (wf.app_id !== appId) err(`${wfPath}: workflow.app_id "${wf.app_id}" must equal folder name "${appId}"`);
  if (sc.app_id !== appId) err(`${scPath}: shortcuts.app_id "${sc.app_id}" must equal folder name "${appId}"`);

  // Check 3: shortcut id uniqueness within shortcuts.json.
  const seen = new Map();
  for (let i = 0; i < (sc.shortcuts ?? []).length; i++) {
    const s = sc.shortcuts[i];
    if (typeof s?.id !== "string") continue;
    if (seen.has(s.id)) {
      err(`${scPath}: duplicate shortcut id "${s.id}" at indices ${seen.get(s.id)} and ${i}`);
    } else {
      seen.set(s.id, i);
    }
  }

  // Check 4: every {placeholder} in actions/verification must be a declared parameter.
  function* walkStrings(value) {
    if (typeof value === "string") {
      yield value;
    } else if (Array.isArray(value)) {
      for (const v of value) yield* walkStrings(v);
    } else if (value && typeof value === "object") {
      for (const v of Object.values(value)) yield* walkStrings(v);
    }
  }
  for (const s of sc.shortcuts ?? []) {
    if (!s) continue;
    const declared = new Set((s.parameters ?? []).map((p) => p.name));
    const used = new Set();
    for (const str of walkStrings(s.actions)) {
      for (const m of str.matchAll(PLACEHOLDER_RE)) used.add(m[1]);
    }
    for (const str of walkStrings(s.verification)) {
      for (const m of str.matchAll(PLACEHOLDER_RE)) used.add(m[1]);
    }
    for (const name of used) {
      if (!declared.has(name)) {
        err(`${scPath}: shortcut "${s.id}" uses placeholder {${name}} but does not declare a parameter named "${name}"`);
      }
    }
  }

  // Bonus: each app folder should appear in registry/index.json.
  if (indexJson && !indexedAppIds.has(appId)) {
    err(`registry/index.json: missing entry for app "${appId}" (folder exists at ${appDir})`);
  }
}

// Bonus: each entry in index.json should have a corresponding folder.
if (indexJson) {
  for (const entry of indexJson.apps ?? []) {
    if (!appDirs.includes(entry.id)) {
      err(`registry/index.json: lists app "${entry.id}" but no folder exists at registry/apps/${entry.id}/`);
    }
  }
}

if (errors.length === 0) {
  console.log(`OK: validated ${appDirs.length} app(s).`);
  process.exit(0);
} else {
  console.error(`FAIL: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
