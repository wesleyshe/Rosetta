#!/usr/bin/env node
// Generates registry/apps/rhino/shortcuts.json from the curated tuple list below.
// 309 shortcuts: a mix of true cmd-modified keyboard shortcuts (method:"shortcut")
// and typed Rhino commands routed through the always-visible command line
// (method:"search"). Run with: `node gen.mjs > shortcuts.json` from this dir, or
// just `node gen.mjs` and it will write shortcuts.json next to itself.
//
// Tuple shapes (see entry helpers below):
//   shortcut(id, intent, keys, qVerify, opts?)         — cmd-modified key combo
//   typed(id, intent, command, qVerify, opts?)         — typed Rhino command, no params
//   typedRisk(id, intent, command, qVerify, opts?)     — typed + risk:"destructive"
//   shortcutRisk(id, intent, keys, qVerify, opts?)     — key combo + risk:"destructive"
//
// Metadata varies cost/speed/date deterministically by id so the registry has
// realistic-looking heterogeneity rather than 309 identical metadata blocks.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "shortcuts.json");

const APP_ID = "rhino";
const PLATFORMS = ["macos"];
const APP_VERSIONS = ["8+"];

// --- metadata variation ----------------------------------------------------

// Bracket of dates the seed is plausibly authored over: 2026-04-15 .. 2026-05-05.
const DATE_BRACKET = [
  "2026-04-15", "2026-04-16", "2026-04-17", "2026-04-18", "2026-04-20",
  "2026-04-22", "2026-04-23", "2026-04-25", "2026-04-27", "2026-04-29",
  "2026-04-30", "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04",
  "2026-05-05"
];

// Tier the cost/speed by category — typed commands cost a bit more (open
// command line + type + enter + dialog) than raw keybinds.
const TIERS = {
  // raw keybind: cmd+s, cmd+z — fast.
  keybind:  { tokens: [3, 5, 8],          ms: [80, 150, 250] },
  // typed command, no follow-on dialog: LINE, CIRCLE, etc.
  typedFast:{ tokens: [10, 14, 18, 22],   ms: [400, 600, 800, 1000] },
  // typed command opens a dialog: BOOLEANUNION, RENDER.
  typedSlow:{ tokens: [25, 35, 50, 75],   ms: [1200, 1600, 2200, 3000] }
};

// Hash a string deterministically into [0, max).
function hashIdx(str, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % max;
}

function metaFor(id, tier) {
  const t = TIERS[tier];
  return {
    contributor_id: "seed",
    payment_destination: null,
    token_cost_estimate: t.tokens[hashIdx(id + ":t", t.tokens.length)],
    speed_estimate_ms:   t.ms[hashIdx(id + ":m", t.ms.length)],
    submitted_at:        DATE_BRACKET[hashIdx(id + ":d", DATE_BRACKET.length)]
  };
}

// --- entry builders --------------------------------------------------------

function entry({ id, intent, method, actions, question, risk, tier }) {
  const obj = {
    id,
    intent,
    parameters: [],
    platforms: PLATFORMS,
    app_versions: APP_VERSIONS,
    method,
    actions,
    verification: { type: "interpret_check", question, expected: "yes" }
  };
  if (risk) obj.risk = risk;
  obj.metadata = metaFor(id, tier);
  return obj;
}

// True cmd-modified keyboard shortcut.
function shortcut(id, intent, keys, question, opts = {}) {
  return entry({
    id, intent,
    method: "shortcut",
    actions: [{ type: "key_combo", keys: { macos: keys } }],
    question,
    risk: opts.risk,
    tier: opts.tier ?? "keybind"
  });
}

// Typed Rhino command into the always-visible command line.
// Pattern: type command name, press enter to invoke. The pre_step in
// workflow.json sends escape first to clear any in-progress command.
function typed(id, intent, command, question, opts = {}) {
  return entry({
    id, intent,
    method: "search",
    actions: [
      { type: "type_text", text: command },
      { type: "key", key: "enter" }
    ],
    question,
    risk: opts.risk,
    tier: opts.tier ?? "typedFast"
  });
}

// --- the 309 tuples --------------------------------------------------------

const shortcuts = [];

// Section 1: App / file (cmd-modified keyboard shortcuts) -- 15 entries
shortcuts.push(
  shortcut("new-document",       "Create a new untitled Rhino document", "cmd+n",       "Has a new untitled Rhino document opened (visible empty four-viewport layout, no objects in the scene)?"),
  shortcut("open-document",      "Open the standard Rhino Open File dialog", "cmd+o",  "Is the macOS Open File dialog now visible, scoped to Rhino's open-document flow?"),
  shortcut("save-document",      "Save the active document to its current path", "cmd+s", "Has the active document been saved (window title no longer shows the modified-document indicator)?", { risk: "destructive" }),
  shortcut("save-as",            "Open the Save As dialog for the active document", "cmd+shift+s", "Is the Save As dialog now visible for the active Rhino document?"),
  shortcut("close-document",     "Close the active Rhino document window", "cmd+w",     "Has the active Rhino document window closed (or, if unsaved, is the save-changes prompt now visible)?"),
  shortcut("quit-app",           "Quit Rhino", "cmd+q",                                "Has Rhino quit (the Rhino app is no longer the frontmost / no longer running)?", { risk: "destructive" }),
  shortcut("open-preferences",   "Open Rhino Preferences", "cmd+,",                    "Is the Rhino Preferences window now visible?"),
  shortcut("undo",               "Undo the most recent action", "cmd+z",               "Has the most recent action been undone (the scene reflects the prior state)?"),
  shortcut("redo",               "Redo the most recently undone action", "cmd+shift+z","Has the most recently undone action been re-applied to the scene?"),
  shortcut("select-all",         "Select all objects in the active document", "cmd+a", "Are all objects in the document now selected (selection highlight visible on every object, status bar reflects the selection count)?"),
  shortcut("copy-selection",     "Copy the current selection to the Rhino clipboard", "cmd+c", "Has the current selection been copied to the clipboard (Rhino's status bar or Edit menu confirms a copy is held)?"),
  shortcut("paste-clipboard",    "Paste the current Rhino clipboard contents into the active document", "cmd+v", "Has the previously-copied geometry been pasted into the active document (objects appear in the scene, possibly at the cursor location)?"),
  shortcut("cut-selection",      "Cut the current selection to the clipboard", "cmd+x", "Has the previously-selected geometry been cut from the scene and held on the clipboard (objects no longer visible at their original locations)?", { risk: "destructive" }),
  shortcut("redo-cmd-y",         "Redo the most recently undone action via cmd+y", "cmd+y", "Has the most recently undone action been re-applied to the scene via the cmd+y redo binding?"),
  shortcut("toggle-fullscreen",  "Toggle Rhino's fullscreen window mode", "cmd+ctrl+f", "Has Rhino's main window toggled fullscreen state (entered or exited fullscreen)?")
);

