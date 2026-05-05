#!/usr/bin/env node
// Generates registry/apps/davinci-resolve/shortcuts.json from a curated array
// of 327 (id, intent, method, action, risk?) tuples.
//
// Run:    node registry/apps/davinci-resolve/gen.mjs
// Output: registry/apps/davinci-resolve/shortcuts.json
//
// Conventions:
//   - Every shortcut has metadata with the full 5-field block. token_cost_estimate,
//     speed_estimate_ms, and submitted_at are varied via small lookup tables so
//     the seed doesn't read like a single batch dump.
//   - Verification defaults to interpret_check with a question templated off the
//     shortcut's intent. The question deliberately doesn't include the literal
//     keystroke; vision should confirm the *outcome*, not the path.
//   - method is "shortcut" if the action is a key/key_combo, "menu" if the
//     action is a top-menu navigation, otherwise we fall through.
//   - risk is "destructive" only on saves, deliveries, and destructive project ops.
//   - All shortcuts are macOS / Resolve 19+ in v0.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "shortcuts.json");

const APP_ID = "davinci-resolve";
const APP_VERSIONS = ["19+"];
const PLATFORMS = ["macos"];

// ----------------------------------------------------------------------------
// Tuple definitions. Each tuple is one of:
//   { id, intent, k:"cmd+s", risk? }                       — key_combo shortcut
//   { id, intent, key:"j", risk? }                         — single key
//   { id, intent, menu:["Color","Add Serial Node"], risk? } — menu navigation
// IDs are kebab-case, globally unique within this array.
// ----------------------------------------------------------------------------

/** @type {Array<{id:string, intent:string, k?:string, key?:string, menu?:string[], risk?:string, params?:Array<{name:string,type:string,required:boolean,description?:string}>, ax?:string}>} */
const TUPLES = [];

// ----- General app (~25) ----------------------------------------------------
TUPLES.push(
  { id: "new-project", intent: "Create a new DaVinci Resolve project (opens the New Project dialog)", k: "cmd+shift+n" },
  { id: "open-project-manager", intent: "Open the Project Manager window", k: "cmd+shift+1" },
  { id: "save-project", intent: "Save the current project to its existing project library entry", k: "cmd+s", risk: "destructive" },
  { id: "save-project-as", intent: "Save the current project under a new name (Save As dialog)", k: "cmd+shift+s", risk: "destructive" },
  {
    id: "import-project-file",
    intent: "Import a Resolve project (.drp) by absolute path into the current project library",
    menu: ["File", "Import Project..."],
    params: [{ name: "path", type: "string", required: true }],
    ax: "type-path"
  },
  {
    id: "export-project-file",
    intent: "Export the current project to a .drp archive at the given absolute path",
    menu: ["File", "Export Project..."],
    params: [{ name: "path", type: "string", required: true }],
    ax: "type-path",
    risk: "destructive"
  },
  { id: "open-project-settings", intent: "Open the Project Settings dialog", k: "cmd+," },
  { id: "open-preferences", intent: "Open DaVinci Resolve > Preferences (system-wide preferences dialog)", menu: ["DaVinci Resolve", "Preferences..."] },
  { id: "open-keyboard-customization", intent: "Open the Keyboard Customization dialog", menu: ["DaVinci Resolve", "Keyboard Customization..."] },
  { id: "quit-resolve", intent: "Quit DaVinci Resolve (cmd+Q)", k: "cmd+q" },
  { id: "hide-resolve", intent: "Hide the DaVinci Resolve application (cmd+H)", k: "cmd+h" },
  { id: "minimize-window", intent: "Minimize the active Resolve window to the dock (cmd+M)", k: "cmd+m" },
  { id: "undo", intent: "Undo the most recent edit (cmd+Z)", k: "cmd+z" },
  { id: "redo", intent: "Redo the most recently undone edit (cmd+shift+Z)", k: "cmd+shift+z" },
  { id: "select-all", intent: "Select all items in the active panel (timeline / Media Pool / node graph) (cmd+A)", k: "cmd+a" },
  { id: "deselect-all", intent: "Deselect all items in the active panel (cmd+shift+A)", k: "cmd+shift+a" },
  { id: "copy", intent: "Copy the current selection (cmd+C)", k: "cmd+c" },
  { id: "cut", intent: "Cut the current selection (cmd+X)", k: "cmd+x" },
  { id: "paste", intent: "Paste from the clipboard (cmd+V)", k: "cmd+v" },
  { id: "paste-insert", intent: "Paste with insert (push downstream clips) on the timeline", k: "cmd+shift+v" },
  { id: "duplicate-selection", intent: "Duplicate the selected timeline clips (cmd+D)", k: "cmd+d" },
  { id: "find", intent: "Open the Find / Search field for the active panel (cmd+F)", k: "cmd+f" },
  { id: "find-and-replace", intent: "Open the Find and Replace dialog (cmd+option+F)", k: "cmd+option+f" },
  { id: "next-window", intent: "Cycle focus to the next window in DaVinci Resolve (cmd+`)", k: "cmd+`" },
  { id: "open-help", intent: "Open the DaVinci Resolve Help menu", menu: ["Help", "DaVinci Resolve Reference Manual"] },
);

// ----- Page navigation (~15) ------------------------------------------------
TUPLES.push(
  { id: "switch-to-media-page", intent: "Switch to the Media page", k: "shift+1" },
  { id: "switch-to-cut-page", intent: "Switch to the Cut page", k: "shift+2" },
  { id: "switch-to-edit-page", intent: "Switch to the Edit page", k: "shift+3" },
  { id: "switch-to-fusion-page", intent: "Switch to the Fusion page", k: "shift+4" },
  { id: "switch-to-color-page", intent: "Switch to the Color page", k: "shift+5" },
  { id: "switch-to-fairlight-page", intent: "Switch to the Fairlight page", k: "shift+6" },
  { id: "switch-to-deliver-page", intent: "Switch to the Deliver page", k: "shift+7" },
  { id: "switch-to-media-page-menu", intent: "Switch to the Media page via the Workspace menu", menu: ["Workspace", "Media"] },
  { id: "switch-to-edit-page-menu", intent: "Switch to the Edit page via the Workspace menu", menu: ["Workspace", "Edit"] },
  { id: "switch-to-color-page-menu", intent: "Switch to the Color page via the Workspace menu", menu: ["Workspace", "Color"] },
  { id: "switch-to-fairlight-page-menu", intent: "Switch to the Fairlight page via the Workspace menu", menu: ["Workspace", "Fairlight"] },
  { id: "switch-to-deliver-page-menu", intent: "Switch to the Deliver page via the Workspace menu", menu: ["Workspace", "Deliver"] },
  { id: "switch-to-fusion-page-menu", intent: "Switch to the Fusion page via the Workspace menu", menu: ["Workspace", "Fusion"] },
  { id: "switch-to-cut-page-menu", intent: "Switch to the Cut page via the Workspace menu", menu: ["Workspace", "Cut"] },
  { id: "next-page", intent: "Switch to the next page in the page bar (cycle right)", menu: ["Workspace", "Switch to Page", "Next Page"] },
);

// ----- Edit page — playback (~25) ------------------------------------------
TUPLES.push(
  { id: "play-stop", intent: "Toggle playback in the active viewer (space)", key: "space" },
  { id: "play-forward", intent: "Play forward at 1x in the active viewer (L)", key: "l" },
  { id: "play-backward", intent: "Play backward at 1x in the active viewer (J)", key: "j" },
  { id: "pause-playback", intent: "Pause playback in the active viewer (K)", key: "k" },
  { id: "shuttle-faster-forward", intent: "Speed up forward shuttle in the active viewer (tap L again)", key: "l" },
  { id: "shuttle-faster-backward", intent: "Speed up backward shuttle in the active viewer (tap J again)", key: "j" },
  { id: "step-forward-frame", intent: "Step the playhead forward by one frame (right arrow)", key: "right" },
  { id: "step-backward-frame", intent: "Step the playhead backward by one frame (left arrow)", key: "left" },
  { id: "step-forward-clip", intent: "Step the playhead forward to the next clip on the timeline (down arrow)", key: "down" },
  { id: "step-backward-clip", intent: "Step the playhead backward to the previous clip on the timeline (up arrow)", key: "up" },
  { id: "step-forward-second", intent: "Step the playhead forward by one second (shift+right)", k: "shift+right" },
  { id: "step-backward-second", intent: "Step the playhead backward by one second (shift+left)", k: "shift+left" },
  { id: "go-to-start", intent: "Jump the playhead to the start of the timeline (home)", key: "home" },
  { id: "go-to-end", intent: "Jump the playhead to the end of the timeline (end)", key: "end" },
  { id: "go-to-in-point", intent: "Jump the playhead to the timeline In point (shift+I)", k: "shift+i" },
  { id: "go-to-out-point", intent: "Jump the playhead to the timeline Out point (shift+O)", k: "shift+o" },
  { id: "play-around-current", intent: "Play around the current playhead position", k: "option+/" },
  { id: "play-from-in-to-out", intent: "Play from In to Out point in the active viewer", k: "option+space" },
  { id: "loop-playback", intent: "Toggle Loop Playback on/off (cmd+/)", k: "cmd+/" },
  { id: "playback-toggle-source-timeline", intent: "Toggle the active viewer between Source and Timeline (Q)", key: "q" },
  { id: "comma-back-by-clip", intent: "Move playhead back to the previous edit point (,)", key: "," },
  { id: "period-forward-by-clip", intent: "Move playhead forward to the next edit point (.)", key: "." },
  { id: "play-reverse-menu", intent: "Play in reverse via the Playback menu", menu: ["Playback", "Play Reverse"] },
  { id: "stop-playback-menu", intent: "Stop playback via the Playback menu", menu: ["Playback", "Stop"] },
  { id: "playback-loop-menu", intent: "Toggle loop playback via the Playback menu", menu: ["Playback", "Loop"] },
);

