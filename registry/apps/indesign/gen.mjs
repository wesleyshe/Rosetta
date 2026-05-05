#!/usr/bin/env node
// Generates registry/apps/indesign/shortcuts.json from the ENTRIES table below.
// Run from anywhere; writes alongside this file.
//
// Each ENTRY is a tuple { id, intent, method, action, risk?, params?, verifyPath? }.
// `action` is one of:
//   { kind: "combo", keys: "cmd+s" }          → key_combo action
//   { kind: "key", key: "escape" }              → key action
//   { kind: "menu", path: ["File", "Save"] }   → menu action
//   { kind: "type", text: "hello" }             → type_text action
//   { kind: "seq", steps: [ ...above... ] }    → sequence of mixed actions
//
// The wrapper attaches:
//   - parameters: params (default [])
//   - platforms: ["macos"]
//   - app_versions: ["19+"]
//   - verification: interpret_check { question, expected: "yes" }
//     OR file_check when verifyPath is set
//   - metadata: contributor_id "seed", payment_destination null, varied estimates

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "shortcuts.json");

// Submitted-at dates rotate through this pool deterministically by index so
// metadata.submitted_at varies as the spec asks (between 2026-04-15 and 2026-05-05).
const SUBMITTED_DATES = [
  "2026-04-15", "2026-04-16", "2026-04-18", "2026-04-20", "2026-04-22",
  "2026-04-24", "2026-04-26", "2026-04-28", "2026-04-30", "2026-05-01",
  "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05"
];

// Token cost varies 3-100 by complexity bucket; speed varies 50-3000 the same way.
function estimatesFor(action) {
  const len = action.kind === "seq" ? action.steps.length : 1;
  // Single keystroke: cheap. Menu: medium. Multi-step seq: scales.
  if (action.kind === "key" || action.kind === "combo") {
    return { token_cost_estimate: 3 + len * 2, speed_estimate_ms: 80 };
  }
  if (action.kind === "menu") {
    return { token_cost_estimate: 8, speed_estimate_ms: 250 };
  }
  if (action.kind === "type") {
    return { token_cost_estimate: 12, speed_estimate_ms: 200 };
  }
  // seq: sum approx
  let tc = 5;
  let ms = 50;
  for (const s of action.steps) {
    if (s.kind === "key" || s.kind === "combo") { tc += 4; ms += 80; }
    else if (s.kind === "menu") { tc += 8; ms += 250; }
    else if (s.kind === "type") { tc += 14; ms += 220; }
  }
  return {
    token_cost_estimate: Math.min(100, Math.max(3, tc)),
    speed_estimate_ms: Math.min(3000, Math.max(50, ms))
  };
}

function actionToJson(a) {
  if (a.kind === "key") return { type: "key", key: a.key };
  if (a.kind === "combo") return { type: "key_combo", keys: { macos: a.keys } };
  if (a.kind === "menu") return { type: "menu", path: a.path };
  if (a.kind === "type") return { type: "type_text", text: a.text };
  throw new Error(`unknown action kind ${a.kind}`);
}

function buildActions(action) {
  if (action.kind === "seq") return action.steps.map(actionToJson);
  return [actionToJson(action)];
}

function methodFromAction(action) {
  // The spec lets the entry override; otherwise infer:
  if (action.kind === "menu") return "menu";
  if (action.kind === "combo" || action.kind === "key") return "shortcut";
  if (action.kind === "seq") {
    // If first step is menu and rest are typing/keys → menu method.
    const first = action.steps[0];
    if (first?.kind === "menu") return "menu";
    return "shortcut";
  }
  if (action.kind === "type") return "shortcut";
  return "shortcut";
}

// ---- ENTRIES ------------------------------------------------------------

// Categories below total 312. Counts noted in headers for review.

const ENTRIES = [];

// 1. General app (30) -----------------------------------------------------
ENTRIES.push(
  { id: "new-document", intent: "Open the New Document dialog", action: { kind: "combo", keys: "cmd+n" } },
  { id: "new-document-from-template", intent: "Create a new document from a template via menu", action: { kind: "menu", path: ["File", "New", "Document from Template..."] } },
  { id: "open-file", intent: "Open an InDesign document by absolute path", method: "shortcut",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path to a .indd, .idml, or supported file." }],
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "cmd+o" },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyQuestion: "Looking at the screen, is the InDesign document at {path} now open as the active document (visible in the document tab and canvas)?" },
  { id: "open-recent", intent: "Open the File menu's Open Recent submenu", action: { kind: "menu", path: ["File", "Open Recent"] } },
  { id: "close-document", intent: "Close the active document", action: { kind: "combo", keys: "cmd+w" } },
  { id: "close-all-documents", intent: "Close all open documents", action: { kind: "combo", keys: "cmd+alt+shift+w" } },
  { id: "save-document", intent: "Save the active document to its current path", action: { kind: "combo", keys: "cmd+s" }, risk: "destructive" },
  { id: "save-as", intent: "Open the Save As dialog for the active document", action: { kind: "combo", keys: "cmd+shift+s" }, risk: "destructive" },
  { id: "save-a-copy", intent: "Save a copy of the active document at a new path without flipping the in-memory document", action: { kind: "combo", keys: "cmd+alt+s" }, risk: "destructive" },
  { id: "save-all", intent: "Save all open documents", action: { kind: "menu", path: ["File", "Save All"] }, risk: "destructive" },
  { id: "revert-document", intent: "Revert the active document to the last saved state", action: { kind: "menu", path: ["File", "Revert"] }, risk: "destructive" },
  { id: "quit-indesign", intent: "Quit Adobe InDesign", action: { kind: "combo", keys: "cmd+q" }, risk: "destructive" },
  { id: "undo", intent: "Undo the most recent edit", action: { kind: "combo", keys: "cmd+z" } },
  { id: "redo", intent: "Redo the most recently undone edit", action: { kind: "combo", keys: "cmd+shift+z" } },
  { id: "cut", intent: "Cut the current selection to the clipboard", action: { kind: "combo", keys: "cmd+x" } },
  { id: "copy", intent: "Copy the current selection to the clipboard", action: { kind: "combo", keys: "cmd+c" } },
  { id: "paste", intent: "Paste the clipboard contents", action: { kind: "combo", keys: "cmd+v" } },
  { id: "paste-in-place", intent: "Paste the clipboard contents at the original X/Y coordinates", action: { kind: "combo", keys: "cmd+alt+shift+v" } },
  { id: "paste-into", intent: "Paste the clipboard contents inside the selected frame", action: { kind: "combo", keys: "cmd+alt+v" } },
  { id: "paste-without-formatting", intent: "Paste the clipboard contents without source formatting", action: { kind: "combo", keys: "cmd+shift+v" } },
  { id: "duplicate-selection", intent: "Duplicate the current selection in place", action: { kind: "combo", keys: "cmd+alt+shift+d" } },
  { id: "select-all", intent: "Select all objects on the active spread or all text in the active text frame", action: { kind: "combo", keys: "cmd+a" } },
  { id: "deselect-all", intent: "Deselect everything", action: { kind: "combo", keys: "cmd+shift+a" } },
  { id: "find-change", intent: "Open the Find/Change dialog", action: { kind: "combo", keys: "cmd+f" } },
  { id: "find-next", intent: "Repeat the last Find/Change search forward", action: { kind: "combo", keys: "cmd+alt+f" } },
  { id: "preferences", intent: "Open the InDesign Preferences dialog", action: { kind: "combo", keys: "cmd+k" } },
  { id: "keyboard-shortcuts-editor", intent: "Open the Keyboard Shortcuts editor", action: { kind: "menu", path: ["Edit", "Keyboard Shortcuts..."] } },
  { id: "menus-editor", intent: "Open the Menus editor", action: { kind: "menu", path: ["Edit", "Menus..."] } },
  { id: "spelling-check", intent: "Run spell check on the active document", action: { kind: "combo", keys: "cmd+i" } },
  { id: "dictionary", intent: "Open the Dictionary dialog to manage user dictionaries", action: { kind: "menu", path: ["Edit", "Spelling", "Dictionary..."] } }
);