// Section 2: Curves (typed Rhino commands) -- 25 entries
shortcuts.push(
  typed("curve-line",          "Start the LINE command (single line segment between two points)",                       "LINE",        "Is the LINE command now active in Rhino's command line, prompting for the start of the line?"),
  typed("curve-line-alias",    "Start the LINE command via the L alias",                                                 "L",           "Is the LINE command active via its L alias, with the command line prompting for the start of the line?"),
  typed("curve-polyline",      "Start the POLYLINE command (multi-segment connected line)",                              "POLYLINE",    "Is the POLYLINE command active, with the command line prompting for the start of the polyline?"),
  typed("curve-curve",         "Start the CURVE command (control-point curve through clicked points)",                   "CURVE",       "Is the CURVE command active, with the command line prompting for the first control point?"),
  typed("curve-curve-alias",   "Start the CURVE command via the CRV alias",                                              "CRV",         "Is the CURVE command active via its CRV alias, with the command line prompting for the first control point?"),
  typed("curve-interpcrv",     "Start the INTERPCRV command (interpolated curve through clicked points)",                "INTERPCRV",   "Is the INTERPCRV command active, with the command line prompting for the first interpolation point?"),
  typed("curve-circle",        "Start the CIRCLE command (default: center, radius)",                                     "CIRCLE",      "Is the CIRCLE command active, with the command line prompting for the center of the circle?"),
  typed("curve-circle-3pt",    "Start the CIRCLE 3Point variant (circle through three clicked points)",                  "CIRCLE _3Point", "Is the CIRCLE command active in 3Point mode, with the command line prompting for the first of three points?"),
  typed("curve-arc",           "Start the ARC command (default: center, start, end angle)",                              "ARC",         "Is the ARC command active, with the command line prompting for the center of the arc?"),
  typed("curve-arc-3pt",       "Start the ARC 3Point variant (arc through three clicked points)",                        "ARC _3Point", "Is the ARC command active in 3Point mode, with the command line prompting for the first of three points?"),
  typed("curve-ellipse",       "Start the ELLIPSE command (default: center, axis end, second axis end)",                 "ELLIPSE",     "Is the ELLIPSE command active, with the command line prompting for the center of the ellipse?"),
  typed("curve-rectangle",     "Start the RECTANGLE command (corner-to-corner rectangle)",                               "RECTANGLE",   "Is the RECTANGLE command active, with the command line prompting for the first corner of the rectangle?"),
  typed("curve-rectangle-alias","Start the RECTANGLE command via the REC alias",                                         "REC",         "Is the RECTANGLE command active via its REC alias, with the command line prompting for the first corner?"),
  typed("curve-polygon",       "Start the POLYGON command (regular polygon by inscribed / circumscribed circle)",        "POLYGON",     "Is the POLYGON command active, with the command line prompting for the number of sides or the center?"),
  typed("curve-spiral",        "Start the SPIRAL command",                                                               "SPIRAL",      "Is the SPIRAL command active, with the command line prompting for the spiral start point or axis?"),
  typed("curve-helix",         "Start the HELIX command",                                                                "HELIX",       "Is the HELIX command active, with the command line prompting for the helix start point or axis?"),
  typed("curve-conic",         "Start the CONIC command (conic-section curve through specified points)",                 "CONIC",       "Is the CONIC command active, with the command line prompting for the start of the conic section?"),
  typed("curve-handle-curve",  "Start the HANDLECURVE command (control-handle Bezier-like curve)",                       "HANDLECURVE", "Is the HANDLECURVE command active, with the command line prompting for the first curve point?"),
  typed("curve-fillet-corner", "Start the FILLETCORNER command (round a polyline corner)",                               "FILLETCORNER","Is the FILLETCORNER command active, with the command line prompting for the polyline corner to fillet?"),
  typed("curve-text-object",   "Start the TEXTOBJECT command (insert text as curves / surfaces / solid)",                "TEXTOBJECT",  "Is the TEXTOBJECT dialog now visible in Rhino, prompting for the text content and font?"),
  typed("curve-projection",    "Start the PROJECT command (project curves onto a target surface)",                       "PROJECT",     "Is the PROJECT command active, with the command line prompting for the curves to project?"),
  typed("curve-pull-curve",    "Start the PULL command (pull curves onto a surface along the surface normal)",           "PULL",        "Is the PULL command active, with the command line prompting for the curves to pull?"),
  typed("curve-blend-curve",   "Start the BLENDCRV command (smooth blend curve between two curves)",                     "BLENDCRV",    "Is the BLENDCRV command active, with the command line prompting for the first curve to blend?"),
  typed("curve-extend",        "Start the EXTEND command (extend a curve to a boundary)",                                "EXTEND",      "Is the EXTEND command active, with the command line prompting for the boundary objects?"),
  typed("curve-divide",        "Start the DIVIDE command (place equal-spaced points along a curve)",                     "DIVIDE",      "Is the DIVIDE command active, with the command line prompting for the curve to divide?")
);

// Section 3: Surfaces (typed Rhino commands) -- 30 entries
shortcuts.push(
  typed("surface-srf",                "Start the SURFACE command (NURBS surface from corner points)",                    "SURFACE",          "Is the SURFACE command active, with the command line prompting for the first surface point?"),
  typed("surface-planar",             "Start the PLANARSRF command (planar surface from closed planar curves)",          "PLANARSRF",        "Is the PLANARSRF command active, with the command line prompting for the closed planar curves?"),
  typed("surface-extrude-curve",      "Start the EXTRUDECRV command (extrude curves into a surface)",                    "EXTRUDECRV",       "Is the EXTRUDECRV command active, with the command line prompting for the curves to extrude?"),
  typed("surface-extrude-curve-alias","Start the EXTRUDECRV command via the EXT alias",                                  "EXT",              "Is the EXTRUDECRV command active via its EXT alias, with the command line prompting for the curves to extrude?"),
  typed("surface-extrude-srf",        "Start the EXTRUDESRF command (extrude a surface in its normal direction)",        "EXTRUDESRF",       "Is the EXTRUDESRF command active, with the command line prompting for the surface to extrude?"),
  typed("surface-extrude-tapered",    "Start the EXTRUDECRVTAPERED command (extrude curves with a draft angle)",         "EXTRUDECRVTAPERED","Is the EXTRUDECRVTAPERED command active, with the command line prompting for the curves to extrude?"),
  typed("surface-extrude-along",      "Start the EXTRUDECRVALONGCRV command (extrude along a path curve)",               "EXTRUDECRVALONGCRV","Is the EXTRUDECRVALONGCRV command active, with the command line prompting for the curves to extrude?"),
  typed("surface-revolve",            "Start the REVOLVE command (surface of revolution)",                               "REVOLVE",          "Is the REVOLVE command active, with the command line prompting for the curves to revolve?"),
  typed("surface-rail-revolve",       "Start the RAILREVOLVE command (rail-driven surface of revolution)",               "RAILREVOLVE",      "Is the RAILREVOLVE command active, with the command line prompting for the profile curve?"),
  typed("surface-sweep1",             "Start the SWEEP1 command (one-rail sweep)",                                       "SWEEP1",           "Is the SWEEP1 command active, with the command line prompting for the rail curve?"),
  typed("surface-sweep2",             "Start the SWEEP2 command (two-rail sweep)",                                       "SWEEP2",           "Is the SWEEP2 command active, with the command line prompting for the first rail curve?"),
  typed("surface-loft",               "Start the LOFT command (lofted surface through a sequence of profile curves)",    "LOFT",             "Is the LOFT dialog now visible (or the command line prompting for the curves to loft)?"),
  typed("surface-network",            "Start the NETWORKSRF command (surface from a network of curves)",                 "NETWORKSRF",       "Is the NETWORKSRF command active, with the command line prompting for the curves in the network?"),
  typed("surface-blend",              "Start the BLENDSRF command (smooth blend surface between two surface edges)",     "BLENDSRF",         "Is the BLENDSRF command active, with the command line prompting for the first edge to blend?"),
  typed("surface-patch",              "Start the PATCH command (best-fit surface through curves and points)",            "PATCH",            "Is the PATCH command active, with the command line prompting for the curves and points?"),
  typed("surface-fillet",             "Start the FILLETSRF command (fillet between two surfaces)",                       "FILLETSRF",        "Is the FILLETSRF command active, with the command line prompting for the first surface?"),
  typed("surface-chamfer",            "Start the CHAMFERSRF command (chamfer between two surfaces)",                     "CHAMFERSRF",       "Is the CHAMFERSRF command active, with the command line prompting for the first surface?"),
  typed("surface-match",              "Start the MATCHSRF command (match a surface edge to another curve / edge)",       "MATCHSRF",         "Is the MATCHSRF command active, with the command line prompting for the surface edge to match?"),
  typed("surface-offset",             "Start the OFFSETSRF command (offset a surface)",                                  "OFFSETSRF",        "Is the OFFSETSRF command active, with the command line prompting for the surface to offset?"),
  typed("surface-from-mesh",          "Start the MESHTONURB command (convert a mesh to NURBS surfaces)",                 "MESHTONURB",       "Is the MESHTONURB command active, with the command line prompting for the mesh to convert?"),
  typed("surface-cap",                "Start the CAP command (close planar holes in a surface or polysurface)",          "CAP",              "Is the CAP command active, with the command line prompting for the polysurface to cap?"),
  typed("surface-untrim",             "Start the UNTRIM command (remove a trim and restore the underlying surface)",     "UNTRIM",           "Is the UNTRIM command active, with the command line prompting for the trim edge to remove?"),
  typed("surface-shrink-trimmed",     "Start the SHRINKTRIMMEDSRF command (shrink a surface to its trim boundary)",      "SHRINKTRIMMEDSRF", "Is the SHRINKTRIMMEDSRF command active, with the command line prompting for the trimmed surface?"),
  typed("surface-rebuild",            "Start the REBUILDSRF command (rebuild a surface with new control-point counts)",  "REBUILD",          "Is the REBUILD dialog now visible, prompting for new control-point and degree counts for the selected surface?"),
  typed("surface-split",              "Start the SPLIT command (split a surface with a curve / surface)",                "SPLIT",            "Is the SPLIT command active, with the command line prompting for the surface to split?"),
  typed("surface-trim",               "Start the TRIM command (trim curves and surfaces with cutting objects)",          "TRIM",             "Is the TRIM command active, with the command line prompting for the cutting objects?"),
  typed("surface-explode",            "Start the EXPLODE command (explode a polysurface into surfaces)",                  "EXPLODE",          "Is the EXPLODE command active, with the command line prompting for the polysurfaces to explode?"),
  typed("surface-isocurve-extract",   "Start the EXTRACTISOCURVE command (extract isoparametric curves from a surface)", "EXTRACTISOCURVE",  "Is the EXTRACTISOCURVE command active, with the command line prompting for the surface?"),
  typed("surface-fin",                "Start the FIN command (extrude curves on a surface along the surface normal)",    "FIN",              "Is the FIN command active, with the command line prompting for the curves on the surface?"),
  typed("surface-symmetry",           "Start the SYMMETRY command (create a symmetric, history-linked mirror of a surface)", "SYMMETRY",      "Is the SYMMETRY command active, with the command line prompting for the curve / surface to mirror?")
);