// ----- Edit page — clip operations (~40) -----------------------------------
TUPLES.push(
  { id: "tool-selection", intent: "Activate the Selection tool on the Edit page (A)", key: "a" },
  { id: "tool-blade", intent: "Activate the Blade Edit Mode on the Edit page (B)", key: "b" },
  { id: "tool-trim-edit", intent: "Activate the Trim Edit Mode on the Edit page (T)", key: "t" },
  { id: "tool-dynamic-trim", intent: "Activate Dynamic Trim Mode on the Edit page (W)", key: "w" },
  { id: "tool-range-selection", intent: "Activate the Range Selection tool on the Edit page (R)", key: "r" },
  { id: "tool-edit-point", intent: "Activate the Edit Point selection mode on the Edit page (V)", key: "v" },
  { id: "set-in-point", intent: "Set an In point at the current playhead position (I)", key: "i" },
  { id: "set-out-point", intent: "Set an Out point at the current playhead position (O)", key: "o" },
  { id: "clear-in-point", intent: "Clear the In point (option+I)", k: "option+i" },
  { id: "clear-out-point", intent: "Clear the Out point (option+O)", k: "option+o" },
  { id: "clear-in-and-out", intent: "Clear both In and Out points (option+X)", k: "option+x" },
  { id: "mark-clip", intent: "Mark In and Out around the clip under the playhead (X)", key: "x" },
  { id: "mark-selection", intent: "Mark In and Out around the current selection (shift+A)", k: "shift+a" },
  { id: "insert-edit", intent: "Insert source clip at the playhead, pushing downstream clips right (F9)", key: "F9" },
  { id: "overwrite-edit", intent: "Overwrite source clip onto the timeline at the playhead (F10)", key: "F10" },
  { id: "replace-edit", intent: "Replace the timeline clip under the playhead with source (F11)", key: "F11" },
  { id: "fit-to-fill-edit", intent: "Fit the source In/Out range to fill the timeline In/Out range (shift+F11)", k: "shift+F11" },
  { id: "place-on-top-edit", intent: "Place the source clip on the next available video track above (F12)", key: "F12" },
  { id: "append-edit", intent: "Append the source clip at the end of the timeline (shift+F12)", k: "shift+F12" },
  { id: "ripple-overwrite-edit", intent: "Ripple Overwrite source onto the timeline (shift+F10)", k: "shift+F10" },
  { id: "blade-at-playhead", intent: "Add an edit point at the current playhead position (cmd+\\)", k: "cmd+\\" },
  { id: "delete-selected-clips", intent: "Delete the currently selected clips from the timeline (delete)", key: "delete" },
  { id: "ripple-delete", intent: "Ripple-delete the currently selected clips (close the gap) (shift+delete)", k: "shift+delete" },
  { id: "split-clip-at-playhead", intent: "Split the clip under the playhead at the current frame", menu: ["Timeline", "Split Clip"] },
  { id: "join-clips", intent: "Join the selected clips back into a single clip", menu: ["Timeline", "Join Clips"] },
  { id: "lock-track", intent: "Lock the focused video track on the timeline", menu: ["Timeline", "Lock Track"] },
  { id: "unlock-track", intent: "Unlock the focused video track on the timeline", menu: ["Timeline", "Unlock Track"] },
  { id: "enable-clips", intent: "Re-enable the selected clips (toggle from disabled)", k: "d", },
  { id: "disable-clips-menu", intent: "Disable the selected clips via the Clip menu", menu: ["Clip", "Enable Clip"] },
  { id: "link-clips", intent: "Link selected video and audio clips so they move together (cmd+option+L)", k: "cmd+option+l" },
  { id: "unlink-clips", intent: "Unlink selected video and audio clips", k: "cmd+option+l" },
  { id: "trim-start-to-playhead", intent: "Trim the clip's In point to the current playhead position (cmd+shift+[)", k: "cmd+shift+[" },
  { id: "trim-end-to-playhead", intent: "Trim the clip's Out point to the current playhead position (cmd+shift+])", k: "cmd+shift+]" },
  { id: "extend-edit", intent: "Extend the selected edit to the playhead (E)", key: "e" },
  { id: "swap-clip-with-prev", intent: "Swap the selected clip with the clip immediately before it on the timeline", menu: ["Edit", "Swap Clips"] },
  { id: "nudge-one-frame-left", intent: "Nudge the selected clip one frame to the left on the timeline (,)", key: "," },
  { id: "nudge-one-frame-right", intent: "Nudge the selected clip one frame to the right on the timeline (.)", key: "." },
  { id: "nudge-five-frames-left", intent: "Nudge the selected clip five frames to the left on the timeline (shift+,)", k: "shift+," },
  { id: "nudge-five-frames-right", intent: "Nudge the selected clip five frames to the right on the timeline (shift+.)", k: "shift+." },
  { id: "freeze-frame-clip", intent: "Convert the selected clip to a freeze frame at the playhead position", menu: ["Clip", "Freeze Frame"] },
);

// ----- Edit page — timeline (~30) -------------------------------------------
TUPLES.push(
  { id: "new-timeline", intent: "Create a new timeline in the current project (cmd+option+N)", k: "cmd+option+n" },
  { id: "duplicate-timeline-menu", intent: "Duplicate the currently active timeline (Edit > Duplicate Timeline)", menu: ["Edit", "Duplicate Timeline"] },
  { id: "timeline-zoom-in", intent: "Zoom the timeline in horizontally (cmd+=)", k: "cmd+=" },
  { id: "timeline-zoom-out", intent: "Zoom the timeline out horizontally (cmd+-)", k: "cmd+-" },
  { id: "timeline-zoom-to-fit", intent: "Fit the entire timeline horizontally in the timeline panel (shift+Z)", k: "shift+z" },
  { id: "timeline-detail-zoom-in", intent: "Increase timeline track detail (taller track headers) (cmd+option+=)", k: "cmd+option+=" },
  { id: "timeline-detail-zoom-out", intent: "Decrease timeline track detail (shorter track headers) (cmd+option+-)", k: "cmd+option+-" },
  { id: "show-clip-thumbnails", intent: "Toggle clip thumbnails on the timeline", menu: ["View", "Show Clip Thumbnails"] },
  { id: "show-audio-waveforms", intent: "Toggle audio waveforms on the timeline", menu: ["View", "Show Audio Waveforms"] },
  { id: "show-track-headers", intent: "Toggle track-header visibility on the timeline", menu: ["View", "Track Heights", "Show Track Headers"] },
  { id: "track-height-medium", intent: "Set timeline track height to Medium", menu: ["View", "Track Heights", "Medium"] },
  { id: "track-height-large", intent: "Set timeline track height to Large", menu: ["View", "Track Heights", "Large"] },
  { id: "track-height-small", intent: "Set timeline track height to Small", menu: ["View", "Track Heights", "Small"] },
  { id: "scroll-timeline-to-playhead", intent: "Scroll the timeline so the playhead is centered (cmd+P)", k: "cmd+p" },
  { id: "linked-selection-toggle", intent: "Toggle Linked Selection (selecting a video clip also selects its audio) (shift+cmd+L)", k: "shift+cmd+l" },
  { id: "snapping-toggle", intent: "Toggle Timeline Snapping on / off (N)", key: "n" },
  { id: "ripple-mode-toggle", intent: "Toggle Ripple-mode editing on the timeline", menu: ["Trim", "Ripple Edit"] },
  { id: "show-timecode", intent: "Toggle the Timecode overlay on the timeline viewer", menu: ["View", "Show Timecode"] },
  { id: "render-cache-toggle", intent: "Toggle Render Cache on / off for the active timeline", menu: ["Playback", "Render Cache", "Smart"] },
  { id: "render-cache-user", intent: "Set Render Cache mode to User", menu: ["Playback", "Render Cache", "User"] },
  { id: "render-cache-off", intent: "Set Render Cache mode to None (off)", menu: ["Playback", "Render Cache", "None"] },
  { id: "add-track-video", intent: "Add a new video track to the timeline", menu: ["Timeline", "Add Track", "Video"] },
  { id: "add-track-audio", intent: "Add a new audio track to the timeline", menu: ["Timeline", "Add Track", "Audio"] },
  { id: "add-track-subtitle", intent: "Add a new subtitle track to the timeline", menu: ["Timeline", "Add Subtitle Track"] },
  { id: "remove-track-video", intent: "Remove the focused empty video track from the timeline", menu: ["Timeline", "Remove Track", "Video"], risk: "destructive" },
  { id: "remove-track-audio", intent: "Remove the focused empty audio track from the timeline", menu: ["Timeline", "Remove Track", "Audio"], risk: "destructive" },
  { id: "go-to-timecode", intent: "Open the 'Go to timecode' field for the active viewer (=)", key: "=" },
  { id: "duplicate-timeline-clip", intent: "Duplicate the selected clip in place on the timeline", menu: ["Edit", "Duplicate"] },
  { id: "ripple-trim-start", intent: "Ripple-trim the start of the selected clip to the playhead", menu: ["Trim", "Ripple Trim Start"] },
  { id: "ripple-trim-end", intent: "Ripple-trim the end of the selected clip to the playhead", menu: ["Trim", "Ripple Trim End"] },
);

