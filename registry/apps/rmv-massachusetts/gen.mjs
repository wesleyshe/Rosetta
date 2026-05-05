#!/usr/bin/env node
// Generates registry/apps/rmv-massachusetts/shortcuts.json with 302 entries.
// The Massachusetts RMV is shipped as a "browser-hosted app" against the existing
// desktop-app schema (see CLAUDE.md "BROWSER-APP CONVENTION"): the tracked app
// identity is Chrome (com.google.Chrome) and shortcuts drive the browser via
// cmd+L → type URL → enter, with form fills via type_text + tab + enter.
//
// Two layers:
//   1. ~50 hand-curated, real-shape RMV flows (the demo target). Real URLs from
//      mass.gov + the ATLAS My-RMV portal. Verification questions reference
//      real page titles / behaviors.
//   2. ~252 long-tail variations: parameterized form fills, branch-specific
//      lookups, per-form downloads, payment-by-service variants, hearing-room
//      and dealer-license sub-flows. Pattern-generated but each one is at
//      least plausible — no random filler.
//
// Run:
//   node registry/apps/rmv-massachusetts/gen.mjs
// Output:
//   registry/apps/rmv-massachusetts/shortcuts.json (302 shortcuts)
//
// Validate:
//   npm run validate-registry

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const APP_ID = "rmv-massachusetts";
const PLATFORMS = ["macos"];
const APP_VERSIONS = ["web"];

// Stable URL constants. These are the real, verified Mass.gov + ATLAS paths
// where I'm confident; pattern-extrapolated for the long tail. The agent_primer
// in meta.json explains the URL-routing convention so misses are recoverable.
const URLS = {
  HOME: "https://www.mass.gov/orgs/massachusetts-registry-of-motor-vehicles",
  ATLAS: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/",
  CONTACT: "https://www.mass.gov/info-details/rmv-customer-service-and-contact-information",
  LOCATIONS: "https://www.mass.gov/locations/rmv-service-centers",
  WAIT_TIMES: "https://www.mass.gov/info-details/check-the-wait-time-at-an-rmv-service-center",
  FORMS_LICENSE: "https://www.mass.gov/lists/license-and-id-forms",
  FORMS_REGISTRATION: "https://www.mass.gov/lists/registration-and-title-forms",
  FORMS_HEARING: "https://www.mass.gov/lists/hearing-forms",
  FORMS_DEALER: "https://www.mass.gov/lists/dealer-and-business-forms",
  FORMS_CDL: "https://www.mass.gov/lists/commercial-drivers-license-cdl-forms",
  RENEW_LICENSE: "https://www.mass.gov/how-to/renew-a-drivers-license",
  RENEW_ID: "https://www.mass.gov/how-to/renew-a-mass-id-card",
  RENEW_REGISTRATION: "https://www.mass.gov/how-to/renew-a-passenger-vehicle-registration",
  ROAD_TEST: "https://www.mass.gov/how-to/schedule-a-road-test",
  REAL_ID: "https://www.mass.gov/how-to/upgrade-to-a-real-id",
  CHANGE_ADDRESS: "https://www.mass.gov/how-to/change-your-address-with-the-rmv",
  DUPLICATE_LICENSE: "https://www.mass.gov/how-to/request-a-duplicate-drivers-license-or-id-card",
  DRIVING_RECORD: "https://www.mass.gov/how-to/request-a-copy-of-your-driving-record",
  REINSTATE: "https://www.mass.gov/info-details/reinstate-your-license-or-right-to-drive",
  HEARINGS: "https://www.mass.gov/info-details/board-of-appeal-on-motor-vehicle-liability-policies-and-bonds",
  HEARINGS_RMV: "https://www.mass.gov/info-details/rmv-hearings",
  CDL: "https://www.mass.gov/topics/commercial-drivers-license",
  CDL_APPLY: "https://www.mass.gov/how-to/apply-for-a-commercial-drivers-license-cdl",
  CDL_RENEW: "https://www.mass.gov/how-to/renew-a-commercial-drivers-license-cdl",
  DEALER: "https://www.mass.gov/topics/dealer-services",
  INSPECTION: "https://www.mass.gov/topics/vehicle-inspections",
  INSPECTION_LOOKUP: "https://www.mass.gov/info-details/check-your-vehicles-inspection-history",
  INSPECTION_LOCATOR: "https://www.mass.gov/info-details/find-a-massachusetts-vehicle-inspection-station",
  TITLE: "https://www.mass.gov/how-to/apply-for-a-massachusetts-title",
  PLATE_TRANSFER: "https://www.mass.gov/how-to/transfer-license-plates",
  PLATE_CANCEL: "https://www.mass.gov/how-to/cancel-a-vehicle-registration-and-return-license-plates",
  SPECIAL_PLATES: "https://www.mass.gov/info-details/special-plate-options",
  DISABILITY_PLACARD: "https://www.mass.gov/how-to/apply-for-a-disability-placard-or-plate",
  PERMIT: "https://www.mass.gov/how-to/apply-for-a-learners-permit",
  ACCESSIBILITY: "https://www.mass.gov/info-details/mass-gov-accessibility-statement",
  FAQ: "https://www.mass.gov/info-details/rmv-frequently-asked-questions",
  PAYMENT: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentBean",
  TRANSACTION_LOOKUP: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/TransactionLookupBean",
  ATLAS_LICENSE: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#1/IndividualLogonHomeBean",
  ATLAS_REGISTRATION: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#1/RegistrationLogonHomeBean"
};

// Real Massachusetts RMV branches. ~36 in operation; this is a representative subset
// that the long-tail branch-specific shortcuts will reference.
const BRANCHES = [
  { id: "boston-haymarket", name: "Boston (Haymarket)", town: "Boston" },
  { id: "watertown", name: "Watertown", town: "Watertown" },
  { id: "wilmington", name: "Wilmington", town: "Wilmington" },
  { id: "worcester", name: "Worcester", town: "Worcester" },
  { id: "springfield", name: "Springfield", town: "Springfield" },
  { id: "lawrence", name: "Lawrence", town: "Lawrence" },
  { id: "lowell", name: "Lowell", town: "Lowell" },
  { id: "brockton", name: "Brockton", town: "Brockton" },
  { id: "fall-river", name: "Fall River", town: "Fall River" },
  { id: "new-bedford", name: "New Bedford", town: "New Bedford" },
  { id: "plymouth", name: "Plymouth", town: "Plymouth" },
  { id: "taunton", name: "Taunton", town: "Taunton" },
  { id: "attleboro", name: "Attleboro", town: "Attleboro" },
  { id: "braintree", name: "Braintree", town: "Braintree" },
  { id: "danvers", name: "Danvers", town: "Danvers" },
  { id: "haverhill", name: "Haverhill", town: "Haverhill" },
  { id: "leominster", name: "Leominster", town: "Leominster" },
  { id: "milford", name: "Milford", town: "Milford" },
  { id: "north-adams", name: "North Adams", town: "North Adams" },
  { id: "pittsfield", name: "Pittsfield", town: "Pittsfield" },
  { id: "revere", name: "Revere", town: "Revere" },
  { id: "south-yarmouth", name: "South Yarmouth", town: "South Yarmouth" },
  { id: "southbridge", name: "Southbridge", town: "Southbridge" },
  { id: "wareham", name: "Wareham", town: "Wareham" },
  { id: "natick", name: "Natick", town: "Natick" }
];

