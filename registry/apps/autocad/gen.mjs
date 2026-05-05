#!/usr/bin/env node
// Generates registry/apps/autocad/shortcuts.json from a tuple list.
// Run from anywhere: `node registry/apps/autocad/gen.mjs`
//
// Shortcut authoring conventions (must match shortcut.schema.json):
//   - method "shortcut" — pure key combo, e.g. cmd+s
//   - method "search"   — typed command alias (LINE, CIRCLE, ...)
//                         action chain: cmd+9 to focus command line,
//                         then type the alias, then Enter.
//   - method "menu"     — uses {type: "menu", path: [...]}
//
// The "search" method models AutoCAD's typed-command surface as the
// search-first dispatch path: the command line is always-visible,
// alias autocomplete is the de-facto fuzzy action search.
//
// Submission dates are spread across 2026-04-15..2026-05-05.
// Token costs and speed estimates are bucketed by method.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "shortcuts.json");

// Pseudo-random but deterministic varied values, keyed by id.
// Hash the id and project into the buckets we want.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pick(id, list) { return list[hash(id) % list.length]; }
function pickN(id, lo, hi) { return lo + (hash(id) % (hi - lo + 1)); }

const DATES = [
  "2026-04-15", "2026-04-17", "2026-04-19", "2026-04-21", "2026-04-23",
  "2026-04-25", "2026-04-27", "2026-04-29", "2026-05-01", "2026-05-02",
  "2026-05-03", "2026-05-04", "2026-05-05"
];

// Helper: build a typed-command shortcut.
//   id: kebab-case unique
//   intent: plain-language sentence
//   alias: AutoCAD command (e.g. "LINE", "L", "OFFSET")
//   verifyQ: yes/no question for interpret_check
//   risk: optional, e.g. "destructive"
function typedCmd(id, intent, alias, verifyQ, opts = {}) {
  return {
    kind: "search",
    id, intent, alias, verifyQ,
    risk: opts.risk,
    cost: opts.cost,
    speed: opts.speed
  };
}

// Helper: build a true keyboard-shortcut entry.
function keyCombo(id, intent, combo, verifyQ, opts = {}) {
  return {
    kind: "shortcut",
    id, intent, combo, verifyQ,
    risk: opts.risk,
    cost: opts.cost,
    speed: opts.speed
  };
}

// Helper: build a function-key (status-bar toggle) entry.
function funcKey(id, intent, key, verifyQ, opts = {}) {
  return {
    kind: "fkey",
    id, intent, key, verifyQ,
    risk: opts.risk,
    cost: opts.cost,
    speed: opts.speed
  };
}

