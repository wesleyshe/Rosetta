// verify(): discriminated-union dispatcher over the six verification types.
// No magic — switch on spec.type, dispatch to a per-type handler, return a
// uniform VerificationResult.
//
// Implemented against the seed shortcuts' verification rules. Stateful
// AX rules (rule names ending in _toggled or _changed) and screenshot_diff
// require an `observation.before` snapshot supplied by the caller; the use
// seed skill is responsible for capturing that before running the action.
// Phase 5 will iterate the seed-skill text to make this explicit.

import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

import { readAxTree, screenshot, type AxResult, type ScreenshotResult } from "./os.js";
import { interpret } from "./interpret.js";

// ---------- types ----------

export type VerificationSpec =
  | { type: "ax_tree_assertion"; rule: string; value?: string }
  | { type: "dom_assertion"; selector: string; value?: string }
  | {
      type: "screenshot_diff";
      region?: { x: number; y: number; width: number; height: number };
      max_pixel_diff_ratio?: number;
    }
  | {
      type: "file_check";
      path: string;
      exists?: boolean;
      hash?: string;
      content_contains?: string;
    }
  | {
      type: "value_compare";
      left: unknown;
      right: unknown;
      comparator?: "equals" | "contains" | "starts_with" | "ends_with";
    }
  | { type: "interpret_check"; question: string; expected: string };

export interface VerifyOptions {
  /** Substituted into string fields with `{name}` placeholders. */
  parameters?: Record<string, string | number | boolean>;
  /** State captured before the action ran. Required for stateful AX
   *  rules and for screenshot_diff. */
  observation?: {
    before?: unknown;
  };
}

export interface VerificationResult {
  passed: boolean;
  /** Standardized error class for telemetry. Set when passed=false. */
  error_class?:
    | "verification_mismatch"
    | "ax_query_failed"
    | "ax_rule_not_implemented"
    | "missing_value"
    | "missing_before_state"
    | "stateful_rule_no_change"
    | "file_not_found"
    | "file_mismatch"
    | "hash_mismatch"
    | "content_mismatch"
    | "value_mismatch"
    | "screenshot_changed_too_much"
    | "interpret_mismatch"
    | "interpret_failed"
    | "dom_not_implemented"
    | "unknown_verification_type"
    | "unknown_comparator";
  /** Diagnostic data: what we observed, what we expected. */
  observation?: unknown;
  message?: string;
}

// ---------- public entry point ----------

export async function verify(
  spec: VerificationSpec,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  switch (spec.type) {
    case "ax_tree_assertion":
      return await verifyAx(spec, options);
    case "dom_assertion":
      return {
        passed: false,
        error_class: "dom_not_implemented",
        message: "dom_assertion is not implemented in v0 (no browser context)",
      };
    case "screenshot_diff":
      return await verifyScreenshotDiff(spec, options);
    case "file_check":
      return verifyFileCheck(spec, options);
    case "value_compare":
      return verifyValueCompare(spec, options);
    case "interpret_check":
      return await verifyInterpret(spec, options);
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = spec;
      return {
        passed: false,
        error_class: "unknown_verification_type",
        message: `Unknown verification type: ${(_exhaustive as { type: string }).type}`,
      };
    }
  }
}

// ---------- helpers ----------

const PLACEHOLDER_RE = /\{([a-z][a-z0-9_]*)\}/g;
const STATEFUL_RULE_SUFFIXES = ["_toggled", "_changed"];

function substitute(text: string, params: Record<string, string | number | boolean>): string {
  return text.replace(PLACEHOLDER_RE, (m, name: string) => {
    const v = params[name];
    return v == null ? m : String(v);
  });
}

function isStatefulRule(rule: string): boolean {
  return STATEFUL_RULE_SUFFIXES.some((s) => rule.endsWith(s));
}

// ---------- AX verification ----------