// Section 4: Solids (typed Rhino commands) -- 25 entries
shortcuts.push(
  typed("solid-box",              "Start the BOX command (axis-aligned solid box from two corners and height)",      "BOX",                  "Is the BOX command active, with the command line prompting for the first corner of the base?"),
  typed("solid-box-3pt",          "Start the BOX 3Point variant (box from three corners)",                           "BOX _3Point",          "Is the BOX command active in 3Point mode, with the command line prompting for the first base corner?"),
  typed("solid-box-vertical",     "Start the BOX Vertical variant (vertical box from base to height)",               "BOX _Vertical",        "Is the BOX command active in Vertical mode, with the command line prompting for the base?"),
  typed("solid-sphere",           "Start the SPHERE command (default: center, radius)",                              "SPHERE",               "Is the SPHERE command active, with the command line prompting for the center of the sphere?"),
  typed("solid-cylinder",         "Start the CYLINDER command (default: base center, radius, height)",               "CYLINDER",             "Is the CYLINDER command active, with the command line prompting for the base center of the cylinder?"),
  typed("solid-cone",             "Start the CONE command (default: base center, radius, apex)",                     "CONE",                 "Is the CONE command active, with the command line prompting for the base center of the cone?"),
  typed("solid-truncated-cone",   "Start the TRUNCONE command (truncated cone from two radii)",                      "TRUNCONE",             "Is the TRUNCONE command active, with the command line prompting for the base center?"),
  typed("solid-torus",            "Start the TORUS command (default: center, major radius, minor radius)",           "TORUS",                "Is the TORUS command active, with the command line prompting for the center of the torus?"),
  typed("solid-ellipsoid",        "Start the ELLIPSOID command (ellipsoid from center and three axes)",              "ELLIPSOID",            "Is the ELLIPSOID command active, with the command line prompting for the center of the ellipsoid?"),
  typed("solid-pipe",             "Start the PIPE command (pipe along a rail curve)",                                "PIPE",                 "Is the PIPE command active, with the command line prompting for the rail curve?"),
  typed("solid-tube",             "Start the TUBE command (hollow tube along a rail curve)",                         "TUBE",                 "Is the TUBE command active, with the command line prompting for the rail curve?"),
  typed("solid-pyramid",          "Start the PYRAMID command",                                                       "PYRAMID",              "Is the PYRAMID command active, with the command line prompting for the number of sides or the base?"),
  typed("solid-paraboloid",       "Start the PARABOLOID command",                                                    "PARABOLOID",           "Is the PARABOLOID command active, with the command line prompting for the focus or vertex of the paraboloid?"),
  typed("solid-extrude-srf",      "Start the EXTRUDESRF command targeting a solid extrusion of a surface",           "EXTRUDESRF",           "Is the EXTRUDESRF command active for solid extrusion, with the command line prompting for the surface?"),
  typed("solid-cap-holes",        "Start the CAP command on a polysurface to close planar holes",                    "CAP",                  "Is the CAP command active on a polysurface, with the command line prompting for the polysurface?"),
  typedRiskBoolean("solid-boolean-union",        "Combine multiple solids into a single solid (BooleanUnion)",         "BOOLEANUNION",         "Have the previously-selected solids been combined into a single solid (the Layers / Properties panel reflects one resulting polysurface)?"),
  typedRiskBoolean("solid-boolean-difference",   "Subtract one or more solids from another (BooleanDifference)",       "BOOLEANDIFFERENCE",    "Has the previously-selected solid been reduced by the subtracting solids (visible material removed where the second-selected solids overlapped)?"),
  typedRiskBoolean("solid-boolean-intersection", "Keep only the overlap of two solids (BooleanIntersection)",          "BOOLEANINTERSECTION",  "Have the previously-selected solids been reduced to just their shared overlap volume?"),
  typedRiskBoolean("solid-boolean-split",        "Split solids by other solids without deleting any pieces (BooleanSplit)", "BOOLEANSPLIT",   "Have the selected solids been split by the cutting solids into separate pieces, with all pieces kept?"),
  typed("solid-shell",            "Start the SHELL command (hollow a solid with a wall thickness)",                  "SHELL",                "Is the SHELL command active, with the command line prompting for the faces to remove and the shell thickness?"),
  typed("solid-offset-srf",       "Start the OFFSETSRF command on a polysurface to thicken into a solid",            "OFFSETSRF",            "Is the OFFSETSRF command active in solid-thickening mode, with the command line prompting for the polysurface and offset distance?"),
  typed("solid-thicken-curve",    "Start the PIPE command for thickening a curve into a tubular solid",              "PIPE",                 "Is the PIPE command active in curve-thickening mode, with the command line prompting for the rail curve?"),
  typed("solid-fillet-edge",      "Start the FILLETEDGE command (fillet edges of a polysurface)",                    "FILLETEDGE",           "Is the FILLETEDGE command active, with the command line prompting for the edges to fillet?"),
  typed("solid-chamfer-edge",     "Start the CHAMFEREDGE command (chamfer edges of a polysurface)",                  "CHAMFEREDGE",          "Is the CHAMFEREDGE command active, with the command line prompting for the edges to chamfer?"),
  typed("solid-extract-srf",      "Start the EXTRACTSRF command (extract a face from a polysurface as its own surface)", "EXTRACTSRF",        "Is the EXTRACTSRF command active, with the command line prompting for the polysurface face to extract?")
);

// Helper for booleans (destructive risk + typedSlow tier).
function typedRiskBoolean(id, intent, command, question) {
  return entry({
    id, intent,
    method: "search",
    actions: [
      { type: "type_text", text: command },
      { type: "key", key: "enter" }
    ],
    question,
    risk: "destructive",
    tier: "typedSlow"
  });
}

// Section 5: SubD (typed Rhino commands) -- 15 entries
shortcuts.push(
  typed("subd-tosubd",            "Start the TOSUBD command (convert NURBS surfaces / polysurfaces to SubD)",              "TOSUBD",        "Is the TOSUBD command active, with the command line prompting for the surfaces / meshes to convert?"),
  typed("subd-fromsubd",          "Start the TONURBS command (convert a SubD object to NURBS surfaces)",                   "TONURBS",       "Is the TONURBS command active, with the command line prompting for the SubD object to convert?"),
  typed("subd-insert-edge",       "Start the INSERTEDGE command (insert a new edge loop on a SubD)",                       "INSERTEDGE",    "Is the INSERTEDGE command active, with the command line prompting for the SubD edges to insert through?"),
  typed("subd-insert-point",      "Start the INSERTPOINT command (insert a vertex on a SubD edge)",                        "INSERTPOINT",   "Is the INSERTPOINT command active, with the command line prompting for the SubD edge to insert into?"),
  typed("subd-add-crease",        "Start the SUBDCREASE command (add a crease to SubD edges or vertices)",                 "SUBDCREASE",    "Is the SUBDCREASE command active, with the command line prompting for the SubD edges or vertices to crease?"),
  typed("subd-remove-crease",     "Start the SUBDREMOVECREASE command (remove a crease from SubD edges or vertices)",      "SUBDREMOVECREASE","Is the SUBDREMOVECREASE command active, with the command line prompting for the SubD edges or vertices to uncrease?"),
  typed("subd-replace-edge",      "Start the SUBDREPLACEEDGE command",                                                     "SUBDREPLACEEDGE","Is the SUBDREPLACEEDGE command active, with the command line prompting for the edge to replace?"),
  typed("subd-bridge",            "Start the BRIDGE command (bridge two SubD edge loops or boundaries)",                   "BRIDGE",        "Is the BRIDGE command active, with the command line prompting for the first SubD edge loop / boundary?"),
  typed("subd-extrude",           "Start the SUBDEXTRUDE command",                                                         "SUBDEXTRUDE",   "Is the SUBDEXTRUDE command active, with the command line prompting for the SubD faces / edges to extrude?"),
  typed("subd-fill-hole",         "Start the SUBDFILLHOLE command (fill an open SubD boundary with a face / faces)",       "SUBDFILLHOLE",  "Is the SUBDFILLHOLE command active, with the command line prompting for the SubD boundary edges to fill?"),
  typed("subd-mirror",            "Start the SUBDSYMMETRY command (apply symmetry to a SubD)",                             "SUBDSYMMETRY",  "Is the SUBDSYMMETRY command active, with the command line prompting for the SubD and its symmetry plane?"),
  typed("subd-edit-mode-toggle",  "Start the SUBDDISPLAYTOGGLE command (toggle smooth / cage SubD display)",               "SUBDDISPLAYTOGGLE","Has the SubD display toggled between smooth and control-cage modes (or, if no SubD is selected, is the command prompting for one)?"),
  typed("subd-friendly-loft",     "Start the LOFT command in SubD mode for a SubD-friendly loft",                          "LOFT",          "Is the LOFT command active with the command line offering SubD-friendly options?"),
  typed("subd-slide",             "Start the SLIDE command on SubD edges / vertices",                                      "SLIDE",         "Is the SLIDE command active, with the command line prompting for the SubD edges / vertices to slide?"),
  typed("subd-quad-remesh",       "Start the QUADREMESH command (generate a SubD-friendly quad mesh from any geometry)",   "QUADREMESH",    "Is the QUADREMESH dialog now visible, prompting for target quad-count and other remesh options?", { tier: "typedSlow" })
);