const SHORTCUTS = [
  // ----------------------------------------------------------------------
  // App-level (true keyboard shortcuts) — ~15
  // ----------------------------------------------------------------------
  keyCombo("new-drawing", "Create a new blank AutoCAD drawing", "cmd+n",
    "Is a new untitled AutoCAD drawing now active (visible as a Drawing1.dwg or similar tab)?"),
  keyCombo("open-drawing", "Open the Open Drawing dialog", "cmd+o",
    "Is the Open Drawing file picker dialog now visible on screen?"),
  keyCombo("save-drawing", "Save the active drawing to its current path", "cmd+s",
    "Has the active drawing been saved (no save-pending indicator on the title bar; no error dialog)?",
    { risk: "destructive" }),
  keyCombo("save-drawing-as", "Open Save Drawing As dialog", "cmd+shift+s",
    "Is the Save Drawing As dialog now visible (with filename and Format dropdown)?"),
  keyCombo("close-drawing", "Close the active drawing window", "cmd+w",
    "Has the active drawing window been closed (or a save-prompt dialog appeared)?"),
  keyCombo("plot", "Open the Plot (print) dialog", "cmd+p",
    "Is the Plot dialog visible on screen with printer/plotter, paper size, and plot area fields?"),
  keyCombo("undo", "Undo the most recent command", "cmd+z",
    "Has the most recent edit been undone (the canvas reflects the prior state)?"),
  keyCombo("redo", "Redo the most recently undone command", "cmd+y",
    "Has the most recently undone edit been re-applied to the canvas?"),
  keyCombo("preferences", "Open AutoCAD Preferences", "cmd+,",
    "Is the AutoCAD Preferences window now visible?"),
  keyCombo("quit-autocad", "Quit AutoCAD", "cmd+q",
    "Has AutoCAD quit (no AutoCAD windows visible; another app is now frontmost)?"),
  keyCombo("cut-selection", "Cut the current selection to the clipboard", "cmd+x",
    "Has the selected geometry been cut (removed from the drawing and placed on the clipboard)?",
    { risk: "destructive" }),
  keyCombo("copy-selection", "Copy the current selection to the clipboard", "cmd+c",
    "Has the selected geometry been copied to the clipboard (canvas unchanged, clipboard updated)?"),
  keyCombo("paste-clipboard", "Paste clipboard contents into the drawing", "cmd+v",
    "Has the clipboard contents been pasted into the drawing (new geometry visible at the cursor or last paste location)?"),
  keyCombo("select-all", "Select all visible objects in the current space", "cmd+a",
    "Have all visible drawing objects been selected (highlighted with grips)?"),
  keyCombo("toggle-command-line", "Toggle visibility of the command line panel", "cmd+9",
    "Has the command line panel toggled (it is now in the opposite visibility state from before)?"),

  // ----------------------------------------------------------------------
  // Drawing primitives (typed commands) — ~25
  // ----------------------------------------------------------------------
  typedCmd("draw-line", "Start the LINE command (multi-segment line)", "LINE",
    "Is AutoCAD now prompting for the first line point (command line shows 'Specify first point:')?"),
  typedCmd("draw-line-alias", "Start the LINE command via the L alias", "L",
    "Is AutoCAD now prompting for the first line point?"),
  typedCmd("draw-pline", "Start the PLINE (polyline) command", "PLINE",
    "Is AutoCAD now prompting for the polyline start point?"),
  typedCmd("draw-pline-alias", "Start the polyline command via the PL alias", "PL",
    "Is AutoCAD now prompting for the polyline start point?"),
  typedCmd("draw-circle", "Start the CIRCLE command", "CIRCLE",
    "Is AutoCAD prompting for the circle center point or three-point/two-point options?"),
  typedCmd("draw-circle-alias", "Start the CIRCLE command via the C alias", "C",
    "Is AutoCAD prompting for the circle center point?"),
  typedCmd("draw-arc", "Start the ARC command", "ARC",
    "Is AutoCAD prompting for the arc start point or arc options?"),
  typedCmd("draw-arc-alias", "Start the ARC command via the A alias", "A",
    "Is AutoCAD prompting for the arc start point?"),
  typedCmd("draw-rectangle", "Start the RECTANGLE command", "RECTANGLE",
    "Is AutoCAD prompting for the rectangle's first corner?"),
  typedCmd("draw-rectangle-alias", "Start the RECTANGLE command via the REC alias", "REC",
    "Is AutoCAD prompting for the rectangle's first corner?"),
  typedCmd("draw-ellipse", "Start the ELLIPSE command", "ELLIPSE",
    "Is AutoCAD prompting for the ellipse axis endpoint or center?"),
  typedCmd("draw-ellipse-alias", "Start the ELLIPSE command via the EL alias", "EL",
    "Is AutoCAD prompting for the ellipse axis endpoint or center?"),
  typedCmd("draw-polygon", "Start the POLYGON command (regular n-sided polygon)", "POLYGON",
    "Is AutoCAD prompting for the number of sides for the polygon?"),
  typedCmd("draw-polygon-alias", "Start the POLYGON command via the POL alias", "POL",
    "Is AutoCAD prompting for the number of sides for the polygon?"),
  typedCmd("draw-point", "Start the POINT command (single point object)", "POINT",
    "Is AutoCAD prompting for the location of the point?"),
  typedCmd("draw-point-alias", "Start the POINT command via the PO alias", "PO",
    "Is AutoCAD prompting for the location of the point?"),
  typedCmd("draw-ray", "Start the RAY command (semi-infinite line)", "RAY",
    "Is AutoCAD prompting for the start point of the ray?"),
  typedCmd("draw-xline", "Start the XLINE (construction line) command", "XLINE",
    "Is AutoCAD prompting for an XLINE point or option (Hor/Ver/Ang/Bisect/Offset)?"),
  typedCmd("draw-xline-alias", "Start the XLINE command via the XL alias", "XL",
    "Is AutoCAD prompting for an XLINE point or option?"),
  typedCmd("draw-spline", "Start the SPLINE command (NURBS curve)", "SPLINE",
    "Is AutoCAD prompting for the first spline point or method?"),
  typedCmd("draw-spline-alias", "Start the SPLINE command via the SPL alias", "SPL",
    "Is AutoCAD prompting for the first spline point or method?"),
  typedCmd("draw-helix", "Start the HELIX command (3D helical spring shape)", "HELIX",
    "Is AutoCAD prompting for the helix base center point?"),
  typedCmd("draw-donut", "Start the DONUT command (filled annular ring)", "DONUT",
    "Is AutoCAD prompting for the donut's inside diameter?"),
  typedCmd("draw-revcloud", "Start the REVCLOUD command (revision cloud)", "REVCLOUD",
    "Is AutoCAD prompting for the revision-cloud start point or option?"),
  typedCmd("draw-region", "Start the REGION command (convert closed shape into 2D region)", "REGION",
    "Is AutoCAD prompting to select objects to convert into a region?"),

  // ----------------------------------------------------------------------
  // Modify (typed commands) — ~40
  // ----------------------------------------------------------------------
  typedCmd("modify-move", "Start the MOVE command", "MOVE",
    "Is AutoCAD prompting to select objects to move?"),
  typedCmd("modify-move-alias", "Start MOVE via the M alias", "M",
    "Is AutoCAD prompting to select objects to move?"),
  typedCmd("modify-copy", "Start the COPY command", "COPY",
    "Is AutoCAD prompting to select objects to copy?"),
  typedCmd("modify-copy-alias", "Start COPY via the CO alias", "CO",
    "Is AutoCAD prompting to select objects to copy?"),
  typedCmd("modify-rotate", "Start the ROTATE command", "ROTATE",
    "Is AutoCAD prompting to select objects to rotate?"),
  typedCmd("modify-rotate-alias", "Start ROTATE via the RO alias", "RO",
    "Is AutoCAD prompting to select objects to rotate?"),
  typedCmd("modify-mirror", "Start the MIRROR command", "MIRROR",
    "Is AutoCAD prompting to select objects to mirror?"),
  typedCmd("modify-mirror-alias", "Start MIRROR via the MI alias", "MI",
    "Is AutoCAD prompting to select objects to mirror?"),
  typedCmd("modify-offset", "Start the OFFSET command (parallel duplicate at distance)", "OFFSET",
    "Is AutoCAD prompting for the offset distance or option?"),
  typedCmd("modify-offset-alias", "Start OFFSET via the O alias", "O",
    "Is AutoCAD prompting for the offset distance or option?"),
  typedCmd("modify-array-rect", "Start the ARRAYRECT (rectangular array) command", "ARRAYRECT",
    "Is AutoCAD prompting to select objects for a rectangular array?"),
  typedCmd("modify-array-polar", "Start the ARRAYPOLAR (polar array) command", "ARRAYPOLAR",
    "Is AutoCAD prompting to select objects for a polar array?"),
  typedCmd("modify-array-path", "Start the ARRAYPATH (path array) command", "ARRAYPATH",
    "Is AutoCAD prompting to select objects for a path array?"),
  typedCmd("modify-array-alias", "Start the ARRAY command via the AR alias", "AR",
    "Is AutoCAD prompting for an array option (Rectangular/Path/Polar)?"),
  typedCmd("modify-trim", "Start the TRIM command", "TRIM",
    "Is AutoCAD prompting to select objects to trim or a cutting edge?"),
  typedCmd("modify-trim-alias", "Start TRIM via the TR alias", "TR",
    "Is AutoCAD prompting to select objects to trim or a cutting edge?"),
  typedCmd("modify-extend", "Start the EXTEND command", "EXTEND",
    "Is AutoCAD prompting to select objects to extend or a boundary edge?"),
  typedCmd("modify-extend-alias", "Start EXTEND via the EX alias", "EX",
    "Is AutoCAD prompting to select objects to extend or a boundary edge?"),
  typedCmd("modify-fillet", "Start the FILLET command (round corner)", "FILLET",
    "Is AutoCAD prompting to select the first object to fillet, or a fillet option (Radius/Polyline/Trim/Multiple)?"),
  typedCmd("modify-fillet-alias", "Start FILLET via the F alias", "F",
    "Is AutoCAD prompting to select the first object to fillet, or a fillet option?"),
  typedCmd("modify-chamfer", "Start the CHAMFER command (bevel corner)", "CHAMFER",
    "Is AutoCAD prompting to select the first object to chamfer, or a chamfer option?"),
  typedCmd("modify-chamfer-alias", "Start CHAMFER via the CHA alias", "CHA",
    "Is AutoCAD prompting to select the first object to chamfer, or a chamfer option?"),
  typedCmd("modify-explode", "Start the EXPLODE command (break compound objects into parts)", "EXPLODE",
    "Is AutoCAD prompting to select objects to explode?"),
  typedCmd("modify-explode-alias", "Start EXPLODE via the X alias", "X",
    "Is AutoCAD prompting to select objects to explode?"),
  typedCmd("modify-join", "Start the JOIN command (combine collinear / contiguous objects)", "JOIN",
    "Is AutoCAD prompting to select source objects to join?"),
  typedCmd("modify-join-alias", "Start JOIN via the J alias", "J",
    "Is AutoCAD prompting to select source objects to join?"),
  typedCmd("modify-break", "Start the BREAK command (cut object into two)", "BREAK",
    "Is AutoCAD prompting to select an object to break?"),
  typedCmd("modify-break-alias", "Start BREAK via the BR alias", "BR",
    "Is AutoCAD prompting to select an object to break?"),
  typedCmd("modify-stretch", "Start the STRETCH command", "STRETCH",
    "Is AutoCAD prompting to select objects to stretch (typically with a crossing window)?"),
  typedCmd("modify-stretch-alias", "Start STRETCH via the S alias", "S",
    "Is AutoCAD prompting to select objects to stretch?"),
  typedCmd("modify-scale", "Start the SCALE command", "SCALE",
    "Is AutoCAD prompting to select objects to scale?"),
  typedCmd("modify-scale-alias", "Start SCALE via the SC alias", "SC",
    "Is AutoCAD prompting to select objects to scale?"),
  typedCmd("modify-align", "Start the ALIGN command (move + rotate + scale to align)", "ALIGN",
    "Is AutoCAD prompting to select objects to align?"),
  typedCmd("modify-matchprop", "Start the MATCHPROP command (copy properties from source to destination)", "MATCHPROP",
    "Is AutoCAD prompting to select the source object whose properties will be matched?"),
  typedCmd("modify-matchprop-alias", "Start MATCHPROP via the MA alias", "MA",
    "Is AutoCAD prompting to select the source object whose properties will be matched?"),
  typedCmd("modify-erase", "Start the ERASE command (delete selected objects)", "ERASE",
    "Is AutoCAD prompting to select objects to erase?",
    { risk: "destructive" }),
  typedCmd("modify-erase-alias", "Start ERASE via the E alias", "E",
    "Is AutoCAD prompting to select objects to erase?",
    { risk: "destructive" }),
  typedCmd("modify-pedit", "Start the PEDIT command (edit polyline)", "PEDIT",
    "Is AutoCAD prompting to select a polyline to edit?"),
  typedCmd("modify-pedit-alias", "Start PEDIT via the PE alias", "PE",
    "Is AutoCAD prompting to select a polyline to edit?"),
  typedCmd("modify-lengthen", "Start the LENGTHEN command (change length of object)", "LENGTHEN",
    "Is AutoCAD prompting for a lengthen mode (Delta/Percent/Total/Dynamic) or to select an object?"),

  // ----------------------------------------------------------------------
  // Annotation — ~30
  // ----------------------------------------------------------------------
  typedCmd("annot-text", "Start the TEXT (single-line) command", "TEXT",
    "Is AutoCAD prompting for the text start point or option (Justify/Style)?"),
  typedCmd("annot-text-alias", "Start single-line TEXT via the DT alias", "DT",
    "Is AutoCAD prompting for the text start point or option?"),
  typedCmd("annot-mtext", "Start the MTEXT (multiline text) command", "MTEXT",
    "Is AutoCAD prompting for the first corner of the MTEXT bounding box?"),
  typedCmd("annot-mtext-alias", "Start MTEXT via the T alias", "T",
    "Is AutoCAD prompting for the first corner of the MTEXT bounding box?"),
  typedCmd("annot-mtext-mt-alias", "Start MTEXT via the MT alias", "MT",
    "Is AutoCAD prompting for the first corner of the MTEXT bounding box?"),
  typedCmd("annot-dim-linear", "Start the DIMLINEAR command (linear dimension)", "DIMLINEAR",
    "Is AutoCAD prompting for the first extension-line origin or to select an object to dimension?"),
  typedCmd("annot-dim-linear-alias", "Start DIMLINEAR via the DLI alias", "DLI",
    "Is AutoCAD prompting for the first extension-line origin or to select an object?"),
  typedCmd("annot-dim-aligned", "Start the DIMALIGNED command (aligned dimension)", "DIMALIGNED",
    "Is AutoCAD prompting for the first extension-line origin for an aligned dimension?"),
  typedCmd("annot-dim-aligned-alias", "Start DIMALIGNED via the DAL alias", "DAL",
    "Is AutoCAD prompting for the first extension-line origin?"),
  typedCmd("annot-dim-radius", "Start the DIMRADIUS command (radius dimension)", "DIMRADIUS",
    "Is AutoCAD prompting to select an arc or circle for a radius dimension?"),
  typedCmd("annot-dim-radius-alias", "Start DIMRADIUS via the DRA alias", "DRA",
    "Is AutoCAD prompting to select an arc or circle for a radius dimension?"),
  typedCmd("annot-dim-diameter", "Start the DIMDIAMETER command (diameter dimension)", "DIMDIAMETER",
    "Is AutoCAD prompting to select an arc or circle for a diameter dimension?"),
  typedCmd("annot-dim-diameter-alias", "Start DIMDIAMETER via the DDI alias", "DDI",
    "Is AutoCAD prompting to select an arc or circle for a diameter dimension?"),
  typedCmd("annot-dim-angular", "Start the DIMANGULAR command (angular dimension)", "DIMANGULAR",
    "Is AutoCAD prompting to select an arc, circle, line, or vertex for an angular dimension?"),
  typedCmd("annot-dim-angular-alias", "Start DIMANGULAR via the DAN alias", "DAN",
    "Is AutoCAD prompting to select an arc, circle, line, or vertex for an angular dimension?"),
  typedCmd("annot-dim-arc", "Start the DIMARC command (arc-length dimension)", "DIMARC",
    "Is AutoCAD prompting to select an arc or arc-segment for an arc dimension?"),
  typedCmd("annot-dim-ordinate", "Start the DIMORDINATE command", "DIMORDINATE",
    "Is AutoCAD prompting for an ordinate-dimension feature location?"),
  typedCmd("annot-dim-baseline", "Start the DIMBASELINE command (baseline dimension)", "DIMBASELINE",
    "Is AutoCAD prompting for the next-extension-line origin for a baseline dimension?"),
  typedCmd("annot-dim-continue", "Start the DIMCONTINUE command (chained dimension)", "DIMCONTINUE",
    "Is AutoCAD prompting for the next extension-line origin for a continued dimension?"),
  typedCmd("annot-dim-jogged", "Start the DIMJOGGED command (jogged radius dimension)", "DIMJOGGED",
    "Is AutoCAD prompting to select an arc or circle for a jogged radius dimension?"),
  typedCmd("annot-leader", "Start the LEADER command (single leader)", "LEADER",
    "Is AutoCAD prompting for the leader start point?"),
  typedCmd("annot-mleader", "Start the MLEADER command (multileader)", "MLEADER",
    "Is AutoCAD prompting for the multileader landing or arrowhead location?"),
  typedCmd("annot-qleader", "Start the QLEADER command (quick leader)", "QLEADER",
    "Is AutoCAD prompting for the quick-leader first point?"),
  typedCmd("annot-hatch", "Start the HATCH command (fill closed area with pattern)", "HATCH",
    "Is the Hatch contextual ribbon active or is AutoCAD prompting to pick an internal point or select objects?"),
  typedCmd("annot-hatch-alias", "Start HATCH via the H alias", "H",
    "Is the Hatch contextual ribbon active or is AutoCAD prompting to pick an internal point?"),
  typedCmd("annot-bhatch-alias", "Start HATCH via the BHATCH alias", "BHATCH",
    "Is the Hatch contextual ribbon active or is AutoCAD prompting to pick an internal point?"),
  typedCmd("annot-gradient", "Start the GRADIENT command (fill with color gradient)", "GRADIENT",
    "Is the Gradient contextual ribbon active or is AutoCAD prompting to pick an internal point?"),
  typedCmd("annot-tablet", "Start the TABLE command (insert a data table)", "TABLE",
    "Is the Insert Table dialog visible?"),
  typedCmd("annot-table-alias", "Start TABLE via the TB alias", "TB",
    "Is the Insert Table dialog visible?"),
  typedCmd("annot-textedit", "Start the TEXTEDIT command (edit existing text)", "TEXTEDIT",
    "Is AutoCAD prompting to select an annotation object to edit?"),

  // ----------------------------------------------------------------------
  // Selection — ~15
  // ----------------------------------------------------------------------
  typedCmd("select-objects", "Start the SELECT command (build a manual selection set)", "SELECT",
    "Is AutoCAD prompting to select objects?"),
  typedCmd("select-objects-alias", "Start SELECT via the SE alias", "SE",
    "Is AutoCAD prompting to select objects?"),
  typedCmd("select-quick", "Open the Quick Select dialog (filter selection by property)", "QSELECT",
    "Is the Quick Select dialog now visible?"),
  typedCmd("select-similar", "Start the SELECTSIMILAR command (select all objects similar to current)", "SELECTSIMILAR",
    "Is AutoCAD prompting to select an example object whose siblings will be selected?"),
  typedCmd("select-filter", "Open the FILTER dialog (build named selection filter)", "FILTER",
    "Is the Object Selection Filters dialog now visible?"),
  typedCmd("select-pickadd-toggle", "Toggle PICKADD between additive and replacement selection", "PICKADD",
    "Has AutoCAD prompted for or echoed a PICKADD value (toggling between 0 and 1)?"),
  typedCmd("select-pickfirst-toggle", "Toggle PICKFIRST (whether selection survives across commands)", "PICKFIRST",
    "Has AutoCAD prompted for or echoed a PICKFIRST value?"),
  typedCmd("select-pickauto-toggle", "Toggle PICKAUTO (auto-windowing behaviour)", "PICKAUTO",
    "Has AutoCAD prompted for or echoed a PICKAUTO value?"),
  typedCmd("select-pickbox-set", "Open the PICKBOX setting (target box size for selection)", "PICKBOX",
    "Has AutoCAD prompted for a PICKBOX value?"),
  typedCmd("select-deselect", "Start the DESELECTALL command (clear current selection)", "DESELECTALL",
    "Has the active selection been cleared (no grips visible on previously-selected geometry)?"),
  typedCmd("select-prev", "Start the PREVIOUS selection (re-select last selection set)", "P",
    "Has the previous selection been re-applied (its grips are visible again)?"),
  typedCmd("select-fence", "Use FENCE selection at the next select-objects prompt (chain typed before SELECT)", "FENCE",
    "Has AutoCAD acknowledged the FENCE option (prompting to specify the fence's first point)?"),
  typedCmd("select-wpolygon", "Use WPOLYGON (window polygon) selection mode", "WP",
    "Has AutoCAD acknowledged the WPOLYGON option?"),
  typedCmd("select-cpolygon", "Use CPOLYGON (crossing polygon) selection mode", "CP",
    "Has AutoCAD acknowledged the CPOLYGON option?"),
  typedCmd("select-all-cmd", "Start the ALL keyword to select every drawing object", "ALL",
    "Has AutoCAD acknowledged ALL (every visible object selected)?"),

  // ----------------------------------------------------------------------
  // Layers — ~15
  // ----------------------------------------------------------------------
  typedCmd("layer-properties", "Open the Layer Properties Manager", "LAYER",
    "Is the Layer Properties Manager palette/dialog now visible?"),
  typedCmd("layer-properties-alias", "Open the Layer Properties Manager via the LA alias", "LA",
    "Is the Layer Properties Manager palette/dialog now visible?"),
  typedCmd("layer-walk", "Start the LAYWALK command", "LAYWALK",
    "Is the LayerWalk dialog now visible?"),
  typedCmd("layer-isolate", "Start the LAYISO command (isolate selected object's layer)", "LAYISO",
    "Is AutoCAD prompting to select an object whose layer should be isolated?"),
  typedCmd("layer-unisolate", "Start the LAYUNISO command (restore previously isolated layers)", "LAYUNISO",
    "Have the previously isolated layers been restored to their prior visibility state?"),
  typedCmd("layer-off", "Start the LAYOFF command (turn off selected object's layer)", "LAYOFF",
    "Is AutoCAD prompting to select an object whose layer should be turned off?"),
  typedCmd("layer-on", "Start the LAYON command (turn on all layers)", "LAYON",
    "Have all previously off layers been turned back on?"),
  typedCmd("layer-freeze", "Start the LAYFRZ command (freeze a layer)", "LAYFRZ",
    "Is AutoCAD prompting to select an object whose layer should be frozen?"),
  typedCmd("layer-thaw", "Start the LAYTHW command (thaw all frozen layers)", "LAYTHW",
    "Have all frozen layers been thawed (their objects are visible again)?"),
  typedCmd("layer-current", "Start the LAYMCUR command (set selected object's layer current)", "LAYMCUR",
    "Is AutoCAD prompting to select an object whose layer should become current?"),
  typedCmd("layer-merge", "Start the LAYMRG command (merge layers, deleting source)", "LAYMRG",
    "Is AutoCAD prompting to select objects on the source layer for layer merge?",
    { risk: "destructive" }),
  typedCmd("layer-delete", "Start the LAYDEL command (delete a layer and its objects)", "LAYDEL",
    "Is AutoCAD prompting to select an object on the layer to delete?",
    { risk: "destructive" }),
  typedCmd("layer-lock", "Start the LAYLCK command (lock a layer)", "LAYLCK",
    "Is AutoCAD prompting to select an object whose layer should be locked?"),
  typedCmd("layer-unlock", "Start the LAYULK command (unlock a layer)", "LAYULK",
    "Is AutoCAD prompting to select an object whose layer should be unlocked?"),
  typedCmd("layer-make", "Start the LAYMAKE command (create a layer and make it current)", "LAYMAKE",
    "Is AutoCAD prompting to select objects whose layer should be created/made current?"),

  // ----------------------------------------------------------------------
  // Blocks — ~20
  // ----------------------------------------------------------------------
  typedCmd("block-insert", "Open the Insert Block dialog (INSERT)", "INSERT",
    "Is the Blocks palette or Insert dialog now visible?"),
  typedCmd("block-insert-alias", "Open the Insert Block dialog via the I alias", "I",
    "Is the Blocks palette or Insert dialog now visible?"),
  typedCmd("block-define", "Open the Block Definition dialog (BLOCK)", "BLOCK",
    "Is the Block Definition dialog now visible (with Name, Base point, Objects sections)?"),
  typedCmd("block-define-alias", "Open the Block Definition dialog via the B alias", "B",
    "Is the Block Definition dialog now visible?"),
  typedCmd("block-write", "Open the Write Block dialog (WBLOCK)", "WBLOCK",
    "Is the Write Block dialog now visible?"),
  typedCmd("block-write-alias", "Open the Write Block dialog via the W alias", "W",
    "Is the Write Block dialog now visible?"),
  typedCmd("block-edit", "Open the Block Editor (BEDIT)", "BEDIT",
    "Is the Block Editor environment active (or is the Edit Block Definition dialog visible)?"),
  typedCmd("block-edit-alias", "Open the Block Editor via the BE alias", "BE",
    "Is the Block Editor environment active?"),
  typedCmd("block-refedit", "Start the REFEDIT command (edit a referenced block in place)", "REFEDIT",
    "Is AutoCAD prompting to select the reference (block or xref) to edit in place?"),
  typedCmd("block-refclose", "Start the REFCLOSE command (close in-place reference editing)", "REFCLOSE",
    "Is AutoCAD prompting whether to save changes to the reference?"),
  typedCmd("block-attdef", "Open the Attribute Definition dialog (ATTDEF)", "ATTDEF",
    "Is the Attribute Definition dialog now visible?"),
  typedCmd("block-attdef-alias", "Open the Attribute Definition dialog via the ATT alias", "ATT",
    "Is the Attribute Definition dialog now visible?"),
  typedCmd("block-attedit", "Start the ATTEDIT command (edit block attributes)", "ATTEDIT",
    "Is AutoCAD prompting to select a block whose attributes will be edited?"),
  typedCmd("block-eattedit", "Start the EATTEDIT command (enhanced attribute editor)", "EATTEDIT",
    "Is AutoCAD prompting to select a block for the enhanced attribute editor?"),
  typedCmd("block-bcount", "Start the BCOUNT command (count occurrences of each block)", "BCOUNT",
    "Is the BCOUNT result visible (a list of block names with their counts)?"),
  typedCmd("block-bedit-close", "Close the Block Editor (BCLOSE)", "BCLOSE",
    "Has the Block Editor closed and the drawing returned to model space?"),
  typedCmd("block-explode-attribute", "Start BURST (explode block, retaining attribute text)", "BURST",
    "Is AutoCAD prompting to select blocks to burst?"),
  typedCmd("block-replace-all", "Start the BREPLACE command (Express Tool: replace block with another)", "BREPLACE",
    "Is AutoCAD prompting to select the blocks to replace?"),
  typedCmd("block-list-by-name", "Start the BLOCKICON command (refresh block thumbnail icons)", "BLOCKICON",
    "Has AutoCAD echoed BLOCKICON acknowledgment / progress message?"),
  typedCmd("block-purge-unused", "Start the PURGE command targeted at unused blocks", "PURGE",
    "Is the Purge dialog now visible (with categories of removable items)?",
    { risk: "destructive" }),

  // ----------------------------------------------------------------------
  // Layouts / paper space — ~15
  // ----------------------------------------------------------------------
  typedCmd("layout-new", "Start the LAYOUT command (create/manage layout tabs)", "LAYOUT",
    "Has AutoCAD prompted for a LAYOUT subcommand (New/Copy/Delete/Rename/Save/Set/?)?"),
  typedCmd("layout-mview", "Start the MVIEW command (create paper-space viewport)", "MVIEW",
    "Is AutoCAD prompting for a viewport corner or option (in a Layout tab)?"),
  typedCmd("layout-vpmax", "Maximize the active viewport (VPMAX)", "VPMAX",
    "Has the active layout viewport been maximized (it now fills the drawing area, with a red border)?"),
  typedCmd("layout-vpmin", "Restore the maximized viewport (VPMIN)", "VPMIN",
    "Has the maximized viewport been restored (the layout sheet is visible again)?"),
  typedCmd("layout-mspace", "Switch from paper space to model space inside the current viewport (MSPACE)", "MSPACE",
    "Is the active viewport now in model-space mode (the viewport border is highlighted and the cursor is inside it)?"),
  typedCmd("layout-pspace", "Switch from inside-viewport model space back to paper space (PSPACE)", "PSPACE",
    "Is the layout now in paper-space mode (the cursor is over the layout sheet, not inside any viewport)?"),
  typedCmd("layout-pagesetup", "Open the Page Setup Manager (PAGESETUP)", "PAGESETUP",
    "Is the Page Setup Manager dialog now visible?"),
  typedCmd("layout-vplayer", "Start the VPLAYER command (per-viewport layer overrides)", "VPLAYER",
    "Has AutoCAD prompted for a VPLAYER subcommand (?/Color/Linetype/Lineweight/Transparency/Freeze/...)?"),
  typedCmd("layout-vports", "Start the VPORTS command (manage viewports configuration)", "VPORTS",
    "Is the Viewports dialog now visible?"),
  typedCmd("layout-export", "Start the EXPORT command (export layout to format)", "EXPORT",
    "Is the Export Data file dialog now visible?"),
  typedCmd("layout-export-pdf", "Start the EXPORTPDF command (export current layout to PDF)", "EXPORTPDF",
    "Is the Save as PDF dialog now visible?"),
  typedCmd("layout-export-dwf", "Start the EXPORTDWF command (export current layout to DWF)", "EXPORTDWF",
    "Is the Save as DWF dialog now visible?"),
  typedCmd("layout-rename", "Start the RENAME command targeting layouts", "RENAME",
    "Is the Rename dialog now visible (with categories like Blocks, Layers, Layouts)?"),
  typedCmd("layout-copy", "Right-click the layout tab → Copy (mapped here as a typed LAYOUT C subcommand)", "LAYOUT C",
    "Has AutoCAD prompted for the layout name to copy?"),
  typedCmd("layout-delete", "Right-click the layout tab → Delete (LAYOUT D subcommand)", "LAYOUT D",
    "Has AutoCAD prompted for the layout name to delete?",
    { risk: "destructive" }),

  // ----------------------------------------------------------------------
  // Object snap (OSNAP) — ~20
  // ----------------------------------------------------------------------
  typedCmd("osnap-settings", "Open the Drafting Settings dialog at the Object Snap tab (OSNAP)", "OSNAP",
    "Is the Drafting Settings dialog now visible with the Object Snap tab active?"),
  typedCmd("osnap-settings-alias", "Open the Drafting Settings dialog via the OS alias", "OS",
    "Is the Drafting Settings dialog now visible with the Object Snap tab active?"),
  typedCmd("osnap-endpoint", "Apply ENDPOINT object snap once for the next pick", "END",
    "Has AutoCAD acknowledged the ENDPOINT override (the next pick will snap to an endpoint)?"),
  typedCmd("osnap-midpoint", "Apply MIDPOINT object snap once", "MID",
    "Has AutoCAD acknowledged the MIDPOINT override?"),
  typedCmd("osnap-center", "Apply CENTER object snap once", "CEN",
    "Has AutoCAD acknowledged the CENTER override?"),
  typedCmd("osnap-intersection", "Apply INTERSECTION object snap once", "INT",
    "Has AutoCAD acknowledged the INTERSECTION override?"),
  typedCmd("osnap-apparent-intersection", "Apply APPARENT INTERSECTION object snap once", "APP",
    "Has AutoCAD acknowledged the APPARENT INTERSECTION override?"),
  typedCmd("osnap-perpendicular", "Apply PERPENDICULAR object snap once", "PER",
    "Has AutoCAD acknowledged the PERPENDICULAR override?"),
  typedCmd("osnap-tangent", "Apply TANGENT object snap once", "TAN",
    "Has AutoCAD acknowledged the TANGENT override?"),
  typedCmd("osnap-quadrant", "Apply QUADRANT object snap once", "QUA",
    "Has AutoCAD acknowledged the QUADRANT override?"),
  typedCmd("osnap-nearest", "Apply NEAREST object snap once", "NEA",
    "Has AutoCAD acknowledged the NEAREST override?"),
  typedCmd("osnap-node", "Apply NODE object snap once (snap to point objects)", "NOD",
    "Has AutoCAD acknowledged the NODE override?"),
  typedCmd("osnap-insertion", "Apply INSERTION object snap once (snap to block/text insertion point)", "INS",
    "Has AutoCAD acknowledged the INSERTION override?"),
  typedCmd("osnap-from", "Apply FROM relative offset reference for the next pick", "FROM",
    "Has AutoCAD prompted for the FROM base point?"),
  typedCmd("osnap-temporary-track", "Apply temporary tracking point for the next pick", "TT",
    "Has AutoCAD acknowledged the temporary track-point mode?"),
  typedCmd("osnap-mid-between", "Apply midpoint-between-two-points for the next pick", "MTP",
    "Has AutoCAD prompted for the first of two points for the mid-between override?"),
  typedCmd("osnap-extension", "Apply EXTENSION object snap once", "EXT",
    "Has AutoCAD acknowledged the EXTENSION override?"),
  typedCmd("osnap-parallel", "Apply PARALLEL object snap once", "PAR",
    "Has AutoCAD acknowledged the PARALLEL override?"),
  typedCmd("osnap-geometric-center", "Apply GEOMETRIC CENTER object snap once", "GCE",
    "Has AutoCAD acknowledged the GEOMETRIC CENTER override?"),
  typedCmd("osnap-none", "Suppress object snap for the next pick", "NON",
    "Has AutoCAD acknowledged that object snap is suppressed for the next pick?"),

  // ----------------------------------------------------------------------
  // View / display — ~25
  // ----------------------------------------------------------------------
  typedCmd("view-zoom", "Start the ZOOM command (prompt for zoom mode)", "ZOOM",
    "Has AutoCAD prompted for a ZOOM option (All/Center/Dynamic/Extents/Previous/Scale/Window/Object)?"),
  typedCmd("view-zoom-alias", "Start ZOOM via the Z alias", "Z",
    "Has AutoCAD prompted for a ZOOM option?"),
  typedCmd("view-zoom-extents", "Zoom Extents (fit all objects in current viewport)", "ZOOM E",
    "Has the viewport zoomed to fit all visible objects (the drawing fills the viewport)?"),
  typedCmd("view-zoom-all", "Zoom All (extents or drawing limits, whichever is larger)", "ZOOM A",
    "Has the viewport zoomed to All (drawing limits or extents, whichever is larger)?"),
  typedCmd("view-zoom-window", "Zoom Window prompt", "ZOOM W",
    "Has AutoCAD prompted for the zoom window's first corner?"),
  typedCmd("view-zoom-previous", "Zoom Previous", "ZOOM P",
    "Has the viewport restored to the previous zoom state?"),
  typedCmd("view-zoom-scale", "Zoom Scale prompt", "ZOOM S",
    "Has AutoCAD prompted for the zoom scale factor?"),
  typedCmd("view-zoom-realtime", "Real-time zoom (drag the cursor)", "RTZOOM",
    "Has AutoCAD entered real-time zoom mode (cursor changes to a magnifier)?"),
  typedCmd("view-pan", "Start the PAN command (pan with cursor drag)", "PAN",
    "Has AutoCAD entered pan mode (cursor is a hand glyph)?"),
  typedCmd("view-pan-alias", "Start PAN via the P alias", "P",
    "Has AutoCAD entered pan mode?"),
  typedCmd("view-regen", "Regenerate the current viewport (REGEN)", "REGEN",
    "Has the viewport regenerated (display geometry recomputed; arcs no longer faceted)?"),
  typedCmd("view-regen-alias", "Regenerate via the RE alias", "RE",
    "Has the viewport regenerated?"),
  typedCmd("view-regenall", "Regenerate every viewport (REGENALL)", "REGENALL",
    "Have all viewports regenerated?"),
  typedCmd("view-redraw", "Redraw the current viewport (REDRAW)", "REDRAW",
    "Has the current viewport been redrawn (no other state changed)?"),
  typedCmd("view-orbit", "Start free 3D Orbit (3DORBIT)", "3DORBIT",
    "Has AutoCAD entered 3D Orbit mode (the cursor is a green orbit glyph and dragging rotates the view)?"),
  typedCmd("view-orbit-alias", "Start 3D Orbit via the 3DO alias", "3DO",
    "Has AutoCAD entered 3D Orbit mode?"),
  typedCmd("view-orbit-continuous", "Start continuous 3D orbit (3DCORBIT)", "3DCORBIT",
    "Has AutoCAD entered continuous 3D Orbit mode (the view rotates continuously after a flick)?"),
  typedCmd("view-orbit-constrained", "Start constrained 3D orbit (3DCONORBIT)", "3DCONORBIT",
    "Has AutoCAD entered constrained 3D Orbit mode (rotation locked to horizontal axis)?"),
  typedCmd("view-top", "Set the view direction to Top (PLAN view)", "VIEW _TOP",
    "Has the view changed to a top (plan) projection?"),
  typedCmd("view-front", "Set the view direction to Front", "VIEW _FRONT",
    "Has the view changed to a front projection?"),
  typedCmd("view-side", "Set the view direction to Right side", "VIEW _RIGHT",
    "Has the view changed to a right-side projection?"),
  typedCmd("view-perspective", "Toggle perspective projection on the active view", "PERSPECTIVE",
    "Has the view toggled between perspective and parallel projection?"),
  typedCmd("view-named", "Open the View Manager (VIEW)", "VIEW",
    "Is the View Manager dialog now visible?"),
  typedCmd("view-save-named", "Save current view with a name (NEWVIEW)", "NEWVIEW",
    "Is the New View dialog now visible (with a Name field)?"),
  typedCmd("view-restore-named", "Restore a saved named view (-VIEW Restore)", "-VIEW R",
    "Has AutoCAD prompted for the name of the view to restore?"),

  // ----------------------------------------------------------------------
  // 3D primitives + ops — ~30
  // ----------------------------------------------------------------------
  typedCmd("solid-box", "Start the BOX command (3D solid box)", "BOX",
    "Is AutoCAD prompting for the first corner of the box, or the Center option?"),
  typedCmd("solid-cylinder", "Start the CYLINDER command", "CYLINDER",
    "Is AutoCAD prompting for the cylinder's base center point or option?"),
  typedCmd("solid-cone", "Start the CONE command", "CONE",
    "Is AutoCAD prompting for the cone's base center point or option?"),
  typedCmd("solid-sphere", "Start the SPHERE command", "SPHERE",
    "Is AutoCAD prompting for the sphere's center point?"),
  typedCmd("solid-torus", "Start the TORUS command", "TORUS",
    "Is AutoCAD prompting for the torus center point?"),
  typedCmd("solid-wedge", "Start the WEDGE command", "WEDGE",
    "Is AutoCAD prompting for the wedge's first corner?"),
  typedCmd("solid-pyramid", "Start the PYRAMID command", "PYRAMID",
    "Is AutoCAD prompting for the pyramid base center or option?"),
  typedCmd("solid-extrude", "Start the EXTRUDE command", "EXTRUDE",
    "Is AutoCAD prompting to select objects to extrude?"),
  typedCmd("solid-extrude-alias", "Start EXTRUDE via the EXT alias", "EXT",
    "Is AutoCAD prompting to select objects to extrude?"),
  typedCmd("solid-presspull", "Start the PRESSPULL command (push/pull faces)", "PRESSPULL",
    "Is AutoCAD prompting to click inside a bounded area to press/pull?"),
  typedCmd("solid-revolve", "Start the REVOLVE command", "REVOLVE",
    "Is AutoCAD prompting to select objects to revolve?"),
  typedCmd("solid-revolve-alias", "Start REVOLVE via the REV alias", "REV",
    "Is AutoCAD prompting to select objects to revolve?"),
  typedCmd("solid-sweep", "Start the SWEEP command", "SWEEP",
    "Is AutoCAD prompting to select objects to sweep?"),
  typedCmd("solid-loft", "Start the LOFT command", "LOFT",
    "Is AutoCAD prompting to select cross-section curves in lofting order?"),
  typedCmd("solid-union", "Start the UNION command (Boolean union)", "UNION",
    "Is AutoCAD prompting to select solids/regions to unite?"),
  typedCmd("solid-union-alias", "Start UNION via the UNI alias", "UNI",
    "Is AutoCAD prompting to select solids/regions to unite?"),
  typedCmd("solid-subtract", "Start the SUBTRACT command (Boolean subtract)", "SUBTRACT",
    "Is AutoCAD prompting to select solids/regions to subtract from?"),
  typedCmd("solid-subtract-alias", "Start SUBTRACT via the SU alias", "SU",
    "Is AutoCAD prompting to select solids/regions to subtract from?"),
  typedCmd("solid-intersect", "Start the INTERSECT command (Boolean intersect)", "INTERSECT",
    "Is AutoCAD prompting to select solids/regions to intersect?"),
  typedCmd("solid-intersect-alias", "Start INTERSECT via the IN alias", "IN",
    "Is AutoCAD prompting to select solids/regions to intersect?"),
  typedCmd("solid-slice", "Start the SLICE command (cut solids by a plane)", "SLICE",
    "Is AutoCAD prompting to select objects to slice?"),
  typedCmd("solid-slice-alias", "Start SLICE via the SL alias", "SL",
    "Is AutoCAD prompting to select objects to slice?"),
  typedCmd("solid-section", "Start the SECTION command (create a 2D section through solids)", "SECTION",
    "Is AutoCAD prompting to select objects for sectioning?"),
  typedCmd("solid-shell", "Start the SHELL command (hollow a solid by removing faces)", "SHELL",
    "Is AutoCAD prompting to select a 3D solid to shell?"),
  typedCmd("solid-fillet-edge", "Start the FILLETEDGE command (fillet edges of a 3D solid)", "FILLETEDGE",
    "Is AutoCAD prompting to select edges to fillet?"),
  typedCmd("solid-chamfer-edge", "Start the CHAMFEREDGE command (chamfer edges of a 3D solid)", "CHAMFEREDGE",
    "Is AutoCAD prompting to select edges to chamfer?"),
  typedCmd("solid-thicken", "Start the THICKEN command (give a surface thickness)", "THICKEN",
    "Is AutoCAD prompting to select surfaces to thicken?"),
  typedCmd("solid-3dmove", "Start the 3DMOVE command", "3DMOVE",
    "Is AutoCAD prompting to select objects with the 3D move gizmo?"),
  typedCmd("solid-3drotate", "Start the 3DROTATE command", "3DROTATE",
    "Is AutoCAD prompting to select objects with the 3D rotate gizmo?"),
  typedCmd("solid-3dscale", "Start the 3DSCALE command", "3DSCALE",
    "Is AutoCAD prompting to select objects with the 3D scale gizmo?"),

  // ----------------------------------------------------------------------
  // Inquiry — ~15
  // ----------------------------------------------------------------------
  typedCmd("inq-distance", "Start the DIST command (measure distance and angle)", "DIST",
    "Is AutoCAD prompting for the first point of the distance measurement?"),
  typedCmd("inq-distance-alias", "Start DIST via the DI alias", "DI",
    "Is AutoCAD prompting for the first point of the distance measurement?"),
  typedCmd("inq-area", "Start the AREA command (measure area and perimeter)", "AREA",
    "Is AutoCAD prompting for the first corner point or option for the AREA command?"),
  typedCmd("inq-area-alias", "Start AREA via the AA alias", "AA",
    "Is AutoCAD prompting for the first corner point for the AREA command?"),
  typedCmd("inq-massprop", "Start the MASSPROP command (mass properties of solids/regions)", "MASSPROP",
    "Is AutoCAD prompting to select solids/regions for mass-property calculation?"),
  typedCmd("inq-id", "Start the ID command (display coordinates of a picked point)", "ID",
    "Is AutoCAD prompting for a point whose coordinates will be reported?"),
  typedCmd("inq-list", "Start the LIST command (list properties of selected objects)", "LIST",
    "Is AutoCAD prompting to select objects to list?"),
  typedCmd("inq-list-alias", "Start LIST via the LI alias", "LI",
    "Is AutoCAD prompting to select objects to list?"),
  typedCmd("inq-properties", "Open the Properties palette (PROPERTIES)", "PROPERTIES",
    "Is the Properties palette now visible?"),
  typedCmd("inq-properties-alias", "Open the Properties palette via the PR alias", "PR",
    "Is the Properties palette now visible?"),
  typedCmd("inq-properties-ctrl1", "Toggle the Properties palette via Cmd+1", "cmd+1",
    "Has the Properties palette toggled (now visible if it was hidden, hidden if it was visible)?"),
  typedCmd("inq-time", "Start the TIME command (display drawing time statistics)", "TIME",
    "Is AutoCAD displaying drawing time statistics in the command line?"),
  typedCmd("inq-status", "Start the STATUS command (display drawing status)", "STATUS",
    "Is AutoCAD displaying drawing status (limits, snap, fill, etc.) in the command line or text screen?"),
  typedCmd("inq-setvar", "Start the SETVAR command (inspect or set a system variable)", "SETVAR",
    "Has AutoCAD prompted for the variable name (or asked for ? to list variables)?"),
  typedCmd("inq-measuregeom", "Start the MEASUREGEOM command (multi-mode geometry inquiry)", "MEASUREGEOM",
    "Has AutoCAD prompted for an inquiry mode (Distance/Radius/Angle/Area/Volume/eXit)?"),

  // ----------------------------------------------------------------------
  // Drawing aids toggles (function keys + commands) — ~15
  // ----------------------------------------------------------------------
  funcKey("toggle-grid", "Toggle the drawing Grid display", "f7",
    "Has the grid toggled (now visible if previously hidden, hidden if previously visible)?"),
  funcKey("toggle-snap", "Toggle Snap mode (cursor jumps to snap points)", "f9",
    "Has Snap mode toggled (status bar's Snap indicator changed state)?"),
  funcKey("toggle-ortho", "Toggle Ortho mode (constrain cursor to horizontal/vertical)", "f8",
    "Has Ortho mode toggled (status bar's Ortho indicator changed state)?"),
  funcKey("toggle-polar", "Toggle Polar Tracking", "f10",
    "Has Polar Tracking toggled (status bar's Polar indicator changed state)?"),
  funcKey("toggle-osnap-mode", "Toggle running Object Snap mode", "f3",
    "Has running Object Snap toggled (status bar's OSNAP indicator changed state)?"),
  funcKey("toggle-otrack", "Toggle Object Snap Tracking", "f11",
    "Has Object Snap Tracking toggled?"),
  funcKey("toggle-ducs", "Toggle Dynamic UCS", "f6",
    "Has Dynamic UCS toggled?"),
  funcKey("toggle-dyn-input", "Toggle Dynamic Input", "f12",
    "Has Dynamic Input toggled?"),
  funcKey("toggle-snap-3d", "Toggle 3D Object Snap", "f4",
    "Has 3D Object Snap toggled?"),
  funcKey("toggle-isodraft", "Toggle Isometric drafting (cycle planes)", "f5",
    "Has the isoplane cycled (status bar shows the new isoplane: Top/Right/Left)?"),
  funcKey("show-text-screen", "Show the AutoCAD Text Window (command-history)", "f2",
    "Is the AutoCAD Text Window (command history) now visible?"),
  funcKey("toggle-help", "Open the AutoCAD Help window", "f1",
    "Is the AutoCAD Help window now visible?"),
  typedCmd("toggle-lwt", "Toggle Lineweight display (LWT)", "LWT",
    "Has Lineweight display toggled (lines drawn with their lineweights versus uniform)?"),
  typedCmd("toggle-fill", "Toggle FILL mode (filled vs. outlined hatches/polylines)", "FILL",
    "Has FILL mode toggled?"),
  typedCmd("toggle-blipmode", "Toggle BLIPMODE (mark picked points with blips)", "BLIPMODE",
    "Has BLIPMODE toggled?"),

  // ----------------------------------------------------------------------
  // Plot / print — ~10
  // ----------------------------------------------------------------------
  typedCmd("plot-cmd", "Open the Plot dialog via PLOT command", "PLOT",
    "Is the Plot dialog visible on screen with printer/plotter, paper size, and plot area fields?"),
  typedCmd("plot-print-alias", "Open the Plot dialog via the PRINT alias", "PRINT",
    "Is the Plot dialog visible?"),
  typedCmd("plot-publish", "Open the Publish dialog (batch plot)", "PUBLISH",
    "Is the Publish dialog now visible (with a sheet list)?"),
  typedCmd("plot-pagesetup", "Open the Page Setup Manager via PAGESETUP", "PAGESETUP",
    "Is the Page Setup Manager dialog now visible?"),
  typedCmd("plot-preview", "Open the Plot Preview", "PREVIEW",
    "Has AutoCAD entered Plot Preview mode (showing what will plot)?"),
  typedCmd("plot-stamp", "Open the Plot Stamp dialog (PLOTSTAMP)", "PLOTSTAMP",
    "Is the Plot Stamp dialog now visible?"),
  typedCmd("plot-batch", "Open the Batch Plot dialog (BATCHPLT)", "BATCHPLT",
    "Is the Batch Plot dialog now visible?"),
  typedCmd("plot-styles-cmd", "Open the Plot Styles management (STYLESMANAGER)", "STYLESMANAGER",
    "Has the plot-styles file location opened (a Finder window or list of CTB/STB plot style files)?"),
  typedCmd("plot-now", "Plot using the current settings (-PLOT no dialog)", "-PLOT",
    "Has AutoCAD started plotting silently (a plot-progress balloon is visible) or prompted for confirmation?",
    { risk: "destructive" }),
  typedCmd("plot-export-pdf-cmd", "Run EXPORTPDF to write the active layout to PDF", "EXPORTPDF",
    "Is the Save as PDF dialog now visible?"),

  // ----------------------------------------------------------------------
  // Render & presentation — ~10
  // ----------------------------------------------------------------------
  typedCmd("render-now", "Start the RENDER command", "RENDER",
    "Has the Render window opened and begun rendering the current view?"),
  typedCmd("render-presets", "Open the Render Presets Manager (RENDERPRESETS)", "RENDERPRESETS",
    "Is the Render Presets Manager dialog now visible?"),
  typedCmd("render-environment", "Open the Render Environment dialog (RENDERENVIRONMENT)", "RENDERENVIRONMENT",
    "Is the Render Environment / Exposure dialog now visible?"),
  typedCmd("render-window", "Open the Render Window with the last render", "RENDERWIN",
    "Is the Render Window now visible (showing the last render output)?"),
  typedCmd("render-materials-browser", "Open the Materials Browser palette (MATBROWSEROPEN)", "MATBROWSEROPEN",
    "Is the Materials Browser palette now visible?"),
  typedCmd("render-materials-editor", "Open the Materials Editor palette (MATEDITOROPEN)", "MATEDITOROPEN",
    "Is the Materials Editor palette now visible?"),
  typedCmd("render-light-list", "Open the Lights in Model palette (LIGHTLIST)", "LIGHTLIST",
    "Is the Lights in Model palette now visible?"),
  typedCmd("render-sun-properties", "Open the Sun Properties palette (SUNPROPERTIES)", "SUNPROPERTIES",
    "Is the Sun Properties palette now visible?"),
  typedCmd("render-walk", "Start the 3DWALK command (interactive 3D walk-through)", "3DWALK",
    "Has AutoCAD entered 3D Walk navigation mode (cursor and Position Locator panel visible)?"),
  typedCmd("render-fly", "Start the 3DFLY command (interactive 3D fly-through)", "3DFLY",
    "Has AutoCAD entered 3D Fly navigation mode?"),

  // ----------------------------------------------------------------------
  // Express Tools — ~25
  // ----------------------------------------------------------------------
  typedCmd("express-text-mask", "Start the TEXTMASK command (Express Tool: mask area behind text)", "TEXTMASK",
    "Is AutoCAD prompting to select text for masking?"),
  typedCmd("express-text-unmask", "Start the TEXTUNMASK command (remove mask)", "TEXTUNMASK",
    "Is AutoCAD prompting to select text to remove its mask?"),
  typedCmd("express-text-fit", "Start the TEXTFIT command (fit text between two points)", "TEXTFIT",
    "Is AutoCAD prompting to select text to fit?"),
  typedCmd("express-arctext", "Start the ARCTEXT command (place text along an arc)", "ARCTEXT",
    "Is AutoCAD prompting to select an arc for the arc-text command?"),
  typedCmd("express-explode-text", "Start the TXTEXP command (explode text into geometry)", "TXTEXP",
    "Is AutoCAD prompting to select text to explode into geometry?"),
  typedCmd("express-mocoro", "Start the MOCORO command (move/copy/rotate combined)", "MOCORO",
    "Is AutoCAD prompting to select objects for the move/copy/rotate operation?"),
  typedCmd("express-cleanup", "Start the OVERKILL command (remove duplicate / overlapping objects)", "OVERKILL",
    "Is AutoCAD prompting to select objects for OVERKILL cleanup?",
    { risk: "destructive" }),
  typedCmd("express-flatten", "Start the FLATTEN command (collapse objects to Z=0)", "FLATTEN",
    "Is AutoCAD prompting to select objects to flatten?",
    { risk: "destructive" }),
  typedCmd("express-extend-by-edge", "Start the EXTRIM command (extended trim by reference)", "EXTRIM",
    "Is AutoCAD prompting for a cutting edge for EXTRIM?"),
  typedCmd("express-burst", "Start the BURST command (explode block keeping attributes as text)", "BURST",
    "Is AutoCAD prompting to select blocks to burst?"),
  typedCmd("express-clipit", "Start the CLIPIT command (clip image/xref/wipeout to a polyline)", "CLIPIT",
    "Is AutoCAD prompting to select the clipping polyline?"),
  typedCmd("express-plt2dwg", "Start the PLT2DWG command (import plot file as drawing)", "PLT2DWG",
    "Is the PLT2DWG file picker dialog visible?"),
  typedCmd("express-revertlayer", "Start the LAYRTNCURRENT command (revert layer overrides)", "LAYRTNCURRENT",
    "Is AutoCAD prompting to select objects to revert their layer overrides?"),
  typedCmd("express-saveall", "Start the SAVEALL command (save all open drawings)", "SAVEALL",
    "Have all open drawings been saved (no save-pending indicator on any document tab)?",
    { risk: "destructive" }),
  typedCmd("express-closeall", "Start the CLOSEALL command (close all open drawings)", "CLOSEALL",
    "Have all open drawings been closed (or save-prompt dialogs appeared)?"),
  typedCmd("express-renametext", "Start the TXT2MTXT command (convert TEXT to MTEXT)", "TXT2MTXT",
    "Is AutoCAD prompting to select text objects to convert?"),
  typedCmd("express-supplementary-vpsync", "Start the VPSYNC command (synchronize viewports)", "VPSYNC",
    "Is AutoCAD prompting to select the master viewport?"),
  typedCmd("express-redefine-block", "Start the BLOCKREPLACE command (replace one block with another)", "BLOCKREPLACE",
    "Is the Block Replace dialog or prompt now visible?"),
  typedCmd("express-mvsetup", "Start the MVSETUP command (multi-viewport setup wizard)", "MVSETUP",
    "Has AutoCAD started the MVSETUP option prompt (Align/Create/Scale viewports/Options)?"),
  typedCmd("express-aligntext", "Start the ALIGNSPACE command (align objects across viewports)", "ALIGNSPACE",
    "Is AutoCAD prompting for an ALIGNSPACE option (Angle/Scale/Both)?"),
  typedCmd("express-superhatch", "Start the SUPERHATCH command (image / external hatch)", "SUPERHATCH",
    "Is the SuperHatch dialog now visible?"),
  typedCmd("express-color-edit", "Start the COLOR command (set current object color)", "COLOR",
    "Is the Select Color dialog now visible?"),
  typedCmd("express-color-alias", "Start COLOR via the COL alias", "COL",
    "Is the Select Color dialog now visible?"),
  typedCmd("express-linetype", "Open the Linetype Manager (LINETYPE)", "LINETYPE",
    "Is the Linetype Manager dialog now visible?"),
  typedCmd("express-linetype-alias", "Open the Linetype Manager via the LT alias", "LT",
    "Is the Linetype Manager dialog now visible?"),

  // ----------------------------------------------------------------------
  // Status bar / settings / system / files — 16 (to reach 341 total)
  // ----------------------------------------------------------------------
  typedCmd("settings-options", "Open the Options dialog (OPTIONS / configuration)", "OPTIONS",
    "Is the Options dialog now visible (with tabs Files/Display/Open and Save/Plot/System/User Preferences)?"),
  typedCmd("settings-options-alias", "Open the Options dialog via the OP alias", "OP",
    "Is the Options dialog now visible?"),
  typedCmd("settings-units", "Open the Drawing Units dialog (UNITS)", "UNITS",
    "Is the Drawing Units dialog now visible?"),
  typedCmd("settings-units-alias", "Open the Drawing Units dialog via the UN alias", "UN",
    "Is the Drawing Units dialog now visible?"),
  typedCmd("settings-drawing-utils", "Open the Drawing Utilities (DWGPROPS / file properties)", "DWGPROPS",
    "Is the Drawing Properties dialog now visible (with General/Summary/Statistics tabs)?"),
  typedCmd("settings-purge", "Open the Purge dialog (remove unused named items)", "PURGE",
    "Is the Purge dialog now visible (with categories of removable items)?",
    { risk: "destructive" }),
  typedCmd("settings-audit", "Start the AUDIT command (verify drawing integrity)", "AUDIT",
    "Has AutoCAD prompted whether to fix any errors detected (Yes/No)?"),
  typedCmd("settings-recover", "Start the RECOVER command (recover damaged drawing)", "RECOVER",
    "Is the Recover Drawing file picker dialog visible?"),
  typedCmd("files-import", "Open the Import dialog (IMPORT)", "IMPORT",
    "Is the Import File picker dialog now visible?"),
  typedCmd("files-export", "Open the Export Data dialog (EXPORT)", "EXPORT",
    "Is the Export Data picker dialog now visible?"),
  typedCmd("files-attach", "Start the ATTACH command (attach external file as xref/image)", "ATTACH",
    "Is the Select Reference File dialog visible?"),
  typedCmd("files-xref", "Open the External References palette (XREF)", "XREF",
    "Is the External References palette now visible?"),
  typedCmd("files-xref-alias", "Open the External References palette via the XR alias", "XR",
    "Is the External References palette now visible?"),
  typedCmd("files-design-center", "Open the DesignCenter palette (ADCENTER)", "ADCENTER",
    "Is the DesignCenter palette now visible?"),
  typedCmd("files-tool-palettes", "Open the Tool Palettes window (TOOLPALETTES)", "TOOLPALETTES",
    "Is the Tool Palettes window now visible?"),
  typedCmd("files-sheet-set", "Open the Sheet Set Manager (SHEETSET)", "SHEETSET",
    "Is the Sheet Set Manager palette now visible?")
];