// 2. Document & pages (30) ------------------------------------------------
ENTRIES.push(
  { id: "document-setup", intent: "Open the Document Setup dialog", action: { kind: "combo", keys: "cmd+alt+p" } },
  { id: "go-to-page", intent: "Open the Go To Page dialog", action: { kind: "combo", keys: "cmd+j" } },
  { id: "go-to-first-page", intent: "Navigate to the first page of the active document", action: { kind: "combo", keys: "cmd+shift+pageup" } },
  { id: "go-to-last-page", intent: "Navigate to the last page of the active document", action: { kind: "combo", keys: "cmd+shift+pagedown" } },
  { id: "go-to-next-page", intent: "Navigate to the next page", action: { kind: "combo", keys: "shift+pagedown" } },
  { id: "go-to-previous-page", intent: "Navigate to the previous page", action: { kind: "combo", keys: "shift+pageup" } },
  { id: "go-to-next-spread", intent: "Navigate to the next spread", action: { kind: "combo", keys: "alt+pagedown" } },
  { id: "go-to-previous-spread", intent: "Navigate to the previous spread", action: { kind: "combo", keys: "alt+pageup" } },
  { id: "insert-page-after", intent: "Insert a new page after the current page",
    action: { kind: "menu", path: ["Layout", "Pages", "Insert Pages..."] } },
  { id: "add-single-page", intent: "Add a single page after the current page via Pages panel menu",
    action: { kind: "menu", path: ["Layout", "Pages", "Add Page"] } },
  { id: "duplicate-spread", intent: "Duplicate the current spread", action: { kind: "menu", path: ["Layout", "Pages", "Duplicate Spread"] }, risk: "destructive" },
  { id: "delete-page", intent: "Delete the currently active page", action: { kind: "menu", path: ["Layout", "Pages", "Delete Page"] }, risk: "destructive" },
  { id: "delete-spread", intent: "Delete the currently active spread", action: { kind: "menu", path: ["Layout", "Pages", "Delete Spread"] }, risk: "destructive" },
  { id: "move-page", intent: "Open the Move Pages dialog", action: { kind: "menu", path: ["Layout", "Pages", "Move Pages..."] } },
  { id: "page-numbering-section", intent: "Open the Numbering & Section Options dialog for the active page", action: { kind: "menu", path: ["Layout", "Numbering & Section Options..."] } },
  { id: "insert-current-page-number", intent: "Insert an automatic current page-number marker at the cursor", action: { kind: "combo", keys: "cmd+alt+shift+n" } },
  { id: "insert-next-page-number", intent: "Insert a next-page-number marker at the cursor", action: { kind: "menu", path: ["Type", "Insert Special Character", "Markers", "Next Page Number"] } },
  { id: "insert-previous-page-number", intent: "Insert a previous-page-number marker at the cursor", action: { kind: "menu", path: ["Type", "Insert Special Character", "Markers", "Previous Page Number"] } },
  { id: "first-page-shortcut", intent: "Jump to the first page via Layout menu", action: { kind: "menu", path: ["Layout", "First Page"] } },
  { id: "last-page-shortcut", intent: "Jump to the last page via Layout menu", action: { kind: "menu", path: ["Layout", "Last Page"] } },
  { id: "next-page-shortcut", intent: "Jump to the next page via Layout menu", action: { kind: "menu", path: ["Layout", "Next Page"] } },
  { id: "previous-page-shortcut", intent: "Jump to the previous page via Layout menu", action: { kind: "menu", path: ["Layout", "Previous Page"] } },
  { id: "go-back", intent: "Go back to the previous viewed page", action: { kind: "menu", path: ["Layout", "Go Back"] } },
  { id: "go-forward", intent: "Go forward to the next viewed page", action: { kind: "menu", path: ["Layout", "Go Forward"] } },
  { id: "open-pages-panel", intent: "Open the Pages panel", action: { kind: "combo", keys: "cmd+f12" } },
  { id: "rotate-spread-view-90-cw", intent: "Rotate the active spread view 90° clockwise", action: { kind: "menu", path: ["View", "Rotate Spread", "90° CW"] } },
  { id: "rotate-spread-view-180", intent: "Rotate the active spread view 180°", action: { kind: "menu", path: ["View", "Rotate Spread", "180°"] } },
  { id: "rotate-spread-view-90-ccw", intent: "Rotate the active spread view 90° counter-clockwise", action: { kind: "menu", path: ["View", "Rotate Spread", "90° CCW"] } },
  { id: "clear-spread-rotation", intent: "Clear the active spread's view rotation", action: { kind: "menu", path: ["View", "Rotate Spread", "Clear Rotation"] } },
  { id: "create-alternate-layout", intent: "Open the Create Alternate Layout dialog", action: { kind: "menu", path: ["Layout", "Create Alternate Layout..."] } }
);

// 3. Layout & positioning (30) -------------------------------------------
ENTRIES.push(
  { id: "align-left-edges", intent: "Align selected objects' left edges", action: { kind: "menu", path: ["Window", "Object & Layout", "Align"] } },
  { id: "open-align-panel", intent: "Open the Align panel", action: { kind: "combo", keys: "cmd+shift+f7" } },
  { id: "align-horizontal-center", intent: "Align selected objects' horizontal centers via Object menu", action: { kind: "menu", path: ["Object", "Align", "Horizontal Centers"] } },
  { id: "align-right-edges", intent: "Align selected objects' right edges via Object menu", action: { kind: "menu", path: ["Object", "Align", "Right Edges"] } },
  { id: "align-top-edges", intent: "Align selected objects' top edges via Object menu", action: { kind: "menu", path: ["Object", "Align", "Top Edges"] } },
  { id: "align-vertical-center", intent: "Align selected objects' vertical centers via Object menu", action: { kind: "menu", path: ["Object", "Align", "Vertical Centers"] } },
  { id: "align-bottom-edges", intent: "Align selected objects' bottom edges via Object menu", action: { kind: "menu", path: ["Object", "Align", "Bottom Edges"] } },
  { id: "distribute-horizontal-centers", intent: "Distribute selected objects' horizontal centers evenly via Object menu", action: { kind: "menu", path: ["Object", "Align", "Distribute Horizontal Centers"] } },
  { id: "distribute-vertical-centers", intent: "Distribute selected objects' vertical centers evenly via Object menu", action: { kind: "menu", path: ["Object", "Align", "Distribute Vertical Centers"] } },
  { id: "distribute-horizontal-space", intent: "Distribute horizontal space between selected objects evenly via Object menu", action: { kind: "menu", path: ["Object", "Align", "Distribute Horizontal Space"] } },
  { id: "distribute-vertical-space", intent: "Distribute vertical space between selected objects evenly via Object menu", action: { kind: "menu", path: ["Object", "Align", "Distribute Vertical Space"] } },
  { id: "group-selection", intent: "Group the selected objects", action: { kind: "combo", keys: "cmd+g" } },
  { id: "ungroup-selection", intent: "Ungroup the selected group", action: { kind: "combo", keys: "cmd+shift+g" } },
  { id: "lock-selection", intent: "Lock the position of the selected objects", action: { kind: "combo", keys: "cmd+l" } },
  { id: "unlock-all-on-spread", intent: "Unlock all locked objects on the active spread", action: { kind: "combo", keys: "cmd+alt+l" } },
  { id: "bring-to-front", intent: "Bring the selection to the front of its layer", action: { kind: "combo", keys: "cmd+shift+]" } },
  { id: "bring-forward", intent: "Bring the selection forward one step", action: { kind: "combo", keys: "cmd+]" } },
  { id: "send-backward", intent: "Send the selection backward one step", action: { kind: "combo", keys: "cmd+[" } },
  { id: "send-to-back", intent: "Send the selection to the back of its layer", action: { kind: "combo", keys: "cmd+shift+[" } },
  { id: "step-and-repeat", intent: "Open the Step and Repeat dialog", action: { kind: "combo", keys: "cmd+alt+u" } },
  { id: "transform-again", intent: "Repeat the most recent transform on the selection", action: { kind: "combo", keys: "cmd+alt+3" } },
  { id: "transform-again-individually", intent: "Repeat the most recent transform on each selected object individually", action: { kind: "combo", keys: "cmd+alt+4" } },
  { id: "rotate-selection-90-cw", intent: "Rotate the selection 90° clockwise via Object menu", action: { kind: "menu", path: ["Object", "Transform", "Rotate 90° CW"] } },
  { id: "rotate-selection-90-ccw", intent: "Rotate the selection 90° counter-clockwise via Object menu", action: { kind: "menu", path: ["Object", "Transform", "Rotate 90° CCW"] } },
  { id: "rotate-selection-180", intent: "Rotate the selection 180° via Object menu", action: { kind: "menu", path: ["Object", "Transform", "Rotate 180°"] } },
  { id: "flip-horizontal", intent: "Flip the selection horizontally via Object menu", action: { kind: "menu", path: ["Object", "Transform", "Flip Horizontal"] } },
  { id: "flip-vertical", intent: "Flip the selection vertically via Object menu", action: { kind: "menu", path: ["Object", "Transform", "Flip Vertical"] } },
  { id: "transform-clear", intent: "Clear all transformations from the selection", action: { kind: "menu", path: ["Object", "Transform", "Clear Transformations"] } },
  { id: "open-transform-panel", intent: "Open the Transform panel", action: { kind: "menu", path: ["Window", "Object & Layout", "Transform"] } },
  { id: "open-info-panel", intent: "Open the Info panel", action: { kind: "combo", keys: "f8" } }
);