// ----- Color page — node graph (~50) ---------------------------------------
TUPLES.push(
  { id: "color-add-serial-node", intent: "Add a new serial node after the currently selected node on the Color page (option+S)", k: "option+s" },
  { id: "color-add-serial-before", intent: "Add a new serial node before the currently selected node (option+shift+S)", k: "option+shift+s" },
  { id: "color-add-parallel-node", intent: "Add a parallel node branch off the currently selected node on the Color page (option+P)", k: "option+p" },
  { id: "color-add-layer-node", intent: "Add a layer-mixer node downstream of the current node on the Color page (option+L)", k: "option+l" },
  { id: "color-add-outside-node", intent: "Add an outside node downstream of the current node on the Color page (option+O)", k: "option+o" },
  { id: "color-add-corrector-node", intent: "Add a corrector node into the node graph", menu: ["Color", "Nodes", "Add Corrector"] },
  { id: "color-toggle-current-node", intent: "Toggle the currently selected color node enabled/disabled (D)", key: "d" },
  { id: "color-toggle-all-grades", intent: "Toggle ALL grades on the current clip enabled/disabled (cmd+D)", k: "cmd+d" },
  { id: "color-bypass-color-grades", intent: "Bypass color grades and Fusion comp for the current clip (shift+D)", k: "shift+d" },
  { id: "color-reset-current-node", intent: "Reset all grades on the currently selected node", menu: ["Color", "Reset", "All Grades and Nodes"] },
  { id: "color-reset-current-grade", intent: "Reset only the current node's grade (keep node graph intact)", menu: ["Color", "Reset", "Current Node Grade"] },
  { id: "color-delete-current-node", intent: "Delete the currently selected color node", menu: ["Color", "Nodes", "Delete Current Node"] },
  { id: "color-rename-node", intent: "Rename the currently selected color node", menu: ["Color", "Nodes", "Label Current Node"] },
  { id: "color-extract-still", intent: "Grab a still of the current clip's grade into the Gallery (cmd+option+G)", k: "cmd+option+g" },
  { id: "color-apply-grade-from-still", intent: "Apply the grade from the most recently selected still onto the current clip", menu: ["Color", "Apply Grade"] },
  { id: "color-copy-grade", intent: "Copy the grade from the currently selected timeline clip", menu: ["Color", "Copy Grade"] },
  { id: "color-paste-grade", intent: "Paste the previously-copied grade onto the currently selected timeline clip", menu: ["Color", "Paste Grade"] },
  { id: "color-show-node-graph", intent: "Toggle the Node Graph panel on the Color page", menu: ["Workspace", "Show Page", "Color", "Nodes"] },
  { id: "color-show-clips", intent: "Toggle the Clips panel on the Color page", menu: ["Workspace", "Show Page", "Color", "Clips"] },
  { id: "color-show-gallery", intent: "Toggle the Gallery panel on the Color page", menu: ["Workspace", "Show Page", "Color", "Gallery"] },
  { id: "color-show-stills", intent: "Show the Stills panel inside the Gallery on the Color page", menu: ["Workspace", "Show Page", "Color", "Stills"] },
  { id: "color-prev-clip", intent: "Move to the previous clip on the timeline from the Color page (cmd+left)", k: "cmd+left" },
  { id: "color-next-clip", intent: "Move to the next clip on the timeline from the Color page (cmd+right)", k: "cmd+right" },
  { id: "color-show-rgb-parade", intent: "Show the RGB Parade scope below the viewer on the Color page", menu: ["Workspace", "Video Scopes", "RGB Parade"] },
  { id: "color-show-vectorscope", intent: "Show the Vectorscope scope on the Color page", menu: ["Workspace", "Video Scopes", "Vectorscope"] },
  { id: "color-show-waveform", intent: "Show the Waveform scope on the Color page", menu: ["Workspace", "Video Scopes", "Waveform"] },
  { id: "color-show-histogram", intent: "Show the Histogram scope on the Color page", menu: ["Workspace", "Video Scopes", "Histogram"] },
  { id: "color-fullscreen-viewer", intent: "Toggle full-screen viewer on the Color page (cmd+F)", k: "cmd+f" },
  { id: "color-cinema-viewer", intent: "Toggle cinema (full-screen, hide controls) viewer (P)", key: "p" },
  { id: "color-add-tracker-window", intent: "Add a tracker window node to the Color graph", menu: ["Color", "Tracker", "Add Tracker"] },
  { id: "color-add-keyframe", intent: "Add a keyframe to the current node at the current playhead position", menu: ["Color", "Keyframes", "Add Keyframe"] },
  { id: "color-toggle-grade-display", intent: "Toggle between LUT-applied / pre-LUT viewer display (shift+H)", k: "shift+h" },
  { id: "color-toggle-show-clip", intent: "Show/hide the timeline clip strip on the Color page", menu: ["Workspace", "Show Page", "Color", "Timeline"] },
  { id: "color-add-power-window-rect", intent: "Add a rectangular Power Window to the current node", menu: ["Color", "Power Windows", "Add Linear Window"] },
  { id: "color-add-power-window-circle", intent: "Add a circular Power Window to the current node", menu: ["Color", "Power Windows", "Add Circular Window"] },
  { id: "color-add-power-window-curve", intent: "Add a curve Power Window to the current node", menu: ["Color", "Power Windows", "Add Curve Window"] },
  { id: "color-add-power-window-poly", intent: "Add a polygon Power Window to the current node", menu: ["Color", "Power Windows", "Add Polygon Window"] },
  { id: "color-invert-power-window", intent: "Invert the polarity of the current Power Window", menu: ["Color", "Power Windows", "Invert"] },
  { id: "color-tracker-track-forward", intent: "Track the Power Window forward from the current frame", menu: ["Color", "Tracker", "Track Forward"] },
  { id: "color-tracker-track-backward", intent: "Track the Power Window backward from the current frame", menu: ["Color", "Tracker", "Track Reverse"] },
  { id: "color-tracker-clear", intent: "Clear all tracking data on the current node", menu: ["Color", "Tracker", "Clear All Tracking Data"] },
  { id: "color-qualifier-pick", intent: "Activate the HSL Qualifier eyedropper on the Color page (Q)", key: "q" },
  { id: "color-qualifier-add", intent: "Activate the Qualifier 'add' eyedropper (extend the current selection)", menu: ["Color", "Qualifier", "Add to Selection"] },
  { id: "color-qualifier-subtract", intent: "Activate the Qualifier 'subtract' eyedropper", menu: ["Color", "Qualifier", "Subtract from Selection"] },
  { id: "color-qualifier-invert", intent: "Invert the current Qualifier selection", menu: ["Color", "Qualifier", "Invert Selection"] },
  { id: "color-show-key-output", intent: "Toggle the viewer to show the Key output of the current node (shift+H)", k: "shift+h" },
  { id: "color-show-highlight", intent: "Toggle Highlight mode in the viewer (visual indication of qualifier selection) (shift+H)", k: "shift+h" },
  { id: "color-toggle-bypass-current-node", intent: "Bypass only the currently selected node (E)", key: "e" },
  { id: "color-add-shared-node", intent: "Add a shared node to the node graph", menu: ["Color", "Nodes", "Add Shared Node"] },
  { id: "color-add-aux-input", intent: "Add an auxiliary input to the currently selected node", menu: ["Color", "Nodes", "Add Aux Input"] },
);

// ----- Color page — primary corrections (~30) ------------------------------
TUPLES.push(
  { id: "color-show-primary-wheels", intent: "Show the Primary color wheels palette (lift / gamma / gain / offset)", menu: ["Workspace", "Show Page", "Color", "Primaries"] },
  { id: "color-show-primary-bars", intent: "Show the Primary color bars palette", menu: ["Workspace", "Show Page", "Color", "Primary Bars"] },
  { id: "color-show-log-wheels", intent: "Show the Log color wheels palette (shadow / midtone / highlight)", menu: ["Workspace", "Show Page", "Color", "Log"] },
  { id: "color-show-color-warper", intent: "Show the Color Warper palette", menu: ["Workspace", "Show Page", "Color", "Color Warper"] },
  { id: "color-show-color-boost", intent: "Show the Color Boost palette (vibrance-style chroma boost)", menu: ["Workspace", "Show Page", "Color", "Color Boost"] },
  { id: "color-show-shadows", intent: "Show the Shadows palette", menu: ["Workspace", "Show Page", "Color", "Shadows"] },
  { id: "color-show-highlights", intent: "Show the Highlights palette", menu: ["Workspace", "Show Page", "Color", "Highlights"] },
  { id: "color-show-mid-detail", intent: "Show the Mid/Detail palette (separation between mid-tones and detail)", menu: ["Workspace", "Show Page", "Color", "Mid/Detail"] },
  { id: "color-show-saturation-vibrance", intent: "Show the Saturation / Vibrance palette", menu: ["Workspace", "Show Page", "Color", "Saturation/Hue"] },
  { id: "color-reset-lift", intent: "Reset the Lift color wheel to neutral", menu: ["Color", "Reset", "Lift"] },
  { id: "color-reset-gamma", intent: "Reset the Gamma color wheel to neutral", menu: ["Color", "Reset", "Gamma"] },
  { id: "color-reset-gain", intent: "Reset the Gain color wheel to neutral", menu: ["Color", "Reset", "Gain"] },
  { id: "color-reset-offset", intent: "Reset the Offset color wheel to neutral", menu: ["Color", "Reset", "Offset"] },
  { id: "color-reset-saturation", intent: "Reset Saturation to its default", menu: ["Color", "Reset", "Saturation"] },
  { id: "color-reset-hue", intent: "Reset Hue Rotation to its default", menu: ["Color", "Reset", "Hue Rotation"] },
  { id: "color-reset-contrast", intent: "Reset Contrast to default", menu: ["Color", "Reset", "Contrast"] },
  { id: "color-reset-pivot", intent: "Reset Pivot to default", menu: ["Color", "Reset", "Pivot"] },
  { id: "color-reset-temperature", intent: "Reset Temperature to default", menu: ["Color", "Reset", "Temperature"] },
  { id: "color-reset-tint", intent: "Reset Tint to default", menu: ["Color", "Reset", "Tint"] },
  { id: "color-reset-midtone-detail", intent: "Reset Midtone Detail to default", menu: ["Color", "Reset", "Midtone Detail"] },
  { id: "color-reset-color-boost", intent: "Reset Color Boost to default", menu: ["Color", "Reset", "Color Boost"] },
  { id: "color-balance-auto", intent: "Apply auto color balance to the current node", menu: ["Color", "Auto Color"] },
  { id: "color-shot-match-prev", intent: "Match the current clip's color to the previous clip on the timeline", menu: ["Color", "Shot Match To This Clip"] },
  { id: "color-show-rgb-mixer", intent: "Show the RGB Mixer palette on the Color page", menu: ["Workspace", "Show Page", "Color", "RGB Mixer"] },
  { id: "color-show-motion-effects", intent: "Show the Motion Effects palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Motion Effects"] },
  { id: "color-show-blur", intent: "Show the Blur / Sharpen / Mist palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Blur"] },
  { id: "color-show-key-palette", intent: "Show the Key palette (qualifier output amount, gain, offset)", menu: ["Workspace", "Show Page", "Color", "Key"] },
  { id: "color-show-sizing", intent: "Show the Sizing palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Sizing"] },
  { id: "color-show-stereo-3d", intent: "Show the Stereo 3D palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Stereo 3D"] },
  { id: "color-show-data-burn", intent: "Toggle the Data Burn-In window (overlay timecode / clip name on output)", menu: ["Workspace", "Data Burn In"] },
);