// Section 6: Edit / transform (typed Rhino commands) -- 30 entries
shortcuts.push(
  typed("transform-move",          "Start the MOVE command",                                                  "MOVE",           "Is the MOVE command active, with the command line prompting for the objects to move?"),
  typed("transform-move-alias",    "Start the MOVE command via the M alias",                                  "M",              "Is the MOVE command active via its M alias, with the command line prompting for the objects to move?"),
  typed("transform-copy",          "Start the COPY command",                                                  "COPY",           "Is the COPY command active, with the command line prompting for the objects to copy?"),
  typed("transform-rotate-2d",     "Start the ROTATE command (rotate around the active CPlane normal)",       "ROTATE",         "Is the ROTATE command active, with the command line prompting for the objects to rotate?"),
  typed("transform-rotate-3d",     "Start the ROTATE3D command (rotate around an arbitrary axis in 3D)",      "ROTATE3D",       "Is the ROTATE3D command active, with the command line prompting for the objects to rotate?"),
  typed("transform-scale",         "Start the SCALE command (uniform 3D scale)",                              "SCALE",          "Is the SCALE command active, with the command line prompting for the objects to scale?"),
  typed("transform-scale-1d",      "Start the SCALE1D command (1D scale along one axis)",                     "SCALE1D",        "Is the SCALE1D command active, with the command line prompting for the objects to scale and the axis?"),
  typed("transform-scale-2d",      "Start the SCALE2D command (2D scale in the active CPlane)",               "SCALE2D",        "Is the SCALE2D command active, with the command line prompting for the objects to scale?"),
  typed("transform-scale-non-uniform","Start the SCALENU command (independent X/Y/Z scale factors)",          "SCALENU",        "Is the SCALENU command active, with the command line prompting for the objects to scale?"),
  typed("transform-mirror",        "Start the MIRROR command (mirror across a line in the active CPlane)",    "MIRROR",         "Is the MIRROR command active, with the command line prompting for the objects to mirror?"),
  typed("transform-array",         "Start the ARRAY command (rectangular array)",                             "ARRAY",          "Is the ARRAY command active, with the command line prompting for the objects to array?"),
  typed("transform-array-polar",   "Start the ARRAYPOLAR command (circular / polar array)",                   "ARRAYPOLAR",     "Is the ARRAYPOLAR command active, with the command line prompting for the objects to array?"),
  typed("transform-array-linear",  "Start the ARRAYLINEAR command (linear array)",                            "ARRAYLINEAR",    "Is the ARRAYLINEAR command active, with the command line prompting for the objects to array?"),
  typed("transform-array-along-curve","Start the ARRAYCRV command (array along a curve)",                     "ARRAYCRV",       "Is the ARRAYCRV command active, with the command line prompting for the objects to array?"),
  typed("transform-array-along-srf","Start the ARRAYSRF command (array on a surface)",                        "ARRAYSRF",       "Is the ARRAYSRF command active, with the command line prompting for the objects to array?"),
  typed("transform-flow",          "Start the FLOW command (flow geometry from a base curve onto a target curve)", "FLOW",       "Is the FLOW command active, with the command line prompting for the objects to flow?"),
  typed("transform-flow-along-srf","Start the FLOWALONGSRF command (flow geometry from a base surface onto a target surface)", "FLOWALONGSRF", "Is the FLOWALONGSRF command active, with the command line prompting for the objects to flow?"),
  typed("transform-bend",          "Start the BEND command (bend a region of geometry around a spine)",       "BEND",           "Is the BEND command active, with the command line prompting for the objects to bend?"),
  typed("transform-twist",         "Start the TWIST command (twist a region of geometry around an axis)",     "TWIST",          "Is the TWIST command active, with the command line prompting for the objects to twist?"),
  typed("transform-taper",         "Start the TAPER command (taper a region of geometry along an axis)",      "TAPER",          "Is the TAPER command active, with the command line prompting for the objects to taper?"),
  typed("transform-shear",         "Start the SHEAR command (shear geometry along an axis)",                  "SHEAR",          "Is the SHEAR command active, with the command line prompting for the objects to shear?"),
  typed("transform-orient",        "Start the ORIENT command (move + rotate one set of points to another)",    "ORIENT",        "Is the ORIENT command active, with the command line prompting for the objects to orient?"),
  typed("transform-orient-3pt",    "Start the ORIENT3PT command (3-point orient)",                            "ORIENT3PT",      "Is the ORIENT3PT command active, with the command line prompting for the objects to orient?"),
  typed("transform-orient-on-srf", "Start the ORIENTONSRF command (orient an object onto a surface)",         "ORIENTONSRF",    "Is the ORIENTONSRF command active, with the command line prompting for the objects to orient?"),
  typed("transform-align",         "Start the ALIGN command (align a set of objects)",                        "ALIGN",          "Is the ALIGN command active, with the command line prompting for the objects to align?"),
  typed("transform-distribute",    "Start the DISTRIBUTE command (distribute a set of objects evenly)",       "DISTRIBUTE",     "Is the DISTRIBUTE command active, with the command line prompting for the objects to distribute?"),
  typed("transform-set-pt",        "Start the SETPT command (set X / Y / Z of selected points to a value)",   "SETPT",          "Is the SETPT command active, with the command line prompting for the objects whose points to set?"),
  typed("transform-rotate-history",  "Start the ROTATE command with history recording for parametric edit",   "ROTATE",         "Is the ROTATE command active with the command line offering a history-recording option?"),
  typed("transform-cage-edit",     "Start the CAGEEDIT command (deform geometry through a control cage)",     "CAGEEDIT",       "Is the CAGEEDIT command active, with the command line prompting for the objects to deform?"),
  typed("transform-soft-move",     "Start the SOFTMOVE command (move with falloff influence)",                "SOFTMOVE",       "Is the SOFTMOVE command active, with the command line prompting for the objects to soft-move?")
);