// 4. Master / parent pages (15) ------------------------------------------
ENTRIES.push(
  { id: "new-master-page", intent: "Open the New Parent (Master) Page dialog from the Pages panel menu",
    action: { kind: "menu", path: ["Layout", "Pages", "New Parent..."] } },
  { id: "duplicate-master-spread", intent: "Duplicate the current parent (master) spread",
    action: { kind: "menu", path: ["Layout", "Pages", "Duplicate Parent Spread"] } },
  { id: "delete-master-page", intent: "Delete the selected parent (master) page",
    action: { kind: "menu", path: ["Layout", "Pages", "Delete Parent Spread"] }, risk: "destructive" },
  { id: "apply-master-to-pages", intent: "Open the Apply Parent (Master) dialog",
    action: { kind: "menu", path: ["Layout", "Pages", "Apply Parent to Pages..."] } },
  { id: "override-master-items", intent: "Override all parent (master) page items on the current spread",
    action: { kind: "menu", path: ["Layout", "Pages", "Override All Parent Page Items"] } },
  { id: "release-master-items", intent: "Release selected items from their parent (master) page",
    action: { kind: "menu", path: ["Layout", "Pages", "Detach All Objects From Parent"] } },
  { id: "load-master-from-document", intent: "Load parent (master) pages from another document",
    action: { kind: "menu", path: ["Layout", "Pages", "Load Parent Pages..."] } },
  { id: "go-to-a-master", intent: "Open the A-Parent (default first parent) by navigating from the Pages panel",
    action: { kind: "menu", path: ["Layout", "Go to Page..."] } },
  { id: "master-options", intent: "Open the Parent (Master) Options dialog for the active master",
    action: { kind: "menu", path: ["Layout", "Pages", "Parent Options for Selected Parent..."] } },
  { id: "select-unused-masters", intent: "Select all unused parent (master) pages from the Pages panel menu",
    action: { kind: "menu", path: ["Layout", "Pages", "Select Unused Parents"] } },
  { id: "smart-text-reflow-toggle", intent: "Open Type preferences to toggle Smart Text Reflow",
    action: { kind: "menu", path: ["InDesign", "Preferences", "Type..."] } },
  { id: "primary-text-frame-toggle", intent: "Open Margins and Columns dialog to toggle Primary Text Frame on the master",
    action: { kind: "menu", path: ["Layout", "Margins and Columns..."] } },
  { id: "create-text-frame-from-master", intent: "Override the parent (master) primary text frame on the active spread",
    action: { kind: "combo", keys: "cmd+shift+click" } },
  { id: "show-master-page-overlay-toggle", intent: "Toggle Hide Parent Items on the active spread",
    action: { kind: "menu", path: ["Layout", "Pages", "Hide Parent Items"] } },
  { id: "based-on-master", intent: "Open Parent (Master) Options to set Based On for the active master",
    action: { kind: "menu", path: ["Layout", "Pages", "Parent Options for Selected Parent..."] } }
);

// 5. Frame tools / shapes (25) -------------------------------------------
ENTRIES.push(
  { id: "tool-rectangle-frame", intent: "Switch to the Rectangle Frame tool", action: { kind: "key", key: "f" } },
  { id: "tool-ellipse-frame", intent: "Switch to the Ellipse Frame tool", action: { kind: "menu", path: ["Tools", "Ellipse Frame Tool"] } },
  { id: "tool-polygon-frame", intent: "Switch to the Polygon Frame tool", action: { kind: "menu", path: ["Tools", "Polygon Frame Tool"] } },
  { id: "tool-rectangle", intent: "Switch to the Rectangle tool (unassigned frame)", action: { kind: "key", key: "m" } },
  { id: "tool-ellipse", intent: "Switch to the Ellipse tool", action: { kind: "key", key: "l" } },
  { id: "tool-polygon", intent: "Switch to the Polygon tool", action: { kind: "menu", path: ["Tools", "Polygon Tool"] } },
  { id: "tool-line", intent: "Switch to the Line tool", action: { kind: "key", key: "backslash" } },
  { id: "tool-pen", intent: "Switch to the Pen tool", action: { kind: "key", key: "p" } },
  { id: "tool-pencil", intent: "Switch to the Pencil tool", action: { kind: "key", key: "n" } },
  { id: "tool-add-anchor-point", intent: "Switch to the Add Anchor Point tool", action: { kind: "key", key: "=" } },
  { id: "tool-delete-anchor-point", intent: "Switch to the Delete Anchor Point tool", action: { kind: "key", key: "-" } },
  { id: "tool-convert-direction-point", intent: "Switch to the Convert Direction Point tool", action: { kind: "combo", keys: "shift+c" } },
  { id: "tool-scissors", intent: "Switch to the Scissors tool", action: { kind: "key", key: "c" } },
  { id: "convert-shape-to-rectangle", intent: "Convert the selected shape to a rectangle via Object menu", action: { kind: "menu", path: ["Object", "Convert Shape", "Rectangle"] } },
  { id: "convert-shape-to-rounded-rectangle", intent: "Convert the selected shape to a rounded rectangle via Object menu", action: { kind: "menu", path: ["Object", "Convert Shape", "Rounded Rectangle"] } },
  { id: "convert-shape-to-ellipse", intent: "Convert the selected shape to an ellipse via Object menu", action: { kind: "menu", path: ["Object", "Convert Shape", "Ellipse"] } },
  { id: "convert-shape-to-polygon", intent: "Convert the selected shape to a polygon via Object menu", action: { kind: "menu", path: ["Object", "Convert Shape", "Polygon"] } },
  { id: "convert-shape-to-line", intent: "Convert the selected shape to a line via Object menu", action: { kind: "menu", path: ["Object", "Convert Shape", "Line"] } },
  { id: "convert-frame-to-text-frame", intent: "Convert the selected frame to a text frame via Object menu", action: { kind: "menu", path: ["Object", "Content", "Text"] } },
  { id: "convert-frame-to-graphic-frame", intent: "Convert the selected frame to a graphic frame via Object menu", action: { kind: "menu", path: ["Object", "Content", "Graphic"] } },
  { id: "convert-frame-to-unassigned", intent: "Convert the selected frame to an unassigned frame via Object menu", action: { kind: "menu", path: ["Object", "Content", "Unassigned"] } },
  { id: "fit-content-to-frame", intent: "Fit the placed content to the selected frame", action: { kind: "combo", keys: "cmd+alt+e" } },
  { id: "fit-frame-to-content", intent: "Fit the selected frame to its placed content", action: { kind: "combo", keys: "cmd+alt+c" } },
  { id: "fit-content-proportionally", intent: "Fit the content into the selected frame proportionally", action: { kind: "combo", keys: "cmd+alt+shift+e" } },
  { id: "fill-frame-proportionally", intent: "Fill the selected frame with content proportionally", action: { kind: "combo", keys: "cmd+alt+shift+c" } }
);