// ----- Color page — curves & qualifier (~25) -------------------------------
TUPLES.push(
  { id: "color-show-curves", intent: "Show the Curves palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Curves"] },
  { id: "color-curves-custom", intent: "Switch the Curves palette to Custom (RGB master) curve mode", menu: ["Color", "Curves", "Custom"] },
  { id: "color-curves-soft-clip", intent: "Switch the Curves palette to Soft Clip mode", menu: ["Color", "Curves", "Soft Clip"] },
  { id: "color-curves-hue-vs-hue", intent: "Switch the Curves palette to Hue vs Hue mode", menu: ["Color", "Curves", "Hue Vs Hue"] },
  { id: "color-curves-hue-vs-sat", intent: "Switch the Curves palette to Hue vs Sat mode", menu: ["Color", "Curves", "Hue Vs Sat"] },
  { id: "color-curves-hue-vs-lum", intent: "Switch the Curves palette to Hue vs Lum mode", menu: ["Color", "Curves", "Hue Vs Lum"] },
  { id: "color-curves-lum-vs-sat", intent: "Switch the Curves palette to Lum vs Sat mode", menu: ["Color", "Curves", "Lum Vs Sat"] },
  { id: "color-curves-sat-vs-sat", intent: "Switch the Curves palette to Sat vs Sat mode", menu: ["Color", "Curves", "Sat Vs Sat"] },
  { id: "color-reset-curves", intent: "Reset all curves on the current node to default", menu: ["Color", "Reset", "All Curves"] },
  { id: "color-reset-red-curve", intent: "Reset the Red curve on the current node", menu: ["Color", "Reset", "Red Curve"] },
  { id: "color-reset-green-curve", intent: "Reset the Green curve on the current node", menu: ["Color", "Reset", "Green Curve"] },
  { id: "color-reset-blue-curve", intent: "Reset the Blue curve on the current node", menu: ["Color", "Reset", "Blue Curve"] },
  { id: "color-reset-hue-vs-hue-curve", intent: "Reset the Hue vs Hue curve on the current node", menu: ["Color", "Reset", "Hue Vs Hue"] },
  { id: "color-reset-hue-vs-sat-curve", intent: "Reset the Hue vs Sat curve on the current node", menu: ["Color", "Reset", "Hue Vs Sat"] },
  { id: "color-reset-hue-vs-lum-curve", intent: "Reset the Hue vs Lum curve on the current node", menu: ["Color", "Reset", "Hue Vs Lum"] },
  { id: "color-show-qualifier", intent: "Show the Qualifier palette (HSL keyer) on the Color page", menu: ["Workspace", "Show Page", "Color", "Qualifier"] },
  { id: "color-qualifier-mode-3d", intent: "Switch Qualifier to 3D mode", menu: ["Color", "Qualifier", "Mode", "3D"] },
  { id: "color-qualifier-mode-rgb", intent: "Switch Qualifier to RGB mode", menu: ["Color", "Qualifier", "Mode", "RGB"] },
  { id: "color-qualifier-mode-luma", intent: "Switch Qualifier to Luma mode", menu: ["Color", "Qualifier", "Mode", "Luma"] },
  { id: "color-qualifier-reset", intent: "Reset the Qualifier on the current node", menu: ["Color", "Reset", "Qualifier"] },
  { id: "color-show-power-windows", intent: "Show the Power Windows palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Window"] },
  { id: "color-show-tracker", intent: "Show the Tracker palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Tracker"] },
  { id: "color-show-magic-mask", intent: "Show the Magic Mask palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Magic Mask"] },
  { id: "color-show-blur-fx", intent: "Show the Effects (OpenFX) library on the Color page", menu: ["Workspace", "Show Page", "Color", "Effects Library"] },
  { id: "color-show-clip-history", intent: "Show the per-clip Color History (versioning) palette", menu: ["Workspace", "Show Page", "Color", "History"] },
);

// ----- Color page — gallery / stills (~15) ---------------------------------
TUPLES.push(
  { id: "gallery-grab-still", intent: "Grab a still of the current clip's grade into the Gallery (alias of cmd+option+G)", k: "cmd+option+g" },
  { id: "gallery-grab-missing", intent: "Grab missing stills for every clip on the timeline that doesn't have one yet", menu: ["Color", "Gallery", "Grab Missing Stills"] },
  { id: "gallery-grab-all", intent: "Grab a still of every clip on the timeline", menu: ["Color", "Gallery", "Grab All Stills"] },
  { id: "gallery-show-album", intent: "Show the Stills album list inside the Gallery", menu: ["Workspace", "Show Page", "Color", "Albums"] },
  { id: "gallery-add-album", intent: "Add a new album to the Gallery", menu: ["Color", "Gallery", "Add Album"] },
  {
    id: "gallery-rename-album",
    intent: "Rename the currently selected gallery album",
    menu: ["Color", "Gallery", "Rename Current Album"]
  },
  { id: "gallery-delete-still", intent: "Delete the currently selected still from the Gallery", menu: ["Color", "Gallery", "Delete Selected Still"], risk: "destructive" },
  { id: "gallery-export-still", intent: "Export the currently selected still as an image and DRX file", menu: ["Color", "Gallery", "Export Stills..."] },
  { id: "gallery-import-still", intent: "Import a still / DRX file into the Gallery", menu: ["Color", "Gallery", "Import Stills..."] },
  { id: "gallery-toggle-wipe", intent: "Toggle the still-vs-clip wipe in the viewer (W)", key: "w" },
  { id: "gallery-wipe-vertical", intent: "Switch the wipe to a vertical orientation", menu: ["View", "Wipe Mode", "Vertical"] },
  { id: "gallery-wipe-horizontal", intent: "Switch the wipe to a horizontal orientation", menu: ["View", "Wipe Mode", "Horizontal"] },
  { id: "gallery-wipe-mix", intent: "Switch wipe mode to Mix (cross-dissolve between still and clip)", menu: ["View", "Wipe Mode", "Mix"] },
  { id: "gallery-prev-still", intent: "Cycle to the previous still in the Gallery", menu: ["Color", "Gallery", "Previous Still"] },
  { id: "gallery-next-still", intent: "Cycle to the next still in the Gallery", menu: ["Color", "Gallery", "Next Still"] },
);

// ----- Fusion page — node ops (~20) -----------------------------------------
TUPLES.push(
  { id: "fusion-add-merge", intent: "Add a Merge node to the Fusion comp (M)", key: "m" },
  { id: "fusion-add-background", intent: "Add a Background node to the Fusion comp", menu: ["Fusion", "Add Tool", "Generator", "Background"] },
  { id: "fusion-add-transform", intent: "Add a Transform node to the Fusion comp", menu: ["Fusion", "Add Tool", "Transform", "Transform"] },
  { id: "fusion-add-blur", intent: "Add a Blur node to the Fusion comp", menu: ["Fusion", "Add Tool", "Blur", "Blur"] },
  { id: "fusion-add-color-corrector", intent: "Add a Color Corrector node to the Fusion comp", menu: ["Fusion", "Add Tool", "Color", "Color Corrector"] },
  { id: "fusion-add-text", intent: "Add a Text+ node to the Fusion comp", menu: ["Fusion", "Add Tool", "Generator", "Text+"] },
  { id: "fusion-add-rectangle-mask", intent: "Add a Rectangle mask to the currently selected Fusion node", menu: ["Fusion", "Add Tool", "Mask", "Rectangle"] },
  { id: "fusion-add-ellipse-mask", intent: "Add an Ellipse mask to the currently selected Fusion node", menu: ["Fusion", "Add Tool", "Mask", "Ellipse"] },
  { id: "fusion-add-bspline-mask", intent: "Add a B-Spline mask to the currently selected Fusion node", menu: ["Fusion", "Add Tool", "Mask", "BSpline"] },
  { id: "fusion-add-polygon-mask", intent: "Add a Polygon mask to the currently selected Fusion node", menu: ["Fusion", "Add Tool", "Mask", "Polygon"] },
  { id: "fusion-add-tracker", intent: "Add a Tracker node to the Fusion comp", menu: ["Fusion", "Add Tool", "Tracking", "Tracker"] },
  { id: "fusion-add-planar-tracker", intent: "Add a Planar Tracker node to the Fusion comp", menu: ["Fusion", "Add Tool", "Tracking", "Planar Tracker"] },
  { id: "fusion-add-keyer", intent: "Add a Delta Keyer node to the Fusion comp", menu: ["Fusion", "Add Tool", "Matte", "Delta Keyer"] },
  { id: "fusion-add-output", intent: "Add a MediaOut node to the Fusion comp", menu: ["Fusion", "Add Tool", "I/O", "MediaOut"] },
  { id: "fusion-show-node-graph", intent: "Toggle the Node Graph panel on the Fusion page", menu: ["Workspace", "Show Page", "Fusion", "Nodes"] },
  { id: "fusion-show-inspector", intent: "Toggle the Inspector panel on the Fusion page", menu: ["Workspace", "Show Page", "Fusion", "Inspector"] },
  { id: "fusion-show-spline-editor", intent: "Toggle the Spline editor on the Fusion page", menu: ["Workspace", "Show Page", "Fusion", "Spline"] },
  { id: "fusion-show-keyframes-editor", intent: "Toggle the Keyframes editor on the Fusion page", menu: ["Workspace", "Show Page", "Fusion", "Keyframes"] },
  { id: "fusion-loop-comp-playback", intent: "Toggle Loop playback in the Fusion viewer (cmd+/)", k: "cmd+/" },
  { id: "fusion-disable-current-tool", intent: "Disable the currently selected Fusion node (cmd+P)", k: "cmd+p" },
);