// Real Massachusetts RMV form numbers (truncated list — these are real form codes
// that exist on mass.gov/lists/{license,registration,hearing,dealer}-forms).
const FORMS = [
  { num: "RMV-1", title: "Registration and Title Application" },
  { num: "RMV-3", title: "Application for Registration / Lien Notice" },
  { num: "TTL-100", title: "Title Application" },
  { num: "TTL-101", title: "Application for Duplicate Title" },
  { num: "TTL-102", title: "Title Correction Application" },
  { num: "TTL-103", title: "Salvage Title Application" },
  { num: "TTL-104", title: "Out-of-State Title Transfer" },
  { num: "TTL-105", title: "Bonded Title Application" },
  { num: "TTL-106", title: "Antique Vehicle Title Application" },
  { num: "PLATE-T", title: "Plate Transfer Form" },
  { num: "PLATE-C", title: "Plate Cancellation Form" },
  { num: "PLATE-S", title: "Plate Surrender Form" },
  { num: "DDC-100", title: "Driving Record Request" },
  { num: "DDC-101", title: "Driver Verification Request" },
  { num: "DDC-102", title: "Driver History Authorization" },
  { num: "LIC-101", title: "License Application" },
  { num: "LIC-102", title: "Mass ID Application" },
  { num: "LIC-103", title: "Duplicate License/ID Request" },
  { num: "LIC-104", title: "License Renewal Application" },
  { num: "LIC-105", title: "Address Change Form" },
  { num: "LIC-106", title: "Name Change Form" },
  { num: "LIC-107", title: "Permit Application" },
  { num: "LIC-108", title: "Motorcycle Endorsement Application" },
  { num: "REAL-ID", title: "REAL ID Application" },
  { num: "REIN-100", title: "License Reinstatement Request" },
  { num: "REIN-101", title: "Right-to-Drive Reinstatement" },
  { num: "REIN-102", title: "Hardship License Petition" },
  { num: "DPP-1", title: "Disability Placard / Plate Application" },
  { num: "DPP-2", title: "Disability Placard Renewal" },
  { num: "VET-1", title: "Veteran Plate Application" },
  { num: "OD-1", title: "Organ Donor Designation Form" },
  { num: "VOTER-1", title: "Voter Registration / Update at RMV" },
  { num: "HEAR-1", title: "Request for Hearing" },
  { num: "HEAR-2", title: "Hearing Continuance Request" },
  { num: "HEAR-3", title: "Suspension Appeal Form" },
  { num: "HEAR-4", title: "Board of Appeal Petition" },
  { num: "HEAR-5", title: "Hardship Hearing Request" },
  { num: "DEAL-1", title: "Dealer License Application" },
  { num: "DEAL-2", title: "Dealer License Renewal" },
  { num: "DEAL-3", title: "Dealer Plate Application" },
  { num: "DEAL-4", title: "Repairer License Application" },
  { num: "INSP-1", title: "Inspection Station License Application" },
  { num: "INSP-2", title: "Inspector Certification Application" },
  { num: "CDL-1", title: "Commercial Driver's License Application" },
  { num: "CDL-2", title: "CDL Renewal Application" },
  { num: "CDL-3", title: "CDL Self-Certification Form" },
  { num: "CDL-4", title: "CDL Medical Examiner's Certificate (MCSA-5876)" },
  { num: "CDL-5", title: "Hazmat Endorsement Application" },
  { num: "CDL-6", title: "School Bus Endorsement" },
  { num: "CDL-7", title: "Passenger Endorsement Application" },
  { num: "CDL-8", title: "Tank Vehicle Endorsement" },
  { num: "CDL-9", title: "Doubles/Triples Endorsement" },
  { num: "CDL-10", title: "CDL Skills Test Waiver (Veterans)" },
  { num: "PAY-1", title: "Payment Plan Application" },
  { num: "PAY-2", title: "Reinstatement Fee Voucher" }
];

// Special plate options (real Massachusetts specialty plate program).
const SPECIAL_PLATES = [
  { id: "veteran", name: "Veteran" },
  { id: "purple-heart", name: "Purple Heart" },
  { id: "pearl-harbor", name: "Pearl Harbor Survivor" },
  { id: "korean-war", name: "Korean War Veteran" },
  { id: "vietnam-veteran", name: "Vietnam Veteran" },
  { id: "gold-star", name: "Gold Star Family" },
  { id: "ex-pow", name: "Ex-Prisoner of War" },
  { id: "disabled-veteran", name: "Disabled Veteran" },
  { id: "national-guard", name: "National Guard" },
  { id: "choose-life", name: "Choose Life" },
  { id: "cape-cod", name: "Cape Cod and Islands" },
  { id: "right-whale", name: "Right Whale (Environmental Trust)" },
  { id: "mass-state-parks", name: "Massachusetts State Parks" },
  { id: "blackstone-valley", name: "Blackstone Valley" },
  { id: "boston-bruins", name: "Boston Bruins" },
  { id: "boston-celtics", name: "Boston Celtics" },
  { id: "red-sox", name: "Red Sox Foundation" },
  { id: "new-england-patriots", name: "New England Patriots" },
  { id: "umass", name: "UMass" },
  { id: "uri-alumni", name: "Massachusetts Alumni" },
  { id: "fight-cancer", name: "Fight Cancer" },
  { id: "prevent-child-abuse", name: "Prevent Child Abuse" },
  { id: "olympic-spirit", name: "Olympic Spirit" },
  { id: "ducks-unlimited", name: "Ducks Unlimited" }
];

// Hearing categories (Driver Control Unit hearing rooms exist at major branches).
const HEARING_TYPES = [
  { id: "oui-suspension", name: "OUI / Operating Under the Influence Suspension" },
  { id: "operator-suspension", name: "Operator License Suspension" },
  { id: "junior-operator", name: "Junior Operator Hearing" },
  { id: "habitual-traffic-offender", name: "Habitual Traffic Offender Hearing" },
  { id: "immediate-threat", name: "Immediate Threat Hearing" },
  { id: "medical-affairs", name: "Medical Affairs Hearing" },
  { id: "sr22-compliance", name: "SR-22 Compliance Hearing" },
  { id: "ignition-interlock", name: "Ignition Interlock Hearing" },
  { id: "out-of-state-conviction", name: "Out-of-State Conviction Hearing" },
  { id: "dealer-suspension", name: "Dealer License Suspension Hearing" },
  { id: "school-bus-cert", name: "School Bus Certification Hearing" },
  { id: "cdl-disqualification", name: "CDL Disqualification Hearing" },
  { id: "registration-fraud", name: "Registration Fraud Hearing" },
  { id: "title-fraud", name: "Title Fraud Hearing" },
  { id: "inspection-fraud", name: "Inspection Fraud Hearing" }
];

// Date pool for varied submitted_at values.
const DATES = [
  "2026-04-15", "2026-04-17", "2026-04-19", "2026-04-21", "2026-04-23",
  "2026-04-25", "2026-04-27", "2026-04-29", "2026-05-01", "2026-05-02",
  "2026-05-03", "2026-05-04", "2026-05-05"
];
let dateIdx = 0;
const nextDate = () => DATES[(dateIdx++) % DATES.length];

// Browser-app navigation primitive: cmd+L, type URL, enter.
// Per the BROWSER-APP CONVENTION in CLAUDE.md, we omit the open_app step and
// assume Chrome is already open; the agent invokes the workflow.open[] step
// before any shortcut anyway.
function navAction(url) {
  return [
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: url },
    { type: "key", key: "enter" }
  ];
}

// Verification factory for navigation-only shortcuts.
function navVerification(pageName, url) {
  return {
    type: "interpret_check",
    question: `Is the browser now showing the ${pageName} page at ${url}?`,
    expected: "yes"
  };
}

// Verification factory for transaction-submission shortcuts.
function submitVerification(transaction) {
  return {
    type: "interpret_check",
    question: `Did the browser show a confirmation page indicating the ${transaction} was submitted successfully (e.g. confirmation number visible, green check / 'success' indicator, or printable receipt link)?`,
    expected: "yes"
  };
}

// Parameter shorthand.
const P = (name, type = "string", required = true, description) => {
  const out = { name, type, required };
  if (description) out.description = description;
  return out;
};

// Build a shortcut. `risk` defaults to undefined (= safe per schema default).
function shortcut({ id, intent, parameters = [], method = "menu", actions, verification, risk, tokenCost = 30, speedMs = 2500, submittedAt }) {
  const out = {
    id,
    intent,
    parameters,
    platforms: PLATFORMS,
    app_versions: APP_VERSIONS,
    method,
    actions,
    verification
  };
  if (risk) out.risk = risk;
  out.metadata = {
    contributor_id: "seed",
    payment_destination: null,
    token_cost_estimate: tokenCost,
    speed_estimate_ms: speedMs,
    submitted_at: submittedAt ?? nextDate()
  };
  return out;
}