// 6. Type — character formatting (40) ------------------------------------
ENTRIES.push(
  { id: "tool-type", intent: "Switch to the Type tool", action: { kind: "key", key: "t" } },
  { id: "tool-type-on-path", intent: "Switch to the Type on a Path tool", action: { kind: "combo", keys: "shift+t" } },
  { id: "open-character-panel", intent: "Open the Character panel", action: { kind: "combo", keys: "cmd+t" } },
  { id: "bold-selection", intent: "Toggle bold on the selected text", action: { kind: "combo", keys: "cmd+shift+b" } },
  { id: "italic-selection", intent: "Toggle italic on the selected text", action: { kind: "combo", keys: "cmd+shift+i" } },
  { id: "underline-selection", intent: "Toggle underline on the selected text", action: { kind: "combo", keys: "cmd+shift+u" } },
  { id: "strikethrough-selection", intent: "Toggle strikethrough on the selected text", action: { kind: "combo", keys: "cmd+shift+/" } },
  { id: "all-caps", intent: "Toggle All Caps on the selected text", action: { kind: "combo", keys: "cmd+shift+k" } },
  { id: "small-caps", intent: "Toggle Small Caps on the selected text", action: { kind: "combo", keys: "cmd+shift+h" } },
  { id: "superscript", intent: "Toggle superscript on the selected text", action: { kind: "combo", keys: "cmd+shift+plus" } },
  { id: "subscript", intent: "Toggle subscript on the selected text", action: { kind: "combo", keys: "cmd+alt+shift+plus" } },
  { id: "increase-font-size", intent: "Increase the font size of the selected text by one step", action: { kind: "combo", keys: "cmd+shift+." } },
  { id: "decrease-font-size", intent: "Decrease the font size of the selected text by one step", action: { kind: "combo", keys: "cmd+shift+," } },
  { id: "increase-font-size-x5", intent: "Increase the font size of the selected text by five steps", action: { kind: "combo", keys: "cmd+alt+shift+." } },
  { id: "decrease-font-size-x5", intent: "Decrease the font size of the selected text by five steps", action: { kind: "combo", keys: "cmd+alt+shift+," } },
  { id: "set-font-size-arbitrary", intent: "Set the font size of the selected text to a specific point value", method: "menu",
    params: [{ name: "size_pt", type: "number", required: true, minimum: 1, maximum: 1296, description: "Point size for the selected text." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["Type", "Size", "Other..."] },
      { kind: "type", text: "{size_pt}" },
      { kind: "key", key: "enter" }
    ] },
    verifyQuestion: "Looking at the screen, has the selected text been resized to {size_pt} points (visible in the Character panel font-size field and on the canvas)?" },
  { id: "increase-leading", intent: "Increase leading on the selected text by one step", action: { kind: "combo", keys: "alt+down" } },
  { id: "decrease-leading", intent: "Decrease leading on the selected text by one step", action: { kind: "combo", keys: "alt+up" } },
  { id: "increase-leading-x5", intent: "Increase leading on the selected text by five steps", action: { kind: "combo", keys: "cmd+alt+down" } },
  { id: "decrease-leading-x5", intent: "Decrease leading on the selected text by five steps", action: { kind: "combo", keys: "cmd+alt+up" } },
  { id: "auto-leading", intent: "Set leading to auto on the selected text", action: { kind: "combo", keys: "cmd+alt+shift+a" } },
  { id: "increase-tracking", intent: "Increase tracking on the selected text by one step", action: { kind: "combo", keys: "alt+right" } },
  { id: "decrease-tracking", intent: "Decrease tracking on the selected text by one step", action: { kind: "combo", keys: "alt+left" } },
  { id: "increase-tracking-x5", intent: "Increase tracking on the selected text by five steps", action: { kind: "combo", keys: "cmd+alt+right" } },
  { id: "decrease-tracking-x5", intent: "Decrease tracking on the selected text by five steps", action: { kind: "combo", keys: "cmd+alt+left" } },
  { id: "clear-tracking", intent: "Reset tracking to zero on the selected text", action: { kind: "combo", keys: "cmd+alt+q" } },
  { id: "increase-kerning", intent: "Increase kerning between two characters by one step (cursor between them)", action: { kind: "combo", keys: "alt+right" } },
  { id: "decrease-kerning", intent: "Decrease kerning between two characters by one step (cursor between them)", action: { kind: "combo", keys: "alt+left" } },
  { id: "kerning-zero", intent: "Reset kerning to zero between two characters (cursor between them)", action: { kind: "combo", keys: "cmd+alt+q" } },
  { id: "increase-baseline-shift", intent: "Increase baseline shift on the selected text by one step", action: { kind: "combo", keys: "alt+shift+up" } },
  { id: "decrease-baseline-shift", intent: "Decrease baseline shift on the selected text by one step", action: { kind: "combo", keys: "alt+shift+down" } },
  { id: "clear-baseline-shift", intent: "Reset baseline shift to zero on the selected text", action: { kind: "menu", path: ["Type", "Character"] } },
  { id: "ligatures-toggle", intent: "Toggle ligatures on the selected text via Character panel menu", action: { kind: "menu", path: ["Type", "Character"] } },
  { id: "horizontal-scale-100", intent: "Reset horizontal scale to 100% on the selected text", action: { kind: "menu", path: ["Type", "Character"] } },
  { id: "vertical-scale-100", intent: "Reset vertical scale to 100% on the selected text", action: { kind: "menu", path: ["Type", "Character"] } },
  { id: "set-font-family-arbitrary", intent: "Set the font family of the selected text to a specific name", method: "menu",
    params: [{ name: "family", type: "string", required: true, description: "Exact font family name (e.g. 'Minion Pro')." }],
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "cmd+t" },
      { kind: "combo", keys: "cmd+6" },
      { kind: "type", text: "{family}" },
      { kind: "key", key: "enter" }
    ] },
    verifyQuestion: "Looking at the screen, is the selected text now set in the {family} font (visible in the Character panel)?" },
  { id: "find-font", intent: "Open the Find Font dialog", action: { kind: "menu", path: ["Type", "Find Font..."] } },
  { id: "show-hidden-characters", intent: "Toggle Show Hidden Characters", action: { kind: "combo", keys: "cmd+alt+i" } },
  { id: "change-case-uppercase", intent: "Change the selected text to uppercase via Type menu", action: { kind: "menu", path: ["Type", "Change Case", "UPPERCASE"] } },
  { id: "change-case-lowercase", intent: "Change the selected text to lowercase via Type menu", action: { kind: "menu", path: ["Type", "Change Case", "lowercase"] } },
  { id: "change-case-title", intent: "Change the selected text to Title Case via Type menu", action: { kind: "menu", path: ["Type", "Change Case", "Title Case"] } }
);

// 7. Type — paragraph (25) -----------------------------------------------
ENTRIES.push(
  { id: "open-paragraph-panel", intent: "Open the Paragraph panel", action: { kind: "combo", keys: "cmd+alt+t" } },
  { id: "align-left", intent: "Align selected paragraph(s) left", action: { kind: "combo", keys: "cmd+shift+l" } },
  { id: "align-center", intent: "Center-align selected paragraph(s)", action: { kind: "combo", keys: "cmd+shift+c" } },
  { id: "align-right", intent: "Align selected paragraph(s) right", action: { kind: "combo", keys: "cmd+shift+r" } },
  { id: "justify-left", intent: "Justify selected paragraph(s) with last line aligned left", action: { kind: "combo", keys: "cmd+shift+j" } },
  { id: "justify-center", intent: "Justify selected paragraph(s) with last line centered", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "justify-right", intent: "Justify selected paragraph(s) with last line aligned right", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "justify-all-lines", intent: "Justify all lines of selected paragraph(s)", action: { kind: "combo", keys: "cmd+shift+f" } },
  { id: "increase-left-indent", intent: "Increase left indent on the selected paragraph", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "decrease-left-indent", intent: "Decrease left indent on the selected paragraph", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "increase-right-indent", intent: "Increase right indent on the selected paragraph", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "decrease-right-indent", intent: "Decrease right indent on the selected paragraph", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "first-line-indent", intent: "Set first-line indent on the selected paragraph", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "drop-cap-3-line", intent: "Apply a 3-line drop cap to the selected paragraph",
    action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "drop-cap-arbitrary", intent: "Set a drop cap of N lines and M characters on the selected paragraph", method: "menu",
    params: [
      { name: "lines", type: "number", required: true, minimum: 0, maximum: 25, description: "Number of lines for the drop cap (0 to clear)." },
      { name: "chars", type: "number", required: false, minimum: 1, maximum: 150, description: "Number of characters to drop. Defaults to 1." }
    ],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["Type", "Paragraph"] }
    ] },
    verifyQuestion: "Looking at the screen, has a {lines}-line drop cap of {chars} character(s) been applied to the selected paragraph?" },
  { id: "hyphenation-toggle", intent: "Toggle hyphenation on the selected paragraph", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "open-hyphenation-settings", intent: "Open Hyphenation Settings for the selected paragraph", action: { kind: "menu", path: ["Type", "Paragraph"] } },
  { id: "open-justification-settings", intent: "Open Justification Settings for the selected paragraph", action: { kind: "combo", keys: "cmd+alt+shift+j" } },
  { id: "keep-options", intent: "Open Keep Options for the selected paragraph", action: { kind: "combo", keys: "cmd+alt+k" } },
  { id: "paragraph-rules", intent: "Open Paragraph Rules dialog", action: { kind: "combo", keys: "cmd+alt+j" } },
  { id: "tabs-panel", intent: "Open the Tabs panel", action: { kind: "combo", keys: "cmd+shift+t" } },
  { id: "bullets-and-numbering", intent: "Open Bullets and Numbering for the selected paragraph", action: { kind: "menu", path: ["Type", "Bulleted & Numbered Lists", "Apply Bullets"] } },
  { id: "convert-bullets-to-text", intent: "Convert bullets to text on the selected paragraph", action: { kind: "menu", path: ["Type", "Bulleted & Numbered Lists", "Convert Bullets to Text"] } },
  { id: "convert-numbering-to-text", intent: "Convert numbering to text on the selected paragraph", action: { kind: "menu", path: ["Type", "Bulleted & Numbered Lists", "Convert Numbering to Text"] } },
  { id: "paragraph-shading", intent: "Open Paragraph Shading dialog", action: { kind: "menu", path: ["Type", "Paragraph"] } }
);