// ----- Fairlight — track ops (~25) ------------------------------------------
TUPLES.push(
  { id: "fairlight-mute-track", intent: "Toggle Mute on the currently focused audio track", menu: ["Fairlight", "Track", "Mute"] },
  { id: "fairlight-solo-track", intent: "Toggle Solo on the currently focused audio track", menu: ["Fairlight", "Track", "Solo"] },
  { id: "fairlight-arm-record", intent: "Toggle Record-arm on the currently focused audio track", menu: ["Fairlight", "Track", "Record"] },
  { id: "fairlight-add-audio-track", intent: "Add a new mono audio track on the Fairlight page", menu: ["Fairlight", "Track", "Add", "Mono"] },
  { id: "fairlight-add-stereo-track", intent: "Add a new stereo audio track on the Fairlight page", menu: ["Fairlight", "Track", "Add", "Stereo"] },
  { id: "fairlight-add-51-track", intent: "Add a new 5.1 surround audio track on the Fairlight page", menu: ["Fairlight", "Track", "Add", "5.1"] },
  { id: "fairlight-add-71-track", intent: "Add a new 7.1 surround audio track on the Fairlight page", menu: ["Fairlight", "Track", "Add", "7.1"] },
  { id: "fairlight-add-bus", intent: "Add a new submix bus on the Fairlight page", menu: ["Fairlight", "Bus Format..."] },
  { id: "fairlight-rename-track", intent: "Rename the currently focused audio track", menu: ["Fairlight", "Track", "Rename"] },
  { id: "fairlight-delete-track", intent: "Delete the currently focused audio track", menu: ["Fairlight", "Track", "Remove"], risk: "destructive" },
  { id: "fairlight-automation-read", intent: "Set automation mode to Read on the focused track", menu: ["Fairlight", "Automation", "Read"] },
  { id: "fairlight-automation-touch", intent: "Set automation mode to Touch on the focused track", menu: ["Fairlight", "Automation", "Touch"] },
  { id: "fairlight-automation-latch", intent: "Set automation mode to Latch on the focused track", menu: ["Fairlight", "Automation", "Latch"] },
  { id: "fairlight-automation-write", intent: "Set automation mode to Write on the focused track", menu: ["Fairlight", "Automation", "Write"] },
  { id: "fairlight-automation-off", intent: "Turn automation Off on the focused track", menu: ["Fairlight", "Automation", "Off"] },
  { id: "fairlight-show-mixer", intent: "Toggle the Mixer panel on the Fairlight page", menu: ["Workspace", "Show Page", "Fairlight", "Mixer"] },
  { id: "fairlight-show-meters", intent: "Toggle the Meters panel on the Fairlight page", menu: ["Workspace", "Show Page", "Fairlight", "Meters"] },
  { id: "fairlight-show-monitoring", intent: "Toggle the Monitoring panel on the Fairlight page", menu: ["Workspace", "Show Page", "Fairlight", "Monitoring"] },
  { id: "fairlight-show-edit-index", intent: "Toggle the Edit Index panel on the Fairlight page", menu: ["Workspace", "Show Page", "Fairlight", "Edit Index"] },
  { id: "fairlight-show-effects", intent: "Toggle the Effects library panel on the Fairlight page", menu: ["Workspace", "Show Page", "Fairlight", "Effects Library"] },
  { id: "fairlight-show-audio-tracks-only", intent: "Show only audio tracks on the Fairlight page (hide video timeline)", menu: ["Workspace", "Show Page", "Fairlight", "Audio Only"] },
  { id: "fairlight-record-start", intent: "Start record on all armed tracks (cmd+R)", k: "cmd+r" },
  { id: "fairlight-record-stop", intent: "Stop record on all armed tracks (space)", key: "space" },
  { id: "fairlight-toggle-loop-record", intent: "Toggle loop-record mode on the Fairlight page", menu: ["Fairlight", "Loop Record"] },
  { id: "fairlight-set-track-color", intent: "Open the Track Color picker for the focused audio track", menu: ["Fairlight", "Track", "Color"] },
);

// ----- Fairlight — fader / panner / EQ / dynamics (~15) ---------------------
TUPLES.push(
  { id: "fairlight-show-channel-strip", intent: "Show the channel strip for the focused audio track in the Inspector", menu: ["Fairlight", "Channel Strip"] },
  { id: "fairlight-toggle-eq", intent: "Toggle the EQ on the focused audio track in the channel strip", menu: ["Fairlight", "Channel Strip", "EQ"] },
  { id: "fairlight-toggle-dynamics", intent: "Toggle the Dynamics processor on the focused audio track", menu: ["Fairlight", "Channel Strip", "Dynamics"] },
  { id: "fairlight-toggle-compressor", intent: "Toggle the Compressor section in the focused track's Dynamics", menu: ["Fairlight", "Channel Strip", "Compressor"] },
  { id: "fairlight-toggle-expander", intent: "Toggle the Expander section in the focused track's Dynamics", menu: ["Fairlight", "Channel Strip", "Expander"] },
  { id: "fairlight-toggle-gate", intent: "Toggle the Gate section in the focused track's Dynamics", menu: ["Fairlight", "Channel Strip", "Gate"] },
  { id: "fairlight-toggle-limiter", intent: "Toggle the Limiter section in the focused track's Dynamics", menu: ["Fairlight", "Channel Strip", "Limiter"] },
  { id: "fairlight-show-panner", intent: "Open the Panner window for the focused audio track", menu: ["Fairlight", "Panner"] },
  { id: "fairlight-reset-fader", intent: "Reset the focused track's fader to 0 dB", menu: ["Fairlight", "Channel Strip", "Reset Fader"] },
  { id: "fairlight-reset-eq", intent: "Reset the focused track's EQ to defaults", menu: ["Fairlight", "Channel Strip", "Reset EQ"] },
  { id: "fairlight-reset-dynamics", intent: "Reset the focused track's Dynamics processor to defaults", menu: ["Fairlight", "Channel Strip", "Reset Dynamics"] },
  { id: "fairlight-reset-panner", intent: "Reset the focused track's panner to centered", menu: ["Fairlight", "Channel Strip", "Reset Panner"] },
  { id: "fairlight-add-plugin", intent: "Open the Add Plugin selector on the focused audio track's channel strip", menu: ["Fairlight", "Channel Strip", "Add Plugin..."] },
  { id: "fairlight-clear-fades", intent: "Clear all fade handles on the selected audio clip", menu: ["Fairlight", "Clip", "Clear Fades"] },
  { id: "fairlight-normalize-clip", intent: "Normalize peak loudness on the selected audio clip", menu: ["Fairlight", "Clip", "Normalize Audio Levels..."] },
);

// ----- Deliver page — render queue / presets (~10) -------------------------
TUPLES.push(
  { id: "deliver-add-to-render-queue", intent: "Add the current Deliver settings to the render queue", menu: ["Deliver", "Add to Render Queue"] },
  { id: "deliver-render-all", intent: "Start rendering all jobs in the render queue", menu: ["Deliver", "Render All"], risk: "destructive" },
  { id: "deliver-render-selected", intent: "Start rendering only the currently selected jobs in the render queue", menu: ["Deliver", "Render Selected"], risk: "destructive" },
  { id: "deliver-stop-render", intent: "Stop the currently running render job", menu: ["Deliver", "Stop Render"] },
  { id: "deliver-clear-completed", intent: "Clear all completed jobs from the render queue", menu: ["Deliver", "Clear Completed Renders"] },
  { id: "deliver-preset-youtube", intent: "Switch the Deliver preset to YouTube 1080p", menu: ["Deliver", "Render Presets", "YouTube 1080p"] },
  { id: "deliver-preset-vimeo", intent: "Switch the Deliver preset to Vimeo 1080p", menu: ["Deliver", "Render Presets", "Vimeo 1080p"] },
  { id: "deliver-preset-prores", intent: "Switch the Deliver preset to ProRes Master", menu: ["Deliver", "Render Presets", "ProRes Master"] },
  { id: "deliver-preset-h264", intent: "Switch the Deliver preset to H.264 Master", menu: ["Deliver", "Render Presets", "H.264 Master"] },
  { id: "deliver-save-current-as-preset", intent: "Save the current Deliver settings as a new render preset", menu: ["Deliver", "Save As New Preset..."] },
);

// ----- View / window (~20) --------------------------------------------------
TUPLES.push(
  { id: "view-fullscreen", intent: "Toggle full-screen mode for the active Resolve window (cmd+ctrl+F)", k: "cmd+ctrl+f" },
  { id: "view-cinema-mode", intent: "Toggle Cinema Viewer mode (full-screen viewer, hides UI chrome) (P)", key: "p" },
  { id: "view-show-scopes", intent: "Show the Scopes window (RGB Parade / Vectorscope / Waveform / Histogram) (cmd+option+W)", k: "cmd+option+w" },
  { id: "view-show-dual-monitor", intent: "Toggle Dual Monitor mode for the current page", menu: ["Workspace", "Dual Screen", "On"] },
  { id: "view-single-monitor", intent: "Switch to single-monitor mode", menu: ["Workspace", "Dual Screen", "Off"] },
  { id: "view-toggle-clean-feed", intent: "Toggle Clean Feed (output without UI overlays) on the second monitor", menu: ["Workspace", "Clean Feed"] },
  { id: "view-show-source-viewer", intent: "Show the Source viewer panel on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Source Viewer"] },
  { id: "view-show-timeline-viewer", intent: "Show the Timeline viewer panel on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Timeline Viewer"] },
  { id: "view-show-effects-library", intent: "Toggle the Effects library on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Effects Library"] },
  { id: "view-show-edit-index", intent: "Toggle the Edit Index panel on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Edit Index"] },
  { id: "view-show-inspector", intent: "Toggle the Inspector panel on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Inspector"] },
  { id: "view-show-mixer", intent: "Toggle the Mixer panel on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Mixer"] },
  { id: "view-show-metadata", intent: "Toggle the Metadata panel on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Metadata"] },
  { id: "view-show-media-pool", intent: "Toggle the Media Pool panel", menu: ["Workspace", "Show Page", "Edit", "Media Pool"] },
  { id: "view-zoom-window-100", intent: "Zoom the timeline viewer to 100%", menu: ["View", "Zoom", "Zoom to 100%"] },
  { id: "view-zoom-window-fit", intent: "Fit the viewer image to the window", menu: ["View", "Zoom", "Zoom to Fit"] },
  { id: "view-show-safe-area", intent: "Toggle Safe Area overlay in the Edit-page viewer", menu: ["View", "Safe Area", "Show Safe Area"] },
  { id: "view-show-overlay-grid", intent: "Toggle the Grid overlay in the Edit-page viewer", menu: ["View", "Show Grid"] },
  { id: "view-show-onscreen-controls", intent: "Toggle the on-screen controls overlay (transform / crop handles)", menu: ["View", "On-Screen Controls", "Toggle"] },
  { id: "view-show-page-bar", intent: "Toggle the page bar at the bottom of the window", menu: ["Workspace", "Show Page Navigation"] },
);

// ----- Markers (~10) --------------------------------------------------------
TUPLES.push(
  { id: "marker-add", intent: "Add a marker at the current playhead position (M)", key: "m" },
  { id: "marker-add-with-modify", intent: "Add a marker and immediately open the modify-marker dialog (cmd+M)", k: "cmd+m" },
  { id: "marker-modify-current", intent: "Modify the marker at the current playhead position", menu: ["Mark", "Modify Marker"] },
  { id: "marker-delete-current", intent: "Delete the marker at the current playhead position", menu: ["Mark", "Delete Marker"], risk: "destructive" },
  { id: "marker-show-panel", intent: "Open the Markers panel (shift+M)", k: "shift+m" },
  { id: "marker-add-blue", intent: "Add a Blue-colored marker at the current playhead position", menu: ["Mark", "Add Marker", "Blue"] },
  { id: "marker-add-red", intent: "Add a Red-colored marker at the current playhead position", menu: ["Mark", "Add Marker", "Red"] },
  { id: "marker-add-green", intent: "Add a Green-colored marker at the current playhead position", menu: ["Mark", "Add Marker", "Green"] },
  { id: "marker-add-yellow", intent: "Add a Yellow-colored marker at the current playhead position", menu: ["Mark", "Add Marker", "Yellow"] },
  { id: "marker-add-cyan", intent: "Add a Cyan-colored marker at the current playhead position", menu: ["Mark", "Add Marker", "Cyan"] },
);