async function verifyAx(
  spec: Extract<VerificationSpec, { type: "ax_tree_assertion" }>,
  options: VerifyOptions
): Promise<VerificationResult> {
  const params = options.parameters ?? {};
  const value = spec.value ? substitute(spec.value, params) : undefined;

  // Map verification rule names to read_ax_tree primitives. Each verification
  // rule below is one of the named rules used by the seed shortcuts.
  switch (spec.rule) {
    case "active_editor_filename_contains": {
      if (!value) {
        return { passed: false, error_class: "missing_value", message: "rule requires `value`" };
      }
      const r = await readAxTree({ rule: "active_editor_filename" });
      if (!r.ok) {
        const isNotImplemented = r.error.includes("ax_rule_not_implemented");
        return {
          passed: false,
          error_class: isNotImplemented ? "ax_rule_not_implemented" : "ax_query_failed",
          message: r.error,
        };
      }
      const title = r.value ?? "";
      const matched = title.includes(value);
      return {
        passed: matched,
        error_class: matched ? undefined : "verification_mismatch",
        observation: { window_title: title, expected_substring: value },
      };
    }

    case "command_palette_visible":
    case "rename_widget_visible": {
      const r = await readAxTree({ rule: spec.rule });
      if (!r.ok) {
        const isNotImplemented = r.error.includes("ax_rule_not_implemented");
        return {
          passed: false,
          error_class: isNotImplemented ? "ax_rule_not_implemented" : "ax_query_failed",
          message: r.error,
        };
      }
      const matched = r.value === "true" || r.matched === true;
      return {
        passed: matched,
        error_class: matched ? undefined : "verification_mismatch",
        observation: { rule: spec.rule, raw: r },
      };
    }

    case "sidebar_visibility_toggled":
    case "terminal_panel_visibility_toggled": {
      // Stateful: caller must provide observation.before.
      if (options.observation?.before === undefined) {
        return {
          passed: false,
          error_class: "missing_before_state",
          message:
            `Stateful rule "${spec.rule}" requires observation.before — capture state via read_ax_tree before running the action.`,
        };
      }
      const probeRule =
        spec.rule === "sidebar_visibility_toggled" ? "sidebar_visible" : "terminal_panel_visible";
      const after = await readAxTree({ rule: probeRule });
      if (!after.ok) {
        const isNotImplemented = after.error.includes("ax_rule_not_implemented");
        return {
          passed: false,
          error_class: isNotImplemented ? "ax_rule_not_implemented" : "ax_query_failed",
          message: after.error,
        };
      }
      const beforeVal = options.observation.before;
      const afterVal = after.matched ?? after.value;
      const changed = beforeVal !== afterVal;
      return {
        passed: changed,
        error_class: changed ? undefined : "stateful_rule_no_change",
        observation: { before: beforeVal, after: afterVal },
      };
    }

    default:
      // Treat any other rule as not implemented — verify dispatcher does not
      // invent behavior. Phase 7 expands AX coverage.
      if (isStatefulRule(spec.rule)) {
        return {
          passed: false,
          error_class: "ax_rule_not_implemented",
          message: `Stateful rule "${spec.rule}" is not in v0's AX scope; consider interpret_check.`,
        };
      }
      return {
        passed: false,
        error_class: "ax_rule_not_implemented",
        message: `AX rule "${spec.rule}" is not in v0's scope (seed-rule set is documented in os.ts).`,
      };
  }
}

// ---------- file_check ----------

function verifyFileCheck(
  spec: Extract<VerificationSpec, { type: "file_check" }>,
  options: VerifyOptions
): VerificationResult {
  const params = options.parameters ?? {};
  const path = substitute(spec.path, params);
  const present = existsSync(path) && statSync(path).isFile();

  if (spec.exists !== undefined) {
    const matched = present === spec.exists;
    if (!matched) {
      return {
        passed: false,
        error_class: present ? "file_mismatch" : "file_not_found",
        observation: { path, exists: present, expected_exists: spec.exists },
        message: `expected exists=${spec.exists}, got ${present}`,
      };
    }
    if (!present) return { passed: true, observation: { path, exists: false } };
  } else if (!present) {
    return {
      passed: false,
      error_class: "file_not_found",
      observation: { path, exists: false },
      message: `file not found: ${path}`,
    };
  }

  if (spec.hash) {
    const buf = readFileSync(path);
    const actual = createHash("sha256").update(buf).digest("hex");
    if (actual !== spec.hash) {
      return {
        passed: false,
        error_class: "hash_mismatch",
        observation: { path, hash_actual: actual, hash_expected: spec.hash },
      };
    }
  }
  if (spec.content_contains) {
    const text = readFileSync(path, "utf8");
    const needle = substitute(spec.content_contains, params);
    if (!text.includes(needle)) {
      return {
        passed: false,
        error_class: "content_mismatch",
        observation: { path, expected_substring: needle },
      };
    }
  }

  return { passed: true, observation: { path, exists: true } };
}