// ---------------------------------------------------------------------------
// Materialize the schema-shaped shortcut objects.
// ---------------------------------------------------------------------------
function buildShortcut(s) {
  const id = s.id;
  // Pick varied metadata.
  let cost, speed;
  if (s.kind === "shortcut") {
    cost = s.cost ?? pickN(id, 3, 12);
    speed = s.speed ?? pickN(id, 100, 500);
  } else if (s.kind === "fkey") {
    cost = s.cost ?? pickN(id, 3, 10);
    speed = s.speed ?? pickN(id, 100, 400);
  } else { // search (typed command)
    cost = s.cost ?? pickN(id, 25, 90);
    speed = s.speed ?? pickN(id, 400, 1800);
  }
  const date = pick(id, DATES);

  let method, actions;
  if (s.kind === "shortcut") {
    method = "shortcut";
    actions = [
      { type: "key_combo", keys: { macos: s.combo } }
    ];
  } else if (s.kind === "fkey") {
    method = "shortcut";
    actions = [
      { type: "key", key: s.key }
    ];
  } else {
    method = "search";
    actions = [
      { type: "key_combo", keys: { macos: "cmd+9" } },
      { type: "type_text", text: s.alias },
      { type: "key", key: "enter" }
    ];
  }

  const out = {
    id,
    intent: s.intent,
    parameters: [],
    platforms: ["macos"],
    app_versions: ["2024+"],
    method,
    actions,
    verification: {
      type: "interpret_check",
      question: s.verifyQ,
      expected: "yes"
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: cost,
      speed_estimate_ms: speed,
      submitted_at: date
    }
  };
  if (s.risk) out.risk = s.risk;
  return out;
}

const built = SHORTCUTS.map(buildShortcut);

// Uniqueness sanity check.
const seen = new Set();
for (const s of built) {
  if (seen.has(s.id)) throw new Error(`duplicate id: ${s.id}`);
  seen.add(s.id);
}

const TARGET_COUNT = 341;
if (built.length !== TARGET_COUNT) {
  throw new Error(`expected ${TARGET_COUNT} shortcuts, got ${built.length}`);
}

const payload = {
  schema_version: 1,
  app_id: "autocad",
  shortcuts: built
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`Wrote ${built.length} shortcuts to ${OUT}`);