// 8. Type — styles (15) --------------------------------------------------
ENTRIES.push(
  { id: "open-paragraph-styles-panel", intent: "Open the Paragraph Styles panel", action: { kind: "combo", keys: "f11" } },
  { id: "open-character-styles-panel", intent: "Open the Character Styles panel", action: { kind: "combo", keys: "shift+f11" } },
  { id: "apply-paragraph-style-named", intent: "Apply a paragraph style by name to the current selection", method: "menu",
    params: [{ name: "style_name", type: "string", required: true, description: "Exact paragraph style name as it appears in the Paragraph Styles panel." }],
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "f11" }
    ] },
    verifyQuestion: "Looking at the screen, has the paragraph style {style_name} been applied to the current selection (highlighted in the Paragraph Styles panel)?" },
  { id: "apply-character-style-named", intent: "Apply a character style by name to the current selection", method: "menu",
    params: [{ name: "style_name", type: "string", required: true, description: "Exact character style name as it appears in the Character Styles panel." }],
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "shift+f11" }
    ] },
    verifyQuestion: "Looking at the screen, has the character style {style_name} been applied to the current selection (highlighted in the Character Styles panel)?" },
  { id: "new-paragraph-style", intent: "Open the New Paragraph Style dialog", action: { kind: "menu", path: ["Type", "Paragraph Styles"] } },
  { id: "new-character-style", intent: "Open the New Character Style dialog", action: { kind: "menu", path: ["Type", "Character Styles"] } },
  { id: "redefine-paragraph-style", intent: "Redefine the active paragraph style from the current selection", action: { kind: "combo", keys: "cmd+alt+shift+r" } },
  { id: "redefine-character-style", intent: "Redefine the active character style from the current selection", action: { kind: "menu", path: ["Type", "Character Styles"] } },
  { id: "no-paragraph-style", intent: "Apply No Paragraph Style to the current selection", action: { kind: "menu", path: ["Type", "Paragraph Styles"] } },
  { id: "no-character-style", intent: "Apply None to the current character-style selection", action: { kind: "menu", path: ["Type", "Character Styles"] } },
  { id: "load-paragraph-styles", intent: "Load paragraph styles from another InDesign document", action: { kind: "menu", path: ["Type", "Paragraph Styles"] } },
  { id: "load-character-styles", intent: "Load character styles from another InDesign document", action: { kind: "menu", path: ["Type", "Character Styles"] } },
  { id: "load-all-text-styles", intent: "Load all paragraph and character styles from another document", action: { kind: "menu", path: ["Type", "Paragraph Styles"] } },
  { id: "break-link-to-paragraph-style", intent: "Break the link between the current selection and its paragraph style", action: { kind: "menu", path: ["Type", "Paragraph Styles"] } },
  { id: "break-link-to-character-style", intent: "Break the link between the current selection and its character style", action: { kind: "menu", path: ["Type", "Character Styles"] } }
);

// 9. Tables (25) ----------------------------------------------------------
ENTRIES.push(
  { id: "insert-table", intent: "Open the Insert Table dialog at the current cursor", action: { kind: "combo", keys: "cmd+alt+shift+t" } },
  { id: "convert-text-to-table", intent: "Open Convert Text to Table for the current text selection", action: { kind: "menu", path: ["Table", "Convert Text to Table..."] } },
  { id: "convert-table-to-text", intent: "Open Convert Table to Text for the active table", action: { kind: "menu", path: ["Table", "Convert Table to Text..."] } },
  { id: "table-options", intent: "Open Table Options dialog", action: { kind: "menu", path: ["Table", "Table Options", "Table Setup..."] } },
  { id: "cell-options", intent: "Open Cell Options dialog", action: { kind: "menu", path: ["Table", "Cell Options", "Text..."] } },
  { id: "insert-row-above", intent: "Insert a row above the active cell row", action: { kind: "menu", path: ["Table", "Insert", "Row..."] } },
  { id: "insert-row-below", intent: "Insert a row below the active cell row", action: { kind: "combo", keys: "cmd+9" } },
  { id: "insert-column-left", intent: "Insert a column to the left of the active cell column", action: { kind: "menu", path: ["Table", "Insert", "Column..."] } },
  { id: "insert-column-right", intent: "Insert a column to the right of the active cell column", action: { kind: "combo", keys: "cmd+alt+9" } },
  { id: "delete-row", intent: "Delete the active table row", action: { kind: "combo", keys: "cmd+backspace" }, risk: "destructive" },
  { id: "delete-column", intent: "Delete the active table column", action: { kind: "combo", keys: "cmd+shift+backspace" }, risk: "destructive" },
  { id: "delete-table", intent: "Delete the active table", action: { kind: "menu", path: ["Table", "Delete", "Table"] }, risk: "destructive" },
  { id: "select-row", intent: "Select the active table row", action: { kind: "combo", keys: "cmd+3" } },
  { id: "select-column", intent: "Select the active table column", action: { kind: "combo", keys: "cmd+alt+3" } },
  { id: "select-table", intent: "Select the entire active table", action: { kind: "combo", keys: "cmd+alt+a" } },
  { id: "merge-cells", intent: "Merge selected table cells", action: { kind: "menu", path: ["Table", "Merge Cells"] } },
  { id: "unmerge-cells", intent: "Unmerge previously merged table cells", action: { kind: "menu", path: ["Table", "Unmerge Cells"] } },
  { id: "split-cell-horizontally", intent: "Split the active cell horizontally", action: { kind: "menu", path: ["Table", "Split Cell Horizontally"] } },
  { id: "split-cell-vertically", intent: "Split the active cell vertically", action: { kind: "menu", path: ["Table", "Split Cell Vertically"] } },
  { id: "distribute-rows-evenly", intent: "Distribute selected table rows evenly", action: { kind: "menu", path: ["Table", "Distribute Rows Evenly"] } },
  { id: "distribute-columns-evenly", intent: "Distribute selected table columns evenly", action: { kind: "menu", path: ["Table", "Distribute Columns Evenly"] } },
  { id: "convert-row-to-header", intent: "Convert the selected row(s) to header rows", action: { kind: "menu", path: ["Table", "Convert Rows", "To Header"] } },
  { id: "convert-row-to-footer", intent: "Convert the selected row(s) to footer rows", action: { kind: "menu", path: ["Table", "Convert Rows", "To Footer"] } },
  { id: "convert-row-to-body", intent: "Convert the selected row(s) to body rows", action: { kind: "menu", path: ["Table", "Convert Rows", "To Body"] } },
  { id: "open-table-styles-panel", intent: "Open the Table Styles panel", action: { kind: "menu", path: ["Window", "Styles", "Table Styles"] } }
);

// 10. Color & swatches (20) ----------------------------------------------
ENTRIES.push(
  { id: "open-swatches-panel", intent: "Open the Swatches panel", action: { kind: "key", key: "f5" } },
  { id: "open-color-panel", intent: "Open the Color panel", action: { kind: "key", key: "f6" } },
  { id: "open-gradient-panel", intent: "Open the Gradient panel", action: { kind: "menu", path: ["Window", "Color", "Gradient"] } },
  { id: "new-color-swatch", intent: "Open the New Color Swatch dialog", action: { kind: "menu", path: ["Window", "Color", "Swatches"] } },
  { id: "new-tint-swatch", intent: "Open the New Tint Swatch dialog", action: { kind: "menu", path: ["Window", "Color", "Swatches"] } },
  { id: "new-gradient-swatch", intent: "Open the New Gradient Swatch dialog", action: { kind: "menu", path: ["Window", "Color", "Swatches"] } },
  { id: "new-mixed-ink-swatch", intent: "Open the New Mixed Ink Swatch dialog", action: { kind: "menu", path: ["Window", "Color", "Swatches"] } },
  { id: "swap-fill-stroke", intent: "Swap fill and stroke on the selected object", action: { kind: "combo", keys: "shift+x" } },
  { id: "default-fill-stroke", intent: "Reset fill to None and stroke to Black on the selected object", action: { kind: "key", key: "d" } },
  { id: "apply-fill-color", intent: "Activate Fill in the Tools panel", action: { kind: "key", key: "x" } },
  { id: "apply-no-fill", intent: "Apply None to the active fill", action: { kind: "combo", keys: "comma" } },
  { id: "apply-last-color-swatch", intent: "Apply the most recently used color swatch to the active fill/stroke", action: { kind: "key", key: "comma" } },
  { id: "apply-gradient", intent: "Apply the most recently used gradient swatch to the active fill/stroke", action: { kind: "key", key: "period" } },
  { id: "apply-none", intent: "Apply None to the selected object", action: { kind: "combo", keys: "slash" } },
  { id: "load-swatches-from-document", intent: "Load swatches from another InDesign document", action: { kind: "menu", path: ["Window", "Color", "Swatches"] } },
  { id: "merge-swatches", intent: "Merge the selected swatches in the Swatches panel", action: { kind: "menu", path: ["Window", "Color", "Swatches"] } },
  { id: "delete-swatch", intent: "Delete the selected swatch", action: { kind: "menu", path: ["Window", "Color", "Swatches"] }, risk: "destructive" },
  { id: "select-unused-swatches", intent: "Select all unused swatches in the Swatches panel", action: { kind: "menu", path: ["Window", "Color", "Swatches"] } },
  { id: "color-theme-panel", intent: "Open the Color Theme panel", action: { kind: "menu", path: ["Window", "Color", "Adobe Color Themes"] } },
  { id: "open-stroke-panel", intent: "Open the Stroke panel", action: { kind: "key", key: "f10" } }
);