// ---------- value_compare ----------

function verifyValueCompare(
  spec: Extract<VerificationSpec, { type: "value_compare" }>,
  options: VerifyOptions
): VerificationResult {
  const params = options.parameters ?? {};
  const sub = (v: unknown): unknown =>
    typeof v === "string" ? substitute(v, params) : v;
  const left = sub(spec.left);
  const right = sub(spec.right);
  const cmp = spec.comparator ?? "equals";

  let passed: boolean;
  switch (cmp) {
    case "equals":
      passed = left === right;
      break;
    case "contains":
      passed = String(left).includes(String(right));
      break;
    case "starts_with":
      passed = String(left).startsWith(String(right));
      break;
    case "ends_with":
      passed = String(left).endsWith(String(right));
      break;
    default:
      return {
        passed: false,
        error_class: "unknown_comparator",
        message: `Unknown comparator: ${cmp}`,
      };
  }

  return {
    passed,
    error_class: passed ? undefined : "value_mismatch",
    observation: { left, right, comparator: cmp },
  };
}

// ---------- screenshot_diff ----------

async function verifyScreenshotDiff(
  spec: Extract<VerificationSpec, { type: "screenshot_diff" }>,
  options: VerifyOptions
): Promise<VerificationResult> {
  const before = options.observation?.before as ScreenshotResult | undefined;
  if (!before || typeof before !== "object" || typeof (before as ScreenshotResult).base64 !== "string") {
    return {
      passed: false,
      error_class: "missing_before_state",
      message:
        "screenshot_diff requires observation.before to be a ScreenshotResult captured pre-action.",
    };
  }
  const after = await screenshot(spec.region);
  const ratio = approximateDiffRatio(before.base64, after.base64);
  const max = spec.max_pixel_diff_ratio ?? 0.02;

  return {
    passed: ratio <= max,
    error_class: ratio > max ? "screenshot_changed_too_much" : undefined,
    observation: {
      diff_ratio: ratio,
      max_allowed: max,
      before_path: before.path,
      after_path: after.path,
      note: "v0 uses byte-level approximation, not true pixel diff. Proper PNG-decoded pixel comparison is parking-lot 5-adjacent (Phase 7). For visible-toggle verifications use interpret_check.",
    },
  };
}

/**
 * Crude byte-level approximation of pixel diff. PNGs of different sizes
 * report ratio = 1.0 (totally different). Otherwise, ratio is the fraction
 * of bytes that differ at corresponding offsets. Highly imprecise for true
 * pixel-level work — proper PNG decoding is deferred (see parking-lot 5 +
 * the Phase 7 polish substep). Acceptable v0 behavior because no seed
 * shortcut uses screenshot_diff.
 */
function approximateDiffRatio(beforeBase64: string, afterBase64: string): number {
  const a = Buffer.from(beforeBase64, "base64");
  const b = Buffer.from(afterBase64, "base64");
  if (a.length === 0 || b.length === 0) return 1;
  if (a.length !== b.length) return 1;
  let differing = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) differing++;
  }
  return differing / a.length;
}

// ---------- interpret_check ----------

async function verifyInterpret(
  spec: Extract<VerificationSpec, { type: "interpret_check" }>,
  options: VerifyOptions
): Promise<VerificationResult> {
  const params = options.parameters ?? {};
  const question = substitute(spec.question, params);
  const expected = substitute(spec.expected, params);

  let answer: string;
  let provider: string;
  let model: string;
  try {
    const shot = await screenshot();
    const r = await interpret({ image_base64: shot.base64, question });
    answer = r.answer;
    provider = r.provider;
    model = r.model;
  } catch (e) {
    return {
      passed: false,
      error_class: "interpret_failed",
      message: (e as Error).message,
    };
  }

  const matched = answer.toLowerCase().includes(expected.toLowerCase());
  return {
    passed: matched,
    error_class: matched ? undefined : "interpret_mismatch",
    observation: { question, expected, answer, provider, model },
  };
}