// Section 7: Modify / curve & surface ops (typed Rhino commands) -- 25 entries
shortcuts.push(
  typed("modify-trim",             "Start the TRIM command (trim with cutting objects)",                      "TRIM",           "Is the TRIM command active, with the command line prompting for the cutting objects?"),
  typed("modify-untrim",           "Start the UNTRIM command (remove a trim)",                                "UNTRIM",         "Is the UNTRIM command active, with the command line prompting for the trim edge to remove?"),
  typed("modify-split",            "Start the SPLIT command (split with cutting objects without discarding)", "SPLIT",          "Is the SPLIT command active, with the command line prompting for the objects to split?"),
  typed("modify-join",             "Start the JOIN command (join compatible curves / surfaces)",              "JOIN",           "Is the JOIN command active, with the command line prompting for the objects to join?"),
  typed("modify-explode",          "Start the EXPLODE command (break a polysurface or polyline into parts)",  "EXPLODE",        "Is the EXPLODE command active, with the command line prompting for the objects to explode?"),
  typed("modify-fillet-edge",      "Start the FILLETEDGE command (round polysurface edges)",                  "FILLETEDGE",     "Is the FILLETEDGE command active, with the command line prompting for the edges to fillet?"),
  typed("modify-fillet-srf",       "Start the FILLETSRF command (fillet between two surfaces)",               "FILLETSRF",      "Is the FILLETSRF command active, with the command line prompting for the first surface to fillet?"),
  typed("modify-chamfer-edge",     "Start the CHAMFEREDGE command (chamfer polysurface edges)",               "CHAMFEREDGE",    "Is the CHAMFEREDGE command active, with the command line prompting for the edges to chamfer?"),
  typed("modify-chamfer-srf",      "Start the CHAMFERSRF command (chamfer between two surfaces)",             "CHAMFERSRF",     "Is the CHAMFERSRF command active, with the command line prompting for the first surface to chamfer?"),
  typed("modify-blend-srf",        "Start the BLENDSRF command (smooth blend between two surface edges)",     "BLENDSRF",       "Is the BLENDSRF command active, with the command line prompting for the first edge to blend?"),
  typed("modify-match-srf",        "Start the MATCHSRF command (match a surface edge to a target)",           "MATCHSRF",       "Is the MATCHSRF command active, with the command line prompting for the surface edge to match?"),
  typed("modify-offset-curve",     "Start the OFFSET command (offset a curve in the active CPlane)",          "OFFSET",         "Is the OFFSET command active, with the command line prompting for the curve to offset?"),
  typed("modify-offset-curve-3d",  "Start the OFFSETCRVONSRF command (offset a curve along a surface)",       "OFFSETCRVONSRF", "Is the OFFSETCRVONSRF command active, with the command line prompting for the curve on the surface?"),
  typed("modify-offset-srf",       "Start the OFFSETSRF command (offset a surface)",                          "OFFSETSRF",      "Is the OFFSETSRF command active, with the command line prompting for the surface to offset?"),
  typed("modify-offset-mesh",      "Start the OFFSETMESH command (offset a mesh)",                            "OFFSETMESH",     "Is the OFFSETMESH command active, with the command line prompting for the mesh to offset?"),
  typed("modify-extend-curve",     "Start the EXTEND command (extend a curve to a boundary)",                 "EXTEND",         "Is the EXTEND command active, with the command line prompting for the boundary objects?"),
  typed("modify-extend-srf",       "Start the EXTENDSRF command (extend a surface edge)",                     "EXTENDSRF",      "Is the EXTENDSRF command active, with the command line prompting for the surface edge to extend?"),
  typed("modify-rebuild",          "Start the REBUILD command (rebuild a curve / surface with new control-point counts)", "REBUILD", "Is the REBUILD dialog now visible, prompting for new control-point and degree counts?"),
  typed("modify-fair-curve",       "Start the FAIR command (smooth out a curve while preserving its endpoints)", "FAIR",        "Is the FAIR command active, with the command line prompting for the curve to fair?"),
  typed("modify-smooth",           "Start the SMOOTH command (smooth selected control points / vertices)",    "SMOOTH",         "Is the SMOOTH dialog now visible, prompting for the smoothing factor?"),
  typed("modify-mergesrf",         "Start the MERGESRF command (merge two compatible surfaces along their shared edge)", "MERGESRF","Is the MERGESRF command active, with the command line prompting for the first surface to merge?"),
  typed("modify-mergeallcoplanarfaces","Start the MERGEALLCOPLANARFACES command",                             "MERGEALLCOPLANARFACES", "Is the MERGEALLCOPLANARFACES command active, with the command line prompting for the polysurface?"),
  typed("modify-divide-by-length", "Start the DIVIDE command in Length mode (place points at a fixed spacing)", "DIVIDE _Length","Is the DIVIDE command active in Length mode, with the command line prompting for the curve and spacing?"),
  typed("modify-pull-curve",       "Start the PULL command (pull curves onto a surface)",                     "PULL",           "Is the PULL command active, with the command line prompting for the curves to pull?"),
  typed("modify-project-curve",    "Start the PROJECT command (project curves onto a surface along the active CPlane)", "PROJECT", "Is the PROJECT command active, with the command line prompting for the curves to project?")
);

// Section 8: Selection (typed Rhino commands) -- 20 entries
shortcuts.push(
  typed("sel-all",                 "Select all visible objects (SELALL)",                                     "SELALL",         "Are all objects in the active document now selected (status bar reflects the full selection count)?"),
  typed("sel-none",                "Deselect all objects (SELNONE)",                                          "SELNONE",        "Have all selections been cleared (no selection highlight visible on any object)?"),
  typed("sel-last",                "Select the most recently created objects (SELLAST)",                      "SELLAST",        "Are the most recently created objects now selected (selection highlight visible on the latest created geometry)?"),
  typed("sel-prev",                "Re-select the previous selection (SELPREV)",                              "SELPREV",        "Has the previous selection been restored (the prior selection highlight is back)?"),
  typed("sel-curves",              "Select all curves (SELCRV)",                                              "SELCRV",         "Are all curves in the active document now selected (lines / polylines / arcs / curves highlighted, surfaces and solids unselected)?"),
  typed("sel-srf",                 "Select all surfaces (SELSRF)",                                            "SELSRF",         "Are all surfaces in the active document now selected (surface objects highlighted, curves and solids unselected)?"),
  typed("sel-poly-srf",            "Select all polysurfaces (SELPOLYSRF)",                                    "SELPOLYSRF",     "Are all polysurfaces in the active document now selected?"),
  typed("sel-mesh",                "Select all meshes (SELMESH)",                                             "SELMESH",        "Are all meshes in the active document now selected?"),
  typed("sel-subd",                "Select all SubD objects (SELSUBD)",                                       "SELSUBD",        "Are all SubD objects in the active document now selected?"),
  typed("sel-by-type",             "Open the SELBYTYPE selection dialog",                                     "SELBYTYPE",      "Is the SELBYTYPE dialog now visible, listing object types to select by?"),
  typed("sel-by-layer",            "Open the SELLAYER selection by layer dialog",                             "SELLAYER",       "Is the layer-selection dialog now visible, prompting for the layer whose objects to select?"),
  typed("sel-by-name",             "Open the SELNAME selection by object name dialog",                        "SELNAME",        "Is the SELNAME dialog now visible, prompting for the object name(s) to select?"),
  typed("sel-by-color",            "Open the SELCOLOR selection by display color dialog",                     "SELCOLOR",       "Is the color-selection dialog now visible, prompting for the display color whose objects to select?"),
  typed("sel-by-material",         "Open the SELMATERIALNAME selection dialog",                               "SELMATERIALNAME","Is the SELMATERIALNAME dialog now visible, prompting for the material name?"),
  typed("sel-block",               "Select all block instances (SELBLOCKINSTANCE)",                           "SELBLOCKINSTANCE","Are all block instances in the active document now selected?"),
  typed("sel-bad-objects",         "Select all bad-geometry objects (SELBADOBJECTS)",                         "SELBADOBJECTS",  "Are all objects with bad geometry now selected (Rhino's bad-object detection is highlighted on any flawed geometry)?"),
  typed("sel-duplicates",          "Run the SELDUP command to select duplicate objects",                      "SELDUP",         "Are duplicate objects in the active document now selected?"),
  typed("sel-invert",              "Invert the current selection (INVERT)",                                   "INVERT",         "Has the previous selection been inverted (objects that were unselected are now selected, and vice versa)?"),
  typed("sel-visible",             "Select all visible objects (SELVISIBLE)",                                 "SELVISIBLE",     "Are all currently-visible objects now selected (hidden / locked objects unselected)?"),
  typed("sel-locked",              "Select all locked objects (SELLOCKED)",                                   "SELLOCKED",      "Are all currently-locked objects now selected?")
);

// Section 9: Layers (typed Rhino commands) -- 15 entries
shortcuts.push(
  typed("layer-open-panel",        "Open the Layers panel (LAYER)",                                           "LAYER",          "Is the Layers panel now visible / focused, showing the project's layer hierarchy?"),
  typed("layer-toggle",            "Toggle layer visibility on/off via dialog (LAYERONOFF)",                  "LAYERONOFF",     "Is the LAYERONOFF prompt now active, prompting for the layer to toggle?"),
  typed("layer-on",                "Turn a layer on (LAYERON)",                                               "LAYERON",        "Is the LAYERON command now prompting for the layer to turn on?"),
  typed("layer-off",               "Turn a layer off (LAYEROFF)",                                             "LAYEROFF",       "Is the LAYEROFF command now prompting for the layer to turn off?"),
  typed("layer-lock",              "Lock a layer (LAYERLOCK)",                                                "LAYERLOCK",      "Is the LAYERLOCK command now prompting for the layer to lock?"),
  typed("layer-unlock",            "Unlock a layer (LAYERUNLOCK)",                                            "LAYERUNLOCK",    "Is the LAYERUNLOCK command now prompting for the layer to unlock?"),
  typed("layer-one-on",            "Turn one layer on and all others off (ONELAYERON)",                       "ONELAYERON",     "Is the ONELAYERON command now prompting for the single layer to leave on?"),
  typed("layer-new",               "Create a new layer (NEWLAYER)",                                           "NEWLAYER",       "Is the NEWLAYER command now prompting for the new layer's name?"),
  typed("layer-rename",            "Rename a layer (RENAMELAYER)",                                            "RENAMELAYER",    "Is the RENAMELAYER command now prompting for the layer to rename?"),
  typed("layer-current",           "Set the current layer (CURRENTLAYER)",                                    "CURRENTLAYER",   "Is the CURRENTLAYER command now prompting for the layer to set as current?"),
  typed("layer-copy-to",           "Copy selected objects to a target layer (COPYTOLAYER)",                   "COPYTOLAYER",    "Is the COPYTOLAYER command now prompting for the target layer?"),
  typed("layer-change",            "Change selected objects' layer (CHANGELAYER)",                            "CHANGELAYER",    "Is the CHANGELAYER command now prompting for the new layer for the selected objects?"),
  typedRisk("layer-purge-empty",   "Purge empty layers from the document (PURGE)",                            "PURGE",          "Is the PURGE dialog now visible, prompting for which empty layers / linetypes / blocks to remove?"),
  typed("layer-isolate",           "Isolate the current layer (turn off all others) (ISOLATELAYER)",          "ISOLATELAYER",   "Has only the current layer remained on (all other layers are now hidden)?"),
  typed("layer-show-all",          "Turn on all layers (LAYERSALLON)",                                        "LAYERSALLON",    "Have all layers been turned on (all previously-hidden layers are now visible)?")
);