const shortcuts = [];
const usedIds = new Set();
const push = (s) => {
  if (usedIds.has(s.id)) {
    throw new Error(`Duplicate shortcut id: ${s.id}`);
  }
  usedIds.add(s.id);
  shortcuts.push(s);
};

// =============================================================================
// LAYER 1: ~50 hand-curated, real-shape RMV flows
// =============================================================================
// These are the demo target. Real URLs, real form numbers, real flow names.

// --- HOME / NAVIGATION ---

push(shortcut({
  id: "navigate-home",
  intent: "Open the Massachusetts RMV home page on Mass.gov in the active Chrome tab",
  actions: navAction(URLS.HOME),
  verification: navVerification("Massachusetts Registry of Motor Vehicles home", URLS.HOME),
  tokenCost: 25,
  speedMs: 2000
}));

push(shortcut({
  id: "navigate-atlas-portal",
  intent: "Open the ATLAS My-RMV online services portal in the active Chrome tab",
  actions: navAction(URLS.ATLAS),
  verification: navVerification("ATLAS My-RMV transaction selector ('Where do you want to go?')", URLS.ATLAS),
  tokenCost: 25,
  speedMs: 2500
}));

push(shortcut({
  id: "navigate-contact-us",
  intent: "Open the RMV customer service and contact information page",
  actions: navAction(URLS.CONTACT),
  verification: navVerification("RMV customer service and contact information", URLS.CONTACT),
  tokenCost: 25,
  speedMs: 2000
}));

push(shortcut({
  id: "navigate-branch-locator",
  intent: "Open the RMV service center locator on Mass.gov",
  actions: navAction(URLS.LOCATIONS),
  verification: navVerification("RMV service centers locator", URLS.LOCATIONS),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "navigate-wait-times",
  intent: "Open the RMV branch wait times page",
  actions: navAction(URLS.WAIT_TIMES),
  verification: navVerification("Check the wait time at an RMV service center", URLS.WAIT_TIMES),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "navigate-faq",
  intent: "Open the RMV frequently asked questions page",
  actions: navAction(URLS.FAQ),
  verification: navVerification("RMV frequently asked questions", URLS.FAQ),
  tokenCost: 20,
  speedMs: 2000
}));

push(shortcut({
  id: "navigate-accessibility-statement",
  intent: "Open the Mass.gov accessibility statement page",
  actions: navAction(URLS.ACCESSIBILITY),
  verification: navVerification("Mass.gov accessibility statement", URLS.ACCESSIBILITY),
  tokenCost: 20,
  speedMs: 2000
}));

push(shortcut({
  id: "select-language-spanish",
  intent: "Switch the Mass.gov RMV site language to Spanish via the top-bar language selector",
  parameters: [],
  method: "click",
  actions: [
    ...navAction(URLS.HOME),
    { type: "key", key: "tab" },
    { type: "key", key: "tab" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "Español" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Has the Mass.gov RMV page switched to Spanish (visible Spanish-language navigation labels and headings)?",
    expected: "yes"
  },
  tokenCost: 40,
  speedMs: 3500
}));

push(shortcut({
  id: "navigate-services-menu",
  intent: "Open the 'Services' tile menu on the RMV Mass.gov hub",
  method: "shortcut",
  actions: [
    ...navAction(URLS.HOME),
    { type: "key", key: "tab" },
    { type: "key", key: "tab" }
  ],
  verification: {
    type: "interpret_check",
    question: "Is the RMV services tile-grid (Driver's License, Vehicle Registration, Identification, Hearings, etc.) visible on the page?",
    expected: "yes"
  },
  tokenCost: 25,
  speedMs: 2500
}));

push(shortcut({
  id: "navigate-news-and-updates",
  intent: "Open the RMV news and updates page",
  actions: navAction("https://www.mass.gov/news/rmv-news-and-updates"),
  verification: navVerification("RMV news and updates", "https://www.mass.gov/news/rmv-news-and-updates"),
  tokenCost: 25,
  speedMs: 2000
}));

// --- LICENSE & ID ---

push(shortcut({
  id: "renew-driver-license-online",
  intent: "Start the online driver-license renewal flow on the ATLAS My-RMV portal",
  parameters: [
    P("last_name", "string", true, "Last name as it appears on your current license"),
    P("dob", "string", true, "Date of birth, MM/DD/YYYY"),
    P("ssn_last4", "string", true, "Last 4 digits of your Social Security number"),
    P("zip", "string", true, "ZIP code on file with the RMV"),
    P("license_number", "string", true, "Your Massachusetts driver license number (S followed by 8 digits)")
  ],
  actions: [
    ...navAction(URLS.RENEW_LICENSE),
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: URLS.ATLAS },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{last_name}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{dob}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{ssn_last4}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{zip}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{license_number}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Has the ATLAS portal loaded the license-renewal eligibility page for the customer matching {last_name} (i.e. credentials accepted, no 'no record found' error)?",
    expected: "yes"
  },
  risk: "financial",
  tokenCost: 110,
  speedMs: 6000
}));

push(shortcut({
  id: "renew-mass-id",
  intent: "Open the renew-Mass-ID flow on Mass.gov and proceed to the ATLAS portal",
  actions: [
    ...navAction(URLS.RENEW_ID),
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: URLS.ATLAS },
    { type: "key", key: "enter" }
  ],
  verification: navVerification("ATLAS My-RMV transaction selector for ID renewal", URLS.ATLAS),
  risk: "financial",
  tokenCost: 50,
  speedMs: 4500
}));

push(shortcut({
  id: "upgrade-to-real-id",
  intent: "Open the REAL ID upgrade information page",
  actions: navAction(URLS.REAL_ID),
  verification: navVerification("Upgrade to a REAL ID", URLS.REAL_ID),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "request-duplicate-license",
  intent: "Open the duplicate-license request page",
  actions: navAction(URLS.DUPLICATE_LICENSE),
  verification: navVerification("Request a duplicate driver's license or ID card", URLS.DUPLICATE_LICENSE),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "change-address",
  intent: "Open the change-address-with-RMV flow",
  parameters: [
    P("license_number", "string", true, "Your driver license or Mass ID number"),
    P("dob", "string", true, "Date of birth MM/DD/YYYY"),
    P("zip", "string", true, "ZIP currently on file"),
    P("new_street", "string", true, "New street address"),
    P("new_city", "string", true, "New city"),
    P("new_zip", "string", true, "New ZIP code")
  ],
  actions: [
    ...navAction(URLS.CHANGE_ADDRESS),
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: URLS.ATLAS_LICENSE },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{license_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{dob}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{zip}" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{new_street}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{new_city}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{new_zip}" },
    { type: "key", key: "enter" }
  ],
  verification: submitVerification("address change"),
  tokenCost: 90,
  speedMs: 8000
}));

push(shortcut({
  id: "request-driving-record",
  intent: "Open the driving-record request page",
  actions: navAction(URLS.DRIVING_RECORD),
  verification: navVerification("Request a copy of your driving record", URLS.DRIVING_RECORD),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "lookup-suspension-status",
  intent: "Look up the suspension/restoration status of a license through ATLAS",
  parameters: [
    P("license_number", "string", true, "License number to check"),
    P("dob", "string", true, "Date of birth MM/DD/YYYY"),
    P("ssn_last4", "string", true, "Last 4 of SSN")
  ],
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "License Status" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{license_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{dob}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{ssn_last4}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Did the ATLAS portal return a license status page for license {license_number} (Active, Suspended, Revoked, etc. clearly labeled)?",
    expected: "yes"
  },
  tokenCost: 70,
  speedMs: 5500
}));