// ----- Audio sync, multicam, scripting (~10) --------------------------------
TUPLES.push(
  { id: "auto-sync-audio", intent: "Auto-sync the selected video clips to selected audio clips by waveform", menu: ["Clip", "Auto Sync Audio", "Based on Waveform"] },
  { id: "auto-sync-by-tc", intent: "Auto-sync the selected video clips to selected audio clips by timecode", menu: ["Clip", "Auto Sync Audio", "Based on Timecode"] },
  { id: "create-multicam-clip", intent: "Create a new multicam clip from the selected source clips", menu: ["Clip", "Create New Multicam Clip..."] },
  { id: "open-in-multicam-viewer", intent: "Open the selected multicam clip in the Multicam viewer", menu: ["Clip", "Open In Multicam Viewer"] },
  { id: "decompose-multicam", intent: "Decompose the selected multicam clip back to its source angles", menu: ["Clip", "Decompose Multicam Clip"] },
  { id: "console-open", intent: "Open the Resolve scripting Console (Lua / Python REPL)", menu: ["Workspace", "Console"] },
  { id: "console-run-script", intent: "Run a saved DaVinci Resolve script from disk by absolute path", menu: ["Workspace", "Scripts", "Run Script..."] },
  { id: "open-project-library", intent: "Open the Project Library / Database manager", menu: ["DaVinci Resolve", "Project Libraries..."] },
  { id: "switch-project-library", intent: "Switch the active project library to a different database", menu: ["DaVinci Resolve", "Project Libraries...", "Connect to Library..."] },
  { id: "open-data-burn-in-window", intent: "Open the Data Burn-In window (per-project / per-clip overlays)", menu: ["Workspace", "Data Burn In..."] },
);