// Helper: typed command marked destructive.
function typedRisk(id, intent, command, question, opts = {}) {
  return entry({
    id, intent,
    method: "search",
    actions: [
      { type: "type_text", text: command },
      { type: "key", key: "enter" }
    ],
    question,
    risk: "destructive",
    tier: opts.tier ?? "typedFast"
  });
}

// Section 10: View / viewport (typed + a few keybinds) -- 25 entries
shortcuts.push(
  typed("view-zoom-extents",       "Zoom to fit all visible objects (ZOOM Extents)",                          "ZOOM _Extents",      "Has the active viewport zoomed to fit all visible geometry (the entire scene is now framed in the viewport)?"),
  typed("view-zoom-extents-all",   "Zoom to fit all visible objects in every viewport (ZOOM All Extents)",    "ZOOM _All _Extents", "Have all viewports zoomed to fit all visible geometry?"),
  typed("view-zoom-selected",      "Zoom to the current selection (ZOOM Selected)",                           "ZOOM _Selected",     "Has the active viewport zoomed to frame just the current selection?"),
  typed("view-zoom-window",        "Zoom by drawing a rectangle (ZOOM Window)",                               "ZOOM _Window",       "Is the ZOOM command active in Window mode, with the command line prompting for the zoom rectangle?"),
  typed("view-zoom-target",        "Zoom to a target point (ZOOM Target)",                                    "ZOOM _Target",       "Is the ZOOM command active in Target mode, with the command line prompting for the target point?"),
  typed("view-pan",                "Start the PAN command",                                                   "PAN",                "Is the PAN command active, with the command line prompting for a drag direction?"),
  typed("view-rotate",             "Start the ROTATEVIEW command (orbit the camera)",                         "ROTATEVIEW",         "Is the ROTATEVIEW command active, with the command line prompting for the camera orbit motion?"),
  typed("view-undo",               "Undo the last view change (UNDOVIEWCHANGE)",                              "UNDOVIEWCHANGE",     "Has the active viewport reverted to its previous view (camera position / zoom rolled back one step)?"),
  typed("view-redo",               "Redo the last undone view change (REDOVIEWCHANGE)",                       "REDOVIEWCHANGE",     "Has the active viewport advanced to the previously-undone view?"),
  typed("view-set-top",            "Switch the active viewport to the Top view",                              "TOP",                "Is the active viewport now showing the Top orthographic view (looking down the world Z axis)?"),
  typed("view-set-front",          "Switch the active viewport to the Front view",                            "FRONT",              "Is the active viewport now showing the Front orthographic view?"),
  typed("view-set-right",          "Switch the active viewport to the Right view",                            "RIGHT",              "Is the active viewport now showing the Right orthographic view?"),
  typed("view-set-back",           "Switch the active viewport to the Back view",                             "BACK",               "Is the active viewport now showing the Back orthographic view?"),
  typed("view-set-bottom",         "Switch the active viewport to the Bottom view",                           "BOTTOM",             "Is the active viewport now showing the Bottom orthographic view?"),
  typed("view-set-perspective",    "Switch the active viewport to Perspective",                              "PERSPECTIVE",        "Is the active viewport now in Perspective projection?"),
  typed("view-four-up",            "Restore the four-viewport (Top / Front / Right / Perspective) layout",    "4VIEW",              "Is the workspace now showing the four standard viewports (Top, Front, Right, Perspective)?"),
  typed("view-maximize",           "Maximize the active viewport (MAXVIEWPORT)",                              "MAXVIEWPORT",        "Has the active viewport expanded to fill the workspace (the other viewports are no longer visible)?"),
  typed("view-named-views",        "Open the Named Views panel (NAMEDVIEW)",                                  "NAMEDVIEW",          "Is the Named Views panel now visible, listing saved camera positions?"),
  typed("view-restore-named",      "Restore a named view (RESTOREVIEW)",                                      "RESTOREVIEW",        "Is the RESTOREVIEW command now prompting for the named view to restore?"),
  typed("view-save-named",         "Save the current view as a named view (NAMEDVIEW Save)",                  "NAMEDVIEW _Save",    "Is the named-view save dialog / prompt now active, prompting for the new view's name?"),
  typed("view-shade-mode",         "Open the SHADEMODE command",                                              "SHADEMODE",          "Is the SHADEMODE command active, with the command line prompting for the new shading mode?"),
  typed("view-shaded-display",     "Switch the active viewport to Shaded display",                            "SHADED",             "Is the active viewport now in Shaded display mode (objects shown with flat shading and outlines)?"),
  typed("view-rendered-display",   "Switch the active viewport to Rendered display",                          "RENDERED",           "Is the active viewport now in Rendered display mode (objects shown with materials, lights, and shadows)?"),
  typed("view-ghosted-display",    "Switch the active viewport to Ghosted display",                           "GHOSTED",            "Is the active viewport now in Ghosted display mode (objects shown with transparent shading)?"),
  typed("view-x-ray-display",      "Switch the active viewport to X-Ray display",                             "XRAYALLWIRES",       "Is the active viewport now in an X-Ray-style display mode (all wires visible through occluding surfaces)?")
);

// Section 11: Object snap & aids (typed + toggles) -- 15 entries
shortcuts.push(
  typed("osnap-end",               "Toggle the End object snap",                                              "END",                "Has the End object snap toggled state in the OSNAP toolbar (lit if previously unlit, unlit if previously lit)?"),
  typed("osnap-near",              "Toggle the Near object snap",                                             "NEAR",               "Has the Near object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-point",             "Toggle the Point object snap",                                            "POINT",              "Has the Point object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-mid",               "Toggle the Mid object snap",                                              "MID",                "Has the Mid object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-cen",               "Toggle the Center object snap",                                           "CEN",                "Has the Center object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-int",               "Toggle the Intersection object snap",                                     "INT",                "Has the Intersection object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-perp",              "Toggle the Perpendicular object snap",                                    "PERP",               "Has the Perpendicular object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-tan",               "Toggle the Tangent object snap",                                          "TAN",                "Has the Tangent object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-quad",              "Toggle the Quadrant object snap",                                         "QUAD",               "Has the Quadrant object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-knot",              "Toggle the Knot object snap",                                             "KNOT",               "Has the Knot object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-vertex",            "Toggle the Vertex object snap",                                           "VERTEX",             "Has the Vertex object snap toggled state in the OSNAP toolbar?"),
  typed("osnap-disable-all",       "Disable all object snaps temporarily (DISABLEOSNAP)",                     "DISABLEOSNAP",       "Have all object snaps been disabled (the OSNAP toolbar shows everything dimmed / unlit)?"),
  typed("osnap-toggle-smarttrack", "Toggle SmartTrack on / off (SMARTTRACK)",                                 "SMARTTRACK",         "Has SmartTrack toggled state in the status bar?"),
  typed("osnap-toggle-grid-snap",  "Toggle Grid Snap on / off (SNAP)",                                        "SNAP",               "Has Grid Snap toggled state in the status bar?"),
  typed("osnap-toggle-ortho",      "Toggle Ortho mode on / off (ORTHO)",                                      "ORTHO",              "Has Ortho mode toggled state in the status bar?")
);