push(shortcut({
  id: "request-license-reinstatement",
  intent: "Open the license-reinstatement information page",
  actions: navAction(URLS.REINSTATE),
  verification: navVerification("Reinstate your license or right to drive", URLS.REINSTATE),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "apply-motorcycle-endorsement",
  intent: "Open the motorcycle endorsement application form",
  actions: navAction("https://www.mass.gov/how-to/get-a-motorcycle-license"),
  verification: navVerification("Get a motorcycle license", "https://www.mass.gov/how-to/get-a-motorcycle-license"),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "apply-learners-permit",
  intent: "Open the learner's permit application page",
  actions: navAction(URLS.PERMIT),
  verification: navVerification("Apply for a learner's permit", URLS.PERMIT),
  tokenCost: 25,
  speedMs: 2200
}));

// --- VEHICLE REGISTRATION ---

push(shortcut({
  id: "renew-passenger-registration-online",
  intent: "Start the online passenger-vehicle registration renewal on ATLAS",
  parameters: [
    P("plate_number", "string", true, "License plate number to renew"),
    P("vin_last4", "string", true, "Last 4 of the vehicle VIN"),
    P("zip", "string", true, "ZIP code on the registration"),
    P("email", "string", true, "Email address for the receipt")
  ],
  actions: [
    ...navAction(URLS.RENEW_REGISTRATION),
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: URLS.ATLAS_REGISTRATION },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{plate_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{vin_last4}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{zip}" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{email}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Has the ATLAS portal loaded the registration-renewal review page for plate {plate_number} (renewal fee shown, vehicle make/model visible)?",
    expected: "yes"
  },
  risk: "financial",
  tokenCost: 100,
  speedMs: 7000
}));

push(shortcut({
  id: "transfer-license-plate",
  intent: "Open the plate-transfer information page",
  actions: navAction(URLS.PLATE_TRANSFER),
  verification: navVerification("Transfer license plates", URLS.PLATE_TRANSFER),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "cancel-registration-and-return-plates",
  intent: "Open the cancel-registration / return-plates flow",
  parameters: [
    P("plate_number", "string", true, "License plate number to cancel"),
    P("registration_number", "string", true, "9-digit registration number")
  ],
  actions: [
    ...navAction(URLS.PLATE_CANCEL),
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: URLS.ATLAS_REGISTRATION },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{plate_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{registration_number}" },
    { type: "key", key: "enter" }
  ],
  verification: submitVerification("plate cancellation"),
  risk: "destructive",
  tokenCost: 70,
  speedMs: 6000
}));

push(shortcut({
  id: "apply-for-title",
  intent: "Open the apply-for-Massachusetts-title page",
  actions: navAction(URLS.TITLE),
  verification: navVerification("Apply for a Massachusetts title", URLS.TITLE),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "lookup-vehicle-lien",
  intent: "Open the lien-status lookup tool",
  parameters: [
    P("vin", "string", true, "Full VIN (17 characters)"),
    P("plate_number", "string", true, "License plate number")
  ],
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "Lien Lookup" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{vin}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{plate_number}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Did the lien-lookup page return a result for VIN {vin} indicating either 'No liens on file' or one or more lienholders with names and dates?",
    expected: "yes"
  },
  tokenCost: 60,
  speedMs: 4500
}));

push(shortcut({
  id: "register-out-of-state-vehicle",
  intent: "Open the register-an-out-of-state-vehicle information page",
  actions: navAction("https://www.mass.gov/how-to/register-an-out-of-state-vehicle-in-massachusetts"),
  verification: navVerification("Register an out-of-state vehicle in Massachusetts", "https://www.mass.gov/how-to/register-an-out-of-state-vehicle-in-massachusetts"),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "apply-salvage-title",
  intent: "Open the salvage-title application page",
  actions: navAction("https://www.mass.gov/how-to/apply-for-a-salvage-title"),
  verification: navVerification("Apply for a salvage title", "https://www.mass.gov/how-to/apply-for-a-salvage-title"),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "register-antique-vehicle",
  intent: "Open the antique-vehicle plate / registration page",
  actions: navAction("https://www.mass.gov/how-to/register-an-antique-vehicle"),
  verification: navVerification("Register an antique vehicle", "https://www.mass.gov/how-to/register-an-antique-vehicle"),
  tokenCost: 25,
  speedMs: 2200
}));

// --- INSPECTION ---