// ----- Reach 327: pad with sensible Edit-page additions ---------------------
TUPLES.push(
  { id: "open-file-import-media", intent: "Open the Media Import panel and import a media file by absolute path", menu: ["File", "Import", "Media..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "import-folder-of-media", intent: "Import an entire folder of media into the Media Pool by absolute path", menu: ["File", "Import", "Media Folder..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "import-timeline", intent: "Import a timeline (.drt / EDL / XML / AAF) by absolute path", menu: ["File", "Import", "Timeline..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "export-timeline-edl", intent: "Export the active timeline as a CMX 3600 EDL to the given path", menu: ["File", "Export", "Timeline..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path", risk: "destructive" },
  { id: "export-timeline-xml", intent: "Export the active timeline as Final Cut Pro XML to the given path", menu: ["File", "Export", "AAF, XML..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path", risk: "destructive" },
  { id: "export-current-frame", intent: "Export the current viewer frame as a still image to the given absolute path", menu: ["File", "Export", "Current Frame as Still..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "render-in-place", intent: "Render-in-place the selected clip to a new media file (committing the grade)", menu: ["Clip", "Render in Place"], risk: "destructive" },
  { id: "remove-rendered-cache", intent: "Remove all render cache files for the active timeline", menu: ["Playback", "Delete Render Cache", "All"], risk: "destructive" },
  { id: "delete-unused-clips", intent: "Delete unused source clips from the Media Pool", menu: ["Edit", "Delete Unused Clips..."], risk: "destructive" },
  { id: "consolidate-media", intent: "Consolidate referenced media into a single folder (Media Management)", menu: ["File", "Media Management..."] },
  { id: "open-collaboration", intent: "Open the Collaboration / multi-user project sharing dialog", menu: ["File", "Collaboration..."] },
  { id: "show-render-progress", intent: "Show the per-job render progress detail in the Deliver page", menu: ["Workspace", "Show Page", "Deliver", "Render Job Details"] },
  { id: "switch-input-color-space", intent: "Open Project Settings to the Color Management input color space picker", menu: ["DaVinci Resolve", "Project Settings...", "Color Management"] },
  { id: "show-project-settings-image-scaling", intent: "Open Project Settings to the Image Scaling tab", menu: ["DaVinci Resolve", "Project Settings...", "Image Scaling"] },
  { id: "show-project-settings-master", intent: "Open Project Settings to the Master Settings tab", menu: ["DaVinci Resolve", "Project Settings...", "Master Settings"] },
  { id: "show-project-settings-capture", intent: "Open Project Settings to the Capture and Playback tab", menu: ["DaVinci Resolve", "Project Settings...", "Capture and Playback"] },
  { id: "show-project-settings-subtitles", intent: "Open Project Settings to the Subtitles tab", menu: ["DaVinci Resolve", "Project Settings...", "Subtitles"] },
  { id: "show-project-settings-fairlight", intent: "Open Project Settings to the Fairlight tab", menu: ["DaVinci Resolve", "Project Settings...", "Fairlight"] },
  { id: "open-system-preferences", intent: "Open the system-wide DaVinci Resolve Preferences dialog", menu: ["DaVinci Resolve", "Preferences...", "System"] },
  { id: "open-user-preferences", intent: "Open the per-user Preferences dialog (User tab)", menu: ["DaVinci Resolve", "Preferences...", "User"] },
  { id: "user-pref-edit-defaults", intent: "Open User Preferences to the Editing default tab", menu: ["DaVinci Resolve", "Preferences...", "Editing"] },
  { id: "user-pref-color-defaults", intent: "Open User Preferences to the Color default tab", menu: ["DaVinci Resolve", "Preferences...", "Color"] },
  { id: "user-pref-fairlight-defaults", intent: "Open User Preferences to the Fairlight default tab", menu: ["DaVinci Resolve", "Preferences...", "Fairlight"] },
  { id: "edit-page-show-subtitle-track", intent: "Show subtitle track edit controls on the Edit page", menu: ["Workspace", "Show Page", "Edit", "Subtitle Track"] },
  { id: "edit-add-subtitle-from-text", intent: "Add a subtitle clip at the current playhead with the given text", menu: ["Timeline", "Add Subtitle"], params: [{ name: "text", type: "string", required: true }], ax: "type-subtitle" },
  { id: "edit-import-subtitles-srt", intent: "Import subtitles from an SRT file by absolute path", menu: ["File", "Import", "Subtitles..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "edit-export-subtitles-srt", intent: "Export the timeline's subtitle track as an SRT file to the given path", menu: ["File", "Export", "Subtitles..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path", risk: "destructive" },
  { id: "speed-change-50", intent: "Change the selected clip's speed to 50%", menu: ["Clip", "Change Clip Speed...", "50%"] },
  { id: "speed-change-200", intent: "Change the selected clip's speed to 200%", menu: ["Clip", "Change Clip Speed...", "200%"] },
  { id: "speed-reverse-clip", intent: "Reverse playback direction of the selected clip", menu: ["Clip", "Change Clip Speed...", "Reverse"] },
  { id: "retime-controls", intent: "Show retime controls on the selected timeline clip (cmd+R)", k: "cmd+r" },
  { id: "stabilize-clip", intent: "Open the Stabilization panel for the selected clip", menu: ["Clip", "Stabilize"] },
  { id: "lens-correction", intent: "Apply automatic lens correction to the selected clip", menu: ["Clip", "Lens Correction", "Analyze"] },
  { id: "show-clip-attributes", intent: "Show the Clip Attributes dialog for the selected clip", menu: ["Clip", "Clip Attributes..."] },
  { id: "show-clip-color-tag", intent: "Open the Clip Color tag picker for the selected clip", menu: ["Clip", "Clip Color"] },
  { id: "show-fusion-comp-on-clip", intent: "Open the selected clip in the Fusion page (jump from Edit)", menu: ["Clip", "Open in Fusion Page"] },
  { id: "show-comp-in-edit-from-fusion", intent: "Jump from a Fusion comp back to the Edit page at the same clip", menu: ["Clip", "Open in Edit Page"] },
  { id: "show-text-plus-template", intent: "Add a Text+ title template to the timeline at the playhead", menu: ["Timeline", "Add Title", "Text+"] },
  { id: "show-fusion-title-template", intent: "Add a Fusion title template to the timeline at the playhead", menu: ["Timeline", "Add Title", "Fusion Title"] },
  { id: "show-cross-dissolve", intent: "Add a 1-second cross-dissolve transition between the two selected clips", menu: ["Edit", "Add Transition", "Cross Dissolve"] },
  { id: "remove-transition", intent: "Remove the currently selected transition from the timeline", menu: ["Edit", "Remove Transition"] },
  { id: "transitions-show-effects", intent: "Show the Transitions tab in the Effects library", menu: ["Workspace", "Show Page", "Edit", "Transitions"] },
  { id: "titles-show-effects", intent: "Show the Titles tab in the Effects library", menu: ["Workspace", "Show Page", "Edit", "Titles"] },
  { id: "generators-show-effects", intent: "Show the Generators tab in the Effects library", menu: ["Workspace", "Show Page", "Edit", "Generators"] },
  { id: "open-cut-page-fast-review", intent: "Open the Cut page Fast Review feature on the active source clip", menu: ["Workspace", "Show Page", "Cut", "Fast Review"] },
  { id: "cut-page-source-tape", intent: "Toggle Source Tape view on the Cut page", menu: ["Workspace", "Show Page", "Cut", "Source Tape"] },
  { id: "cut-page-sync-bin", intent: "Toggle the Sync Bin panel on the Cut page", menu: ["Workspace", "Show Page", "Cut", "Sync Bin"] },
  { id: "cut-page-source-viewer", intent: "Switch the Cut-page upper viewer to Source mode", menu: ["Workspace", "Show Page", "Cut", "Source Viewer"] },
  { id: "cut-page-timeline-viewer", intent: "Switch the Cut-page upper viewer to Timeline mode", menu: ["Workspace", "Show Page", "Cut", "Timeline Viewer"] },
  { id: "cut-page-quick-export", intent: "Open the Cut-page Quick Export menu", menu: ["File", "Quick Export..."] },
  { id: "media-page-clone-tool", intent: "Open the Clone tool on the Media page (for offload-and-verify workflows)", menu: ["Workspace", "Show Page", "Media", "Clone Tool"] },
  { id: "media-page-toggle-meta", intent: "Toggle the Metadata panel on the Media page", menu: ["Workspace", "Show Page", "Media", "Metadata"] },
  { id: "media-page-toggle-audio", intent: "Toggle the Audio panel on the Media page", menu: ["Workspace", "Show Page", "Media", "Audio Panel"] },
  { id: "media-page-toggle-storage", intent: "Toggle the Storage Locations panel on the Media page", menu: ["Workspace", "Show Page", "Media", "Media Storage"] },
  { id: "media-page-add-bin", intent: "Add a new bin to the Media Pool", menu: ["File", "New Bin"] },
  { id: "media-page-rename-bin", intent: "Rename the currently selected bin in the Media Pool", menu: ["File", "Rename Bin"] },
  { id: "media-page-delete-bin", intent: "Delete the currently selected bin in the Media Pool", menu: ["File", "Delete Bin"], risk: "destructive" },
  { id: "media-page-create-smart-bin", intent: "Create a Smart Bin in the Media Pool with the given name", menu: ["File", "Create Smart Bin..."], params: [{ name: "name", type: "string", required: true }], ax: "type-text" },
  { id: "media-page-toggle-thumbnail-mode", intent: "Switch the Media Pool to Thumbnail view", menu: ["View", "Media Pool", "Thumbnails"] },
  { id: "media-page-toggle-list-mode", intent: "Switch the Media Pool to List view", menu: ["View", "Media Pool", "List"] },
  { id: "media-page-grid-view", intent: "Switch the Media Pool to Icon (grid) view", menu: ["View", "Media Pool", "Icon"] },
  { id: "media-page-rebuild-cache", intent: "Rebuild the Media Pool's proxy cache for selected clips", menu: ["Playback", "Render Cache", "Update Cache"] },
  { id: "media-page-relink-clips", intent: "Relink offline clips by absolute folder path", menu: ["Clip", "Relink Selected Clips..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "media-page-mark-offline", intent: "Mark the selected clips as offline (forcibly unlink)", menu: ["Clip", "Mark as Offline"], risk: "destructive" },
  { id: "edit-page-toggle-render-cache-color-output", intent: "Switch render cache to use color-output frames", menu: ["Playback", "Render Cache", "Color Output"] },
  { id: "edit-page-toggle-render-cache-fusion-output", intent: "Switch render cache to use Fusion-output frames", menu: ["Playback", "Render Cache", "Fusion Output"] },
  { id: "fusion-fit-to-viewer", intent: "Fit the Fusion node graph to the viewer panel", menu: ["Fusion", "Node Graph", "Fit to Window"] },
  { id: "fusion-zoom-graph-100", intent: "Zoom the Fusion node graph to 100%", menu: ["Fusion", "Node Graph", "Zoom to 100%"] },
  { id: "fusion-show-render-manager", intent: "Open the Fusion Render Manager", menu: ["Fusion", "Render Manager..."] },
  { id: "fusion-add-3d-merge", intent: "Add a 3D Merge node to the Fusion comp", menu: ["Fusion", "Add Tool", "3D", "Merge3D"] },
  { id: "fusion-add-camera-3d", intent: "Add a Camera3D node to the Fusion comp", menu: ["Fusion", "Add Tool", "3D", "Camera3D"] },
  { id: "fusion-add-shape-3d", intent: "Add a Shape3D node to the Fusion comp", menu: ["Fusion", "Add Tool", "3D", "Shape3D"] },
  { id: "fusion-add-image-plane-3d", intent: "Add an ImagePlane3D node to the Fusion comp", menu: ["Fusion", "Add Tool", "3D", "ImagePlane3D"] },
  { id: "fusion-add-renderer-3d", intent: "Add a Renderer3D node to the Fusion comp (rasterize 3D scene)", menu: ["Fusion", "Add Tool", "3D", "Renderer3D"] },
  { id: "color-show-versions", intent: "Show the per-clip Color version sidebar", menu: ["Color", "Versions", "Show Versions"] },
  { id: "color-add-version", intent: "Add a new local color version to the current clip", menu: ["Color", "Versions", "Add Version"] },
  { id: "color-rename-version", intent: "Rename the currently selected color version", menu: ["Color", "Versions", "Rename Version"] },
  { id: "color-load-version", intent: "Load a saved color version onto the current clip", menu: ["Color", "Versions", "Load Version"] },
  { id: "color-promote-version", intent: "Promote the current color version to the master version", menu: ["Color", "Versions", "Promote Version"] },
  { id: "color-delete-version", intent: "Delete the currently selected color version", menu: ["Color", "Versions", "Delete Version"], risk: "destructive" },
  { id: "color-show-lut-browser", intent: "Show the LUT browser on the Color page", menu: ["Workspace", "Show Page", "Color", "LUTs"] },
  { id: "color-apply-lut-by-name", intent: "Apply a LUT by name to the currently selected color node", menu: ["Color", "LUT", "Apply"], params: [{ name: "lut_name", type: "string", required: true }], ax: "type-text" },
  { id: "color-clear-lut", intent: "Remove the LUT applied to the currently selected color node", menu: ["Color", "LUT", "Clear"] },
  { id: "color-bypass-lut", intent: "Bypass the LUT on the currently selected color node", menu: ["Color", "LUT", "Bypass"] },
  { id: "color-show-fairlight-meters", intent: "Show Fairlight meters in the Color page lower panel", menu: ["Workspace", "Show Page", "Color", "Audio Meters"] },
  { id: "color-show-keyer", intent: "Show the Keyer / Holdout palette on the Color page", menu: ["Workspace", "Show Page", "Color", "Keyer"] },
  { id: "color-show-warper", intent: "Show the Color Warper palette on the Color page (chroma-warp grid)", menu: ["Workspace", "Show Page", "Color", "Color Warper Panel"] },
  { id: "color-blanking-fill", intent: "Apply blanking fill to the current clip's color", menu: ["Color", "Blanking", "Fill"] },
  { id: "color-show-shot-list", intent: "Show the Color page Clip Timeline / Shot List panel", menu: ["Workspace", "Show Page", "Color", "Timeline Thumbnails"] },
  { id: "color-show-curve-overlay", intent: "Toggle curve-overlay display in the Color page viewer", menu: ["View", "Show Curves Overlay"] },
  { id: "color-show-onscreen-pan-tilt", intent: "Toggle on-screen pan/tilt controls in the Color page viewer", menu: ["View", "On-Screen Controls", "Pan and Tilt"] },
  { id: "color-export-grade", intent: "Export the current clip's grade as a DRX file to the given absolute path", menu: ["Color", "Export Grade..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "color-import-grade", intent: "Import a grade from a DRX file by absolute path onto the current clip", menu: ["Color", "Import Grade..."], params: [{ name: "path", type: "string", required: true }], ax: "type-path" },
  { id: "edit-page-add-compound-clip", intent: "Compound the selected clips into a single compound clip", menu: ["Clip", "New Compound Clip..."] },
  { id: "edit-page-decompose-compound", intent: "Decompose the selected compound clip back to its component clips", menu: ["Clip", "Decompose"] },
  { id: "edit-page-new-fusion-clip", intent: "Create a new Fusion clip from the selected timeline clips", menu: ["Clip", "New Fusion Clip"] },
  { id: "edit-page-detach-audio", intent: "Detach audio from the selected video clip into a separate timeline track", menu: ["Clip", "Detach Audio"] },
  { id: "edit-page-link-clips-by-time", intent: "Link selected video and audio clips that share matching timecode", menu: ["Clip", "Link Clips"] },
  { id: "edit-page-paste-attributes", intent: "Open the Paste Attributes dialog for the selected timeline clip", menu: ["Edit", "Paste Attributes..."] },
  { id: "edit-page-remove-attributes", intent: "Remove all per-clip attributes (transform / opacity / retime) from the selected clip", menu: ["Edit", "Remove Attributes..."], risk: "destructive" },
  { id: "edit-page-stabilize-show-inspector", intent: "Show the Stabilization controls in the Inspector for the selected clip", menu: ["Clip", "Open Inspector", "Stabilization"] },
  { id: "edit-page-color-tab", intent: "Open the Color tab in the Inspector for the selected clip on the Edit page", menu: ["Clip", "Open Inspector", "Color"] },
  { id: "edit-page-audio-tab", intent: "Open the Audio tab in the Inspector for the selected audio clip", menu: ["Clip", "Open Inspector", "Audio"] },
  { id: "edit-page-effects-tab", intent: "Open the Effects tab in the Inspector for the selected clip", menu: ["Clip", "Open Inspector", "Effects"] },
  { id: "edit-page-transitions-tab", intent: "Open the Transitions tab in the Inspector for the selected transition", menu: ["Clip", "Open Inspector", "Transitions"] },
  { id: "edit-page-flag-clip-blue", intent: "Add a Blue flag to the selected timeline clip", menu: ["Clip", "Flag", "Blue"] },
  { id: "edit-page-flag-clip-red", intent: "Add a Red flag to the selected timeline clip", menu: ["Clip", "Flag", "Red"] },
  { id: "edit-page-flag-clip-green", intent: "Add a Green flag to the selected timeline clip", menu: ["Clip", "Flag", "Green"] },
  { id: "edit-page-clear-flags", intent: "Clear all flags on the selected timeline clip", menu: ["Clip", "Flag", "Clear All"] },
  { id: "edit-page-clip-color-blue", intent: "Set the timeline clip color to Blue on the selected clip", menu: ["Clip", "Clip Color", "Blue"] },
  { id: "edit-page-clip-color-red", intent: "Set the timeline clip color to Red on the selected clip", menu: ["Clip", "Clip Color", "Red"] },
  { id: "edit-page-clip-color-green", intent: "Set the timeline clip color to Green on the selected clip", menu: ["Clip", "Clip Color", "Green"] },
  { id: "edit-page-clip-color-clear", intent: "Clear the per-clip color tag on the selected clip", menu: ["Clip", "Clip Color", "Clear"] },
  { id: "page-cycle-toolbar-left", intent: "Cycle the page-bar selection one to the left", menu: ["Workspace", "Switch to Page", "Previous Page"] },
  { id: "show-keyboard-customization-shortcut", intent: "Open Keyboard Customization (cmd+option+K)", k: "cmd+option+k" },
  { id: "open-burn-in-presets", intent: "Open the Data Burn-In presets dropdown", menu: ["Workspace", "Data Burn In", "Presets"] },
  { id: "view-toggle-clip-name-overlay", intent: "Toggle the Clip Name overlay in the timeline viewer", menu: ["View", "Show Clip Names"] },
  { id: "view-toggle-marker-overlay", intent: "Toggle Marker overlay visibility in the timeline viewer", menu: ["View", "Show Markers"] },
  { id: "view-toggle-zebra-stripes", intent: "Toggle Zebra Stripes overlay in the viewer (over-exposure indicator)", menu: ["View", "Show Zebra"] },
  { id: "view-toggle-false-color", intent: "Toggle the False Color exposure overlay in the viewer", menu: ["View", "Show False Color"] },
  { id: "view-toggle-out-of-gamut-warning", intent: "Toggle Out-of-Gamut warning overlay in the viewer", menu: ["View", "Show Gamut Warning"] },
  { id: "view-toggle-broadcast-safe", intent: "Toggle Broadcast Safe range warning overlay in the viewer", menu: ["View", "Show Broadcast Safe"] },
  { id: "fairlight-loudness-meter", intent: "Open the Loudness Meter on the Fairlight page", menu: ["Workspace", "Show Page", "Fairlight", "Loudness Meter"] },
  { id: "fairlight-fix-room-tone", intent: "Open the Audio Fix dialog for the selected clip on the Fairlight page", menu: ["Fairlight", "Audio Fix..."] },
  { id: "fairlight-render-mix", intent: "Render the audio mix to a single track / file", menu: ["Fairlight", "Render Audio..."], risk: "destructive" },
  { id: "fairlight-set-monitoring-output", intent: "Open the Monitoring output / patch panel on the Fairlight page", menu: ["Fairlight", "Monitoring..."] },
  { id: "edit-page-zoom-track-vertical", intent: "Increase the vertical track height on the Edit page timeline", menu: ["View", "Zoom", "Track Heights Increase"] },
  { id: "edit-page-zoom-track-vertical-decrease", intent: "Decrease the vertical track height on the Edit page timeline", menu: ["View", "Zoom", "Track Heights Decrease"] },
  { id: "edit-page-show-track-numbers", intent: "Toggle track-number labels on the Edit page timeline", menu: ["View", "Show Track Numbers"] },
  { id: "edit-page-show-edit-points-only", intent: "Show only edit points (slim mode) on the Edit page timeline", menu: ["View", "Slim Timeline"] },
  { id: "edit-page-show-locator-bar", intent: "Toggle the Locator bar (timecode strip) on the Edit page timeline", menu: ["View", "Show Locator Bar"] },
  { id: "color-render-cache-clip", intent: "Force render-cache the currently selected clip on the Color page", menu: ["Playback", "Render Cache", "Cache Selected Clips"] },
  { id: "color-clear-cache-clip", intent: "Clear render cache for the currently selected clip on the Color page", menu: ["Playback", "Delete Render Cache", "Selected Clips"], risk: "destructive" },
  { id: "fairlight-show-vu-meters", intent: "Switch Fairlight meters to VU style", menu: ["Fairlight", "Meter Settings", "VU"] },
  { id: "fairlight-show-loudness-meters", intent: "Switch Fairlight meters to Loudness (LUFS) style", menu: ["Fairlight", "Meter Settings", "Loudness"] },
);

// Sanity-check: dedupe at this point (errors should fall out earlier).
const seen = new Set();
for (const t of TUPLES) {
  if (seen.has(t.id)) {
    console.error(`Duplicate id: ${t.id}`);
    process.exit(1);
  }
  seen.add(t.id);
}

if (TUPLES.length < 327) {
  console.error(`Expected at least 327 tuples, got ${TUPLES.length}.`);
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Per-shortcut field generation.
// ----------------------------------------------------------------------------

const SUBMITTED_DATES = [
  "2026-04-15", "2026-04-18", "2026-04-21", "2026-04-23", "2026-04-25",
  "2026-04-27", "2026-04-29", "2026-05-01", "2026-05-02", "2026-05-03",
  "2026-05-04", "2026-05-05"
];

// Coarse buckets so values aren't all identical.
function pickSpeedAndCost(t) {
  // Single-key or modal-less key combo: cheap, fast.
  if (t.key) return { token_cost_estimate: 4, speed_estimate_ms: 90 };
  if (t.k && !t.k.includes("shift+S") && t.id !== "save-project" && t.id !== "save-project-as") {
    // Most key combos are quick.
    const seed = t.id.length;
    return {
      token_cost_estimate: 5 + (seed % 8),                    // 5..12
      speed_estimate_ms: 100 + ((seed * 13) % 250)            // 100..349
    };
  }
  // Menu navigations: slower.
  if (t.menu) {
    const depth = t.menu.length;
    const hasParam = (t.params ?? []).length > 0;
    const seed = t.id.length;
    return {
      token_cost_estimate: hasParam ? 40 + (seed % 30) : 18 + (depth * 4) + (seed % 7),
      speed_estimate_ms: hasParam ? 1500 + ((seed * 11) % 1300) : 600 + (depth * 90) + ((seed * 7) % 250)
    };
  }
  // Save/save-as paths: a little heavier than other key combos.
  return { token_cost_estimate: 30, speed_estimate_ms: 900 };
}

function pickDate(t) {
  // Hash the id stably to a date in the range.
  let h = 0;
  for (const ch of t.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBMITTED_DATES[h % SUBMITTED_DATES.length];
}

function buildVerification(t) {
  // For a few generic ones we customize. Otherwise a templated yes/no question.
  if (t.id === "save-project") {
    return {
      type: "interpret_check",
      question: "Has the current DaVinci Resolve project been saved (no unsaved-changes asterisk in the title bar, no Save dialog visible)?",
      expected: "yes"
    };
  }
  if (t.id === "save-project-as") {
    return {
      type: "interpret_check",
      question: "Has DaVinci Resolve completed a Save As (the new project name is visible in the title bar and no Save As dialog remains)?",
      expected: "yes"
    };
  }
  if (t.id.startsWith("export-") || t.id.startsWith("color-export-")) {
    return {
      type: "interpret_check",
      question: `Has the export to {path} completed successfully (no error dialog visible, the export progress indicator is gone)?`,
      expected: "yes"
    };
  }
  if (t.id.startsWith("import-") || t.id === "color-import-grade") {
    return {
      type: "interpret_check",
      question: `Has the import from {path} completed successfully (the imported content appears in DaVinci Resolve, no error dialog)?`,
      expected: "yes"
    };
  }
  if (t.id === "open-file-import-media" || t.id === "import-folder-of-media") {
    return {
      type: "interpret_check",
      question: `Did the media at {path} import successfully (it now appears in the Media Pool with no error dialog)?`,
      expected: "yes"
    };
  }
  if (t.id === "media-page-relink-clips") {
    return {
      type: "interpret_check",
      question: `Have the offline clips been relinked successfully against {path} (clips no longer show as offline in the Media Pool)?`,
      expected: "yes"
    };
  }
  if (t.id === "edit-add-subtitle-from-text") {
    return {
      type: "interpret_check",
      question: `Has a subtitle clip with the text '{text}' been added to the timeline at the playhead position?`,
      expected: "yes"
    };
  }
  if (t.id === "media-page-create-smart-bin") {
    return {
      type: "interpret_check",
      question: `Has a new Smart Bin named '{name}' been added to the Media Pool sidebar?`,
      expected: "yes"
    };
  }
  if (t.id === "color-apply-lut-by-name") {
    return {
      type: "interpret_check",
      question: `Has the LUT '{lut_name}' been applied to the currently selected color node (LUT name visible in the node strip)?`,
      expected: "yes"
    };
  }
  if (t.id === "import-project-file") {
    return {
      type: "interpret_check",
      question: `Has the project at {path} imported successfully into the current project library?`,
      expected: "yes"
    };
  }
  if (t.id === "export-project-file") {
    return {
      type: "interpret_check",
      question: `Has the project successfully exported to {path} (no error dialog, export progress complete)?`,
      expected: "yes"
    };
  }
  // Generic templated.
  return {
    type: "interpret_check",
    question: `Looking at the screen, did the action complete successfully — i.e., the screen now reflects the intent: ${t.intent}?`,
    expected: "yes"
  };
}

function buildActions(t) {
  // Path-typing tail: open dialog, type path into the file dialog (Resolve uses
  // its own modal but most respond to a typed absolute path + enter on macOS).
  if (t.ax === "type-path") {
    if (t.menu) {
      return [
        { type: "menu", path: t.menu },
        { type: "type_text", text: "{path}" },
        { type: "key", key: "enter" },
        { type: "key", key: "enter" }
      ];
    }
  }
  if (t.ax === "type-text") {
    if (t.menu) {
      const paramName = (t.params ?? [])[0]?.name ?? "name";
      return [
        { type: "menu", path: t.menu },
        { type: "type_text", text: `{${paramName}}` },
        { type: "key", key: "enter" }
      ];
    }
  }
  if (t.ax === "type-subtitle") {
    return [
      { type: "menu", path: t.menu },
      { type: "type_text", text: "{text}" },
      { type: "key", key: "enter" }
    ];
  }
  if (t.menu) {
    return [{ type: "menu", path: t.menu }];
  }
  if (t.k) {
    return [{ type: "key_combo", keys: { macos: t.k } }];
  }
  if (t.key) {
    return [{ type: "key", key: t.key }];
  }
  throw new Error(`Tuple ${t.id} has no action source`);
}

function buildMethod(t) {
  if (t.menu) return "menu";
  return "shortcut";
}

const shortcuts = TUPLES.map((t) => {
  const { token_cost_estimate, speed_estimate_ms } = pickSpeedAndCost(t);
  const submitted_at = pickDate(t);
  const out = {
    id: t.id,
    intent: t.intent,
    parameters: t.params ?? [],
    platforms: PLATFORMS,
    app_versions: APP_VERSIONS,
    method: buildMethod(t),
    actions: buildActions(t),
    verification: buildVerification(t)
  };
  if (t.risk) out.risk = t.risk;
  out.metadata = {
    contributor_id: "seed",
    payment_destination: null,
    token_cost_estimate,
    speed_estimate_ms,
    submitted_at
  };
  return out;
});

const file = {
  schema_version: 1,
  app_id: APP_ID,
  shortcuts
};

writeFileSync(OUT, JSON.stringify(file, null, 2) + "\n", "utf8");
console.log(`Wrote ${shortcuts.length} shortcuts to ${OUT}`);