// Section 12: Annotation (typed Rhino commands) -- 20 entries
shortcuts.push(
  typed("annot-dim-linear",        "Start the DIM command (linear dimension)",                                "DIM",                "Is the DIM command active, with the command line prompting for the first dimension point?"),
  typed("annot-dim-aligned",       "Start the DIMALIGNED command (aligned linear dimension)",                 "DIMALIGNED",         "Is the DIMALIGNED command active, with the command line prompting for the first dimension point?"),
  typed("annot-dim-radius",        "Start the DIMRADIUS command (radius dimension)",                          "DIMRADIUS",          "Is the DIMRADIUS command active, with the command line prompting for the curve / arc to dimension?"),
  typed("annot-dim-diameter",      "Start the DIMDIAMETER command (diameter dimension)",                      "DIMDIAMETER",        "Is the DIMDIAMETER command active, with the command line prompting for the curve / arc to dimension?"),
  typed("annot-dim-angle",         "Start the DIMANGLE command (angle dimension)",                            "DIMANGLE",           "Is the DIMANGLE command active, with the command line prompting for the lines / curves to angle-dimension?"),
  typed("annot-dim-ordinate",      "Start the DIMORDINATE command (ordinate dimension)",                      "DIMORDINATE",        "Is the DIMORDINATE command active, with the command line prompting for the point to dimension?"),
  typed("annot-leader",            "Start the LEADER command (leader line with text)",                        "LEADER",             "Is the LEADER command active, with the command line prompting for the leader's first point?"),
  typed("annot-text",              "Start the TEXT command (single-line annotation text)",                    "TEXT",               "Is the TEXT dialog now visible, prompting for the text content?"),
  typed("annot-mtext",             "Start the MTEXT command (multi-line annotation text)",                    "MTEXT",              "Is the MTEXT dialog now visible, prompting for the multi-line text content?"),
  typed("annot-dot",               "Start the DOT command (text dot annotation)",                             "DOT",                "Is the DOT command active, with the command line prompting for the dot's location and label?"),
  typed("annot-area",              "Start the AREA command (compute area of selected curves / surfaces)",     "AREA",               "Is the AREA command active, with the command line prompting for the curves / surfaces / hatches to measure?"),
  typed("annot-volume",            "Start the VOLUME command (compute volume of selected closed surfaces)",   "VOLUME",             "Is the VOLUME command active, with the command line prompting for the closed surfaces / polysurfaces?"),
  typed("annot-length",            "Start the LENGTH command (measure length of curves)",                     "LENGTH",             "Is the LENGTH command active, with the command line prompting for the curves to measure?"),
  typed("annot-distance",          "Start the DISTANCE command (measure distance between two points)",        "DISTANCE",           "Is the DISTANCE command active, with the command line prompting for the first point?"),
  typed("annot-angle",             "Start the ANGLE command (measure angle between two lines / curves)",      "ANGLE",              "Is the ANGLE command active, with the command line prompting for the lines / curves?"),
  typed("annot-mass-properties",   "Start the MASSPROPERTIES command (compute mass properties of solids)",    "MASSPROPERTIES",     "Is the MASSPROPERTIES command active, with the command line prompting for the closed surfaces / polysurfaces?"),
  typed("annot-evaluate-pt",       "Start the EVALUATEPT command (report properties of a 3D point)",          "EVALUATEPT",         "Is the EVALUATEPT command active, with the command line prompting for the point to evaluate?"),
  typed("annot-hatch",             "Start the HATCH command (hatch a closed planar curve)",                   "HATCH",              "Is the HATCH dialog now visible, prompting for the hatch pattern and the closed curves to fill?"),
  typed("annot-bbox",              "Start the BOUNDINGBOX command (compute axis-aligned bounding box)",       "BOUNDINGBOX",        "Is the BOUNDINGBOX command active, with the command line prompting for the objects to compute?"),
  typed("annot-text-style",        "Open the Text Styles dialog (DOCUMENTPROPERTIES Text)",                   "DOCUMENTPROPERTIES", "Has the Document Properties dialog opened (likely on a recent tab — Text Styles, Annotation Styles, etc.)?")
);

// Section 13: Display / visibility (typed + a few keybinds) -- 15 entries
shortcuts.push(
  typed("display-hide",            "Hide the current selection (HIDE)",                                       "HIDE",               "Have the previously-selected objects been hidden (no longer visible in the viewport, but not deleted)?"),
  typed("display-show",            "Show all hidden objects (SHOW)",                                          "SHOW",               "Have all previously-hidden objects been restored to visibility?"),
  typed("display-show-selected",   "Show only the previously-hidden objects you select (SHOWSELECTED)",       "SHOWSELECTED",       "Is the SHOWSELECTED command now prompting for which hidden objects to reveal?"),
  typed("display-isolate",         "Hide everything except the current selection (ISOLATE)",                  "ISOLATE",            "Have all non-selected objects been hidden (only the previous selection remains visible)?"),
  typed("display-lock",            "Lock the current selection (LOCK)",                                       "LOCK",               "Have the previously-selected objects been locked (visible but not editable, displayed dimmed)?"),
  typed("display-unlock",          "Unlock all locked objects (UNLOCK)",                                      "UNLOCK",             "Have all previously-locked objects been unlocked and returned to a normal display?"),
  typed("display-lock-selected",   "Lock only the previously-locked objects you select (UNLOCKSELECTED)",     "UNLOCKSELECTED",     "Is the UNLOCKSELECTED command now prompting for which locked objects to unlock?"),
  typed("display-shaded-view",     "Switch the active viewport to Shaded mode (SHADEDVIEW)",                  "SHADEDVIEW",         "Is the active viewport now in Shaded display mode?"),
  typed("display-rendered-view",   "Switch the active viewport to Rendered mode (RENDEREDVIEW)",              "RENDEREDVIEW",       "Is the active viewport now in Rendered display mode?"),
  typed("display-wireframe-view",  "Switch the active viewport to Wireframe mode (WIREFRAMEVIEW)",            "WIREFRAMEVIEW",      "Is the active viewport now in Wireframe display mode?"),
  typed("display-ground-plane",    "Open the Ground Plane settings (GROUNDPLANE)",                            "GROUNDPLANE",        "Is the Ground Plane panel / settings now visible?"),
  typed("display-show-edges",      "Toggle isocurve / edge display (SHOWEDGES)",                              "SHOWEDGES",          "Is the SHOWEDGES tool now active, highlighting which edges are displayed?"),
  typed("display-show-points",     "Show control points for the current selection (POINTSON)",                "POINTSON",           "Are control points now visible on the previously-selected curves / surfaces?"),
  typed("display-hide-points",     "Hide control points (POINTSOFF)",                                         "POINTSOFF",          "Have control points been hidden across the document?"),
  typed("display-toggle-grid",     "Toggle the construction-plane grid (GRID)",                              "GRID",               "Has the construction-plane grid toggled visibility in the active viewport?")
);

// Section 14: Mesh (typed Rhino commands) -- 15 entries
shortcuts.push(
  typed("mesh-from-srf",           "Convert NURBS surfaces to a mesh (MESH)",                                 "MESH",               "Is the MESH dialog now visible, prompting for tessellation parameters?"),
  typed("mesh-from-srf-detailed",  "Convert NURBS surfaces to a mesh with detailed controls (MESHFROMSURFACE)", "MESHFROMSURFACE",  "Is the MESHFROMSURFACE dialog now visible, prompting for detailed mesh-creation controls?"),
  typed("mesh-from-points",        "Build a mesh from a point cloud (MESHFROMPOINTS)",                        "MESHFROMPOINTS",     "Is the MESHFROMPOINTS command active, with the command line prompting for the point cloud?"),
  typed("mesh-reduce",             "Reduce a mesh's face count (REDUCEMESH)",                                 "REDUCEMESH",         "Is the REDUCEMESH dialog now visible, prompting for the target face count or reduction percentage?"),
  typed("mesh-repair",             "Repair a mesh (REPAIRMESH / CHECKMESH)",                                  "CHECKMESH",          "Is the CHECKMESH report / dialog now visible, listing mesh issues?"),
  typed("mesh-weld",               "Weld mesh vertices within a tolerance (WELDMESH)",                        "WELDMESH",           "Is the WELDMESH command active, with the command line prompting for the mesh and weld tolerance?"),
  typed("mesh-rebuild",            "Rebuild a mesh's structure (REBUILDMESH)",                                "REBUILDMESH",        "Is the REBUILDMESH command active, with the command line prompting for the mesh?"),
  typed("mesh-unify-normals",      "Unify mesh face normals (UNIFYMESHNORMALS)",                              "UNIFYMESHNORMALS",   "Is the UNIFYMESHNORMALS command active, with the command line prompting for the mesh?"),
  typed("mesh-flip-normals",       "Flip mesh face normals (FLIPMESHNORMALS)",                                "FLIPMESHNORMALS",    "Is the FLIPMESHNORMALS command active, with the command line prompting for the mesh?"),
  typed("mesh-fill-holes",         "Fill mesh holes (FILLMESHHOLES)",                                         "FILLMESHHOLES",      "Is the FILLMESHHOLES command active, with the command line prompting for the mesh?"),
  typed("mesh-extract-naked",      "Extract naked-edge mesh boundaries (EXTRACTMESHFACES)",                   "EXTRACTMESHFACES",   "Is the EXTRACTMESHFACES command active, with the command line prompting for the mesh and the faces to extract?"),
  typed("mesh-split-disjoint",     "Split a mesh into disjoint pieces (SPLITDISJOINTMESH)",                   "SPLITDISJOINTMESH",  "Is the SPLITDISJOINTMESH command active, with the command line prompting for the mesh?"),
  typed("mesh-boolean-union",      "Boolean-union meshes (MESHBOOLEANUNION)",                                 "MESHBOOLEANUNION",   "Is the MESHBOOLEANUNION command active, with the command line prompting for the meshes to union?", { tier: "typedSlow" }),
  typed("mesh-boolean-difference", "Boolean-subtract meshes (MESHBOOLEANDIFFERENCE)",                         "MESHBOOLEANDIFFERENCE","Is the MESHBOOLEANDIFFERENCE command active, with the command line prompting for the meshes?", { tier: "typedSlow" }),
  typed("mesh-quad-remesh",        "Quad-remesh selected geometry (QUADREMESH)",                              "QUADREMESH",         "Is the QUADREMESH dialog now visible, prompting for target quad-count and other remesh options?", { tier: "typedSlow" })
);

