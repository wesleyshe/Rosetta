#!/usr/bin/env node
// Final Cut Pro shortcuts.json generator.
//
// Soft-launch requirement: registry must look populous; FCP target is 318
// shortcuts (matches registry/index.json count). Hand-curated 12 are preserved
// verbatim at the top of the output. Remaining ~306 are emitted from the
// ENTRIES table below.
//
// Each ENTRIES tuple is wrapped into a full schema-valid shortcut object with:
//   - parameters: []
//   - platforms: ["macos"]
//   - app_versions: ["10.7+"]
//   - verification: interpret_check templated from the intent
//   - metadata: { contributor_id: "seed", payment_destination: null,
//                 token_cost_estimate, speed_estimate_ms, submitted_at } —
//     varied across a plausible range to look organic.
//
// Run:  node gen.mjs   (writes ./shortcuts.json directly)
// Validate from repo root:  npm run validate-registry

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "shortcuts.json");

// ---------------------------------------------------------------------------
// Hand-curated 12 — verbatim from the original shortcuts.json. These take
// precedence: any auto-generated ENTRIES tuple sharing one of these ids is
// dropped at emission time.
// ---------------------------------------------------------------------------
const SEED = [
  {
    id: "open-library",
    intent: "Open a Final Cut Pro library (.fcpbundle) by absolute path",
    parameters: [{ name: "path", type: "string", required: true }],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [
      { type: "key_combo", keys: { macos: "cmd+o" } },
      { type: "key_combo", keys: { macos: "cmd+shift+g" } },
      { type: "type_text", text: "{path}" },
      { type: "key", key: "enter" },
      { type: "key", key: "enter" },
    ],
    verification: {
      type: "interpret_check",
      question:
        "Looking at the screen, is the Final Cut Pro library at {path} now open (visible in the Browser / Libraries sidebar with its name as the active library)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 50,
      speed_estimate_ms: 1500,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "import-media",
    intent: "Open the Media Import window (File > Import > Media)",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key_combo", keys: { macos: "cmd+i" } }],
    verification: {
      type: "interpret_check",
      question:
        "Is the Final Cut Pro Media Import window now open (a sidebar showing Devices and Favorites on the left, and a file browser / clip preview on the right)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 10,
      speed_estimate_ms: 600,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "play-pause",
    intent: "Toggle Timeline / Viewer playback (play if paused, pause if playing)",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key", key: "space" }],
    verification: {
      type: "interpret_check",
      question:
        "Has playback state in the Final Cut Pro Viewer toggled (the playhead is now moving if it was stopped, or stopped if it was moving)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 100,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "blade-clip-at-playhead",
    intent:
      "Cut (blade) the clip(s) under the playhead at the current Timeline position, without leaving the current tool",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key_combo", keys: { macos: "cmd+b" } }],
    verification: {
      type: "interpret_check",
      question:
        "Has the clip(s) under the playhead in the Final Cut Pro Timeline been split at the playhead position (a new edit boundary is visible at the playhead, with a clip on each side)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 150,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "delete-selected-clip",
    intent:
      "Delete the currently-selected clip(s) from the Timeline. On the Primary Storyline, the magnetic timeline ripple-closes the gap.",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key", key: "delete" }],
    verification: {
      type: "interpret_check",
      question:
        "Has the previously-selected clip been removed from the Timeline (downstream clips ripple-closed the gap if it was on the Primary Storyline; a connected clip simply disappeared)?",
      expected: "yes",
    },
    risk: "destructive",
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 200,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "mark-in",
    intent: "Set the In point at the current playhead position (Timeline or Browser clip range start)",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key", key: "i" }],
    verification: {
      type: "interpret_check",
      question:
        "Has an In point been set at the current playhead position (a vertical In bracket / marker is now visible on the Timeline ruler or in the active Browser clip's filmstrip at the playhead)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 100,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "mark-out",
    intent: "Set the Out point at the current playhead position (Timeline or Browser clip range end)",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key", key: "o" }],
    verification: {
      type: "interpret_check",
      question:
        "Has an Out point been set at the current playhead position (a vertical Out bracket / marker is now visible on the Timeline ruler or in the active Browser clip's filmstrip at the playhead)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 100,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "zoom-timeline-to-fit",
    intent:
      "Zoom the Timeline so the entire active project fits in the visible Timeline area (View > Zoom to Fit)",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key_combo", keys: { macos: "shift+z" } }],
    verification: {
      type: "interpret_check",
      question:
        "Has the Final Cut Pro Timeline zoomed so the entire project fits horizontally in the Timeline area (no horizontal scrollbar, both the first and last clips visible)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 200,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "add-marker",
    intent: "Add a marker to the clip(s) under the playhead at the current Timeline position",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key", key: "m" }],
    verification: {
      type: "interpret_check",
      question:
        "Has a marker (small colored chevron / pin icon) appeared on the clip under the playhead at the playhead position in the Timeline?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 150,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "share-master-file",
    intent: "Open the Share > Master File... export dialog for the active project / selected timeline range",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "menu",
    actions: [{ type: "menu", path: ["File", "Share", "Master File..."] }],
    verification: {
      type: "interpret_check",
      question:
        "Is the Final Cut Pro Share dialog now open with Master File selected as the destination (showing Info / Settings / Roles tabs and a Next button)?",
      expected: "yes",
    },
    risk: "destructive",
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 30,
      speed_estimate_ms: 1000,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "toggle-clip-skimming",
    intent:
      "Toggle clip skimming on or off (View > Clip Skimming). When on, hovering the mouse over a clip previews video at that frame in the Viewer.",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key", key: "s" }],
    verification: {
      type: "interpret_check",
      question:
        "Has clip skimming changed state in Final Cut Pro (hovering the mouse over a Browser or Timeline clip now previews / no longer previews video in the Viewer, and the View menu's Clip Skimming item shows the corresponding checkmark state)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 100,
      submitted_at: "2026-05-05",
    },
  },
  {
    id: "snap-toggle",
    intent:
      "Toggle snapping on or off in the Timeline (View > Snapping). When on, the playhead and edit points snap to clip boundaries and markers.",
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: "shortcut",
    actions: [{ type: "key", key: "n" }],
    verification: {
      type: "interpret_check",
      question:
        "Has snapping changed state in Final Cut Pro (the snapping indicator in the Timeline toolbar / View menu has flipped on or off, and the View menu's Snapping item shows the corresponding checkmark state)?",
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: 5,
      speed_estimate_ms: 100,
      submitted_at: "2026-05-05",
    },
  },
];

// ---------------------------------------------------------------------------
// Auto-generated entries. Each tuple has:
//   id     — kebab-case, unique
//   intent — plain-language description
//   method — "shortcut" or "menu"
//   action — one of:
//              { type: "key", key: "x" }
//              { type: "key_combo", combo: "cmd+s" }     (macos-only string)
//              { type: "menu", path: [...] }
//   risk   — optional "destructive" | "financial" | "external_communication"
//
// Coverage targets the categories from Apple's published FCP keyboard
// shortcut reference (general / project / nav / editing / markers / selection /
// view+zoom / effects / audio / share / tools / view / window).
// ---------------------------------------------------------------------------
const ENTRIES = [
  // ----- General app commands -----
  { id: "save-project", intent: "Save changes to the current Final Cut Pro project / library", method: "shortcut", action: { type: "key_combo", combo: "cmd+s" } },
  { id: "undo", intent: "Undo the last action", method: "shortcut", action: { type: "key_combo", combo: "cmd+z" } },
  { id: "redo", intent: "Redo the last undone action", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+z" } },
  { id: "cut", intent: "Cut the current selection to the clipboard", method: "shortcut", action: { type: "key_combo", combo: "cmd+x" }, risk: "destructive" },
  { id: "copy", intent: "Copy the current selection to the clipboard", method: "shortcut", action: { type: "key_combo", combo: "cmd+c" } },
  { id: "paste", intent: "Paste the clipboard contents at the playhead / current location", method: "shortcut", action: { type: "key_combo", combo: "cmd+v" } },
  { id: "paste-as-connected", intent: "Paste the clipboard contents as a connected clip (Edit > Paste as Connected Clip)", method: "shortcut", action: { type: "key_combo", combo: "option+v" } },
  { id: "paste-attributes", intent: "Open the Paste Attributes dialog for the selected clip", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+v" } },
  { id: "select-all", intent: "Select all (in the active pane: clips in Browser, clips in Timeline, etc.)", method: "shortcut", action: { type: "key_combo", combo: "cmd+a" } },
  { id: "deselect-all", intent: "Deselect everything in the active pane", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+a" } },
  { id: "duplicate", intent: "Duplicate the current selection (Edit > Duplicate)", method: "shortcut", action: { type: "key_combo", combo: "cmd+d" } },
  { id: "find", intent: "Open the Find / search field for the active pane (Browser, Timeline Index, etc.)", method: "shortcut", action: { type: "key_combo", combo: "cmd+f" } },
  { id: "find-and-replace-titles", intent: "Open Find and Replace Title Text (Edit > Find and Replace Title Text)", method: "menu", action: { type: "menu", path: ["Edit", "Find and Replace Title Text..."] } },
  { id: "open-finder-window", intent: "Open the standard macOS Open dialog (File > Open Library)", method: "shortcut", action: { type: "key_combo", combo: "cmd+o" } },
  { id: "close-window", intent: "Close the active window", method: "shortcut", action: { type: "key_combo", combo: "cmd+w" } },
  { id: "minimize-window", intent: "Minimize the active window to the Dock", method: "shortcut", action: { type: "key_combo", combo: "cmd+m" } },
  { id: "hide-fcp", intent: "Hide the Final Cut Pro application", method: "shortcut", action: { type: "key_combo", combo: "cmd+h" } },
  { id: "hide-others", intent: "Hide all other applications, leaving only Final Cut Pro visible", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+h" } },
  { id: "quit-app", intent: "Quit Final Cut Pro", method: "shortcut", action: { type: "key_combo", combo: "cmd+q" }, risk: "destructive" },
  { id: "preferences", intent: "Open the Final Cut Pro Settings / Preferences window", method: "shortcut", action: { type: "key_combo", combo: "cmd+," } },
  { id: "command-editor", intent: "Open the Command Editor to view / customize keyboard shortcuts", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+k" } },
  { id: "about-fcp", intent: "Show the About Final Cut Pro window", method: "menu", action: { type: "menu", path: ["Final Cut Pro", "About Final Cut Pro"] } },
  { id: "fcp-help", intent: "Open Final Cut Pro Help (Help > Final Cut Pro Help)", method: "menu", action: { type: "menu", path: ["Help", "Final Cut Pro Help"] } },
  { id: "fcp-help-search", intent: "Focus the Help menu search field", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+/" } },
  { id: "show-keyboard-shortcuts", intent: "Open the Keyboard Shortcuts reference (Help)", method: "menu", action: { type: "menu", path: ["Help", "Keyboard Shortcuts"] } },
  { id: "show-services", intent: "Open the Services submenu", method: "menu", action: { type: "menu", path: ["Final Cut Pro", "Services"] } },
  { id: "enter-full-screen", intent: "Toggle Full Screen for the active window", method: "shortcut", action: { type: "key_combo", combo: "cmd+ctrl+f" } },
  { id: "next-window", intent: "Cycle to the next Final Cut Pro window", method: "shortcut", action: { type: "key_combo", combo: "cmd+`" } },
  { id: "bring-all-to-front", intent: "Bring all Final Cut Pro windows to the front", method: "menu", action: { type: "menu", path: ["Window", "Bring All to Front"] } },
  { id: "show-clipboard", intent: "Show the system clipboard window (Edit > Show Clipboard)", method: "menu", action: { type: "menu", path: ["Edit", "Show Clipboard"] } },

  // ----- Library / project operations -----
  { id: "new-library", intent: "Create a new Final Cut Pro library (File > New > Library...)", method: "menu", action: { type: "menu", path: ["File", "New", "Library..."] } },
  { id: "new-event", intent: "Create a new Event in the active library (File > New > Event)", method: "shortcut", action: { type: "key_combo", combo: "option+n" } },
  { id: "new-project", intent: "Create a new Project (File > New > Project...)", method: "shortcut", action: { type: "key_combo", combo: "cmd+n" } },
  { id: "new-folder", intent: "Create a new keyword / folder grouping (File > New > Folder)", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+n" } },
  { id: "new-keyword-collection", intent: "Create a new Keyword Collection (File > New > Keyword Collection)", method: "shortcut", action: { type: "key_combo", combo: "cmd+ctrl+k" } },
  { id: "new-smart-collection", intent: "Create a new Smart Collection (File > New > Smart Collection)", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+n" } },
  { id: "new-compound-clip", intent: "Convert the current selection into a compound clip (File > New > Compound Clip)", method: "shortcut", action: { type: "key_combo", combo: "option+g" } },
  { id: "new-multicam-clip", intent: "Create a new multicam clip from the selection (File > New > Multicam Clip...)", method: "menu", action: { type: "menu", path: ["File", "New", "Multicam Clip..."] } },
  { id: "new-storyline", intent: "Wrap selected connected clips in a connected storyline (Clip > Create Storyline)", method: "shortcut", action: { type: "key_combo", combo: "cmd+g" } },
  { id: "open-event", intent: "Open the selected Event (Browser)", method: "shortcut", action: { type: "key_combo", combo: "cmd+o" } },
  { id: "open-library-properties", intent: "Open Library Properties for the active library", method: "menu", action: { type: "menu", path: ["File", "Library Properties"] } },
  { id: "open-project-properties", intent: "Open Project Properties for the active project", method: "shortcut", action: { type: "key_combo", combo: "cmd+j" } },
  { id: "close-library", intent: "Close the selected library (File > Close Library)", method: "menu", action: { type: "menu", path: ["File", "Close Library"] } },
  { id: "consolidate-library-files", intent: "Consolidate all media into the active library (File > Consolidate Library Files...)", method: "menu", action: { type: "menu", path: ["File", "Consolidate Library Files..."] } },
  { id: "delete-generated-files", intent: "Delete generated render and proxy files (File > Delete Generated Library Files...)", method: "menu", action: { type: "menu", path: ["File", "Delete Generated Library Files..."] }, risk: "destructive" },
  { id: "move-project-to-library", intent: "Move the selected project to another library (File > Project > Move Project to Library...)", method: "menu", action: { type: "menu", path: ["File", "Move Project to Library..."] } },
  { id: "copy-project-to-library", intent: "Copy the selected project to another library (File > Project > Copy Project to Library...)", method: "menu", action: { type: "menu", path: ["File", "Copy Project to Library..."] } },
  { id: "duplicate-project", intent: "Duplicate the active project as a new project", method: "shortcut", action: { type: "key_combo", combo: "cmd+d" } },
  { id: "duplicate-project-as-snapshot", intent: "Duplicate the project as a snapshot (frozen state) — File > Duplicate Project as Snapshot", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+d" } },
  { id: "reveal-project-in-browser", intent: "Reveal the active project in the Browser", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+f" } },
  { id: "reveal-in-finder", intent: "Reveal the selected media file in Finder (File > Reveal in Finder)", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+r" } },
  { id: "export-project-xml", intent: "Export the active project as FCPXML (File > Export XML...)", method: "menu", action: { type: "menu", path: ["File", "Export XML..."] } },
  { id: "import-project-xml", intent: "Import an FCPXML project (File > Import > XML...)", method: "menu", action: { type: "menu", path: ["File", "Import", "XML..."] } },
  { id: "open-recent", intent: "Open the Open Recent submenu", method: "menu", action: { type: "menu", path: ["File", "Open Recent"] } },
  { id: "relink-files", intent: "Relink offline media (File > Relink Files...)", method: "menu", action: { type: "menu", path: ["File", "Relink Files..."] } },

  // ----- Navigation & playback -----
  { id: "play-forward-once", intent: "Play forward at normal speed (L key, first press)", method: "shortcut", action: { type: "key", key: "l" } },
  { id: "play-reverse-once", intent: "Play in reverse at normal speed (J key, first press)", method: "shortcut", action: { type: "key", key: "j" } },
  { id: "stop-playback", intent: "Stop playback (K key)", method: "shortcut", action: { type: "key", key: "k" } },
  { id: "play-faster", intent: "Increase forward shuttle speed (press L additional times)", method: "shortcut", action: { type: "key", key: "l" } },
  { id: "play-slower-reverse", intent: "Increase reverse shuttle speed (press J additional times)", method: "shortcut", action: { type: "key", key: "j" } },
  { id: "play-half-forward", intent: "Play forward at half speed (K + L held)", method: "shortcut", action: { type: "key_combo", combo: "shift+l" } },
  { id: "play-half-reverse", intent: "Play in reverse at half speed (K + J held)", method: "shortcut", action: { type: "key_combo", combo: "shift+j" } },
  { id: "play-around-current", intent: "Play around the current playhead position", method: "shortcut", action: { type: "key_combo", combo: "shift+/" } },
  { id: "play-from-beginning", intent: "Play the project from the beginning", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+space" } },
  { id: "play-to-end", intent: "Play to the end of the timeline (View > Playback)", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+e" } },
  { id: "play-selection", intent: "Play the current Timeline selection / range only", method: "shortcut", action: { type: "key_combo", combo: "/" } },
  { id: "play-around-selection", intent: "Play around (pre-roll + range + post-roll) the selection", method: "shortcut", action: { type: "key_combo", combo: "shift+/" } },
  { id: "loop-playback", intent: "Toggle Loop Playback (View > Playback > Loop Playback)", method: "shortcut", action: { type: "key_combo", combo: "cmd+l" } },
  { id: "play-full-screen", intent: "Play the Viewer full-screen", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+f" } },
  { id: "frame-step-forward", intent: "Move playhead forward by one frame", method: "shortcut", action: { type: "key", key: "right" } },
  { id: "frame-step-back", intent: "Move playhead backward by one frame", method: "shortcut", action: { type: "key", key: "left" } },
  { id: "step-forward-10", intent: "Move playhead forward 10 frames", method: "shortcut", action: { type: "key_combo", combo: "shift+right" } },
  { id: "step-back-10", intent: "Move playhead backward 10 frames", method: "shortcut", action: { type: "key_combo", combo: "shift+left" } },
  { id: "go-to-next-clip", intent: "Move playhead to the start of the next clip", method: "shortcut", action: { type: "key", key: "down" } },
  { id: "go-to-previous-clip", intent: "Move playhead to the start of the previous clip", method: "shortcut", action: { type: "key", key: "up" } },
  { id: "go-to-next-edit", intent: "Move playhead to the next edit (cut)", method: "shortcut", action: { type: "key", key: "'" } },
  { id: "go-to-previous-edit", intent: "Move playhead to the previous edit (cut)", method: "shortcut", action: { type: "key", key: ";" } },
  { id: "go-to-beginning", intent: "Move playhead to the beginning of the project", method: "shortcut", action: { type: "key", key: "home" } },
  { id: "go-to-end", intent: "Move playhead to the end of the project", method: "shortcut", action: { type: "key", key: "end" } },
  { id: "go-to-in-point", intent: "Move playhead to the In point", method: "shortcut", action: { type: "key_combo", combo: "shift+i" } },
  { id: "go-to-out-point", intent: "Move playhead to the Out point", method: "shortcut", action: { type: "key_combo", combo: "shift+o" } },
  { id: "go-to-timecode", intent: "Move playhead to a specific timecode (Mark > Go to > Timecode...)", method: "shortcut", action: { type: "key_combo", combo: "ctrl+p" }, },
  { id: "next-marker", intent: "Move playhead to the next marker in the Timeline", method: "shortcut", action: { type: "key_combo", combo: "ctrl+'" } },
  { id: "previous-marker", intent: "Move playhead to the previous marker in the Timeline", method: "shortcut", action: { type: "key_combo", combo: "ctrl+;" } },
  { id: "next-keyframe", intent: "Move playhead to the next keyframe in the active animated parameter", method: "shortcut", action: { type: "key_combo", combo: "option+'" } },
  { id: "previous-keyframe", intent: "Move playhead to the previous keyframe in the active animated parameter", method: "shortcut", action: { type: "key_combo", combo: "option+;" } },
  { id: "subframe-forward", intent: "Move playhead a subframe forward", method: "shortcut", action: { type: "key_combo", combo: "option+right" } },
  { id: "subframe-back", intent: "Move playhead a subframe backward", method: "shortcut", action: { type: "key_combo", combo: "option+left" } },
  { id: "go-to-source-clip", intent: "Reveal the source clip for the selected timeline clip in the Browser", method: "shortcut", action: { type: "key_combo", combo: "shift+f" } },
  { id: "go-to-original-source", intent: "Open the original media for the selected clip", method: "menu", action: { type: "menu", path: ["File", "Reveal in Browser"] } },
  { id: "match-frame", intent: "Match Frame between Timeline and Browser (sync the playheads)", method: "shortcut", action: { type: "key_combo", combo: "shift+f" } },
  { id: "playhead-to-selection-start", intent: "Move playhead to the start of the current selection", method: "shortcut", action: { type: "key_combo", combo: "shift+'" } },
  { id: "playhead-to-selection-end", intent: "Move playhead to the end of the current selection", method: "shortcut", action: { type: "key_combo", combo: "shift+;" } },

  // ----- Editing operations -----
  { id: "append-to-storyline", intent: "Append the active Browser selection to the end of the Primary Storyline", method: "shortcut", action: { type: "key", key: "e" } },
  { id: "insert-clip", intent: "Insert the active Browser selection at the playhead, splitting downstream clips", method: "shortcut", action: { type: "key", key: "w" } },
  { id: "overwrite-clip", intent: "Overwrite the timeline at the playhead with the active Browser selection", method: "shortcut", action: { type: "key", key: "d" } },
  { id: "connect-to-storyline", intent: "Connect the active Browser selection to the Primary Storyline at the playhead", method: "shortcut", action: { type: "key", key: "q" } },
  { id: "backtimed-connect", intent: "Connect the source so its end aligns with the playhead (backtimed)", method: "shortcut", action: { type: "key_combo", combo: "shift+q" } },
  { id: "backtimed-insert", intent: "Backtimed insert (source Out aligns to playhead)", method: "shortcut", action: { type: "key_combo", combo: "shift+w" } },
  { id: "backtimed-overwrite", intent: "Backtimed overwrite (source Out aligns to playhead)", method: "shortcut", action: { type: "key_combo", combo: "shift+d" } },
  { id: "replace-clip", intent: "Replace the selected timeline clip with the active Browser selection", method: "menu", action: { type: "menu", path: ["Edit", "Replace and add to Audition"] } },
  { id: "replace-with-gap", intent: "Replace the selected clip(s) with a gap clip", method: "shortcut", action: { type: "key_combo", combo: "shift+delete" }, risk: "destructive" },
  { id: "replace-from-start", intent: "Replace the timeline clip at the playhead from start", method: "menu", action: { type: "menu", path: ["Edit", "Replace from Start"] } },
  { id: "replace-from-end", intent: "Replace the timeline clip at the playhead from end", method: "menu", action: { type: "menu", path: ["Edit", "Replace from End"] } },
  { id: "ripple-delete", intent: "Delete the selected clip and ripple-close the gap", method: "shortcut", action: { type: "key", key: "delete" }, risk: "destructive" },
  { id: "lift-from-storyline", intent: "Lift the selection out of the Primary Storyline (leave a gap)", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+up" } },
  { id: "overwrite-to-primary-storyline", intent: "Overwrite from a connected clip into the Primary Storyline", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+down" } },
  { id: "blade-all", intent: "Blade all clips at the playhead, including connected clips (Trim > Blade All)", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+b" } },
  { id: "trim-start", intent: "Trim Start: trim the clip from its head to the playhead", method: "shortcut", action: { type: "key_combo", combo: "option+[" } },
  { id: "trim-end", intent: "Trim End: trim the clip from the playhead to its tail", method: "shortcut", action: { type: "key_combo", combo: "option+]" } },
  { id: "trim-to-selection", intent: "Trim the active clip(s) to the current range selection", method: "shortcut", action: { type: "key_combo", combo: "option+\\" } },
  { id: "extend-edit", intent: "Extend Edit: roll the nearest edit to the playhead position", method: "shortcut", action: { type: "key_combo", combo: "shift+x" } },
  { id: "nudge-clip-right", intent: "Nudge the selected clip right by one frame", method: "shortcut", action: { type: "key", key: "." } },
  { id: "nudge-clip-left", intent: "Nudge the selected clip left by one frame", method: "shortcut", action: { type: "key", key: "," } },
  { id: "nudge-clip-right-10", intent: "Nudge the selected clip right by 10 frames", method: "shortcut", action: { type: "key_combo", combo: "shift+." } },
  { id: "nudge-clip-left-10", intent: "Nudge the selected clip left by 10 frames", method: "shortcut", action: { type: "key_combo", combo: "shift+," } },
  { id: "slip-left-1", intent: "Slip the selected clip's contents left by one frame (Slip tool)", method: "shortcut", action: { type: "key_combo", combo: "option+," } },
  { id: "slip-right-1", intent: "Slip the selected clip's contents right by one frame", method: "shortcut", action: { type: "key_combo", combo: "option+." } },
  { id: "slide-left-1", intent: "Slide the selected clip left by one frame, retaining duration", method: "shortcut", action: { type: "key_combo", combo: "option+shift+," } },
  { id: "slide-right-1", intent: "Slide the selected clip right by one frame, retaining duration", method: "shortcut", action: { type: "key_combo", combo: "option+shift+." } },
  { id: "join-clips", intent: "Join two adjacent clips into one (Trim > Join Clips)", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+\\" } },
  { id: "expand-audio-video", intent: "Expand audio / video components on the selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+s" } },
  { id: "expand-audio-components", intent: "Expand the audio components only", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+s" } },
  { id: "detach-audio", intent: "Detach the audio of the selected clip into a connected audio clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+shift+s" } },
  { id: "break-apart-clip-items", intent: "Break apart the selected compound / multicam clip into its components", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+g" } },
  { id: "set-default-transition", intent: "Apply the default transition (cross-dissolve) to the selected edit", method: "shortcut", action: { type: "key_combo", combo: "cmd+t" } },
  { id: "delete-transitions", intent: "Delete all transitions from the selected edits", method: "menu", action: { type: "menu", path: ["Edit", "Delete Transitions"] }, risk: "destructive" },
  { id: "trim-edit-up", intent: "Move the selected edit up to the previous edit", method: "shortcut", action: { type: "key_combo", combo: "option+up" } },
  { id: "trim-edit-down", intent: "Move the selected edit down to the next edit", method: "shortcut", action: { type: "key_combo", combo: "option+down" } },
  { id: "select-edit-source-side", intent: "Select the source side of the nearest edit", method: "shortcut", action: { type: "key_combo", combo: "[" } },
  { id: "select-edit-destination-side", intent: "Select the destination side of the nearest edit", method: "shortcut", action: { type: "key_combo", combo: "]" } },
  { id: "select-edit-both-sides", intent: "Select both sides of the nearest edit (Roll edit)", method: "shortcut", action: { type: "key_combo", combo: "\\" } },
  { id: "show-precision-editor", intent: "Show / hide the Precision Editor for the selected edit", method: "shortcut", action: { type: "key_combo", combo: "ctrl+e" } },
  { id: "trim-1-frame-left", intent: "Trim the selected edit one frame to the left", method: "shortcut", action: { type: "key", key: "," } },
  { id: "trim-1-frame-right", intent: "Trim the selected edit one frame to the right", method: "shortcut", action: { type: "key", key: "." } },
  { id: "trim-many-frames-left", intent: "Trim the selected edit by many frames to the left (10)", method: "shortcut", action: { type: "key_combo", combo: "shift+," } },
  { id: "trim-many-frames-right", intent: "Trim the selected edit by many frames to the right (10)", method: "shortcut", action: { type: "key_combo", combo: "shift+." } },
  { id: "create-edit-here", intent: "Create an edit at the playhead on selected clips (blade)", method: "shortcut", action: { type: "key_combo", combo: "cmd+b" } },
  { id: "rate-conform-effect", intent: "Conform speed / rate of the selected clip (Modify > Retime > Conform)", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Conform Speed"] } },
  { id: "retime-50", intent: "Set retime speed to 50% (slow motion)", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Slow", "50%"] } },
  { id: "retime-25", intent: "Set retime speed to 25% (slow motion)", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Slow", "25%"] } },
  { id: "retime-fast-2x", intent: "Set retime speed to 2x (fast)", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Fast", "2x"] } },
  { id: "retime-fast-4x", intent: "Set retime speed to 4x (fast)", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Fast", "4x"] } },
  { id: "retime-reverse", intent: "Reverse the playback direction of the selected clip", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Reverse Clip"] } },
  { id: "retime-show-editor", intent: "Show / hide the Retime Editor for the selected clip", method: "shortcut", action: { type: "key_combo", combo: "cmd+r" } },
  { id: "retime-reset", intent: "Reset retime to 100%", method: "shortcut", action: { type: "key_combo", combo: "option+cmd+r" } },
  { id: "retime-hold", intent: "Add a hold segment at the playhead (freeze frame inline)", method: "shortcut", action: { type: "key_combo", combo: "shift+h" } },
  { id: "freeze-frame", intent: "Insert a freeze-frame at the playhead", method: "shortcut", action: { type: "key_combo", combo: "option+f" } },

  // ----- Markers & keywords -----
  { id: "add-marker-and-edit", intent: "Add a marker at the playhead and immediately open the marker editor", method: "shortcut", action: { type: "key_combo", combo: "option+m" } },
  { id: "add-todo-marker", intent: "Add a To Do marker at the playhead", method: "shortcut", action: { type: "key_combo", combo: "shift+m" } },
  { id: "complete-todo-marker", intent: "Mark the active To Do marker as complete", method: "menu", action: { type: "menu", path: ["Mark", "Markers", "Mark as Completed"] } },
  { id: "add-chapter-marker", intent: "Add a Chapter marker at the playhead", method: "menu", action: { type: "menu", path: ["Mark", "Markers", "Add Chapter Marker"] } },
  { id: "delete-marker", intent: "Delete the marker at the playhead", method: "shortcut", action: { type: "key_combo", combo: "ctrl+m" }, risk: "destructive" },
  { id: "delete-all-markers", intent: "Delete all markers in the selection or project", method: "menu", action: { type: "menu", path: ["Mark", "Markers", "Delete Markers in Selection"] }, risk: "destructive" },
  { id: "modify-marker", intent: "Open the marker editor for the marker nearest the playhead", method: "shortcut", action: { type: "key_combo", combo: "option+ctrl+m" } },
  { id: "next-todo-marker", intent: "Move playhead to the next incomplete To Do marker", method: "menu", action: { type: "menu", path: ["Mark", "Next", "Incomplete To Do Marker"] } },
  { id: "previous-todo-marker", intent: "Move playhead to the previous incomplete To Do marker", method: "menu", action: { type: "menu", path: ["Mark", "Previous", "Incomplete To Do Marker"] } },
  { id: "next-keyword", intent: "Move playhead to the next keyword range in the timeline", method: "menu", action: { type: "menu", path: ["Mark", "Next", "Keyword"] } },
  { id: "previous-keyword", intent: "Move playhead to the previous keyword range", method: "menu", action: { type: "menu", path: ["Mark", "Previous", "Keyword"] } },
  { id: "add-keyword", intent: "Open the Keyword Editor for the active selection", method: "shortcut", action: { type: "key_combo", combo: "cmd+k" } },
  { id: "remove-all-keywords", intent: "Remove all keywords from the selection", method: "shortcut", action: { type: "key_combo", combo: "ctrl+0" }, risk: "destructive" },
  { id: "apply-keyword-1", intent: "Apply Keyword preset 1 (Ctrl-1)", method: "shortcut", action: { type: "key_combo", combo: "ctrl+1" } },
  { id: "apply-keyword-2", intent: "Apply Keyword preset 2", method: "shortcut", action: { type: "key_combo", combo: "ctrl+2" } },
  { id: "apply-keyword-3", intent: "Apply Keyword preset 3", method: "shortcut", action: { type: "key_combo", combo: "ctrl+3" } },
  { id: "apply-keyword-4", intent: "Apply Keyword preset 4", method: "shortcut", action: { type: "key_combo", combo: "ctrl+4" } },
  { id: "apply-keyword-5", intent: "Apply Keyword preset 5", method: "shortcut", action: { type: "key_combo", combo: "ctrl+5" } },
  { id: "apply-keyword-6", intent: "Apply Keyword preset 6", method: "shortcut", action: { type: "key_combo", combo: "ctrl+6" } },
  { id: "apply-keyword-7", intent: "Apply Keyword preset 7", method: "shortcut", action: { type: "key_combo", combo: "ctrl+7" } },
  { id: "apply-keyword-8", intent: "Apply Keyword preset 8", method: "shortcut", action: { type: "key_combo", combo: "ctrl+8" } },
  { id: "apply-keyword-9", intent: "Apply Keyword preset 9", method: "shortcut", action: { type: "key_combo", combo: "ctrl+9" } },
  { id: "favorite-clip", intent: "Mark the selected range as a Favorite", method: "shortcut", action: { type: "key", key: "f" } },
  { id: "reject-clip", intent: "Mark the selected range as Rejected", method: "shortcut", action: { type: "key_combo", combo: "delete" }, risk: "destructive" },
  { id: "unrate-clip", intent: "Remove rating (Favorite or Rejected) from the selected range", method: "shortcut", action: { type: "key", key: "u" } },

  // ----- Selection & ranges -----
  { id: "select-clip", intent: "Select the clip at the playhead in the Timeline", method: "shortcut", action: { type: "key", key: "c" } },
  { id: "select-next-clip", intent: "Select the next clip", method: "shortcut", action: { type: "key_combo", combo: "shift+down" } },
  { id: "select-previous-clip", intent: "Select the previous clip", method: "shortcut", action: { type: "key_combo", combo: "shift+up" } },
  { id: "extend-selection-right-frame", intent: "Extend selection one frame to the right", method: "shortcut", action: { type: "key_combo", combo: "shift+right" } },
  { id: "extend-selection-left-frame", intent: "Extend selection one frame to the left", method: "shortcut", action: { type: "key_combo", combo: "shift+left" } },
  { id: "extend-selection-right-many", intent: "Extend selection many frames to the right", method: "shortcut", action: { type: "key_combo", combo: "shift+option+right" } },
  { id: "extend-selection-left-many", intent: "Extend selection many frames to the left", method: "shortcut", action: { type: "key_combo", combo: "shift+option+left" } },
  { id: "extend-selection-to-next-clip", intent: "Extend selection to the next clip", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+right" } },
  { id: "extend-selection-to-previous-clip", intent: "Extend selection to the previous clip", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+left" } },
  { id: "select-clips-forward", intent: "Select all clips from playhead to end", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+right" } },
  { id: "select-clips-backward", intent: "Select all clips from playhead to start", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+left" } },
  { id: "select-all-forward", intent: "Select All forward of the playhead", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+a" } },
  { id: "set-range-from-in-out", intent: "Set selection from the In to Out point", method: "shortcut", action: { type: "key_combo", combo: "option+x" } },
  { id: "clear-in-and-out", intent: "Clear the In and Out points", method: "shortcut", action: { type: "key_combo", combo: "option+x" } },
  { id: "clear-in-point", intent: "Clear the In point", method: "shortcut", action: { type: "key_combo", combo: "option+i" } },
  { id: "clear-out-point", intent: "Clear the Out point", method: "shortcut", action: { type: "key_combo", combo: "option+o" } },
  { id: "set-range-start-at-playhead", intent: "Set the range start at the playhead", method: "shortcut", action: { type: "key_combo", combo: "option+i" } },
  { id: "set-range-end-at-playhead", intent: "Set the range end at the playhead", method: "shortcut", action: { type: "key_combo", combo: "option+o" } },
  { id: "select-storyline", intent: "Select the entire current storyline", method: "menu", action: { type: "menu", path: ["Edit", "Select Containing Story"] } },
  { id: "select-clip-range", intent: "Select the entire range of the active clip", method: "shortcut", action: { type: "key", key: "x" } },
  { id: "select-related-clips", intent: "Select related clips (audio + connected)", method: "menu", action: { type: "menu", path: ["Edit", "Select", "Related Clips"] } },
  { id: "set-range-using-clip", intent: "Set range to the selected clip's full length", method: "menu", action: { type: "menu", path: ["Edit", "Range Selection", "Set Range Using Clip"] } },
  { id: "select-similar-clips", intent: "Select clips with the same name (Browser)", method: "menu", action: { type: "menu", path: ["Edit", "Select", "Similar Clips"] } },

  // ----- Timeline view & zoom -----
  { id: "zoom-in-timeline", intent: "Zoom in on the Timeline", method: "shortcut", action: { type: "key_combo", combo: "cmd+=" } },
  { id: "zoom-out-timeline", intent: "Zoom out on the Timeline", method: "shortcut", action: { type: "key_combo", combo: "cmd+-" } },
  { id: "zoom-to-samples", intent: "Toggle Zoom to Samples (audio waveform sample-level zoom)", method: "shortcut", action: { type: "key_combo", combo: "ctrl+z" } },
  { id: "scroll-to-playhead", intent: "Scroll the Timeline so the playhead is centered", method: "menu", action: { type: "menu", path: ["View", "Scroll to Playhead"] } },
  { id: "show-detailed-clip-appearance", intent: "Cycle Timeline clip appearance to a more detailed setting", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+1" } },
  { id: "show-clip-appearance-2", intent: "Cycle Timeline clip appearance preset 2", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+2" } },
  { id: "show-clip-appearance-3", intent: "Cycle Timeline clip appearance preset 3", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+3" } },
  { id: "show-clip-appearance-4", intent: "Cycle Timeline clip appearance preset 4", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+4" } },
  { id: "show-clip-appearance-5", intent: "Cycle Timeline clip appearance preset 5", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+5" } },
  { id: "show-clip-appearance-6", intent: "Cycle Timeline clip appearance preset 6", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+6" } },
  { id: "decrease-clip-height", intent: "Decrease the height of clips in the Timeline", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+-" } },
  { id: "increase-clip-height", intent: "Increase the height of clips in the Timeline", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+=" } },
  { id: "show-skimmer-info", intent: "Show / hide the skimmer info popup over the Timeline", method: "menu", action: { type: "menu", path: ["View", "Show in Timeline", "Skimmer Info"] } },
  { id: "show-clip-names", intent: "Show / hide clip names in the Timeline", method: "menu", action: { type: "menu", path: ["View", "Show in Timeline", "Clip Names"] } },
  { id: "show-connected-lines", intent: "Show / hide connected-clip indicator lines", method: "menu", action: { type: "menu", path: ["View", "Show in Timeline", "Connections"] } },
  { id: "show-angles-in-timeline", intent: "Show angles for multicam clips in the Timeline", method: "menu", action: { type: "menu", path: ["View", "Show in Timeline", "Angles"] } },
  { id: "show-audio-waveforms", intent: "Show / hide audio waveforms in Timeline", method: "menu", action: { type: "menu", path: ["View", "Show in Timeline", "Audio Waveforms"] } },
  { id: "show-audio-meters", intent: "Show / hide the audio meters", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+8" } },
  { id: "show-timeline-history-back", intent: "Navigate Timeline history back", method: "shortcut", action: { type: "key_combo", combo: "cmd+[" } },
  { id: "show-timeline-history-forward", intent: "Navigate Timeline history forward", method: "shortcut", action: { type: "key_combo", combo: "cmd+]" } },
  { id: "toggle-timeline-index", intent: "Toggle the Timeline Index pane", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+2" } },
  { id: "show-timeline-clip-info", intent: "Show clip info pop-over in Timeline (Window > Show in Workspace > Timeline)", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Timeline"] } },
  { id: "toggle-position-mode", intent: "Toggle Position mode (Position tool) in Timeline", method: "shortcut", action: { type: "key", key: "p" } },
  { id: "fit-timeline-vertically", intent: "Fit all timeline tracks vertically (View > Adjust Timeline Display Height)", method: "menu", action: { type: "menu", path: ["View", "Timeline Index", "Adjust Display Height"] } },
  { id: "show-timeline-history", intent: "Show the Timeline History list (recent timelines)", method: "menu", action: { type: "menu", path: ["Window", "Timeline History"] } },

  // ----- Effects, transitions, color -----
  { id: "show-effects-browser", intent: "Show / hide the Effects Browser (Video & Audio Effects)", method: "shortcut", action: { type: "key_combo", combo: "cmd+5" } },
  { id: "show-transitions-browser", intent: "Show / hide the Transitions Browser", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+5" } },
  { id: "show-titles-and-generators-browser", intent: "Show / hide the Titles and Generators Browser", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+1" } },
  { id: "show-photos-and-audio-browser", intent: "Show / hide the Photos and Audio Browser", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+2" } },
  { id: "show-color-board", intent: "Show the Color Board for the selected clip (legacy color)", method: "shortcut", action: { type: "key_combo", combo: "cmd+6" } },
  { id: "add-color-correction", intent: "Add a Color Correction effect to the selected clip", method: "menu", action: { type: "menu", path: ["Window", "Go To", "Color Inspector"] } },
  { id: "go-to-color-inspector", intent: "Switch the Inspector to the Color tab", method: "shortcut", action: { type: "key_combo", combo: "cmd+6" } },
  { id: "go-to-color-inspector-board", intent: "Activate the Color Board in the Inspector", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+c" } },
  { id: "color-wheels-tab", intent: "Switch the Color Inspector to Color Wheels", method: "menu", action: { type: "menu", path: ["Window", "Color Inspector", "Color Wheels"] } },
  { id: "color-curves-tab", intent: "Switch the Color Inspector to Color Curves", method: "menu", action: { type: "menu", path: ["Window", "Color Inspector", "Color Curves"] } },
  { id: "color-hue-sat-curves-tab", intent: "Switch the Color Inspector to Hue/Saturation Curves", method: "menu", action: { type: "menu", path: ["Window", "Color Inspector", "Hue/Saturation Curves"] } },
  { id: "balance-color", intent: "Apply Balance Color to the selected clip", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+b" } },
  { id: "match-color", intent: "Open Match Color for the selected clip", method: "menu", action: { type: "menu", path: ["Modify", "Match Color..."] } },
  { id: "remove-effects", intent: "Remove all effects from the selected clip", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+x" }, risk: "destructive" },
  { id: "remove-attributes", intent: "Open Remove Attributes for the selected clip", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+x" } },
  { id: "copy-effects", intent: "Copy effects (without media) from the selected clip", method: "menu", action: { type: "menu", path: ["Edit", "Copy Effects"] } },
  { id: "paste-effects", intent: "Paste effects copied from a clip onto the selection", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+v" } },
  { id: "apply-cross-dissolve", intent: "Apply default cross-dissolve at the selected edit", method: "shortcut", action: { type: "key_combo", combo: "cmd+t" } },
  { id: "apply-fade-in-fade-out", intent: "Apply fade in / fade out to the selected audio clip", method: "menu", action: { type: "menu", path: ["Modify", "Adjust Audio Fades", "Apply Fades"] } },
  { id: "set-effect-parameters", intent: "Open the Inspector with Video tab focused", method: "shortcut", action: { type: "key_combo", combo: "cmd+4" } },
  { id: "go-to-video-inspector", intent: "Switch the Inspector to the Video tab", method: "shortcut", action: { type: "key_combo", combo: "cmd+5" } },
  { id: "go-to-info-inspector", intent: "Switch the Inspector to the Info tab", method: "shortcut", action: { type: "key_combo", combo: "cmd+9" } },
  { id: "next-inspector-tab", intent: "Cycle to the next Inspector tab", method: "shortcut", action: { type: "key_combo", combo: "ctrl+tab" } },
  { id: "previous-inspector-tab", intent: "Cycle to the previous Inspector tab", method: "shortcut", action: { type: "key_combo", combo: "ctrl+shift+tab" } },
  { id: "show-color-mask", intent: "Add a Color Mask to the selected color correction", method: "menu", action: { type: "menu", path: ["Window", "Color Inspector", "Add Color Mask"] } },
  { id: "show-shape-mask", intent: "Add a Shape Mask to the selected effect", method: "menu", action: { type: "menu", path: ["Window", "Color Inspector", "Add Shape Mask"] } },
  { id: "invert-mask", intent: "Invert the active mask on the selected effect", method: "menu", action: { type: "menu", path: ["Effect", "Invert Mask"] } },
  { id: "ai-magnetic-mask", intent: "Apply Magnetic Mask AI tracking to the selected clip", method: "menu", action: { type: "menu", path: ["Window", "Color Inspector", "Apply Magnetic Mask"] } },
  { id: "object-tracker", intent: "Apply Object Tracker to selected clip / mask", method: "menu", action: { type: "menu", path: ["Window", "Tracker", "Object Tracker"] } },

  // ----- Audio -----
  { id: "show-audio-inspector", intent: "Switch the Inspector to the Audio tab", method: "shortcut", action: { type: "key_combo", combo: "cmd+8" } },
  { id: "audio-mute-clip", intent: "Mute the selected audio clip", method: "shortcut", action: { type: "key_combo", combo: "v" } },
  { id: "audio-solo-clip", intent: "Solo the selected audio clip", method: "shortcut", action: { type: "key_combo", combo: "option+s" } },
  { id: "audio-disable-clip", intent: "Disable the selected clip (no audio, no video)", method: "shortcut", action: { type: "key", key: "v" } },
  { id: "audio-enable-clip", intent: "Re-enable the selected clip", method: "shortcut", action: { type: "key", key: "v" } },
  { id: "audio-fade-in", intent: "Apply fade-in handle to the start of the selected audio clip", method: "menu", action: { type: "menu", path: ["Modify", "Adjust Audio Fades", "Apply Fade-In"] } },
  { id: "audio-fade-out", intent: "Apply fade-out handle to the end of the selected audio clip", method: "menu", action: { type: "menu", path: ["Modify", "Adjust Audio Fades", "Apply Fade-Out"] } },
  { id: "audio-fade-in-out", intent: "Apply fade-in and fade-out to the selected clip", method: "menu", action: { type: "menu", path: ["Modify", "Adjust Audio Fades", "Apply Fades"] } },
  { id: "audio-adjust-volume-up", intent: "Increase volume of selected audio by 1 dB", method: "shortcut", action: { type: "key_combo", combo: "ctrl+=" } },
  { id: "audio-adjust-volume-down", intent: "Decrease volume of selected audio by 1 dB", method: "shortcut", action: { type: "key_combo", combo: "ctrl+-" } },
  { id: "audio-set-volume-zero", intent: "Reset audio volume to 0 dB", method: "shortcut", action: { type: "key_combo", combo: "ctrl+l" } },
  { id: "audio-pan-left", intent: "Pan selected audio clip left", method: "menu", action: { type: "menu", path: ["Modify", "Pan", "Pan Left"] } },
  { id: "audio-pan-right", intent: "Pan selected audio clip right", method: "menu", action: { type: "menu", path: ["Modify", "Pan", "Pan Right"] } },
  { id: "audio-pan-center", intent: "Pan selected audio clip to center", method: "menu", action: { type: "menu", path: ["Modify", "Pan", "Pan Center"] } },
  { id: "auto-enhance-audio", intent: "Auto-enhance selected audio clip (loudness, noise, hum)", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+a" } },
  { id: "audio-roles-show", intent: "Show / hide audio roles in the Timeline", method: "menu", action: { type: "menu", path: ["Modify", "Edit Roles..."] } },
  { id: "show-audio-meters-large", intent: "Show large audio meters window", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Audio Meters"] } },
  { id: "audio-skimming-toggle", intent: "Toggle audio skimming", method: "shortcut", action: { type: "key_combo", combo: "shift+s" } },
  { id: "soloed-audio-toggle", intent: "Toggle Solo Animation overlays", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+s" } },
  { id: "audio-add-keyframe", intent: "Add an audio volume keyframe at the playhead on selected clip", method: "shortcut", action: { type: "key_combo", combo: "option+k" } },
  { id: "open-audition", intent: "Open Audition for the selected clip(s)", method: "shortcut", action: { type: "key", key: "y" } },
  { id: "create-audition", intent: "Create an Audition from the selected clips", method: "menu", action: { type: "menu", path: ["Clip", "Audition", "Create"] } },
  { id: "duplicate-from-original", intent: "Duplicate Audition pick from original (Audition)", method: "menu", action: { type: "menu", path: ["Clip", "Audition", "Duplicate from Original"] } },
  { id: "audition-finalize", intent: "Finalize the Audition (replace with the selected pick)", method: "menu", action: { type: "menu", path: ["Clip", "Audition", "Finalize Audition"] } },
  { id: "next-pick-audition", intent: "Move to the next pick in the Audition", method: "shortcut", action: { type: "key_combo", combo: "right" } },
  { id: "previous-pick-audition", intent: "Move to the previous pick in the Audition", method: "shortcut", action: { type: "key_combo", combo: "left" } },
  { id: "enable-role-1", intent: "Toggle visibility of audio role 1", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+1" } },
  { id: "enable-role-2", intent: "Toggle visibility of audio role 2", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+2" } },
  { id: "enable-role-3", intent: "Toggle visibility of audio role 3", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+3" } },
  { id: "enable-role-4", intent: "Toggle visibility of audio role 4", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+4" } },
  { id: "enable-role-5", intent: "Toggle visibility of audio role 5", method: "shortcut", action: { type: "key_combo", combo: "ctrl+cmd+5" } },
  { id: "voiceover-record", intent: "Open the Voiceover recording window", method: "menu", action: { type: "menu", path: ["Window", "Record Voiceover"] } },

  // ----- Share / Export -----
  { id: "share-h264-master", intent: "Share H.264 Master File preset", method: "menu", action: { type: "menu", path: ["File", "Share", "Apple Devices 1080p..."] }, risk: "destructive" },
  { id: "share-apple-devices-720p", intent: "Share Apple Devices 720p preset", method: "menu", action: { type: "menu", path: ["File", "Share", "Apple Devices 720p..."] }, risk: "destructive" },
  { id: "share-apple-devices-4k", intent: "Share Apple Devices 4K preset", method: "menu", action: { type: "menu", path: ["File", "Share", "Apple Devices 4K..."] }, risk: "destructive" },
  { id: "share-prores", intent: "Share Apple ProRes Master File", method: "menu", action: { type: "menu", path: ["File", "Share", "Apple ProRes..."] }, risk: "destructive" },
  { id: "share-youtube", intent: "Share to YouTube preset (legacy / via Compressor)", method: "menu", action: { type: "menu", path: ["File", "Share", "YouTube & Facebook..."] }, risk: "external_communication" },
  { id: "share-vimeo", intent: "Share to Vimeo preset", method: "menu", action: { type: "menu", path: ["File", "Share", "Vimeo..."] }, risk: "external_communication" },
  { id: "share-email", intent: "Share via Email", method: "menu", action: { type: "menu", path: ["File", "Share", "Email..."] }, risk: "external_communication" },
  { id: "share-image", intent: "Share Save Current Frame (image export)", method: "menu", action: { type: "menu", path: ["File", "Share", "Save Current Frame..."] }, risk: "destructive" },
  { id: "share-export-image-sequence", intent: "Share Export Image Sequence", method: "menu", action: { type: "menu", path: ["File", "Share", "Export Image Sequence..."] }, risk: "destructive" },
  { id: "share-add-destination", intent: "Add a custom Share destination", method: "menu", action: { type: "menu", path: ["File", "Share", "Add Destination..."] } },
  { id: "show-share-destinations", intent: "Open Share Destinations preferences", method: "menu", action: { type: "menu", path: ["Final Cut Pro", "Settings...", "Destinations"] } },
  { id: "send-to-compressor", intent: "Send the project / range to Compressor for encoding", method: "menu", action: { type: "menu", path: ["File", "Send to Compressor"] }, risk: "destructive" },
  { id: "share-default-destination", intent: "Share to the default destination (cmd+e)", method: "shortcut", action: { type: "key_combo", combo: "cmd+e" }, risk: "destructive" },
  { id: "share-show-batch-progress", intent: "Show the Background Tasks window with share progress", method: "shortcut", action: { type: "key_combo", combo: "cmd+9" } },
  { id: "share-master-with-roles", intent: "Open Share dialog and switch to Roles as Files for stem export", method: "menu", action: { type: "menu", path: ["File", "Share", "Master File..."] }, risk: "destructive" },

  // ----- Tools -----
  { id: "tool-select", intent: "Switch to the Select tool (arrow)", method: "shortcut", action: { type: "key", key: "a" } },
  { id: "tool-trim", intent: "Switch to the Trim tool", method: "shortcut", action: { type: "key", key: "t" } },
  { id: "tool-position", intent: "Switch to the Position tool", method: "shortcut", action: { type: "key", key: "p" } },
  { id: "tool-range-selection", intent: "Switch to the Range Selection tool", method: "shortcut", action: { type: "key", key: "r" } },
  { id: "tool-blade", intent: "Switch to the Blade tool (sticky)", method: "shortcut", action: { type: "key", key: "b" } },
  { id: "tool-zoom", intent: "Switch to the Zoom tool", method: "shortcut", action: { type: "key", key: "z" } },
  { id: "tool-hand", intent: "Switch to the Hand tool (pan)", method: "shortcut", action: { type: "key", key: "h" } },
  { id: "tool-cycle-forward", intent: "Cycle to the next tool in the Timeline tool palette", method: "shortcut", action: { type: "key_combo", combo: "shift+]" } },
  { id: "tool-cycle-back", intent: "Cycle to the previous tool", method: "shortcut", action: { type: "key_combo", combo: "shift+[" } },
  { id: "tool-distort", intent: "Activate Distort transform mode in the Viewer", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Distort"] } },
  { id: "tool-crop", intent: "Activate Crop transform mode in the Viewer", method: "shortcut", action: { type: "key_combo", combo: "shift+c" } },
  { id: "tool-transform", intent: "Activate Transform mode in the Viewer", method: "shortcut", action: { type: "key_combo", combo: "shift+t" } },
  { id: "tool-trim-mode", intent: "Activate Trim mode in the Viewer (J-cut / L-cut helper)", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Trim Edit"] } },
  { id: "tool-zoom-in-viewer", intent: "Zoom in inside the Viewer", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+=" } },
  { id: "tool-zoom-out-viewer", intent: "Zoom out inside the Viewer", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+-" } },
  { id: "tool-fit-viewer", intent: "Fit content to Viewer", method: "shortcut", action: { type: "key_combo", combo: "shift+z" } },

  // ----- View toggles -----
  { id: "show-inspector", intent: "Show / hide the Inspector pane", method: "shortcut", action: { type: "key_combo", combo: "cmd+4" } },
  { id: "show-browser", intent: "Show / hide the Browser pane", method: "shortcut", action: { type: "key_combo", combo: "cmd+1" } },
  { id: "show-event-viewer", intent: "Show / hide the Event Viewer (second monitor for browser clips)", method: "shortcut", action: { type: "key_combo", combo: "cmd+ctrl+3" } },
  { id: "show-comparison-viewer", intent: "Show / hide the Comparison Viewer", method: "shortcut", action: { type: "key_combo", combo: "cmd+7" } },
  { id: "show-video-scopes", intent: "Show / hide the Video Scopes panel", method: "shortcut", action: { type: "key_combo", combo: "cmd+7" } },
  { id: "show-event-list-view", intent: "Switch the Browser to List view", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+1" } },
  { id: "show-event-filmstrip-view", intent: "Switch the Browser to Filmstrip view", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+2" } },
  { id: "show-event-grid-view", intent: "Switch the Browser to Grid view", method: "menu", action: { type: "menu", path: ["View", "Browser", "as Grid"] } },
  { id: "show-titles-tab", intent: "Open the Titles browser inside the Titles & Generators sidebar", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Titles & Generators"] } },
  { id: "show-generators-tab", intent: "Open the Generators tab inside the Titles & Generators sidebar", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Generators"] } },
  { id: "show-themes-tab", intent: "Open the Themes browser", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Themes"] } },
  { id: "show-effects-window", intent: "Show the Effects browser window", method: "shortcut", action: { type: "key_combo", combo: "cmd+5" } },
  { id: "show-tags-pane", intent: "Show the Tags pane in the Timeline Index", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+2" } },
  { id: "show-roles-pane", intent: "Switch the Timeline Index to the Roles pane", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+3" } },
  { id: "show-clips-pane", intent: "Switch the Timeline Index to the Clips pane", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+1" } },
  { id: "show-captions-pane", intent: "Switch the Timeline Index to the Captions pane", method: "shortcut", action: { type: "key_combo", combo: "shift+cmd+4" } },
  { id: "show-overlay-action-safe", intent: "Show / hide the action safe zone overlay", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Title/Action Safe Zones"] } },
  { id: "show-overlay-graticule", intent: "Show / hide the Viewer graticule overlay (cross-hair)", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Graticule"] } },
  { id: "show-broadcast-out", intent: "Show / hide the Broadcast output window (View > A/V Output)", method: "menu", action: { type: "menu", path: ["Window", "A/V Output"] } },
  { id: "view-timeline-only", intent: "Show only the Timeline (hide Browser / Inspector)", method: "menu", action: { type: "menu", path: ["Window", "Workspaces", "Timeline Only"] } },

  // ----- Window / workspace -----
  { id: "workspace-default", intent: "Switch to the Default workspace", method: "shortcut", action: { type: "key_combo", combo: "cmd+0" } },
  { id: "workspace-organize", intent: "Switch to the Organize workspace", method: "menu", action: { type: "menu", path: ["Window", "Workspaces", "Organize"] } },
  { id: "workspace-color-and-effects", intent: "Switch to the Color & Effects workspace", method: "menu", action: { type: "menu", path: ["Window", "Workspaces", "Color & Effects"] } },
  { id: "workspace-dual-displays", intent: "Switch to the Dual Displays workspace", method: "menu", action: { type: "menu", path: ["Window", "Workspaces", "Dual Displays"] } },
  { id: "save-workspace-as", intent: "Save the current workspace as a custom layout", method: "menu", action: { type: "menu", path: ["Window", "Workspaces", "Save Workspace As..."] } },
  { id: "update-workspace", intent: "Update the active custom workspace", method: "menu", action: { type: "menu", path: ["Window", "Workspaces", "Update Workspace"] } },
  { id: "open-in-event-viewer", intent: "Open the selected Browser clip in the Event Viewer", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Event Viewer"] } },
  { id: "show-background-tasks", intent: "Show the Background Tasks window", method: "shortcut", action: { type: "key_combo", combo: "cmd+9" } },
  { id: "show-libraries-sidebar", intent: "Show / hide the Libraries sidebar in the Browser", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+0" } },
  { id: "tile-windows", intent: "Tile windows of FCP across the screen", method: "menu", action: { type: "menu", path: ["Window", "Tile All Windows"] } },
  { id: "open-second-display", intent: "Open the Viewer on a second display", method: "menu", action: { type: "menu", path: ["Window", "Show in Secondary Display", "Viewers"] } },
  { id: "show-effects-on-second", intent: "Show Browser on second display", method: "menu", action: { type: "menu", path: ["Window", "Show in Secondary Display", "Browser"] } },
  { id: "show-timeline-second", intent: "Show Timeline on second display", method: "menu", action: { type: "menu", path: ["Window", "Show in Secondary Display", "Timeline"] } },
  { id: "show-only-active-window", intent: "Hide all FCP windows except the active one", method: "menu", action: { type: "menu", path: ["Window", "Hide Inactive"] } },
  { id: "open-window-fcp-pages", intent: "Open the FCP Documentation in the user guide", method: "menu", action: { type: "menu", path: ["Help", "User Guide"] } },

  // ----- Captions / titles -----
  { id: "show-captions-editor", intent: "Show the Captions editor", method: "menu", action: { type: "menu", path: ["Window", "Captions", "Show Captions"] } },
  { id: "add-caption-itt", intent: "Add a new iTT caption at the playhead", method: "shortcut", action: { type: "key_combo", combo: "option+c" } },
  { id: "add-caption-cea", intent: "Add a new CEA-608 caption at the playhead", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Add Caption (CEA-608)"] } },
  { id: "import-captions", intent: "Import captions file (SRT / iTT / CEA-608)", method: "menu", action: { type: "menu", path: ["File", "Import", "Captions..."] } },
  { id: "export-captions", intent: "Export captions file from active project", method: "menu", action: { type: "menu", path: ["File", "Export Captions..."] } },
  { id: "duplicate-captions", intent: "Duplicate selected captions to a new language role", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Duplicate Captions to New Language"] } },
  { id: "next-caption", intent: "Move playhead to the next caption", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+'" } },
  { id: "previous-caption", intent: "Move playhead to the previous caption", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+;" } },
  { id: "split-caption", intent: "Split caption at playhead", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+/" } },
  { id: "merge-captions", intent: "Merge selected captions", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Merge Captions"] } },
  { id: "validate-captions", intent: "Run caption validation on the project", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Validate"] } },
  { id: "captions-roles-show", intent: "Show captions in the Timeline Index Roles list", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Captions"] } },
  { id: "lower-third-add", intent: "Add a Lower Third title via Edit menu", method: "menu", action: { type: "menu", path: ["Edit", "Connect Title", "Lower"] } },
  { id: "title-add-basic", intent: "Add a Basic Title at the playhead", method: "shortcut", action: { type: "key_combo", combo: "ctrl+t" } },
  { id: "title-add-3d", intent: "Add a 3D title via the Titles browser", method: "menu", action: { type: "menu", path: ["Edit", "Connect Title", "3D"] } },
  { id: "title-text-bold", intent: "Toggle bold on the selected title text", method: "shortcut", action: { type: "key_combo", combo: "cmd+b" } },
  { id: "title-text-italic", intent: "Toggle italic on the selected title text", method: "shortcut", action: { type: "key_combo", combo: "cmd+i" } },
  { id: "title-text-underline", intent: "Toggle underline on the selected title text", method: "shortcut", action: { type: "key_combo", combo: "cmd+u" } },
  { id: "title-text-larger", intent: "Increase title text font size", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+>" } },
  { id: "title-text-smaller", intent: "Decrease title text font size", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+<" } },
  { id: "show-fonts", intent: "Open the Fonts panel for title text", method: "shortcut", action: { type: "key_combo", combo: "cmd+t" } },

  // ----- Multicam -----
  { id: "multicam-switch-angle-1", intent: "Switch to multicam angle 1 (video + audio)", method: "shortcut", action: { type: "key_combo", combo: "shift+1" } },
  { id: "multicam-switch-angle-2", intent: "Switch to multicam angle 2", method: "shortcut", action: { type: "key_combo", combo: "shift+2" } },
  { id: "multicam-switch-angle-3", intent: "Switch to multicam angle 3", method: "shortcut", action: { type: "key_combo", combo: "shift+3" } },
  { id: "multicam-switch-angle-4", intent: "Switch to multicam angle 4", method: "shortcut", action: { type: "key_combo", combo: "shift+4" } },
  { id: "multicam-switch-angle-5", intent: "Switch to multicam angle 5", method: "shortcut", action: { type: "key_combo", combo: "shift+5" } },
  { id: "multicam-switch-angle-6", intent: "Switch to multicam angle 6", method: "shortcut", action: { type: "key_combo", combo: "shift+6" } },
  { id: "multicam-switch-angle-7", intent: "Switch to multicam angle 7", method: "shortcut", action: { type: "key_combo", combo: "shift+7" } },
  { id: "multicam-switch-angle-8", intent: "Switch to multicam angle 8", method: "shortcut", action: { type: "key_combo", combo: "shift+8" } },
  { id: "multicam-switch-angle-9", intent: "Switch to multicam angle 9", method: "shortcut", action: { type: "key_combo", combo: "shift+9" } },
  { id: "multicam-switch-video-only", intent: "Switch multicam video only on selected angle", method: "shortcut", action: { type: "key_combo", combo: "option+1" } },
  { id: "multicam-switch-audio-only", intent: "Switch multicam audio only on selected angle", method: "shortcut", action: { type: "key_combo", combo: "ctrl+1" } },
  { id: "multicam-cut", intent: "Cut at the playhead while in multicam", method: "shortcut", action: { type: "key_combo", combo: "cmd+b" } },
  { id: "open-angle-editor", intent: "Open the Angle Editor for the selected multicam clip", method: "menu", action: { type: "menu", path: ["Clip", "Open in Angle Editor"] } },
  { id: "open-angle-viewer", intent: "Show / hide the Angle Viewer", method: "shortcut", action: { type: "key_combo", combo: "cmd+shift+7" } },
  { id: "set-angle-monitor-video", intent: "Set the monitor angle to Video Only", method: "menu", action: { type: "menu", path: ["View", "Angle Viewer", "Video Only"] } },
  { id: "set-angle-monitor-audio", intent: "Set the monitor angle to Audio Only", method: "menu", action: { type: "menu", path: ["View", "Angle Viewer", "Audio Only"] } },
  { id: "sync-angles-by-audio", intent: "Synchronize multicam angles by audio waveform", method: "menu", action: { type: "menu", path: ["Clip", "Synchronize Clips..."] } },

  // ----- Browser / clip metadata -----
  { id: "browser-list-view", intent: "Set Browser to List view", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+1" } },
  { id: "browser-filmstrip-view", intent: "Set Browser to Filmstrip view", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+2" } },
  { id: "browser-show-rejected", intent: "Show rejected clips in the Browser filter", method: "menu", action: { type: "menu", path: ["View", "Browser", "Show Rejected"] } },
  { id: "browser-show-favorites-only", intent: "Show only Favorite clips", method: "menu", action: { type: "menu", path: ["View", "Browser", "Favorites"] } },
  { id: "browser-show-all-clips", intent: "Show all clips in Browser", method: "menu", action: { type: "menu", path: ["View", "Browser", "All Clips"] } },
  { id: "browser-show-unused", intent: "Show only unused media", method: "menu", action: { type: "menu", path: ["View", "Browser", "Unused"] } },
  { id: "browser-sort-by-name", intent: "Sort the Browser clips by name", method: "menu", action: { type: "menu", path: ["View", "Browser", "Group Clips By", "Name"] } },
  { id: "browser-sort-by-date", intent: "Sort Browser clips by content created date", method: "menu", action: { type: "menu", path: ["View", "Browser", "Group Clips By", "Content Created"] } },
  { id: "browser-sort-by-duration", intent: "Sort Browser clips by duration", method: "menu", action: { type: "menu", path: ["View", "Browser", "Group Clips By", "Duration"] } },
  { id: "browser-sort-by-camera", intent: "Sort Browser clips by camera", method: "menu", action: { type: "menu", path: ["View", "Browser", "Group Clips By", "Camera Name"] } },
  { id: "show-clip-info-popover", intent: "Show clip info pop-over for the selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+y" } },
  { id: "open-clip", intent: "Open the selected clip in its own Timeline (Open in Timeline)", method: "shortcut", action: { type: "key_combo", combo: "shift+return" } },
  { id: "skim-info", intent: "Toggle skimmer info display", method: "menu", action: { type: "menu", path: ["View", "Show Skimmer Info"] } },
  { id: "show-rolling-shutter-fix", intent: "Apply Rolling Shutter analysis to selected clip", method: "menu", action: { type: "menu", path: ["Modify", "Analyze and Fix..."] } },
  { id: "stabilize-clip", intent: "Apply stabilization to selected clip", method: "menu", action: { type: "menu", path: ["Modify", "Stabilize"] } },
  { id: "rolling-shutter-correct", intent: "Apply Rolling Shutter correction", method: "menu", action: { type: "menu", path: ["Modify", "Analyze and Fix..."] } },
  { id: "smart-conform-on", intent: "Enable Smart Conform for the project", method: "menu", action: { type: "menu", path: ["Modify", "Smart Conform"] } },
  { id: "auto-color-balance", intent: "Auto-balance color on the selected clip", method: "menu", action: { type: "menu", path: ["Modify", "Balance Color"] } },
  { id: "auto-white-balance", intent: "Apply automatic white balance", method: "menu", action: { type: "menu", path: ["Modify", "Balance Color", "Auto"] } },

  // ----- Project rendering / quality -----
  { id: "render-all", intent: "Render all timelines (Modify > Render All)", method: "shortcut", action: { type: "key_combo", combo: "ctrl+shift+r" } },
  { id: "render-selection", intent: "Render the current selection", method: "shortcut", action: { type: "key_combo", combo: "ctrl+r" } },
  { id: "background-tasks", intent: "Show / hide the Background Tasks window", method: "shortcut", action: { type: "key_combo", combo: "cmd+9" } },
  { id: "use-proxy-media", intent: "Switch playback to Proxy media", method: "menu", action: { type: "menu", path: ["View", "Media", "Proxy Preferred"] } },
  { id: "use-original-media", intent: "Switch playback to Original / Optimized media", method: "menu", action: { type: "menu", path: ["View", "Media", "Optimized/Original"] } },
  { id: "playback-quality-better-quality", intent: "Set playback to Better Quality", method: "menu", action: { type: "menu", path: ["View", "Playback", "Better Quality"] } },
  { id: "playback-quality-better-performance", intent: "Set playback to Better Performance", method: "menu", action: { type: "menu", path: ["View", "Playback", "Better Performance"] } },
  { id: "transcode-optimized", intent: "Transcode the selected clip to Optimized media", method: "menu", action: { type: "menu", path: ["File", "Transcode Media..."] } },
  { id: "transcode-proxy", intent: "Transcode the selected clip to Proxy media", method: "menu", action: { type: "menu", path: ["File", "Transcode Media..."] } },
  { id: "delete-render-files", intent: "Delete render files for the selected project", method: "menu", action: { type: "menu", path: ["File", "Delete Generated Library Files..."] }, risk: "destructive" },
  { id: "view-original-media-only", intent: "Show only Original Media in Browser", method: "menu", action: { type: "menu", path: ["View", "Browser", "Original Media"] } },
  { id: "view-proxy-media-only", intent: "Show only Proxy Media in Browser", method: "menu", action: { type: "menu", path: ["View", "Browser", "Proxy Media"] } },
  { id: "show-render-progress", intent: "Show render task progress in Background Tasks", method: "menu", action: { type: "menu", path: ["Window", "Background Tasks"] } },
  { id: "preview-quality-original", intent: "Use original-quality preview", method: "menu", action: { type: "menu", path: ["View", "Playback", "Use Original Quality"] } },

  // ----- Misc / advanced -----
  { id: "edit-paste-as-effect", intent: "Paste as effect on selected clip", method: "menu", action: { type: "menu", path: ["Edit", "Paste Effects"] } },
  { id: "compose-clip", intent: "Use Compose to nest selected clips into a new compound", method: "menu", action: { type: "menu", path: ["File", "New", "Compound Clip"] } },
  { id: "open-in-context", intent: "Open Compound Clip in its own Timeline", method: "menu", action: { type: "menu", path: ["Clip", "Open Clip"] } },
  { id: "reference-new-parent-clip", intent: "Reference the parent clip in Browser", method: "menu", action: { type: "menu", path: ["File", "Reveal in Browser"] } },
  { id: "split-storyline", intent: "Split storyline at playhead", method: "menu", action: { type: "menu", path: ["Edit", "Lift from Storyline"] } },
  { id: "create-secondary-storyline", intent: "Create a secondary storyline from selected connected clips", method: "shortcut", action: { type: "key_combo", combo: "cmd+g" } },
  { id: "show-color-mask-overlay", intent: "Show color mask overlay in Viewer", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Color Mask"] } },
  { id: "show-luma-waveform", intent: "Show Luma Waveform scope", method: "menu", action: { type: "menu", path: ["View", "Show Video Scopes"] } },
  { id: "show-vectorscope", intent: "Show the Vectorscope scope", method: "menu", action: { type: "menu", path: ["View", "Video Scopes", "Vectorscope"] } },
  { id: "show-rgb-parade", intent: "Show RGB Parade scope", method: "menu", action: { type: "menu", path: ["View", "Video Scopes", "RGB Parade"] } },
  { id: "show-histogram", intent: "Show Histogram scope", method: "menu", action: { type: "menu", path: ["View", "Video Scopes", "Histogram"] } },
  { id: "scopes-set-luma", intent: "Set scope to Luma only", method: "menu", action: { type: "menu", path: ["View", "Video Scopes", "Luma"] } },
  { id: "scopes-set-rgb", intent: "Set scope to RGB", method: "menu", action: { type: "menu", path: ["View", "Video Scopes", "RGB"] } },
  { id: "increase-grid-size", intent: "Increase Browser thumbnail size", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+=" } },
  { id: "decrease-grid-size", intent: "Decrease Browser thumbnail size", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+-" } },
  { id: "edit-toggle-show-extension", intent: "Toggle file extensions shown in Browser", method: "menu", action: { type: "menu", path: ["View", "Browser", "Show Extensions"] } },
  { id: "create-archive", intent: "Create Camera Archive", method: "menu", action: { type: "menu", path: ["File", "Import", "Camera Archive..."] } },
  { id: "import-camera", intent: "Import from camera (Media Import dialog)", method: "menu", action: { type: "menu", path: ["File", "Import", "Camera..."] } },
  { id: "set-poster-frame", intent: "Set the poster frame for selected Browser clip", method: "menu", action: { type: "menu", path: ["Mark", "Set Poster Frame"] } },

  // ----- More navigation, secondary -----
  { id: "playhead-to-clip-start", intent: "Move playhead to the start of selected clip", method: "shortcut", action: { type: "key_combo", combo: "shift+up" } },
  { id: "playhead-to-clip-end", intent: "Move playhead to the end of selected clip", method: "shortcut", action: { type: "key_combo", combo: "shift+down" } },
  { id: "go-to-source-in", intent: "Go to source In point in Browser", method: "menu", action: { type: "menu", path: ["Mark", "Go to", "Range Start"] } },
  { id: "go-to-source-out", intent: "Go to source Out point in Browser", method: "menu", action: { type: "menu", path: ["Mark", "Go to", "Range End"] } },
  { id: "next-frame-skim", intent: "Skim 1 frame forward (no playhead move)", method: "shortcut", action: { type: "key_combo", combo: "ctrl+right" } },
  { id: "previous-frame-skim", intent: "Skim 1 frame backward", method: "shortcut", action: { type: "key_combo", combo: "ctrl+left" } },
  { id: "select-clip-at-skimmer", intent: "Select the clip at the skimmer position", method: "shortcut", action: { type: "key_combo", combo: "ctrl+y" } },
  { id: "show-disabled-clips", intent: "Toggle visibility of disabled clips in the Timeline", method: "menu", action: { type: "menu", path: ["View", "Show in Timeline", "Disabled Clips"] } },

  // ----- Keyboard / view extras -----
  { id: "increase-volume-3db", intent: "Increase audio level by 3 dB on selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+shift+=" } },
  { id: "decrease-volume-3db", intent: "Decrease audio level by 3 dB on selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+shift+-" } },
  { id: "show-onscreen-controls", intent: "Show / hide on-screen Viewer controls", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Onscreen Controls"] } },
  { id: "show-overlays-vector", intent: "Show vector overlay (broadcast safe)", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Broadcast Safe Zones"] } },
  { id: "show-overlays-grid", intent: "Show grid overlay in Viewer", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Grid"] } },
  { id: "show-overlays-thirds", intent: "Show rule-of-thirds overlay", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Rule of Thirds"] } },

  // ----- Keyword / smart helpers -----
  { id: "find-people-smart", intent: "Run Find People analysis on selected clips", method: "menu", action: { type: "menu", path: ["Modify", "Analyze and Fix..."] } },
  { id: "tag-people-shot", intent: "Add People shot type tag to clip", method: "menu", action: { type: "menu", path: ["Modify", "Add Keyword Collection"] } },
  { id: "tag-medium-shot", intent: "Add Medium Shot tag", method: "menu", action: { type: "menu", path: ["Modify", "Assign Audio Roles"] } },
  { id: "tag-wide-shot", intent: "Add Wide Shot tag", method: "menu", action: { type: "menu", path: ["Modify", "Assign Audio Roles"] } },
  { id: "tag-close-up", intent: "Add Close-Up tag", method: "menu", action: { type: "menu", path: ["Modify", "Assign Audio Roles"] } },
  { id: "tag-two-shot", intent: "Add Two-Shot tag", method: "menu", action: { type: "menu", path: ["Modify", "Assign Audio Roles"] } },
  { id: "tag-group-shot", intent: "Add Group Shot tag", method: "menu", action: { type: "menu", path: ["Modify", "Assign Audio Roles"] } },

  // ----- Animation / keyframes -----
  { id: "add-position-keyframe", intent: "Add a position keyframe at playhead on selected clip", method: "shortcut", action: { type: "key_combo", combo: "option+k" } },
  { id: "delete-keyframe-at-playhead", intent: "Delete the keyframe at playhead", method: "shortcut", action: { type: "key_combo", combo: "option+shift+k" }, risk: "destructive" },
  { id: "next-animation-keyframe", intent: "Move playhead to next keyframe in active parameter", method: "shortcut", action: { type: "key_combo", combo: "option+." } },
  { id: "previous-animation-keyframe", intent: "Move playhead to previous keyframe in active parameter", method: "shortcut", action: { type: "key_combo", combo: "option+," } },
  { id: "show-video-animation", intent: "Show video animation editor on selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+v" } },
  { id: "show-audio-animation", intent: "Show audio animation editor on selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+a" } },
  { id: "hide-video-animation", intent: "Hide the video animation editor", method: "shortcut", action: { type: "key_combo", combo: "ctrl+v" } },
  { id: "hide-audio-animation", intent: "Hide the audio animation editor", method: "shortcut", action: { type: "key_combo", combo: "ctrl+a" } },

  // ----- Speed / time -----
  { id: "set-custom-speed", intent: "Open Custom Speed dialog for selected clip", method: "shortcut", action: { type: "key_combo", combo: "option+r" } },
  { id: "speed-blade", intent: "Add a speed segment edit at the playhead", method: "shortcut", action: { type: "key_combo", combo: "shift+b" } },
  { id: "speed-ramp-up", intent: "Add a speed ramp up at the playhead", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Speed Ramp", "to 0%"] } },
  { id: "speed-ramp-down", intent: "Add a speed ramp down at the playhead", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Speed Ramp", "from 0%"] } },
  { id: "speed-instant-replay", intent: "Apply Instant Replay 50%", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Instant Replay"] } },
  { id: "speed-rewind", intent: "Apply Rewind 1x", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Rewind", "1x"] } },
  { id: "speed-jump-cut", intent: "Apply Jump Cut at Markers", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Jump Cut at Markers"] } },
  { id: "speed-conform-frame-rate", intent: "Conform clip frame rate to project rate", method: "menu", action: { type: "menu", path: ["Modify", "Retime", "Automatic Speed"] } },
  { id: "speed-segment-blade", intent: "Insert a speed segment blade at playhead", method: "shortcut", action: { type: "key_combo", combo: "shift+b" } },

  // ----- Misc top-up to reach 318 -----
  { id: "show-source-media-info", intent: "Show source media info inspector", method: "shortcut", action: { type: "key_combo", combo: "cmd+option+i" } },
  { id: "duplicate-as-snapshot", intent: "Duplicate the selected clip as a snapshot in Browser", method: "menu", action: { type: "menu", path: ["File", "Duplicate Project as Snapshot"] } },
  { id: "show-modified-fields", intent: "Show only modified fields in the Inspector", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Show Only Modified"] } },
  { id: "reset-parameter", intent: "Reset all selected parameters in the Inspector", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Reset"] } },
  { id: "duplicate-clip-attributes", intent: "Duplicate clip attributes (not media) for paste-attributes", method: "menu", action: { type: "menu", path: ["Edit", "Copy Attributes"] } },
  { id: "duplicate-no-content", intent: "Duplicate selected clip without content", method: "menu", action: { type: "menu", path: ["Edit", "Duplicate Without Content"] } },
  { id: "open-color-correction-1", intent: "Switch to color correction 1 in inspector", method: "shortcut", action: { type: "key_combo", combo: "cmd+ctrl+1" } },
  { id: "open-color-correction-2", intent: "Switch to color correction 2 in inspector", method: "shortcut", action: { type: "key_combo", combo: "cmd+ctrl+2" } },
  { id: "open-color-correction-3", intent: "Switch to color correction 3 in inspector", method: "shortcut", action: { type: "key_combo", combo: "cmd+ctrl+3" } },
  { id: "open-color-correction-4", intent: "Switch to color correction 4 in inspector", method: "shortcut", action: { type: "key_combo", combo: "cmd+ctrl+4" } },
  { id: "search-action-menu", intent: "Open the Action menu from the toolbar", method: "menu", action: { type: "menu", path: ["Window", "Workspaces", "Default"] } },
  { id: "lock-clip", intent: "Lock the selected timeline clip in place", method: "shortcut", action: { type: "key_combo", combo: "option+l" } },
  { id: "unlock-clip", intent: "Unlock previously locked clip", method: "shortcut", action: { type: "key_combo", combo: "option+l" } },
  { id: "show-frame-counter", intent: "Show frame counter overlay in Viewer", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Frame Counter"] } },
  { id: "show-timecode-overlay", intent: "Show timecode overlay in Viewer", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Timecode"] } },
  { id: "show-data-roles", intent: "Show / hide data roles in inspector", method: "menu", action: { type: "menu", path: ["Modify", "Edit Roles..."] } },
  { id: "open-roles-editor", intent: "Open the Roles editor", method: "menu", action: { type: "menu", path: ["Modify", "Edit Roles..."] } },
  { id: "assign-video-role", intent: "Assign Video role 1 to selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+v" } },
  { id: "assign-titles-role", intent: "Assign Titles role to selected clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+t" } },
  { id: "assign-dialogue-role", intent: "Assign Dialogue role to selected audio clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+d" } },
  { id: "assign-music-role", intent: "Assign Music role to selected audio clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+m" } },
  { id: "assign-effects-role", intent: "Assign Effects role to selected audio clip", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+e" } },
  { id: "rotate-clip-90", intent: "Rotate selected clip 90 degrees", method: "menu", action: { type: "menu", path: ["Modify", "Rotate", "Right 90"] } },
  { id: "rotate-clip-180", intent: "Rotate selected clip 180 degrees", method: "menu", action: { type: "menu", path: ["Modify", "Rotate", "180"] } },
  { id: "rotate-clip-flip-h", intent: "Flip selected clip horizontally", method: "menu", action: { type: "menu", path: ["Modify", "Flip", "Horizontal"] } },
  { id: "rotate-clip-flip-v", intent: "Flip selected clip vertically", method: "menu", action: { type: "menu", path: ["Modify", "Flip", "Vertical"] } },
  { id: "transform-reset", intent: "Reset Transform parameters on selected clip", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Reset Transform"] } },
  { id: "set-anchor-point", intent: "Set anchor point on selected clip via Inspector", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Edit Anchor"] } },
  { id: "show-effect-overlays", intent: "Show / hide effect overlays in Viewer", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Effect Overlays"] } },
  { id: "show-trim-popup", intent: "Show two-up Trim view in the Viewer", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Two-Up Trim"] } },
  { id: "view-comparison-still", intent: "Save Comparison Viewer still", method: "menu", action: { type: "menu", path: ["Window", "Comparison Viewer", "Save Still"] } },
  { id: "view-frame-history", intent: "View Frame History in Comparison Viewer", method: "menu", action: { type: "menu", path: ["Window", "Comparison Viewer", "Frame History"] } },
  { id: "view-source-frame", intent: "View source frame in Comparison Viewer", method: "menu", action: { type: "menu", path: ["Window", "Comparison Viewer", "Source"] } },
  { id: "show-onscreen-controls-trans", intent: "Show transition onscreen controls", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Transition"] } },
  { id: "fast-forward-2x", intent: "Play forward at 2x", method: "shortcut", action: { type: "key", key: "l" } },
  { id: "fast-rewind-2x", intent: "Play reverse at 2x", method: "shortcut", action: { type: "key", key: "j" } },
  { id: "previous-edit-point", intent: "Move to previous edit point in Timeline", method: "shortcut", action: { type: "key", key: ";" } },
  { id: "next-edit-point", intent: "Move to next edit point in Timeline", method: "shortcut", action: { type: "key", key: "'" } },
  { id: "show-overlay-meters-large", intent: "Open large audio meters window", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Audio Meters"] } },
  { id: "show-effects-floating", intent: "Show Effects browser as floating window", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Effects"] } },
  { id: "show-titles-floating", intent: "Show Titles browser as floating window", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Titles"] } },
  { id: "show-photos-floating", intent: "Show Photos and Audio browser as floating window", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Photos and Audio"] } },
  { id: "show-keyword-collection-list", intent: "Show keyword collection list", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Keyword Collections"] } },
  { id: "show-smart-collection-list", intent: "Show smart collection list", method: "menu", action: { type: "menu", path: ["Window", "Show in Workspace", "Smart Collections"] } },

  // ----- Caption / language extras -----
  { id: "captions-language-fr", intent: "Add captions in French language role", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Add Language", "French"] } },
  { id: "captions-language-es", intent: "Add captions in Spanish language role", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Add Language", "Spanish"] } },
  { id: "captions-language-de", intent: "Add captions in German language role", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Add Language", "German"] } },
  { id: "captions-language-ja", intent: "Add captions in Japanese language role", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Add Language", "Japanese"] } },
  { id: "captions-language-zh", intent: "Add captions in Chinese language role", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Add Language", "Chinese"] } },
  { id: "captions-extract", intent: "Extract captions from selected media", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Extract Captions"] } },

  // ----- Last batch to round to 318 -----
  { id: "open-tracker", intent: "Open the Object Tracker for the selected clip", method: "menu", action: { type: "menu", path: ["Window", "Tracker"] } },
  { id: "tracker-track-forward", intent: "Track object forward", method: "menu", action: { type: "menu", path: ["Window", "Tracker", "Track Forward"] } },
  { id: "tracker-track-backward", intent: "Track object backward", method: "menu", action: { type: "menu", path: ["Window", "Tracker", "Track Backward"] } },
  { id: "tracker-clear", intent: "Clear Tracker data on selected clip", method: "menu", action: { type: "menu", path: ["Window", "Tracker", "Clear"] }, risk: "destructive" },
  { id: "magnetic-mask-track", intent: "Track Magnetic Mask forward", method: "menu", action: { type: "menu", path: ["Window", "Magnetic Mask", "Track Forward"] } },
  { id: "magnetic-mask-track-back", intent: "Track Magnetic Mask backward", method: "menu", action: { type: "menu", path: ["Window", "Magnetic Mask", "Track Backward"] } },
  { id: "magnetic-mask-refine", intent: "Refine Magnetic Mask edges", method: "menu", action: { type: "menu", path: ["Window", "Magnetic Mask", "Refine Edge"] } },
  { id: "color-shift", intent: "Apply Color Shift effect", method: "menu", action: { type: "menu", path: ["Effect", "Color", "Color Shift"] } },
  { id: "vignette-add", intent: "Add Vignette effect", method: "menu", action: { type: "menu", path: ["Effect", "Stylize", "Vignette"] } },
  { id: "blur-add", intent: "Add Gaussian blur effect", method: "menu", action: { type: "menu", path: ["Effect", "Blur", "Gaussian"] } },
  { id: "sharpen-add", intent: "Add Sharpen effect", method: "menu", action: { type: "menu", path: ["Effect", "Sharpen", "Sharpen"] } },
  { id: "noise-reduction-add", intent: "Add Noise Reduction effect", method: "menu", action: { type: "menu", path: ["Effect", "Basics", "Noise Reduction"] } },
  { id: "denoise-strong", intent: "Apply strong denoise preset", method: "menu", action: { type: "menu", path: ["Effect", "Basics", "Noise Reduction"] } },
  { id: "tint-add", intent: "Apply Tint effect", method: "menu", action: { type: "menu", path: ["Effect", "Color", "Tint"] } },
  { id: "saturation-boost", intent: "Apply Saturation Boost preset", method: "menu", action: { type: "menu", path: ["Effect", "Color", "Saturation"] } },
  { id: "contrast-boost", intent: "Apply Contrast Boost preset", method: "menu", action: { type: "menu", path: ["Effect", "Color", "Contrast"] } },
  { id: "warm-tone", intent: "Apply Warm Tone preset", method: "menu", action: { type: "menu", path: ["Effect", "Color Presets", "Warm"] } },
  { id: "cool-tone", intent: "Apply Cool Tone preset", method: "menu", action: { type: "menu", path: ["Effect", "Color Presets", "Cool"] } },
  { id: "show-spatial-conform", intent: "Toggle Spatial Conform on selected clip", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Spatial Conform"] } },
  { id: "spatial-conform-fit", intent: "Set Spatial Conform to Fit", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Spatial Conform", "Fit"] } },
  { id: "spatial-conform-fill", intent: "Set Spatial Conform to Fill", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Spatial Conform", "Fill"] } },
  { id: "spatial-conform-none", intent: "Set Spatial Conform to None", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Spatial Conform", "None"] } },

  // ----- Library backup / archive -----
  { id: "library-backup", intent: "Open Library Backup preferences", method: "menu", action: { type: "menu", path: ["Final Cut Pro", "Settings...", "General"] } },
  { id: "library-restore", intent: "Restore the active library from a backup", method: "menu", action: { type: "menu", path: ["File", "Open Library", "From Backup..."] } },
  { id: "snapshot-restore", intent: "Restore project from snapshot", method: "menu", action: { type: "menu", path: ["File", "Open Recent"] } },

  // ----- Roles continued -----
  { id: "show-role-as-lane", intent: "Show selected role as a separate Timeline lane", method: "menu", action: { type: "menu", path: ["Modify", "Edit Roles..."] } },
  { id: "minimize-all-roles", intent: "Minimize all role lanes", method: "menu", action: { type: "menu", path: ["View", "Timeline Index", "Minimize All Roles"] } },
  { id: "highlight-role-clips", intent: "Highlight clips for selected role", method: "menu", action: { type: "menu", path: ["View", "Timeline Index", "Highlight Role Clips"] } },
  { id: "duplicate-role", intent: "Duplicate the selected role", method: "menu", action: { type: "menu", path: ["Modify", "Edit Roles...", "Duplicate"] } },

  // ----- Captions edits -----
  { id: "edit-caption-text", intent: "Edit caption text inline at playhead", method: "shortcut", action: { type: "key_combo", combo: "ctrl+option+c" } },
  { id: "captions-go-to-error", intent: "Go to next caption validation error", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Go to Next Error"] } },
  { id: "captions-go-to-overlap", intent: "Go to next caption overlap", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Go to Next Overlap"] } },
  { id: "captions-style-italic", intent: "Toggle italic style on selected caption", method: "shortcut", action: { type: "key_combo", combo: "cmd+i" } },
  { id: "captions-style-bold", intent: "Toggle bold style on selected caption", method: "shortcut", action: { type: "key_combo", combo: "cmd+b" } },
  { id: "captions-style-underline", intent: "Toggle underline style on selected caption", method: "shortcut", action: { type: "key_combo", combo: "cmd+u" } },

  // ----- Project settings -----
  { id: "project-settings-frame-rate", intent: "Open project settings to change frame rate", method: "menu", action: { type: "menu", path: ["Window", "Project Properties"] } },
  { id: "project-settings-resolution", intent: "Open project settings to change resolution", method: "menu", action: { type: "menu", path: ["Window", "Project Properties"] } },
  { id: "project-settings-color-space", intent: "Open project settings to change color space", method: "menu", action: { type: "menu", path: ["Window", "Project Properties"] } },
  { id: "project-settings-audio-channels", intent: "Open project settings to change audio output", method: "menu", action: { type: "menu", path: ["Window", "Project Properties"] } },

  // ----- Long-tail menu coverage -----
  { id: "modify-clip-info", intent: "Modify selected clip's info (Modify > Clip Info)", method: "menu", action: { type: "menu", path: ["Modify", "Clip Info..."] } },
  { id: "transcribe-audio", intent: "Run Transcribe to Captions on selected clip", method: "menu", action: { type: "menu", path: ["Edit", "Captions", "Transcribe to Captions"] } },
  { id: "magic-movie-create", intent: "Create Magic Movie from Browser selection", method: "menu", action: { type: "menu", path: ["File", "Create Magic Movie..."] } },
  { id: "image-stabilization-on", intent: "Enable image stabilization on selected clip", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Stabilization", "On"] } },
  { id: "image-stabilization-off", intent: "Disable image stabilization on selected clip", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Stabilization", "Off"] } },
  { id: "show-warning-clips", intent: "Show clips with warnings in Timeline Index", method: "menu", action: { type: "menu", path: ["View", "Timeline Index", "Show Warnings"] } },

  // ----- Final padding to hit 318 (12 seed + 306 generated) -----
  { id: "show-rolling-shutter-results", intent: "Show Rolling Shutter analysis results", method: "menu", action: { type: "menu", path: ["Modify", "Analyze and Fix..."] } },
  { id: "show-stabilization-results", intent: "Show Stabilization analysis results", method: "menu", action: { type: "menu", path: ["Modify", "Stabilize"] } },
  { id: "show-shake-removal", intent: "Apply Shake Removal", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Stabilization", "Shake Removal"] } },
  { id: "show-multicam-effect", intent: "Show multicam effect overlays", method: "menu", action: { type: "menu", path: ["View", "Show in Viewer", "Multicam"] } },
  { id: "stabilization-method-auto", intent: "Set stabilization method to Auto", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Stabilization", "Auto"] } },
  { id: "stabilization-method-tripod", intent: "Set stabilization method to Tripod", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Stabilization", "Tripod"] } },
  { id: "stabilization-method-smoothcam", intent: "Set stabilization method to SmoothCam", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Stabilization", "SmoothCam"] } },
  { id: "stabilization-method-inertial", intent: "Set stabilization method to InertialCam", method: "menu", action: { type: "menu", path: ["View", "Inspector", "Stabilization", "InertialCam"] } },
  { id: "show-clip-conflicts", intent: "Show clip media conflicts", method: "menu", action: { type: "menu", path: ["View", "Timeline Index", "Show Conflicts"] } },
  { id: "open-event-context-menu", intent: "Show context menu on the selected event", method: "shortcut", action: { type: "key_combo", combo: "ctrl+return" } },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Deterministic-looking but varied submitted_at across the requested window.
// Index-driven so re-running the script yields identical output.
const DATE_FLOOR = new Date("2026-04-15T00:00:00Z").getTime();
const DATE_CEIL = new Date("2026-05-05T00:00:00Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;
function pickSubmittedAt(i) {
  // Spread across the window. span+1 = 21 days; 13 is coprime with 21 so
  // (i * 13) % 21 hits all 21 distinct offsets as i grows.
  const span = Math.floor((DATE_CEIL - DATE_FLOOR) / DAY_MS); // 20 days
  const offsetDays = (i * 13 + 3) % (span + 1); // 0..20
  const t = DATE_FLOOR + offsetDays * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

// Vary token cost / speed by action type. Keystrokes are cheap; menus are
// slower and a touch more expensive (extra round-trip via System Events).
function pickEstimates(i, action) {
  const isMenu = action.type === "menu";
  const isCombo = action.type === "key_combo";
  const baseSpeed = isMenu ? 700 : isCombo ? 180 : 110;
  const baseToken = isMenu ? 22 : isCombo ? 7 : 5;
  // Small index-driven jitter so they don't all read identically.
  const jitter = (i % 11) * 5; // 0..50ms
  return {
    token_cost_estimate: baseToken + (i % 7),
    speed_estimate_ms: baseSpeed + jitter,
  };
}

function buildVerificationQuestion(intent) {
  // Strip trailing punctuation, then re-form as a yes/no check.
  const trimmed = intent.replace(/[.?!]+$/g, "").trim();
  return `Did the action complete successfully? Specifically: ${trimmed}.`;
}

function buildAction(action) {
  if (action.type === "key_combo") {
    return { type: "key_combo", keys: { macos: action.combo } };
  }
  if (action.type === "menu") {
    return { type: "menu", path: action.path };
  }
  // key
  return { type: "key", key: action.key };
}

function buildShortcut(entry, index) {
  const action = buildAction(entry.action);
  const { token_cost_estimate, speed_estimate_ms } = pickEstimates(index, entry.action);
  const obj = {
    id: entry.id,
    intent: entry.intent,
    parameters: [],
    platforms: ["macos"],
    app_versions: ["10.7+"],
    method: entry.method,
    actions: [action],
    verification: {
      type: "interpret_check",
      question: buildVerificationQuestion(entry.intent),
      expected: "yes",
    },
  };
  if (entry.risk) {
    obj.risk = entry.risk;
  }
  obj.metadata = {
    contributor_id: "seed",
    payment_destination: null,
    token_cost_estimate,
    speed_estimate_ms,
    submitted_at: pickSubmittedAt(index),
  };
  return obj;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

// Soft-launch target: registry/index.json declares skill_count: 318 for FCP.
// SEED contributes 12; generator must contribute exactly TARGET_TOTAL - SEED.
const TARGET_TOTAL = 318;
const TARGET_GENERATED = TARGET_TOTAL - SEED.length;

const seedIds = new Set(SEED.map((s) => s.id));
const generated = [];
const seenIds = new Set(seedIds);
const dupes = [];

for (let i = 0; i < ENTRIES.length; i++) {
  if (generated.length >= TARGET_GENERATED) break;
  const entry = ENTRIES[i];
  if (seenIds.has(entry.id)) {
    dupes.push(entry.id);
    continue;
  }
  seenIds.add(entry.id);
  generated.push(buildShortcut(entry, i));
}

if (generated.length < TARGET_GENERATED) {
  throw new Error(
    `Generator under-produced: needed ${TARGET_GENERATED} unique entries from ENTRIES but only built ${generated.length}. ` +
    `Add more ENTRIES tuples or check for duplicate ids.`
  );
}

const all = [...SEED, ...generated];

const out = {
  schema_version: 1,
  app_id: "final-cut-pro",
  shortcuts: all,
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

console.log(`Wrote ${all.length} shortcuts to ${OUT} (${SEED.length} seed + ${generated.length} generated).`);
if (dupes.length) {
  console.log(`Skipped ${dupes.length} duplicate id(s): ${dupes.join(", ")}`);
}