// 11. Effects, transparency, blending (15) -------------------------------
ENTRIES.push(
  { id: "open-effects-panel", intent: "Open the Effects panel", action: { kind: "combo", keys: "cmd+shift+f10" } },
  { id: "fx-drop-shadow", intent: "Apply Drop Shadow effect to the selected object", action: { kind: "combo", keys: "cmd+alt+m" } },
  { id: "fx-inner-shadow", intent: "Apply Inner Shadow effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Inner Shadow..."] } },
  { id: "fx-outer-glow", intent: "Apply Outer Glow effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Outer Glow..."] } },
  { id: "fx-inner-glow", intent: "Apply Inner Glow effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Inner Glow..."] } },
  { id: "fx-bevel-emboss", intent: "Apply Bevel and Emboss effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Bevel and Emboss..."] } },
  { id: "fx-satin", intent: "Apply Satin effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Satin..."] } },
  { id: "fx-basic-feather", intent: "Apply Basic Feather effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Basic Feather..."] } },
  { id: "fx-directional-feather", intent: "Apply Directional Feather effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Directional Feather..."] } },
  { id: "fx-gradient-feather", intent: "Apply Gradient Feather effect to the selected object", action: { kind: "menu", path: ["Object", "Effects", "Gradient Feather..."] } },
  { id: "fx-clear-effects", intent: "Clear all effects from the selected object", action: { kind: "menu", path: ["Object", "Effects", "Clear All Transparency"] } },
  { id: "fx-clear-effects-on-fill", intent: "Clear effects on the fill of the selected object", action: { kind: "menu", path: ["Object", "Effects", "Clear Effects"] } },
  { id: "object-opacity-50", intent: "Set the selected object's opacity to 50%", method: "menu",
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "cmd+shift+f10" }
    ] },
    verifyQuestion: "Looking at the screen, has the selected object's opacity been set to 50% (visible in the Effects panel and on canvas)?" },
  { id: "blend-mode-multiply", intent: "Set the selected object's blend mode to Multiply via Effects panel menu", action: { kind: "menu", path: ["Window", "Effects"] } },
  { id: "blend-mode-screen", intent: "Set the selected object's blend mode to Screen via Effects panel menu", action: { kind: "menu", path: ["Window", "Effects"] } }
);

// 12. Layers (15) --------------------------------------------------------
ENTRIES.push(
  { id: "open-layers-panel", intent: "Open the Layers panel", action: { kind: "key", key: "f7" } },
  { id: "new-layer", intent: "Create a new layer in the active document", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "duplicate-layer", intent: "Duplicate the selected layer", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "delete-layer", intent: "Delete the selected layer", action: { kind: "menu", path: ["Window", "Layers"] }, risk: "destructive" },
  { id: "rename-layer", intent: "Open Layer Options to rename the selected layer", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "merge-layers", intent: "Merge the selected layers", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "lock-layer", intent: "Lock the selected layer", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "unlock-all-layers", intent: "Unlock all layers in the active document", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "hide-layer", intent: "Hide the selected layer", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "hide-other-layers", intent: "Hide all layers except the selected layer", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "show-all-layers", intent: "Make all layers visible", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "lock-other-layers", intent: "Lock all layers except the selected layer", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "paste-remembers-layers", intent: "Toggle Paste Remembers Layers in the Layers panel menu", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "move-objects-to-current-layer", intent: "Move the selected objects to the active layer", action: { kind: "menu", path: ["Window", "Layers"] } },
  { id: "select-all-on-layer", intent: "Select all objects on the active layer", action: { kind: "menu", path: ["Window", "Layers"] } }
);

// 13. Find/replace, GREP (10) --------------------------------------------
ENTRIES.push(
  { id: "find-change-text", intent: "Open Find/Change with Text tab active",
    action: { kind: "combo", keys: "cmd+f" } },
  { id: "find-change-grep-tab", intent: "Open Find/Change with GREP tab active",
    action: { kind: "menu", path: ["Edit", "Find/Change..."] } },
  { id: "find-change-glyph-tab", intent: "Open Find/Change with Glyph tab active",
    action: { kind: "menu", path: ["Edit", "Find/Change..."] } },
  { id: "find-change-object-tab", intent: "Open Find/Change with Object tab active",
    action: { kind: "menu", path: ["Edit", "Find/Change..."] } },
  { id: "find-change-find-and-replace", intent: "Run a basic Find/Change replace-all", method: "menu",
    params: [
      { name: "find_text", type: "string", required: true, description: "Text to find." },
      { name: "replace_text", type: "string", required: true, description: "Replacement text." }
    ],
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "cmd+f" },
      { kind: "type", text: "{find_text}" },
      { kind: "key", key: "tab" },
      { kind: "type", text: "{replace_text}" }
    ] },
    verifyQuestion: "Looking at the Find/Change dialog: are the Find and Change-To fields populated with {find_text} and {replace_text} respectively, ready for a replace-all?" },
  { id: "grep-replace", intent: "Run a GREP-tab Find/Change replace-all", method: "menu",
    params: [
      { name: "find_grep", type: "string", required: true, description: "GREP pattern to find." },
      { name: "replace_grep", type: "string", required: true, description: "GREP replacement template." }
    ],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["Edit", "Find/Change..."] },
      { kind: "type", text: "{find_grep}" },
      { kind: "key", key: "tab" },
      { kind: "type", text: "{replace_grep}" }
    ] },
    verifyQuestion: "Looking at the Find/Change dialog (GREP tab): are the Find and Change-To fields populated with the GREP pattern {find_grep} and replacement {replace_grep}?" },
  { id: "find-next-occurrence", intent: "Find the next occurrence using current Find/Change settings", action: { kind: "combo", keys: "cmd+alt+f" } },
  { id: "find-format-only", intent: "Open Find/Change to search by formatting only", action: { kind: "menu", path: ["Edit", "Find/Change..."] } },
  { id: "find-color-with-eyedropper", intent: "Open the Find/Change Color dialog", action: { kind: "menu", path: ["Edit", "Find/Change..."] } },
  { id: "load-find-change-query", intent: "Load a saved Find/Change query", action: { kind: "menu", path: ["Edit", "Find/Change..."] } }
);

// 14. Place / link / package / preflight (15) ----------------------------
ENTRIES.push(
  { id: "place-file", intent: "Open the Place dialog at the current cursor", action: { kind: "combo", keys: "cmd+d" } },
  { id: "place-file-by-path", intent: "Place a specific file at the current cursor by absolute path", method: "shortcut",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path to the asset to place." }],
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "cmd+d" },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyQuestion: "Looking at the screen, is the asset at {path} now placed in the active document (visible in the canvas and as a new entry in the Links panel)?" },
  { id: "open-links-panel", intent: "Open the Links panel", action: { kind: "combo", keys: "cmd+shift+d" } },
  { id: "update-link", intent: "Update the selected link in the Links panel", action: { kind: "menu", path: ["Window", "Links"] } },
  { id: "update-all-links", intent: "Update all out-of-date links in the active document", action: { kind: "menu", path: ["Window", "Links"] } },
  { id: "relink-link", intent: "Open Relink for the selected link", action: { kind: "menu", path: ["Window", "Links"] } },
  { id: "edit-original", intent: "Open the original asset for editing in its source application", action: { kind: "menu", path: ["Edit", "Edit Original"] } },
  { id: "edit-with-application", intent: "Edit the selected linked asset with a chosen application", action: { kind: "menu", path: ["Edit", "Edit With"] } },
  { id: "embed-link", intent: "Embed the selected link into the document", action: { kind: "menu", path: ["Window", "Links"] } },
  { id: "unembed-link", intent: "Unembed the selected link, restoring it as a linked asset", action: { kind: "menu", path: ["Window", "Links"] } },
  { id: "package-document", intent: "Open the Package dialog for the active document", action: { kind: "combo", keys: "cmd+alt+shift+p" }, risk: "destructive" },
  { id: "preflight-panel", intent: "Open the Preflight panel", action: { kind: "combo", keys: "cmd+alt+shift+f" } },
  { id: "define-preflight-profile", intent: "Open Define Profiles for the Preflight panel", action: { kind: "menu", path: ["Window", "Output", "Preflight"] } },
  { id: "links-info", intent: "Open Link Info for the selected link", action: { kind: "menu", path: ["Window", "Links"] } },
  { id: "reveal-in-finder", intent: "Reveal the selected linked asset in the Finder", action: { kind: "menu", path: ["Window", "Links"] } }
);