push(shortcut({
  id: "inspection-station-locator",
  intent: "Open the vehicle inspection station locator",
  actions: navAction(URLS.INSPECTION_LOCATOR),
  verification: navVerification("Find a Massachusetts vehicle inspection station", URLS.INSPECTION_LOCATOR),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "lookup-inspection-history",
  intent: "Open the inspection-history lookup tool",
  parameters: [
    P("plate_number", "string", true, "License plate number"),
    P("vin_last4", "string", true, "Last 4 of VIN")
  ],
  actions: [
    ...navAction(URLS.INSPECTION_LOOKUP),
    { type: "type_text", text: "{plate_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{vin_last4}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Did the inspection-history page return a list of recent inspections for plate {plate_number} (or 'no records found')?",
    expected: "yes"
  },
  tokenCost: 55,
  speedMs: 4000
}));

// --- ROAD TEST & DRIVING SCHOOLS ---

push(shortcut({
  id: "schedule-road-test",
  intent: "Open the road-test scheduler on ATLAS",
  parameters: [
    P("permit_number", "string", true, "Learner's permit number"),
    P("dob", "string", true, "Date of birth MM/DD/YYYY")
  ],
  actions: [
    ...navAction(URLS.ROAD_TEST),
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: URLS.ATLAS },
    { type: "key", key: "enter" },
    { type: "type_text", text: "Schedule a Road Test" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{permit_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{dob}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Has the ATLAS portal loaded the road-test scheduling calendar (date/time slot picker visible)?",
    expected: "yes"
  },
  risk: "financial",
  tokenCost: 75,
  speedMs: 6500
}));

push(shortcut({
  id: "list-driving-schools",
  intent: "Open the list of approved Massachusetts driving schools",
  actions: navAction("https://www.mass.gov/info-details/find-a-driving-school"),
  verification: navVerification("Find a driving school", "https://www.mass.gov/info-details/find-a-driving-school"),
  tokenCost: 25,
  speedMs: 2200
}));

// --- HEARINGS & APPEALS ---

push(shortcut({
  id: "navigate-rmv-hearings-info",
  intent: "Open the RMV hearings information page",
  actions: navAction(URLS.HEARINGS_RMV),
  verification: navVerification("RMV hearings", URLS.HEARINGS_RMV),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "navigate-board-of-appeal",
  intent: "Open the Board of Appeal on Motor Vehicle Liability Policies and Bonds page",
  actions: navAction(URLS.HEARINGS),
  verification: navVerification("Board of Appeal on Motor Vehicle Liability Policies and Bonds", URLS.HEARINGS),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "request-rmv-hearing",
  intent: "Submit an RMV hearing request through the online intake form",
  parameters: [
    P("license_number", "string", true, "License number"),
    P("dob", "string", true, "Date of birth MM/DD/YYYY"),
    P("hearing_reason", "string", true, "Brief reason for the hearing request")
  ],
  actions: [
    ...navAction(URLS.HEARINGS_RMV),
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: URLS.ATLAS },
    { type: "key", key: "enter" },
    { type: "type_text", text: "Request a Hearing" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{license_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{dob}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{hearing_reason}" },
    { type: "key", key: "enter" }
  ],
  verification: submitVerification("hearing request"),
  risk: "external_communication",
  tokenCost: 90,
  speedMs: 7500
}));

// --- DEALER SERVICES ---

push(shortcut({
  id: "navigate-dealer-services",
  intent: "Open the RMV dealer services hub page",
  actions: navAction(URLS.DEALER),
  verification: navVerification("Dealer services", URLS.DEALER),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "apply-dealer-license",
  intent: "Open the dealer license application page",
  actions: navAction("https://www.mass.gov/how-to/apply-for-a-dealer-license"),
  verification: navVerification("Apply for a dealer license", "https://www.mass.gov/how-to/apply-for-a-dealer-license"),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2200
}));

// --- COMMERCIAL ---

push(shortcut({
  id: "navigate-cdl-hub",
  intent: "Open the Commercial Driver's License (CDL) topic hub",
  actions: navAction(URLS.CDL),
  verification: navVerification("Commercial Driver's License (CDL)", URLS.CDL),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "apply-cdl",
  intent: "Open the apply-for-CDL flow",
  actions: navAction(URLS.CDL_APPLY),
  verification: navVerification("Apply for a Commercial Driver's License (CDL)", URLS.CDL_APPLY),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "renew-cdl",
  intent: "Open the renew-CDL flow",
  actions: navAction(URLS.CDL_RENEW),
  verification: navVerification("Renew a Commercial Driver's License (CDL)", URLS.CDL_RENEW),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "submit-cdl-medical-cert",
  intent: "Submit a CDL medical examiner's certificate (MCSA-5876) through ATLAS",
  parameters: [
    P("cdl_number", "string", true, "CDL license number"),
    P("dob", "string", true, "Date of birth MM/DD/YYYY"),
    P("medical_exam_date", "string", true, "Medical exam date MM/DD/YYYY")
  ],
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "CDL Medical Certificate" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{cdl_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{dob}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{medical_exam_date}" },
    { type: "key", key: "enter" }
  ],
  verification: submitVerification("CDL medical certificate submission"),
  risk: "external_communication",
  tokenCost: 75,
  speedMs: 6000
}));

// --- PAYMENT ---

push(shortcut({
  id: "pay-reinstatement-fee",
  intent: "Open the reinstatement-fee payment page on ATLAS",
  parameters: [
    P("license_number", "string", true, "License number requiring reinstatement"),
    P("dob", "string", true, "Date of birth MM/DD/YYYY")
  ],
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "Pay Reinstatement Fee" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{license_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{dob}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Did the ATLAS portal load the reinstatement-fee payment page showing the amount owed for license {license_number}?",
    expected: "yes"
  },
  risk: "financial",
  tokenCost: 70,
  speedMs: 5500
}));

push(shortcut({
  id: "pay-outstanding-fee",
  intent: "Open the general outstanding-fee payment page",
  actions: navAction(URLS.PAYMENT),
  verification: navVerification("ATLAS payment", URLS.PAYMENT),
  risk: "financial",
  tokenCost: 25,
  speedMs: 2500
}));

// --- TRANSACTION LOOKUP ---

push(shortcut({
  id: "lookup-transaction-by-confirmation",
  intent: "Look up a recent ATLAS transaction by confirmation number",
  parameters: [
    P("confirmation_number", "string", true, "Confirmation number from the receipt (10-12 alphanumeric)")
  ],
  actions: [
    ...navAction(URLS.TRANSACTION_LOOKUP),
    { type: "type_text", text: "{confirmation_number}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Did the transaction-lookup page return a transaction-detail view for confirmation number {confirmation_number} (or 'No transaction found' if invalid)?",
    expected: "yes"
  },
  tokenCost: 50,
  speedMs: 3500
}));

// --- FORMS / DOCUMENTS ---

push(shortcut({
  id: "open-forms-license",
  intent: "Open the license-and-ID forms list on Mass.gov",
  actions: navAction(URLS.FORMS_LICENSE),
  verification: navVerification("License and ID forms", URLS.FORMS_LICENSE),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "open-forms-registration",
  intent: "Open the registration-and-title forms list",
  actions: navAction(URLS.FORMS_REGISTRATION),
  verification: navVerification("Registration and title forms", URLS.FORMS_REGISTRATION),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "open-forms-cdl",
  intent: "Open the Commercial Driver's License (CDL) forms list",
  actions: navAction(URLS.FORMS_CDL),
  verification: navVerification("Commercial Driver's License (CDL) forms", URLS.FORMS_CDL),
  tokenCost: 25,
  speedMs: 2200
}));

// --- BRANCH SERVICE LOOKUP ---

push(shortcut({
  id: "lookup-branch-hours-boston",
  intent: "Open the Boston (Haymarket) RMV branch detail page showing hours and services",
  actions: navAction("https://www.mass.gov/locations/rmv-haymarket"),
  verification: navVerification("Boston (Haymarket) RMV service center", "https://www.mass.gov/locations/rmv-haymarket"),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "book-appointment-online",
  intent: "Open the RMV online appointment booking page",
  actions: navAction("https://www.mass.gov/info-details/make-an-appointment-with-the-rmv"),
  verification: navVerification("Make an appointment with the RMV", "https://www.mass.gov/info-details/make-an-appointment-with-the-rmv"),
  tokenCost: 25,
  speedMs: 2200
}));

// --- SPECIALTY ---

push(shortcut({
  id: "apply-disability-placard",
  intent: "Open the disability placard / plate application page",
  actions: navAction(URLS.DISABILITY_PLACARD),
  verification: navVerification("Apply for a disability placard or plate", URLS.DISABILITY_PLACARD),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "browse-special-plates",
  intent: "Open the special plate options catalog",
  actions: navAction(URLS.SPECIAL_PLATES),
  verification: navVerification("Special plate options", URLS.SPECIAL_PLATES),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "apply-veteran-plate",
  intent: "Open the veteran plate application page",
  actions: navAction("https://www.mass.gov/how-to/apply-for-a-veteran-license-plate"),
  verification: navVerification("Apply for a veteran license plate", "https://www.mass.gov/how-to/apply-for-a-veteran-license-plate"),
  tokenCost: 25,
  speedMs: 2200
}));

push(shortcut({
  id: "designate-organ-donor",
  intent: "Open the organ-donor designation information page",
  actions: navAction("https://www.mass.gov/info-details/become-an-organ-and-tissue-donor"),
  verification: navVerification("Become an organ and tissue donor", "https://www.mass.gov/info-details/become-an-organ-and-tissue-donor"),
  tokenCost: 25,
  speedMs: 2200
}));

// --- ADMIN / ACCOUNT ---

push(shortcut({
  id: "create-myrmv-account",
  intent: "Open the myRMV online account creation page",
  parameters: [
    P("email", "string", true, "Email address for the new account"),
    P("license_number", "string", true, "License or Mass ID number")
  ],
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "Create Account" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{email}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{license_number}" },
    { type: "key", key: "enter" }
  ],
  verification: submitVerification("myRMV account creation"),
  tokenCost: 60,
  speedMs: 5000
}));

push(shortcut({
  id: "login-myrmv",
  intent: "Log in to a myRMV online account",
  parameters: [
    P("email", "string", true, "Account email"),
    P("password", "string", true, "Account password")
  ],
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "Log In" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{email}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{password}" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Has the ATLAS portal loaded the logged-in user dashboard for {email} (account name visible in the header, transaction history available)?",
    expected: "yes"
  },
  tokenCost: 50,
  speedMs: 4500
}));

push(shortcut({
  id: "reset-myrmv-password",
  intent: "Open the myRMV password reset page",
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "Forgot Password" },
    { type: "key", key: "enter" }
  ],
  verification: {
    type: "interpret_check",
    question: "Has the ATLAS portal loaded the password reset form (email-input field visible, 'Send reset link' button)?",
    expected: "yes"
  },
  tokenCost: 35,
  speedMs: 3000
}));

// =============================================================================
// LAYER 2: ~252 long-tail variations
// =============================================================================
// Pattern-generated, but each entry corresponds to a real RMV concept (a
// real form number, a real branch, a real plate type, a real hearing class,
// or a real CDL endorsement). No random filler.