// Section 15: Render (typed Rhino commands) -- 10 entries
shortcuts.push(
  typed("render-render",           "Render the active viewport (RENDER)",                                     "RENDER",             "Is the Rhino render window now visible (or rendering in progress), showing a rendered image of the active viewport?", { tier: "typedSlow" }),
  typed("render-preview",          "Quick-render preview of the active viewport (RENDERPREVIEW)",             "RENDERPREVIEW",      "Is a render-preview window now visible, showing a faster, lower-quality render of the active viewport?", { tier: "typedSlow" }),
  typed("render-window",           "Render a window of the active viewport (RENDERWINDOW)",                   "RENDERWINDOW",       "Is the RENDERWINDOW command now prompting for the window region to render?", { tier: "typedSlow" }),
  typed("render-material",         "Open the Materials panel (MATERIAL)",                                     "MATERIAL",           "Is the Materials panel now visible / focused?"),
  typed("render-environment",      "Open the Environment panel (ENVIRONMENT)",                               "ENVIRONMENT",        "Is the Environment panel now visible / focused?"),
  typed("render-lights",           "Open the Lights panel (LIGHTS)",                                          "LIGHTS",             "Is the Lights panel now visible / focused?"),
  typed("render-sun",              "Open the Sun panel (SUN)",                                                "SUN",                "Is the Sun panel now visible / focused, with sun-position controls?"),
  typed("render-ground-plane",     "Open the Ground Plane settings (GROUNDPLANE)",                            "GROUNDPLANE",        "Is the Ground Plane panel / settings now visible?"),
  typed("render-properties",       "Open the Render Properties section of Document Properties (RENDERPROPERTIES)", "RENDERPROPERTIES","Is the Render Properties section of Document Properties now visible?"),
  typed("render-snapshots",        "Open the Snapshots panel (SNAPSHOTS)",                                    "SNAPSHOTS",          "Is the Snapshots panel now visible, listing saved scene states?")
);

// Section 16: Export & file ops (typed Rhino commands) -- 10 entries
shortcuts.push(
  typed("export-selected",         "Open the Export Selected dialog (EXPORT)",                                "EXPORT",             "Is the Export Selected dialog now visible, prompting for the file destination and format?"),
  typed("import-file",             "Open the Import dialog (IMPORT)",                                         "IMPORT",             "Is the Import dialog now visible, prompting for the file to import?"),
  typed("insert-block",            "Open the Insert Block dialog (INSERT)",                                   "INSERT",             "Is the Insert Block dialog now visible, prompting for the block to insert?"),
  typed("block-edit",              "Open the BLOCKEDIT command",                                              "BLOCKEDIT",          "Is the BLOCKEDIT command now active, prompting for the block to edit?"),
  typed("block-define",            "Define a new block from selected geometry (BLOCK)",                       "BLOCK",              "Is the Block Definition dialog now visible, prompting for the block name and base point?"),
  typed("export-stl",              "Export selection as STL (EXPORT in STL mode)",                            "EXPORTSTL",          "Is the Export STL dialog now visible, prompting for the STL file destination?"),
  typed("export-obj",              "Export selection as OBJ (EXPORTOBJ)",                                     "EXPORTOBJ",          "Is the Export OBJ dialog now visible, prompting for the OBJ file destination?"),
  typed("export-step",             "Export selection as STEP (EXPORTSTEP)",                                   "EXPORTSTEP",         "Is the Export STEP dialog now visible, prompting for the STEP file destination?"),
  typed("export-iges",             "Export selection as IGES (EXPORTIGES)",                                   "EXPORTIGES",         "Is the Export IGES dialog now visible, prompting for the IGES file destination?"),
  typed("export-3dm",              "Export selection as 3DM (EXPORT)",                                        "EXPORT",             "Is the Export Selected dialog now visible (3DM is one of the offered formats)?")
);

// Section 17: Grasshopper (typed) -- 5 entries
shortcuts.push(
  typed("grasshopper-open",        "Open Grasshopper (GRASSHOPPER)",                                          "GRASSHOPPER",        "Has the Grasshopper window opened (a separate window with a node-graph canvas, component ribbon, and a script tab)?", { tier: "typedSlow" }),
  typed("grasshopper-load-file",   "Open a Grasshopper file (GRASSHOPPER followed by an open command)",       "GRASSHOPPER",        "Is Grasshopper open and ready to receive a file via its File > Open menu?", { tier: "typedSlow" }),
  typed("grasshopper-bake",        "Bake the active Grasshopper output to Rhino (BAKE — invoked from GH)",    "GRASSHOPPER",        "Is Grasshopper now in front and ready to bake (Bake action available via right-click on a component)?", { tier: "typedSlow" }),
  typed("grasshopper-recompute",   "Force-recompute the Grasshopper graph (GRASSHOPPER > Solution > Recompute)", "GRASSHOPPER",     "Is Grasshopper open with the canvas focused so that Solution > Recompute can be triggered?"),
  typed("grasshopper-disable",     "Disable Grasshopper (lock canvas) so it stops solving (GRASSHOPPER + Lock)", "GRASSHOPPER",     "Is Grasshopper open with the canvas reachable so that Lock Solver can be toggled?")
);

// Section 18: History (typed Rhino commands) -- 5 entries
shortcuts.push(
  typed("history-record-on",       "Turn record-history on (HISTORY ON)",                                     "HISTORY _On",        "Is record-history now ON (the History indicator in the status bar reflects that history recording is active)?"),
  typed("history-record-off",      "Turn record-history off (HISTORY OFF)",                                   "HISTORY _Off",       "Is record-history now OFF (the History indicator in the status bar reflects that history recording is paused)?"),
  typed("history-purge",           "Purge all history relationships (HISTORYPURGE)",                          "HISTORYPURGE",       "Have all history relationships in the document been purged (no parametric child geometry will update on parent edits)?", { tier: "typedFast" }),
  typed("history-update-children", "Force-update all history-linked children (UPDATEHISTORY)",                "UPDATEHISTORY",      "Have all history-linked child objects been re-evaluated against their parents?"),
  typed("history-broken-objects",  "Select objects whose history is broken (SELHISTORY broken)",              "SELHISTORYBROKEN",   "Are all objects with broken history relationships now selected?")
);

// Section 19: Snap & coordinate input (typed) -- 10 entries
shortcuts.push(
  typed("snap-toggle-planar",      "Toggle Planar mode (PLANAR)",                                             "PLANAR",             "Has Planar mode toggled state in the status bar?"),
  typed("snap-toggle-osnap-panel", "Open the Object Snap settings panel (OSNAP)",                             "OSNAP",              "Is the Object Snap settings panel / toolbar now visible / focused?"),
  typed("coords-set-cplane-world", "Reset the construction plane to World Top (CPLANE World Top)",            "CPLANE _World _Top", "Is the active viewport's construction plane now World Top (the grid is aligned with the world XY plane)?"),
  typed("coords-set-cplane-front", "Set the construction plane to World Front (CPLANE World Front)",          "CPLANE _World _Front","Is the active viewport's construction plane now World Front (the grid is aligned with the world XZ plane)?"),
  typed("coords-set-cplane-right", "Set the construction plane to World Right (CPLANE World Right)",          "CPLANE _World _Right","Is the active viewport's construction plane now World Right (the grid is aligned with the world YZ plane)?"),
  typed("coords-cplane-3pt",       "Set the construction plane by three points (CPLANE 3Point)",              "CPLANE _3Point",     "Is the CPLANE command now in 3Point mode, prompting for the construction plane's origin?"),
  typed("coords-cplane-named",     "Open the named-CPlanes panel (NAMEDCPLANE)",                              "NAMEDCPLANE",        "Is the Named CPlanes panel now visible / focused?"),
  typed("coords-cplane-prev",      "Restore the previous construction plane (CPLANE Previous)",               "CPLANE _Previous",   "Has the active viewport's construction plane been rolled back to the previous CPlane?"),
  typed("coords-units",            "Open the Units panel (UNITS)",                                            "UNITS",              "Is the Units settings panel now visible, showing the document's model and page units?"),
  typed("coords-distance-units",   "Open the Document Properties dialog at the Units page (DOCUMENTPROPERTIES Units)", "DOCUMENTPROPERTIES", "Has the Document Properties dialog opened (likely on the Units tab if last visited)?")
);

// --- assemble + write ------------------------------------------------------

// Sanity: ids unique.
{
  const seen = new Set();
  for (const s of shortcuts) {
    if (seen.has(s.id)) {
      throw new Error(`duplicate id in gen.mjs: ${s.id}`);
    }
    seen.add(s.id);
  }
}

const output = {
  schema_version: 1,
  app_id: APP_ID,
  shortcuts
};

writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");
console.error(`wrote ${OUT} with ${shortcuts.length} shortcuts`);