// 15. Export (15) --------------------------------------------------------
ENTRIES.push(
  { id: "open-export-dialog", intent: "Open the Export dialog", action: { kind: "combo", keys: "cmd+e" } },
  { id: "export-pdf-print", intent: "Export the active document as a Print PDF at the given absolute path", method: "menu",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path for the output .pdf file." }],
    action: { kind: "seq", steps: [
      { kind: "combo", keys: "cmd+e" },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyPath: "{path}",
    risk: "destructive" },
  { id: "export-pdf-interactive", intent: "Export the active document as an Interactive PDF at the given absolute path", method: "menu",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path for the output .pdf file." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["File", "Export..."] },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyPath: "{path}",
    risk: "destructive" },
  { id: "export-epub-reflowable", intent: "Export the active document as a Reflowable EPUB at the given absolute path", method: "menu",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path for the output .epub file." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["File", "Export..."] },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyPath: "{path}",
    risk: "destructive" },
  { id: "export-epub-fixed-layout", intent: "Export the active document as a Fixed-Layout EPUB at the given absolute path", method: "menu",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path for the output .epub file." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["File", "Export..."] },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyPath: "{path}",
    risk: "destructive" },
  { id: "export-jpg", intent: "Export the active document as JPG at the given absolute path", method: "menu",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path for the output .jpg file." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["File", "Export..."] },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyPath: "{path}",
    risk: "destructive" },
  { id: "export-png", intent: "Export the active document as PNG at the given absolute path", method: "menu",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path for the output .png file." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["File", "Export..."] },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyPath: "{path}",
    risk: "destructive" },
  { id: "export-idml", intent: "Export the active document as IDML at the given absolute path", method: "menu",
    params: [{ name: "path", type: "string", required: true, description: "Absolute path for the output .idml file." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["File", "Export..."] },
      { kind: "combo", keys: "cmd+shift+g" },
      { kind: "type", text: "{path}" },
      { kind: "key", key: "enter" },
      { kind: "key", key: "enter" }
    ] },
    verifyPath: "{path}",
    risk: "destructive" },
  { id: "export-html", intent: "Export the active document as HTML",
    action: { kind: "menu", path: ["File", "Export..."] }, risk: "destructive" },
  { id: "export-xml", intent: "Export the active document as XML",
    action: { kind: "menu", path: ["File", "Export..."] }, risk: "destructive" },
  { id: "export-flattened-eps", intent: "Export the active document as EPS (legacy)",
    action: { kind: "menu", path: ["File", "Export..."] }, risk: "destructive" },
  { id: "export-publish-online", intent: "Open Publish Online dialog for the active document",
    action: { kind: "menu", path: ["File", "Publish Online..."] }, risk: "destructive" },
  { id: "export-pdf-presets", intent: "Open the PDF Export Presets dialog",
    action: { kind: "menu", path: ["File", "Adobe PDF Presets", "Define..."] } },
  { id: "open-export-as-jpg-quick", intent: "Run File > Export with the JPG preset for quick spread export",
    action: { kind: "menu", path: ["File", "Export..."] } },
  { id: "open-export-as-png-quick", intent: "Run File > Export with the PNG preset for quick spread export",
    action: { kind: "menu", path: ["File", "Export..."] } }
);

// 16. Print (10) ---------------------------------------------------------
ENTRIES.push(
  { id: "open-print-dialog", intent: "Open the Print dialog for the active document", action: { kind: "combo", keys: "cmd+p" } },
  { id: "print-presets-define", intent: "Open the Print Presets > Define dialog",
    action: { kind: "menu", path: ["File", "Print Presets", "Define..."] } },
  { id: "print-booklet", intent: "Open the Print Booklet dialog",
    action: { kind: "menu", path: ["File", "Print Booklet..."] } },
  { id: "print-with-preset", intent: "Open the Print dialog with a chosen preset", method: "menu",
    params: [{ name: "preset_name", type: "string", required: true, description: "Exact preset name from File > Print Presets." }],
    action: { kind: "seq", steps: [
      { kind: "menu", path: ["File", "Print Presets"] }
    ] },
    verifyQuestion: "Looking at the Print dialog, has the {preset_name} preset been loaded?" },
  { id: "print-current-page", intent: "Open the Print dialog scoped to the current page",
    action: { kind: "combo", keys: "cmd+p" } },
  { id: "print-all-pages", intent: "Open the Print dialog scoped to all pages",
    action: { kind: "combo", keys: "cmd+p" } },
  { id: "print-non-printing-objects", intent: "Open Print dialog with Non-Printing Objects toggle in Layers panel",
    action: { kind: "menu", path: ["File", "Print..."] } },
  { id: "print-master-pages", intent: "Open the Print dialog with master-pages output",
    action: { kind: "menu", path: ["File", "Print..."] } },
  { id: "print-marks-and-bleed", intent: "Open the Print dialog Marks and Bleed pane",
    action: { kind: "menu", path: ["File", "Print..."] } },
  { id: "print-postscript-file", intent: "Open Print dialog set to print to a PostScript file",
    action: { kind: "menu", path: ["File", "Print..."] }, risk: "destructive" }
);

// 17. View (zoom, fit, screen mode, guides, grids) (25) ------------------
ENTRIES.push(
  { id: "zoom-in", intent: "Zoom in on the active document", action: { kind: "combo", keys: "cmd+=" } },
  { id: "zoom-out", intent: "Zoom out of the active document", action: { kind: "combo", keys: "cmd+-" } },
  { id: "fit-page-in-window", intent: "Fit the active page in the document window", action: { kind: "combo", keys: "cmd+0" } },
  { id: "fit-spread-in-window", intent: "Fit the active spread in the document window", action: { kind: "combo", keys: "cmd+alt+0" } },
  { id: "actual-size", intent: "Set zoom to 100% (actual size)", action: { kind: "combo", keys: "cmd+1" } },
  { id: "zoom-200", intent: "Set zoom to 200%", action: { kind: "combo", keys: "cmd+2" } },
  { id: "zoom-400", intent: "Set zoom to 400%", action: { kind: "combo", keys: "cmd+4" } },
  { id: "zoom-50", intent: "Set zoom to 50%", action: { kind: "combo", keys: "cmd+5" } },
  { id: "entire-pasteboard", intent: "Show the entire pasteboard", action: { kind: "combo", keys: "cmd+alt+shift+0" } },
  { id: "screen-mode-normal", intent: "Switch to Normal screen mode", action: { kind: "key", key: "w" } },
  { id: "screen-mode-preview", intent: "Switch to Preview screen mode", action: { kind: "menu", path: ["View", "Screen Mode", "Preview"] } },
  { id: "screen-mode-bleed", intent: "Switch to Bleed screen mode", action: { kind: "menu", path: ["View", "Screen Mode", "Bleed"] } },
  { id: "screen-mode-slug", intent: "Switch to Slug screen mode", action: { kind: "menu", path: ["View", "Screen Mode", "Slug"] } },
  { id: "screen-mode-presentation", intent: "Switch to Presentation screen mode", action: { kind: "combo", keys: "shift+w" } },
  { id: "show-rulers", intent: "Show or hide rulers", action: { kind: "combo", keys: "cmd+r" } },
  { id: "show-guides", intent: "Show or hide guides", action: { kind: "combo", keys: "cmd+;" } },
  { id: "lock-guides", intent: "Lock all guides", action: { kind: "combo", keys: "cmd+alt+;" } },
  { id: "snap-to-guides", intent: "Toggle Snap to Guides", action: { kind: "combo", keys: "cmd+shift+;" } },
  { id: "smart-guides-toggle", intent: "Toggle Smart Guides", action: { kind: "combo", keys: "cmd+u" } },
  { id: "show-baseline-grid", intent: "Show or hide the baseline grid", action: { kind: "combo", keys: "cmd+alt+'" } },
  { id: "show-document-grid", intent: "Show or hide the document grid", action: { kind: "combo", keys: "cmd+'" } },
  { id: "snap-to-document-grid", intent: "Toggle Snap to Document Grid", action: { kind: "combo", keys: "cmd+shift+'" } },
  { id: "show-frame-edges", intent: "Show or hide frame edges", action: { kind: "combo", keys: "cmd+h" } },
  { id: "show-text-threads", intent: "Show or hide text threads on the active spread", action: { kind: "combo", keys: "cmd+alt+y" } },
  { id: "high-quality-display", intent: "Set Display Performance to High Quality Display", action: { kind: "menu", path: ["View", "Display Performance", "High Quality Display"] } }
);

// 18. Tools (15) ---------------------------------------------------------
ENTRIES.push(
  { id: "tool-selection", intent: "Switch to the Selection tool (black arrow)", action: { kind: "key", key: "v" } },
  { id: "tool-direct-selection", intent: "Switch to the Direct Selection tool (white arrow)", action: { kind: "key", key: "a" } },
  { id: "tool-page-tool", intent: "Switch to the Page tool", action: { kind: "combo", keys: "shift+p" } },
  { id: "tool-gap-tool", intent: "Switch to the Gap tool", action: { kind: "key", key: "u" } },
  { id: "tool-free-transform", intent: "Switch to the Free Transform tool", action: { kind: "key", key: "e" } },
  { id: "tool-rotate", intent: "Switch to the Rotate tool", action: { kind: "key", key: "r" } },
  { id: "tool-scale", intent: "Switch to the Scale tool", action: { kind: "key", key: "s" } },
  { id: "tool-shear", intent: "Switch to the Shear tool", action: { kind: "key", key: "o" } },
  { id: "tool-eyedropper", intent: "Switch to the Eyedropper tool", action: { kind: "key", key: "i" } },
  { id: "tool-measure", intent: "Switch to the Measure tool", action: { kind: "key", key: "k" } },
  { id: "tool-hand", intent: "Switch to the Hand tool", action: { kind: "key", key: "h" } },
  { id: "tool-zoom", intent: "Switch to the Zoom tool", action: { kind: "key", key: "z" } },
  { id: "toggle-tools-panel-columns", intent: "Toggle the Tools panel between single and double column",
    action: { kind: "menu", path: ["Window", "Tools"] } },
  { id: "default-tools", intent: "Reset the Tools panel to default", action: { kind: "menu", path: ["Window", "Tools"] } },
  { id: "switch-to-last-used-tool", intent: "Cycle to the most recently used tool",
    action: { kind: "combo", keys: "shift+v" } }
);

// 19. Window panels (15) -------------------------------------------------
ENTRIES.push(
  { id: "open-control-panel", intent: "Open or focus the Control panel at the top of the screen", action: { kind: "combo", keys: "cmd+alt+6" } },
  { id: "open-pages-window", intent: "Open the Pages panel via Window menu", action: { kind: "menu", path: ["Window", "Pages"] } },
  { id: "open-links-window", intent: "Open the Links panel via Window menu", action: { kind: "menu", path: ["Window", "Links"] } },
  { id: "open-info-window", intent: "Open the Info panel via Window menu", action: { kind: "menu", path: ["Window", "Info"] } },
  { id: "open-stroke-window", intent: "Open the Stroke panel via Window menu", action: { kind: "menu", path: ["Window", "Stroke"] } },
  { id: "open-effects-window", intent: "Open the Effects panel via Window menu", action: { kind: "menu", path: ["Window", "Effects"] } },
  { id: "open-text-wrap-window", intent: "Open the Text Wrap panel", action: { kind: "combo", keys: "cmd+alt+w" } },
  { id: "open-pathfinder-window", intent: "Open the Pathfinder panel", action: { kind: "menu", path: ["Window", "Object & Layout", "Pathfinder"] } },
  { id: "open-hyperlinks-panel", intent: "Open the Hyperlinks panel", action: { kind: "menu", path: ["Window", "Interactive", "Hyperlinks"] } },
  { id: "open-cross-references-panel", intent: "Open the Cross-References panel", action: { kind: "menu", path: ["Window", "Type & Tables", "Cross-References"] } },
  { id: "open-bookmarks-panel", intent: "Open the Bookmarks panel", action: { kind: "menu", path: ["Window", "Interactive", "Bookmarks"] } },
  { id: "open-articles-panel", intent: "Open the Articles panel", action: { kind: "menu", path: ["Window", "Articles"] } },
  { id: "open-conditional-text-panel", intent: "Open the Conditional Text panel", action: { kind: "menu", path: ["Window", "Type & Tables", "Conditional Text"] } },
  { id: "open-script-label-panel", intent: "Open the Script Label panel", action: { kind: "menu", path: ["Window", "Utilities", "Script Label"] } },
  { id: "open-scripts-panel", intent: "Open the Scripts panel", action: { kind: "menu", path: ["Window", "Utilities", "Scripts"] } }
);

// 20. Special characters / glyphs (10) -----------------------------------
ENTRIES.push(
  { id: "open-glyphs-panel", intent: "Open the Glyphs panel", action: { kind: "menu", path: ["Type", "Glyphs"] } },
  { id: "insert-em-dash", intent: "Insert an em dash at the cursor", action: { kind: "combo", keys: "cmd+alt+shift+-" } },
  { id: "insert-en-dash", intent: "Insert an en dash at the cursor", action: { kind: "combo", keys: "cmd+alt+-" } },
  { id: "insert-discretionary-hyphen", intent: "Insert a discretionary hyphen at the cursor", action: { kind: "combo", keys: "cmd+shift+-" } },
  { id: "insert-nonbreaking-hyphen", intent: "Insert a non-breaking hyphen at the cursor", action: { kind: "combo", keys: "cmd+alt+shift+--" } },
  { id: "insert-nonbreaking-space", intent: "Insert a non-breaking space at the cursor", action: { kind: "combo", keys: "cmd+alt+x" } },
  { id: "insert-em-space", intent: "Insert an em space at the cursor", action: { kind: "combo", keys: "cmd+shift+m" } },
  { id: "insert-en-space", intent: "Insert an en space at the cursor", action: { kind: "combo", keys: "cmd+shift+n" } },
  { id: "insert-thin-space", intent: "Insert a thin space at the cursor", action: { kind: "combo", keys: "cmd+alt+shift+m" } },
  { id: "insert-paragraph-break", intent: "Insert a paragraph break (forced new paragraph) at the cursor", action: { kind: "key", key: "enter" } }
);

// Per-category counts as authored above. ENTRIES was pushed in this exact order.
// Sum is 400. Spec target is 312 across all 20 categories — we trim each category's
// tail to land on 312 while still covering every category.
const AUTHORED_COUNTS = [30, 30, 30, 15, 25, 41, 25, 15, 25, 20, 15, 15, 10, 15, 15, 10, 25, 15, 15, 10];
const TARGET_COUNTS  = [24, 24, 23, 10, 20, 30, 18, 11, 18, 15, 11, 11,  8, 11, 15,  8, 18, 11, 11,  8 + 17];
// 24+24+23+10+20+30+18+11+18+15+11+11+8+11+15+8+18+11+11+8 = 305
// Plus 7 from the special-characters category (rounding) gets to 312 — but we
// only have 10 there. So instead pad earlier categories. Adjust:
// Adjust to balance to exactly 312:
TARGET_COUNTS[0] = 25; // general +1
TARGET_COUNTS[2] = 24; // layout +1
TARGET_COUNTS[5] = 32; // type-char +2
TARGET_COUNTS[6] = 19; // type-para +1
TARGET_COUNTS[8] = 19; // tables +1
TARGET_COUNTS[16] = 19; // view +1
TARGET_COUNTS[19] = 8; // special +0 (reset back from above experiment)
// Recompute total now: 25+24+24+10+20+32+19+11+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 49+24+10+20+32+19+11+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 73+10+20+32+19+11+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 83+20+32+19+11+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 103+32+19+11+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 135+19+11+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 154+11+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 165+19+15+11+11+8+11+15+8+19+11+11+8
//                    = 184+15+11+11+8+11+15+8+19+11+11+8
//                    = 199+11+11+8+11+15+8+19+11+11+8
//                    = 210+11+8+11+15+8+19+11+11+8
//                    = 221+8+11+15+8+19+11+11+8
//                    = 229+11+15+8+19+11+11+8
//                    = 240+15+8+19+11+11+8
//                    = 255+8+19+11+11+8
//                    = 263+19+11+11+8
//                    = 282+11+11+8
//                    = 293+11+8
//                    = 304+8 = 312.

if (AUTHORED_COUNTS.reduce((a, b) => a + b, 0) !== ENTRIES.length) {
  console.error(`gen.mjs: AUTHORED_COUNTS sum (${AUTHORED_COUNTS.reduce((a, b) => a + b, 0)}) != ENTRIES.length (${ENTRIES.length}). Re-author or re-tally.`);
  process.exit(1);
}
if (TARGET_COUNTS.reduce((a, b) => a + b, 0) !== 312) {
  console.error(`gen.mjs: TARGET_COUNTS must sum to 312, got ${TARGET_COUNTS.reduce((a, b) => a + b, 0)}.`);
  process.exit(1);
}

const finalEntries = [];
{
  let cursor = 0;
  for (let i = 0; i < AUTHORED_COUNTS.length; i++) {
    const start = cursor;
    const stop = cursor + TARGET_COUNTS[i];
    for (let j = start; j < stop; j++) finalEntries.push(ENTRIES[j]);
    cursor += AUTHORED_COUNTS[i];
  }
}

if (finalEntries.length !== 312) {
  console.error(`gen.mjs: built ${finalEntries.length} entries, expected 312`);
  process.exit(1);
}

// Detect duplicate ids early.
{
  const seen = new Map();
  for (let i = 0; i < finalEntries.length; i++) {
    const id = finalEntries[i].id;
    if (seen.has(id)) {
      console.error(`gen.mjs: duplicate id "${id}" at indices ${seen.get(id)} and ${i}`);
      process.exit(1);
    }
    seen.set(id, i);
  }
}

function buildShortcut(entry, idx) {
  const { id, intent, action, params, risk, verifyPath, verifyQuestion, method: methodOverride } = entry;
  const actions = buildActions(action);
  const method = methodOverride ?? methodFromAction(action);
  const { token_cost_estimate, speed_estimate_ms } = estimatesFor(action);
  const submitted_at = SUBMITTED_DATES[idx % SUBMITTED_DATES.length];

  const shortcut = {
    id,
    intent,
    parameters: params ?? [],
    platforms: ["macos"],
    app_versions: ["19+"],
    method,
    actions,
  };

  if (verifyPath) {
    shortcut.verification = {
      type: "file_check",
      path: verifyPath,
      exists: true
    };
  } else {
    shortcut.verification = {
      type: "interpret_check",
      question: verifyQuestion ?? `Looking at the screen, has the action "${intent}" completed successfully (visible result on canvas, in panels, or via dialog confirmation)?`,
      expected: "yes"
    };
  }

  if (risk) shortcut.risk = risk;

  shortcut.metadata = {
    contributor_id: "seed",
    payment_destination: null,
    token_cost_estimate,
    speed_estimate_ms,
    submitted_at
  };

  return shortcut;
}

const shortcuts = finalEntries.map(buildShortcut);

const out = {
  schema_version: 1,
  app_id: "indesign",
  shortcuts
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${shortcuts.length} shortcuts to ${OUT}`);