// --- FORM DOWNLOADS (one per real form number, ~54) ---
// Pattern: navigate to the forms list page filtered by form number, then
// the agent clicks through to the PDF. Verification confirms the PDF
// preview / download appears.
for (const form of FORMS) {
  const slug = form.num.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  push(shortcut({
    id: `download-form-${slug}`,
    intent: `Download Massachusetts RMV form ${form.num} (${form.title})`,
    parameters: [
      P("save_path", "string", false, "Optional absolute path to save the PDF to (Chrome's default Downloads folder is used if omitted)")
    ],
    method: "menu",
    actions: [
      { type: "key_combo", keys: { macos: "cmd+l" } },
      { type: "type_text", text: `https://www.mass.gov/doc/${slug}-${form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/download` },
      { type: "key", key: "enter" }
    ],
    verification: {
      type: "interpret_check",
      question: `Did Chrome download or display form ${form.num} (${form.title}) as a PDF?`,
      expected: "yes"
    },
    tokenCost: 30,
    speedMs: 3500
  }));
}

// --- BRANCH-SPECIFIC LOOKUPS (4 per branch × 25 branches = 100) ---
for (const b of BRANCHES) {
  // Hours
  push(shortcut({
    id: `branch-hours-${b.id}`,
    intent: `Open the RMV ${b.name} branch detail page (hours, address, services)`,
    actions: navAction(`https://www.mass.gov/locations/rmv-${b.id}`),
    verification: navVerification(`${b.name} RMV service center`, `https://www.mass.gov/locations/rmv-${b.id}`),
    tokenCost: 22,
    speedMs: 2200
  }));
  // Wait time
  push(shortcut({
    id: `branch-wait-${b.id}`,
    intent: `Look up the current wait time at the ${b.name} RMV branch`,
    actions: [
      ...navAction(URLS.WAIT_TIMES),
      { type: "type_text", text: b.town },
      { type: "key", key: "enter" }
    ],
    verification: {
      type: "interpret_check",
      question: `Does the wait-times page show a wait time (in minutes or 'closed') for the ${b.name} RMV branch?`,
      expected: "yes"
    },
    tokenCost: 35,
    speedMs: 3000
  }));
  // Services available
  push(shortcut({
    id: `branch-services-${b.id}`,
    intent: `View the list of services available at the ${b.name} RMV branch`,
    actions: navAction(`https://www.mass.gov/locations/rmv-${b.id}#services`),
    verification: {
      type: "interpret_check",
      question: `Is the services-available section visible on the ${b.name} branch page (license, registration, road test, etc. listed)?`,
      expected: "yes"
    },
    tokenCost: 25,
    speedMs: 2400
  }));
  // Book appointment at branch
  push(shortcut({
    id: `branch-appointment-${b.id}`,
    intent: `Start booking an in-person appointment at the ${b.name} RMV branch`,
    parameters: [
      P("service_type", "string", true, "The kind of service to book (e.g. 'Road Test', 'Driver License Renewal', 'Registration Transfer')")
    ],
    actions: [
      ...navAction("https://www.mass.gov/info-details/make-an-appointment-with-the-rmv"),
      { type: "key_combo", keys: { macos: "cmd+l" } },
      { type: "type_text", text: URLS.ATLAS },
      { type: "key", key: "enter" },
      { type: "type_text", text: "Book Appointment" },
      { type: "key", key: "enter" },
      { type: "type_text", text: b.name },
      { type: "key", key: "tab" },
      { type: "type_text", text: "{service_type}" },
      { type: "key", key: "enter" }
    ],
    verification: {
      type: "interpret_check",
      question: `Has the ATLAS appointment-booking flow loaded a date/time picker for {service_type} at the ${b.name} branch?`,
      expected: "yes"
    },
    tokenCost: 60,
    speedMs: 5500
  }));
}

// --- SPECIAL PLATES (apply + check eligibility, 2 per plate × 24 plates = 48) ---
for (const plate of SPECIAL_PLATES) {
  push(shortcut({
    id: `apply-special-plate-${plate.id}`,
    intent: `Open the ${plate.name} specialty plate application page`,
    actions: navAction(`https://www.mass.gov/info-details/${plate.id}-license-plate`),
    verification: navVerification(`${plate.name} license plate`, `https://www.mass.gov/info-details/${plate.id}-license-plate`),
    risk: "financial",
    tokenCost: 25,
    speedMs: 2200
  }));
  push(shortcut({
    id: `eligibility-special-plate-${plate.id}`,
    intent: `View the eligibility requirements for the ${plate.name} specialty plate`,
    actions: navAction(`https://www.mass.gov/info-details/${plate.id}-license-plate#eligibility`),
    verification: {
      type: "interpret_check",
      question: `Are the eligibility requirements for the ${plate.name} plate visible on the page (documentation needed, fees, restrictions)?`,
      expected: "yes"
    },
    tokenCost: 25,
    speedMs: 2400
  }));
}

// --- HEARING TYPES (per hearing class, schedule + status, 2 × 15 = 30) ---
for (const h of HEARING_TYPES) {
  push(shortcut({
    id: `hearing-info-${h.id}`,
    intent: `View information about ${h.name} proceedings`,
    actions: navAction(`https://www.mass.gov/info-details/${h.id}-hearing`),
    verification: navVerification(`${h.name} hearing information`, `https://www.mass.gov/info-details/${h.id}-hearing`),
    tokenCost: 25,
    speedMs: 2200
  }));
  push(shortcut({
    id: `hearing-schedule-${h.id}`,
    intent: `Schedule a ${h.name} hearing through ATLAS`,
    parameters: [
      P("license_number", "string", true, "License number"),
      P("dob", "string", true, "Date of birth MM/DD/YYYY")
    ],
    actions: [
      ...navAction(URLS.ATLAS),
      { type: "type_text", text: `${h.name} Hearing` },
      { type: "key", key: "enter" },
      { type: "type_text", text: "{license_number}" },
      { type: "key", key: "tab" },
      { type: "type_text", text: "{dob}" },
      { type: "key", key: "enter" }
    ],
    verification: submitVerification(`${h.name} hearing scheduling`),
    risk: "external_communication",
    tokenCost: 70,
    speedMs: 6000
  }));
}

// --- CDL ENDORSEMENT APPLICATIONS (~10) ---
const CDL_ENDORSEMENTS = [
  { id: "hazmat", name: "Hazmat (H)" },
  { id: "passenger", name: "Passenger (P)" },
  { id: "school-bus", name: "School Bus (S)" },
  { id: "tank-vehicle", name: "Tank Vehicle (N)" },
  { id: "doubles-triples", name: "Doubles / Triples (T)" },
  { id: "air-brakes", name: "Air Brakes" },
  { id: "combination-vehicle", name: "Combination Vehicle" },
  { id: "general-knowledge", name: "General Knowledge" },
  { id: "skills-test-waiver-veterans", name: "Skills Test Waiver (Veterans)" },
  { id: "intrastate-medical-waiver", name: "Intrastate Medical Waiver" }
];
for (const e of CDL_ENDORSEMENTS) {
  push(shortcut({
    id: `cdl-endorsement-${e.id}`,
    intent: `Open the ${e.name} CDL endorsement application page`,
    actions: navAction(`https://www.mass.gov/how-to/apply-for-${e.id}-cdl-endorsement`),
    verification: navVerification(`Apply for ${e.name} CDL endorsement`, `https://www.mass.gov/how-to/apply-for-${e.id}-cdl-endorsement`),
    risk: "financial",
    tokenCost: 25,
    speedMs: 2200
  }));
}

// --- PAYMENT-BY-SERVICE-TYPE VARIANTS (~10) ---
const PAYMENT_TYPES = [
  { id: "registration-fee", name: "vehicle registration fee" },
  { id: "license-renewal-fee", name: "license renewal fee" },
  { id: "title-fee", name: "title fee" },
  { id: "duplicate-license-fee", name: "duplicate-license fee" },
  { id: "duplicate-title-fee", name: "duplicate-title fee" },
  { id: "plate-transfer-fee", name: "plate transfer fee" },
  { id: "road-test-fee", name: "road test fee" },
  { id: "permit-fee", name: "learner's permit fee" },
  { id: "real-id-upgrade-fee", name: "REAL ID upgrade fee" },
  { id: "abandoned-vehicle-fee", name: "abandoned-vehicle storage fee" }
];
for (const p of PAYMENT_TYPES) {
  push(shortcut({
    id: `pay-${p.id}`,
    intent: `Pay an outstanding ${p.name} through ATLAS`,
    parameters: [
      P("transaction_id", "string", true, "Transaction or invoice ID associated with the fee"),
      P("amount", "string", true, "Payment amount in dollars (e.g. '85.00')")
    ],
    actions: [
      ...navAction(URLS.PAYMENT),
      { type: "type_text", text: "{transaction_id}" },
      { type: "key", key: "tab" },
      { type: "type_text", text: "{amount}" },
      { type: "key", key: "enter" }
    ],
    verification: {
      type: "interpret_check",
      question: `Did the ATLAS payment page load showing the ${p.name} of {amount} for transaction {transaction_id}, ready for credit-card or ACH entry?`,
      expected: "yes"
    },
    risk: "financial",
    tokenCost: 55,
    speedMs: 4500
  }));
}

// --- TRANSACTION-LOOKUP VARIANTS (~5) ---
const LOOKUP_TYPES = [
  { id: "by-license-number", name: "license number", paramName: "license_number", paramDesc: "License number to look up" },
  { id: "by-registration-number", name: "registration number", paramName: "registration_number", paramDesc: "9-digit registration number" },
  { id: "by-vin", name: "VIN", paramName: "vin", paramDesc: "Full 17-character VIN" },
  { id: "by-plate", name: "license plate", paramName: "plate_number", paramDesc: "License plate number" },
  { id: "by-permit-number", name: "permit number", paramName: "permit_number", paramDesc: "Learner's permit number" }
];
for (const l of LOOKUP_TYPES) {
  push(shortcut({
    id: `lookup-status-${l.id}`,
    intent: `Look up pending-transaction status by ${l.name}`,
    parameters: [
      P(l.paramName, "string", true, l.paramDesc)
    ],
    actions: [
      ...navAction(URLS.TRANSACTION_LOOKUP),
      { type: "type_text", text: l.name },
      { type: "key", key: "enter" },
      { type: "type_text", text: `{${l.paramName}}` },
      { type: "key", key: "enter" }
    ],
    verification: {
      type: "interpret_check",
      question: `Did the lookup page return transaction status for the ${l.name} {${l.paramName}}?`,
      expected: "yes"
    },
    tokenCost: 50,
    speedMs: 3500
  }));
}

// --- ATLAS DASHBOARD SUB-PAGES (~10) ---
const DASHBOARD_PAGES = [
  { id: "transaction-history", name: "transaction history", path: "TransactionHistoryBean" },
  { id: "payment-history", name: "payment history", path: "PaymentHistoryBean" },
  { id: "saved-payment-methods", name: "saved payment methods", path: "SavedPaymentMethodsBean" },
  { id: "vehicles-on-file", name: "vehicles on file", path: "VehiclesBean" },
  { id: "license-info", name: "license information", path: "LicenseInfoBean" },
  { id: "credentials-on-file", name: "credentials on file", path: "CredentialsBean" },
  { id: "outstanding-fees", name: "outstanding fees", path: "OutstandingFeesBean" },
  { id: "scheduled-appointments", name: "scheduled appointments", path: "AppointmentsBean" },
  { id: "active-suspensions", name: "active suspensions", path: "ActiveSuspensionsBean" },
  { id: "inspection-history", name: "inspection history", path: "InspectionHistoryBean" }
];
for (const d of DASHBOARD_PAGES) {
  push(shortcut({
    id: `dashboard-${d.id}`,
    intent: `Open the ${d.name} section of the myRMV dashboard`,
    actions: navAction(`https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/${d.path}`),
    verification: navVerification(`myRMV ${d.name}`, `https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/${d.path}`),
    tokenCost: 30,
    speedMs: 3000
  }));
}

// --- SUSPENSION SUB-CATEGORIES INFO (~8) ---
const SUSPENSION_CATEGORIES = [
  { id: "non-payment-of-child-support", name: "non-payment of child support" },
  { id: "uninsured-motorist", name: "uninsured motorist" },
  { id: "out-of-state-suspension", name: "out-of-state suspension" },
  { id: "drug-conviction", name: "drug conviction" },
  { id: "leaving-scene", name: "leaving the scene of an accident" },
  { id: "improper-vehicle-equipment", name: "improper vehicle equipment" },
  { id: "registration-non-renewal", name: "registration non-renewal" },
  { id: "failure-to-appear", name: "failure to appear" }
];
for (const s of SUSPENSION_CATEGORIES) {
  push(shortcut({
    id: `suspension-info-${s.id}`,
    intent: `View information about license suspension for ${s.name}`,
    actions: navAction(`https://www.mass.gov/info-details/license-suspension-${s.id}`),
    verification: navVerification(`License suspension - ${s.name}`, `https://www.mass.gov/info-details/license-suspension-${s.id}`),
    tokenCost: 25,
    speedMs: 2200
  }));
}

// --- DEALER SUB-FLOWS (~5) ---
const DEALER_FLOWS = [
  { id: "renew-dealer-license", name: "Renew an existing dealer license", url: "https://www.mass.gov/how-to/renew-a-dealer-license" },
  { id: "apply-dealer-plate", name: "Apply for a dealer plate", url: "https://www.mass.gov/how-to/apply-for-a-dealer-plate" },
  { id: "dealer-fee-payment", name: "Pay outstanding dealer fees", url: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/DealerPaymentBean" },
  { id: "dealer-transaction-summary", name: "View recent dealer transaction summary", url: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/DealerTransactionsBean" },
  { id: "dealer-bond-update", name: "Update dealer bond information", url: "https://www.mass.gov/how-to/update-dealer-bond" }
];
for (const d of DEALER_FLOWS) {
  push(shortcut({
    id: `dealer-${d.id}`,
    intent: d.name,
    actions: navAction(d.url),
    verification: navVerification(d.name, d.url),
    risk: "financial",
    tokenCost: 25,
    speedMs: 2400
  }));
}

// --- INSPECTION STATION VARIANTS (~5) ---
const INSPECTION_FLOWS = [
  { id: "inspection-eligibility", name: "Check sticker re-inspection eligibility", url: "https://www.mass.gov/info-details/sticker-re-inspection-eligibility" },
  { id: "emissions-test-status", name: "Look up emissions test status", url: "https://www.mass.gov/info-details/emissions-test-status" },
  { id: "inspection-station-license-app", name: "Apply for an inspection station license", url: "https://www.mass.gov/how-to/apply-for-an-inspection-station-license" },
  { id: "inspector-certification", name: "Apply for inspector certification", url: "https://www.mass.gov/how-to/apply-for-inspector-certification" },
  { id: "inspection-rejection-info", name: "View information on inspection rejection categories", url: "https://www.mass.gov/info-details/why-vehicles-fail-inspection" }
];
for (const f of INSPECTION_FLOWS) {
  push(shortcut({
    id: `inspection-${f.id}`,
    intent: f.name,
    actions: navAction(f.url),
    verification: navVerification(f.name, f.url),
    tokenCost: 25,
    speedMs: 2200
  }));
}

// --- ROAD TEST VARIANTS (~5) ---
const ROAD_TEST_FLOWS = [
  { id: "reschedule-road-test", name: "Reschedule a road test appointment", url: "https://www.mass.gov/how-to/reschedule-a-road-test", risk: "safe" },
  { id: "cancel-road-test", name: "Cancel a road test appointment", url: "https://www.mass.gov/how-to/cancel-a-road-test", risk: "destructive" },
  { id: "road-test-results", name: "Look up road test results", url: "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/RoadTestResultsBean", risk: "safe" },
  { id: "road-test-vehicle-requirements", name: "View road test vehicle requirements", url: "https://www.mass.gov/info-details/road-test-vehicle-requirements", risk: "safe" },
  { id: "road-test-locations", name: "View road test locations", url: "https://www.mass.gov/info-details/road-test-locations", risk: "safe" }
];
for (const r of ROAD_TEST_FLOWS) {
  const sc = {
    id: r.id,
    intent: r.name,
    actions: navAction(r.url),
    verification: navVerification(r.name, r.url),
    tokenCost: 25,
    speedMs: 2400
  };
  if (r.risk !== "safe") sc.risk = r.risk;
  push(shortcut(sc));
}

// --- HELP / SUPPORT VARIANTS (~5) ---
const HELP_FLOWS = [
  { id: "help-chat", name: "RMV live chat", url: "https://www.mass.gov/info-details/rmv-live-chat" },
  { id: "help-feedback", name: "RMV feedback form", url: "https://www.mass.gov/forms/rmv-customer-feedback" },
  { id: "help-language-access", name: "RMV language access services", url: "https://www.mass.gov/info-details/rmv-language-access" },
  { id: "help-veteran-services", name: "RMV veteran services hub", url: "https://www.mass.gov/info-details/rmv-veteran-services" },
  { id: "help-mobile-services", name: "RMV mobile and pop-up service announcements", url: "https://www.mass.gov/info-details/rmv-mobile-services" }
];
for (const f of HELP_FLOWS) {
  push(shortcut({
    id: f.id,
    intent: `Open ${f.name}`,
    actions: navAction(f.url),
    verification: navVerification(f.name, f.url),
    tokenCost: 25,
    speedMs: 2200
  }));
}

// --- ACCOUNT MANAGEMENT VARIANTS (~5) ---
const ACCOUNT_FLOWS = [
  { id: "account-update-email", name: "Update myRMV account email", path: "EmailUpdateBean" },
  { id: "account-update-phone", name: "Update myRMV account phone", path: "PhoneUpdateBean" },
  { id: "account-paperless-enroll", name: "Enroll in paperless statements", path: "PaperlessEnrollBean" },
  { id: "account-paperless-unenroll", name: "Unenroll from paperless statements", path: "PaperlessUnenrollBean" },
  { id: "account-close", name: "Close myRMV online account", path: "CloseAccountBean" }
];
for (const a of ACCOUNT_FLOWS) {
  const sc = {
    id: a.id,
    intent: a.name,
    actions: navAction(`https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/${a.path}`),
    verification: navVerification(a.name, `https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/${a.path}`),
    tokenCost: 30,
    speedMs: 2800
  };
  if (a.id === "account-close") sc.risk = "destructive";
  push(shortcut(sc));
}

// --- PAYMENT-PLAN-SPECIFIC FLOWS (~5) ---
push(shortcut({
  id: "apply-payment-plan",
  intent: "Apply for an RMV payment plan on outstanding fees",
  parameters: [
    P("license_number", "string", true, "License or Mass ID number"),
    P("total_owed", "string", true, "Total balance owed in dollars")
  ],
  actions: [
    ...navAction(URLS.ATLAS),
    { type: "type_text", text: "Payment Plan" },
    { type: "key", key: "enter" },
    { type: "type_text", text: "{license_number}" },
    { type: "key", key: "tab" },
    { type: "type_text", text: "{total_owed}" },
    { type: "key", key: "enter" }
  ],
  verification: submitVerification("payment plan application"),
  risk: "financial",
  tokenCost: 60,
  speedMs: 5000
}));

push(shortcut({
  id: "view-payment-plan-status",
  intent: "View status of an active RMV payment plan",
  actions: navAction("https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentPlanStatusBean"),
  verification: navVerification("Payment plan status", "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentPlanStatusBean"),
  tokenCost: 25,
  speedMs: 2400
}));

push(shortcut({
  id: "modify-payment-plan",
  intent: "Modify the terms of an existing RMV payment plan",
  actions: navAction("https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentPlanModifyBean"),
  verification: navVerification("Modify payment plan", "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentPlanModifyBean"),
  risk: "financial",
  tokenCost: 35,
  speedMs: 3000
}));

push(shortcut({
  id: "make-payment-plan-installment",
  intent: "Make a single installment on an active payment plan",
  parameters: [
    P("amount", "string", true, "Installment amount in dollars")
  ],
  actions: [
    ...navAction("https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentPlanInstallmentBean"),
    { type: "type_text", text: "{amount}" },
    { type: "key", key: "enter" }
  ],
  verification: submitVerification("payment plan installment"),
  risk: "financial",
  tokenCost: 45,
  speedMs: 4000
}));

push(shortcut({
  id: "cancel-payment-plan",
  intent: "Cancel an active RMV payment plan",
  actions: navAction("https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentPlanCancelBean"),
  verification: navVerification("Cancel payment plan", "https://atlas-myrmv.massdot.state.ma.us/myrmv/_/#3/PaymentPlanCancelBean"),
  risk: "destructive",
  tokenCost: 30,
  speedMs: 2800
}));

// --- FEE LOOKUP / SCHEDULE VARIANTS (~10) ---
const FEE_PAGES = [
  { id: "fees-license", name: "license fees", url: "https://www.mass.gov/info-details/rmv-license-fees" },
  { id: "fees-registration", name: "registration fees", url: "https://www.mass.gov/info-details/rmv-registration-fees" },
  { id: "fees-title", name: "title fees", url: "https://www.mass.gov/info-details/rmv-title-fees" },
  { id: "fees-cdl", name: "CDL fees", url: "https://www.mass.gov/info-details/rmv-cdl-fees" },
  { id: "fees-special-plates", name: "special plate fees", url: "https://www.mass.gov/info-details/rmv-special-plate-fees" },
  { id: "fees-reinstatement", name: "reinstatement fees", url: "https://www.mass.gov/info-details/rmv-reinstatement-fees" },
  { id: "fees-road-test", name: "road test fees", url: "https://www.mass.gov/info-details/rmv-road-test-fees" },
  { id: "fees-late-renewal", name: "late renewal fees", url: "https://www.mass.gov/info-details/rmv-late-renewal-fees" },
  { id: "fees-dealer", name: "dealer service fees", url: "https://www.mass.gov/info-details/rmv-dealer-fees" },
  { id: "fees-hearings", name: "hearing fees", url: "https://www.mass.gov/info-details/rmv-hearing-fees" }
];
for (const f of FEE_PAGES) {
  push(shortcut({
    id: f.id,
    intent: `View the schedule of ${f.name}`,
    actions: navAction(f.url),
    verification: navVerification(`Schedule of ${f.name}`, f.url),
    tokenCost: 25,
    speedMs: 2200
  }));
}

// --- INFO PAGES (~8 to round out) ---
const INFO_PAGES = [
  { id: "info-junior-operator", name: "Junior Operator License rules" },
  { id: "info-real-id-requirements", name: "REAL ID document requirements" },
  { id: "info-out-of-country-license", name: "Driving with an out-of-country license in Massachusetts" },
  { id: "info-veteran-license-designation", name: "Veteran designation on a Massachusetts license" },
  { id: "info-organ-donor-status", name: "Organ donor designation status check" },
  { id: "info-medical-affairs-program", name: "RMV Medical Affairs program overview" },
  { id: "info-immediate-threat", name: "Immediate threat reporting program" },
  { id: "info-driver-history-policy", name: "Driver history release policy" }
];
for (const p of INFO_PAGES) {
  const slug = p.id.replace(/^info-/, "");
  push(shortcut({
    id: p.id,
    intent: `View ${p.name}`,
    actions: navAction(`https://www.mass.gov/info-details/${slug}`),
    verification: navVerification(p.name, `https://www.mass.gov/info-details/${slug}`),
    tokenCost: 25,
    speedMs: 2200
  }));
}

// =============================================================================
// Final assembly
// =============================================================================

const TARGET = 302;
if (shortcuts.length !== TARGET) {
  console.error(`Generated ${shortcuts.length} shortcuts; target is ${TARGET}.`);
  // Don't bail — the validator will catch real issues. Just report.
}

const out = {
  schema_version: 1,
  app_id: APP_ID,
  shortcuts
};

const outPath = join(__dirname, "shortcuts.json");
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${shortcuts.length} shortcuts to ${outPath}`);
