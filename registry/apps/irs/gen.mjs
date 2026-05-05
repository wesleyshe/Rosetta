#!/usr/bin/env node
// Generates registry/apps/irs/shortcuts.json for the IRS.gov v0 seed.
//
// IRS.gov is a website, not a desktop app. We model it as a "browser-hosted
// app" using the existing schema:
//   - host browser is Chrome (com.google.Chrome)
//   - most shortcuts navigate via cmd+L → type URL → enter
//   - method "menu" for direct URL navigation, "shortcut" for keystroke-only sub-flows
//
// 311 shortcuts spanning the major IRS portals: refund tracking, online
// account, direct pay, transcripts, forms (~80 of them, parameterized by
// year for transcript flows), publications, ITA, tax topics, identity
// theft, amended return, installment agreements, withholding estimator,
// business, tax pros, help/contact, language/accessibility.
//
// Run:  node gen.mjs
// Writes shortcuts.json next to this file.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- helpers --------------------------------------------------------------

// Pseudo-random but deterministic. Seeded by id string so regenerating
// produces stable metadata.
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickFrom(id, list) {
  return list[hashString(id) % list.length];
}

// Submitted_at varies between 2026-04-15 and 2026-05-05 (~21 days).
function submittedAt(id) {
  const days = hashString(id + "date") % 21;
  const d = new Date("2026-04-15T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Token cost: 10-200, varies by id.
function tokenCost(id, base = 50) {
  const jitter = (hashString(id + "tok") % 60) - 30;
  return Math.max(10, Math.min(200, base + jitter));
}

// Speed estimate: 500-8000 ms (websites slower than desktop apps).
function speedMs(id, base = 2500) {
  const jitter = (hashString(id + "spd") % 2000) - 1000;
  return Math.max(500, Math.min(8000, base + jitter));
}

// Build a "navigate to URL" shortcut: cmd+L → type URL → enter.
function navShortcut({
  id,
  intent,
  url,
  question,
  parameters = [],
  risk,
  tokenBase = 30,
  speedBase = 2000,
}) {
  const sc = {
    id,
    intent,
    parameters,
    platforms: ["macos"],
    app_versions: ["web"],
    method: "menu",
    actions: [
      { type: "key_combo", keys: { macos: "cmd+l" } },
      { type: "type_text", text: url },
      { type: "key", key: "enter" },
    ],
    verification: {
      type: "interpret_check",
      question,
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: tokenCost(id, tokenBase),
      speed_estimate_ms: speedMs(id, speedBase),
      submitted_at: submittedAt(id),
    },
  };
  if (risk) sc.risk = risk;
  return sc;
}

// Build a multi-action "shortcut" method (keystroke-only sub-flows).
function keyShortcut({
  id,
  intent,
  actions,
  question,
  parameters = [],
  risk,
  tokenBase = 40,
  speedBase = 1500,
}) {
  const sc = {
    id,
    intent,
    parameters,
    platforms: ["macos"],
    app_versions: ["web"],
    method: "shortcut",
    actions,
    verification: {
      type: "interpret_check",
      question,
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: tokenCost(id, tokenBase),
      speed_estimate_ms: speedMs(id, speedBase),
      submitted_at: submittedAt(id),
    },
  };
  if (risk) sc.risk = risk;
  return sc;
}

// Form-with-fields navigate: nav to URL, then fill named fields.
function navAndFill({
  id,
  intent,
  url,
  fields, // [{ value: "{ssn}" or literal, advance: "tab"|"enter"|"none" }]
  parameters,
  question,
  risk,
  tokenBase = 80,
  speedBase = 4000,
}) {
  const actions = [
    { type: "key_combo", keys: { macos: "cmd+l" } },
    { type: "type_text", text: url },
    { type: "key", key: "enter" },
  ];
  for (const f of fields) {
    if (f.value !== undefined) {
      actions.push({ type: "type_text", text: f.value });
    }
    if (f.advance === "tab") actions.push({ type: "key", key: "tab" });
    else if (f.advance === "enter") actions.push({ type: "key", key: "enter" });
  }
  const sc = {
    id,
    intent,
    parameters,
    platforms: ["macos"],
    app_versions: ["web"],
    method: "menu",
    actions,
    verification: {
      type: "interpret_check",
      question,
      expected: "yes",
    },
    metadata: {
      contributor_id: "seed",
      payment_destination: null,
      token_cost_estimate: tokenCost(id, tokenBase),
      speed_estimate_ms: speedMs(id, speedBase),
      submitted_at: submittedAt(id),
    },
  };
  if (risk) sc.risk = risk;
  return sc;
}

// ---- categories -----------------------------------------------------------

const shortcuts = [];

// HOME / NAVIGATION (~15)
shortcuts.push(
  navShortcut({
    id: "open-irs-homepage",
    intent: "Open the IRS.gov homepage in the active Chrome tab",
    url: "https://www.irs.gov",
    question: "Is the IRS.gov homepage now visible (with the IRS logo and main navigation)?",
  }),
  navShortcut({
    id: "open-individuals-tab",
    intent: "Open the IRS Individuals section landing page",
    url: "https://www.irs.gov/individuals",
    question: "Is the IRS Individuals section landing page now visible?",
  }),
  navShortcut({
    id: "open-businesses-tab",
    intent: "Open the IRS Businesses & Self-Employed section landing page",
    url: "https://www.irs.gov/businesses",
    question: "Is the IRS Businesses & Self-Employed section landing page now visible?",
  }),
  navShortcut({
    id: "open-tax-pros-tab",
    intent: "Open the Tax Professionals section landing page",
    url: "https://www.irs.gov/tax-professionals",
    question: "Is the Tax Professionals section landing page now visible?",
  }),
  navShortcut({
    id: "open-charities-nonprofits",
    intent: "Open the Charities & Nonprofits section landing page",
    url: "https://www.irs.gov/charities-non-profits",
    question: "Is the Charities & Nonprofits section landing page now visible?",
  }),
  navShortcut({
    id: "open-government-entities",
    intent: "Open the Government Entities section landing page",
    url: "https://www.irs.gov/government-entities",
    question: "Is the Government Entities section landing page now visible?",
  }),
  navShortcut({
    id: "open-file-menu",
    intent: "Open the File Your Taxes hub on IRS.gov",
    url: "https://www.irs.gov/filing",
    question: "Is the IRS Filing hub page now visible (with options for individuals, businesses, etc.)?",
  }),
  navShortcut({
    id: "open-payments-menu",
    intent: "Open the Payments hub on IRS.gov",
    url: "https://www.irs.gov/payments",
    question: "Is the IRS Payments hub page now visible (showing payment options like Direct Pay, EFTPS, payment plans)?",
  }),
  navShortcut({
    id: "open-refunds-menu",
    intent: "Open the Refunds hub on IRS.gov",
    url: "https://www.irs.gov/refunds",
    question: "Is the IRS Refunds hub / Where's My Refund page now visible?",
  }),
  navShortcut({
    id: "open-credits-deductions",
    intent: "Open the Credits & Deductions hub on IRS.gov",
    url: "https://www.irs.gov/credits-deductions",
    question: "Is the IRS Credits & Deductions hub page now visible?",
  }),
  navShortcut({
    id: "open-newsroom",
    intent: "Open the IRS Newsroom (news releases and announcements)",
    url: "https://www.irs.gov/newsroom",
    question: "Is the IRS Newsroom page now visible (showing news releases and announcements)?",
  }),
  navShortcut({
    id: "open-help-hub",
    intent: "Open the IRS Help & Resources hub",
    url: "https://www.irs.gov/help",
    question: "Is the IRS Help & Resources hub page now visible?",
  }),
  navShortcut({
    id: "open-site-index",
    intent: "Open the IRS site index (A-Z directory)",
    url: "https://www.irs.gov/site-index-search",
    question: "Is the IRS Site Index / search page now visible (with an A-Z directory)?",
  }),
  navShortcut({
    id: "search-irs-site",
    intent: "Run an IRS site search for the given term",
    url: "https://www.irs.gov/site-index-search?search={term}",
    parameters: [{ name: "term", type: "string", required: true }],
    question: "Are search results for {term} now visible on the IRS site search results page?",
    tokenBase: 50,
  }),
  navShortcut({
    id: "open-irs-contact",
    intent: "Open the Let Us Help You / Contact the IRS hub",
    url: "https://www.irs.gov/help/let-us-help-you",
    question: "Is the IRS contact / Let Us Help You page now visible?",
  })
);

// WHERE'S MY REFUND (~15)
shortcuts.push(
  navShortcut({
    id: "open-wheres-my-refund",
    intent: "Open the Where's My Refund? tool homepage",
    url: "https://www.irs.gov/refunds",
    question: "Is the Where's My Refund? tool / refunds page now visible?",
  }),
  navShortcut({
    id: "open-refund-tracker-app",
    intent: "Open the Where's My Refund? tracker application directly",
    url: "https://sa.www4.irs.gov/wmr/",
    question: "Is the Where's My Refund? tracker application page now visible (asking for SSN, filing status, refund amount)?",
  }),
  navShortcut({
    id: "open-amended-refund-tracker",
    intent: "Open the Where's My Amended Return? tracker",
    url: "https://www.irs.gov/filing/wheres-my-amended-return",
    question: "Is the Where's My Amended Return? tracker page now visible?",
  }),
  navShortcut({
    id: "open-amended-refund-tracker-app",
    intent: "Open the Where's My Amended Return? application directly",
    url: "https://sa.www4.irs.gov/wmar/",
    question: "Is the Where's My Amended Return? tracker application page now visible?",
  }),
  navAndFill({
    id: "lookup-refund-by-ssn",
    intent: "Look up refund status by SSN, filing status, and refund amount on Where's My Refund?",
    url: "https://sa.www4.irs.gov/wmr/",
    parameters: [
      { name: "ssn", type: "string", required: true, description: "9-digit SSN, no dashes" },
      { name: "filing_status", type: "string", required: true, description: "single | married-jointly | married-separately | head | qualifying-spouse" },
      { name: "amount", type: "number", required: true, description: "Whole-dollar refund amount" },
    ],
    fields: [
      { value: "{ssn}", advance: "tab" },
      { value: "{filing_status}", advance: "tab" },
      { value: "{amount}", advance: "enter" },
    ],
    question: "Is the Where's My Refund? results page showing the refund status (Return Received, Refund Approved, or Refund Sent) for the queried SSN?",
  }),
  keyShortcut({
    id: "view-refund-status",
    intent: "Read the refund status off the Where's My Refund? results page (assumes the lookup form has already been submitted)",
    actions: [{ type: "key", key: "escape" }],
    question: "Looking at the screen, is one of the three refund statuses ('Return Received', 'Refund Approved', or 'Refund Sent') currently visible on the Where's My Refund? results page?",
  }),
  keyShortcut({
    id: "view-amended-refund-status",
    intent: "Read the amended return status off the Where's My Amended Return? results page",
    actions: [{ type: "key", key: "escape" }],
    question: "Looking at the screen, is one of the amended return statuses ('Received', 'Adjusted', or 'Completed') visible on the Where's My Amended Return? results?",
  }),
  navShortcut({
    id: "open-refund-help",
    intent: "Open the IRS refund help / 'when to expect your refund' page",
    url: "https://www.irs.gov/refunds/tax-season-refund-frequently-asked-questions",
    question: "Is the IRS refund FAQ / when-to-expect-your-refund page now visible?",
  }),
  navShortcut({
    id: "open-direct-deposit-info",
    intent: "Open the IRS direct deposit information page",
    url: "https://www.irs.gov/refunds/get-your-refund-faster-tell-irs-to-direct-deposit",
    question: "Is the IRS direct deposit information page now visible?",
  }),
  navShortcut({
    id: "open-undelivered-refund",
    intent: "Open the page for undelivered or lost refund checks",
    url: "https://www.irs.gov/taxtopics/tc161",
    question: "Is the IRS Tax Topic 161 page (undelivered/lost refund checks) now visible?",
  }),
  navShortcut({
    id: "open-refund-offset",
    intent: "Open the IRS page about refund offsets (treasury offset program)",
    url: "https://www.irs.gov/taxtopics/tc203",
    question: "Is the IRS Tax Topic 203 page (refund offsets) now visible?",
  }),
  navShortcut({
    id: "open-trace-refund",
    intent: "Open the IRS page on tracing a refund (Form 3911)",
    url: "https://www.irs.gov/forms-pubs/about-form-3911",
    question: "Is the IRS About Form 3911 (Taxpayer Statement Regarding Refund) page now visible?",
  }),
  navShortcut({
    id: "download-form-3911",
    intent: "Download Form 3911 (Taxpayer Statement Regarding Refund) PDF",
    url: "https://www.irs.gov/pub/irs-pdf/f3911.pdf",
    question: "Has Form 3911 (Taxpayer Statement Regarding Refund) been downloaded or opened in the browser PDF viewer?",
  }),
  navShortcut({
    id: "open-refund-options",
    intent: "Open the page describing refund options (direct deposit, paper check, savings bonds)",
    url: "https://www.irs.gov/refunds/about-wheres-my-refund",
    question: "Is the About Where's My Refund? page now visible?",
  }),
  navShortcut({
    id: "open-refund-status-by-phone",
    intent: "Open the page with the IRS refund status phone hotline number",
    url: "https://www.irs.gov/help/telephone-assistance",
    question: "Is the IRS Telephone Assistance page (showing service phone numbers including refund hotline) now visible?",
  })
);

// ONLINE ACCOUNT (~25)
shortcuts.push(
  navShortcut({
    id: "open-online-account",
    intent: "Open the IRS Online Account landing page",
    url: "https://www.irs.gov/payments/online-account",
    question: "Is the IRS Online Account landing page now visible?",
  }),
  navShortcut({
    id: "sign-in-online-account",
    intent: "Sign in to IRS Online Account (redirects to ID.me)",
    url: "https://sa.www4.irs.gov/ola/",
    question: "Is the IRS Online Account sign-in page (or the ID.me redirect) now visible?",
  }),
  keyShortcut({
    id: "online-account-view-balance",
    intent: "View the account balance summary in IRS Online Account (assumes you are signed in)",
    actions: [
      { type: "key_combo", keys: { macos: "cmd+l" } },
      { type: "type_text", text: "https://sa.www4.irs.gov/ola/" },
      { type: "key", key: "enter" },
    ],
    question: "Is the IRS Online Account dashboard now visible, showing the current balance owed (or zero balance)?",
    speedBase: 3500,
  }),
  navShortcut({
    id: "online-account-payment-history",
    intent: "Navigate to the Payment Activity section in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/payments-activity",
    question: "Is the IRS Online Account Payment Activity / payment history page now visible?",
  }),
  navShortcut({
    id: "online-account-payment-options",
    intent: "Navigate to the Payment Options section in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/payment-options",
    question: "Is the IRS Online Account Payment Options page now visible?",
  }),
  navShortcut({
    id: "online-account-notices",
    intent: "Navigate to the Notices and Letters section in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/notices-letters",
    question: "Is the IRS Online Account Notices and Letters page now visible?",
  }),
  navShortcut({
    id: "online-account-tax-records",
    intent: "Navigate to the Tax Records section in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/tax-records",
    question: "Is the IRS Online Account Tax Records page now visible?",
  }),
  navShortcut({
    id: "online-account-profile",
    intent: "Navigate to the Profile / account settings page in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/profile",
    question: "Is the IRS Online Account Profile page now visible?",
  }),
  navShortcut({
    id: "online-account-authorizations",
    intent: "Navigate to the Authorizations section (powers of attorney) in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/authorizations",
    question: "Is the IRS Online Account Authorizations page now visible?",
  }),
  navShortcut({
    id: "online-account-economic-impact",
    intent: "Navigate to Economic Impact Payment information in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/economic-impact-payment",
    question: "Is the IRS Online Account Economic Impact Payment information page now visible?",
  }),
  navShortcut({
    id: "online-account-advance-ctc",
    intent: "Navigate to Advance Child Tax Credit information in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/advance-child-tax-credit",
    question: "Is the IRS Online Account Advance Child Tax Credit information page now visible?",
  }),
  navShortcut({
    id: "online-account-payment-plans",
    intent: "Navigate to Payment Plans section in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/payment-plans",
    question: "Is the IRS Online Account Payment Plans page now visible?",
  }),
  navShortcut({
    id: "online-account-request-transcript",
    intent: "Navigate to Get Transcript via Online Account",
    url: "https://sa.www4.irs.gov/ola/transcript",
    question: "Is the IRS Online Account Get Transcript / transcript request page now visible?",
  }),
  navShortcut({
    id: "create-online-account",
    intent: "Open the page to create a new IRS Online Account (ID.me signup)",
    url: "https://www.irs.gov/payments/your-online-account",
    question: "Is the IRS Online Account information / sign-up page now visible (with a 'Create or sign in to your account' button)?",
  }),
  navShortcut({
    id: "open-id-me-signup",
    intent: "Open the ID.me signup page used for IRS authentication",
    url: "https://api.id.me/en/registration/new",
    question: "Is the ID.me account creation / signup page now visible?",
  }),
  navShortcut({
    id: "online-account-help",
    intent: "Open the help page for IRS Online Account",
    url: "https://www.irs.gov/payments/your-online-account-frequently-asked-questions",
    question: "Is the IRS Online Account FAQ / help page now visible?",
  }),
  navShortcut({
    id: "online-account-view-amount-owed",
    intent: "View total amount owed across all tax years in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/amount-owed",
    question: "Is the IRS Online Account total-amount-owed view now visible?",
  }),
  navShortcut({
    id: "online-account-view-by-year",
    intent: "View account balance by tax year in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/balance-by-year",
    question: "Is the IRS Online Account balance-by-tax-year breakdown now visible?",
  }),
  navShortcut({
    id: "online-account-paperless-prefs",
    intent: "Manage paperless statement preferences in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/paperless",
    question: "Is the IRS Online Account paperless preferences page now visible?",
  }),
  navShortcut({
    id: "online-account-comm-prefs",
    intent: "Manage communication preferences in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/communication-preferences",
    question: "Is the IRS Online Account communication preferences page now visible?",
  }),
  navShortcut({
    id: "online-account-update-address",
    intent: "Update mailing address through IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/profile/address",
    question: "Is the IRS Online Account address-update form now visible?",
  }),
  navShortcut({
    id: "online-account-set-payment-plan",
    intent: "Begin setting up a new payment plan in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/payment-plans/new",
    question: "Is the IRS Online Account new-payment-plan setup page now visible?",
  }),
  navShortcut({
    id: "online-account-modify-payment-plan",
    intent: "Modify an existing payment plan in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/payment-plans/manage",
    question: "Is the IRS Online Account manage-payment-plan page now visible?",
    risk: "financial",
  }),
  navShortcut({
    id: "online-account-revoke-poa",
    intent: "Revoke an authorization (POA / 8821) in IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/authorizations/revoke",
    question: "Is the IRS Online Account revoke-authorization page now visible?",
    risk: "destructive",
  }),
  navShortcut({
    id: "sign-out-online-account",
    intent: "Sign out of IRS Online Account",
    url: "https://sa.www4.irs.gov/ola/logout",
    question: "Has the IRS Online Account session been signed out (sign-in page or post-logout confirmation visible)?",
  })
);

// DIRECT PAY (~15)
shortcuts.push(
  navShortcut({
    id: "open-direct-pay",
    intent: "Open the IRS Direct Pay landing page",
    url: "https://www.irs.gov/payments/direct-pay",
    question: "Is the IRS Direct Pay landing page now visible?",
  }),
  navShortcut({
    id: "open-direct-pay-app",
    intent: "Open the IRS Direct Pay application directly (Step 1, payment reason selection)",
    url: "https://directpay.irs.gov/directpay/payment",
    question: "Is the IRS Direct Pay Step 1 (Payment Reason selection) page now visible?",
  }),
  navAndFill({
    id: "direct-pay-current-year",
    intent: "Begin a Direct Pay payment for current-year balance (Tax Return or Notice)",
    url: "https://directpay.irs.gov/directpay/payment",
    parameters: [
      { name: "amount", type: "number", required: true, description: "Payment amount in whole dollars" },
      { name: "tax_year", type: "string", required: true, description: "Tax year, e.g. 2025" },
    ],
    fields: [
      { value: "Tax Return or Notice", advance: "tab" },
      { value: "{tax_year}", advance: "tab" },
      { value: "{amount}", advance: "none" },
    ],
    question: "Has the Direct Pay flow advanced past Step 1 with reason 'Tax Return or Notice', tax year {tax_year}, and amount {amount} entered?",
    risk: "financial",
  }),
  navAndFill({
    id: "direct-pay-estimated-tax",
    intent: "Begin a Direct Pay payment for estimated tax (Form 1040-ES)",
    url: "https://directpay.irs.gov/directpay/payment",
    parameters: [
      { name: "amount", type: "number", required: true },
      { name: "tax_year", type: "string", required: true },
    ],
    fields: [
      { value: "Estimated Tax", advance: "tab" },
      { value: "{tax_year}", advance: "tab" },
      { value: "{amount}", advance: "none" },
    ],
    question: "Has the Direct Pay flow advanced with reason 'Estimated Tax' for tax year {tax_year} and amount {amount}?",
    risk: "financial",
  }),
  navAndFill({
    id: "direct-pay-extension",
    intent: "Begin a Direct Pay payment for an extension request (Form 4868)",
    url: "https://directpay.irs.gov/directpay/payment",
    parameters: [
      { name: "amount", type: "number", required: true },
      { name: "tax_year", type: "string", required: true },
    ],
    fields: [
      { value: "Extension", advance: "tab" },
      { value: "{tax_year}", advance: "tab" },
      { value: "{amount}", advance: "none" },
    ],
    question: "Has the Direct Pay flow advanced with reason 'Extension' for tax year {tax_year} and amount {amount}?",
    risk: "financial",
  }),
  navAndFill({
    id: "direct-pay-installment",
    intent: "Begin a Direct Pay payment toward an existing installment agreement",
    url: "https://directpay.irs.gov/directpay/payment",
    parameters: [
      { name: "amount", type: "number", required: true },
      { name: "tax_year", type: "string", required: true },
    ],
    fields: [
      { value: "Installment Agreement", advance: "tab" },
      { value: "{tax_year}", advance: "tab" },
      { value: "{amount}", advance: "none" },
    ],
    question: "Has the Direct Pay flow advanced with reason 'Installment Agreement' for tax year {tax_year} and amount {amount}?",
    risk: "financial",
  }),
  navAndFill({
    id: "direct-pay-amended-return",
    intent: "Begin a Direct Pay payment for an amended return (Form 1040-X)",
    url: "https://directpay.irs.gov/directpay/payment",
    parameters: [
      { name: "amount", type: "number", required: true },
      { name: "tax_year", type: "string", required: true },
    ],
    fields: [
      { value: "Amended Return", advance: "tab" },
      { value: "{tax_year}", advance: "tab" },
      { value: "{amount}", advance: "none" },
    ],
    question: "Has the Direct Pay flow advanced with reason 'Amended Return' for tax year {tax_year} and amount {amount}?",
    risk: "financial",
  }),
  navShortcut({
    id: "direct-pay-lookup-payment",
    intent: "Look up a previous Direct Pay payment (status and confirmation)",
    url: "https://directpay.irs.gov/directpay/paymentManager",
    question: "Is the IRS Direct Pay Look Up a Payment page now visible?",
  }),
  navShortcut({
    id: "direct-pay-cancel-payment",
    intent: "Cancel a scheduled Direct Pay payment",
    url: "https://directpay.irs.gov/directpay/paymentManager?action=cancel",
    question: "Is the IRS Direct Pay cancel-payment page now visible?",
    risk: "destructive",
  }),
  navShortcut({
    id: "direct-pay-modify-payment",
    intent: "Modify a scheduled Direct Pay payment (date or amount)",
    url: "https://directpay.irs.gov/directpay/paymentManager?action=modify",
    question: "Is the IRS Direct Pay modify-payment page now visible?",
    risk: "financial",
  }),
  navShortcut({
    id: "direct-pay-faqs",
    intent: "Open the Direct Pay FAQ page",
    url: "https://www.irs.gov/payments/direct-pay-with-bank-account",
    question: "Is the IRS Direct Pay FAQ / about page now visible?",
  }),
  navShortcut({
    id: "direct-pay-fees-info",
    intent: "Open the page describing Direct Pay fees (none) vs other payment methods",
    url: "https://www.irs.gov/payments/pay-taxes-by-credit-or-debit-card",
    question: "Is the IRS payment-methods comparison page now visible?",
  }),
  keyShortcut({
    id: "direct-pay-confirm-submit",
    intent: "On Direct Pay Step 5 (final confirmation), submit the payment by pressing Enter",
    actions: [{ type: "key", key: "enter" }],
    question: "Has the Direct Pay payment been submitted (confirmation page with EFT confirmation number now visible)?",
    risk: "financial",
  }),
  navShortcut({
    id: "open-eftps",
    intent: "Open EFTPS (Electronic Federal Tax Payment System) for business and large payments",
    url: "https://www.eftps.gov",
    question: "Is the EFTPS homepage now visible?",
  }),
  navShortcut({
    id: "direct-pay-schedule-future",
    intent: "Open Direct Pay configured for a future scheduled payment (up to 365 days)",
    url: "https://directpay.irs.gov/directpay/payment?schedule=future",
    question: "Is the IRS Direct Pay flow now visible with the schedule-for-future option available?",
    risk: "financial",
  })
);

// TRANSCRIPTS (~30 — types x years parameterization)
const TRANSCRIPT_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const TRANSCRIPT_TYPES = [
  { id: "return", label: "Return Transcript" },
  { id: "account", label: "Account Transcript" },
  { id: "record-of-account", label: "Record of Account" },
  { id: "wage-and-income", label: "Wage and Income Transcript" },
  { id: "non-filing", label: "Verification of Non-filing Letter" },
];

// Hub navigation
shortcuts.push(
  navShortcut({
    id: "open-get-transcript",
    intent: "Open the Get Transcript landing page",
    url: "https://www.irs.gov/individuals/get-transcript",
    question: "Is the IRS Get Transcript landing page now visible?",
  }),
  navShortcut({
    id: "get-transcript-online",
    intent: "Begin the Get Transcript Online flow (requires ID.me)",
    url: "https://sa.www4.irs.gov/icce-core/loadGetTrans.action",
    question: "Is the Get Transcript Online sign-in / ID.me redirect page now visible?",
  }),
  navShortcut({
    id: "get-transcript-by-mail",
    intent: "Begin the Get Transcript by Mail flow",
    url: "https://sa.www4.irs.gov/gettranscript/",
    question: "Is the Get Transcript by Mail entry page now visible?",
  }),
  navShortcut({
    id: "download-form-4506-t",
    intent: "Download Form 4506-T (Request for Transcript of Tax Return) PDF",
    url: "https://www.irs.gov/pub/irs-pdf/f4506t.pdf",
    question: "Has Form 4506-T (Request for Transcript of Tax Return) been downloaded or opened?",
  }),
  navShortcut({
    id: "download-form-4506",
    intent: "Download Form 4506 (Request for Copy of Tax Return) PDF",
    url: "https://www.irs.gov/pub/irs-pdf/f4506.pdf",
    question: "Has Form 4506 (Request for Copy of Tax Return) been downloaded or opened?",
  }),
  navShortcut({
    id: "transcript-types-explained",
    intent: "Open the page explaining the differences between transcript types",
    url: "https://www.irs.gov/individuals/transcript-types-and-ways-to-order-them",
    question: "Is the IRS transcript-types explanation page now visible?",
  })
);

// Generate type x year combos (5 types x 6 years = 30 — matches budget)
for (const type of TRANSCRIPT_TYPES) {
  for (const year of TRANSCRIPT_YEARS) {
    const id = `request-transcript-${type.id}-${year}`;
    shortcuts.push({
      id,
      intent: `Request a ${type.label} for tax year ${year} via Get Transcript Online`,
      parameters: [],
      platforms: ["macos"],
      app_versions: ["web"],
      method: "menu",
      actions: [
        { type: "key_combo", keys: { macos: "cmd+l" } },
        { type: "type_text", text: "https://sa.www4.irs.gov/icce-core/loadGetTrans.action" },
        { type: "key", key: "enter" },
        { type: "key", key: "tab" },
        { type: "type_text", text: type.label },
        { type: "key", key: "tab" },
        { type: "type_text", text: String(year) },
        { type: "key", key: "enter" },
      ],
      verification: {
        type: "interpret_check",
        question: `Has a ${type.label} for tax year ${year} been requested or downloaded (request confirmation or PDF visible)?`,
        expected: "yes",
      },
      metadata: {
        contributor_id: "seed",
        payment_destination: null,
        token_cost_estimate: tokenCost(id, 80),
        speed_estimate_ms: speedMs(id, 4500),
        submitted_at: submittedAt(id),
      },
    });
  }
}

// FORMS & PUBLICATIONS (~80 — major IRS forms)
const FORMS = [
  // 1040 family
  { num: "1040", title: "U.S. Individual Income Tax Return" },
  { num: "1040-sr", pdfNum: "1040sr", title: "U.S. Tax Return for Seniors" },
  { num: "1040-x", pdfNum: "1040x", title: "Amended U.S. Individual Income Tax Return" },
  { num: "1040-es", pdfNum: "1040es", title: "Estimated Tax for Individuals" },
  { num: "1040-v", pdfNum: "1040v", title: "Payment Voucher" },
  { num: "1040-nr", pdfNum: "1040nr", title: "U.S. Nonresident Alien Income Tax Return" },
  // W-series
  { num: "w-2", pdfNum: "fw2", title: "Wage and Tax Statement" },
  { num: "w-2c", pdfNum: "fw2c", title: "Corrected Wage and Tax Statements" },
  { num: "w-3", pdfNum: "fw3", title: "Transmittal of Wage and Tax Statements" },
  { num: "w-4", pdfNum: "fw4", title: "Employee's Withholding Certificate" },
  { num: "w-4p", pdfNum: "fw4p", title: "Withholding Certificate for Periodic Pension or Annuity Payments" },
  { num: "w-4s", pdfNum: "fw4s", title: "Request for Federal Income Tax Withholding from Sick Pay" },
  { num: "w-4r", pdfNum: "fw4r", title: "Withholding Certificate for Nonperiodic Payments and Eligible Rollover Distributions" },
  { num: "w-7", pdfNum: "fw7", title: "Application for IRS Individual Taxpayer Identification Number" },
  { num: "w-9", pdfNum: "fw9", title: "Request for Taxpayer Identification Number and Certification" },
  // 1099 series
  { num: "1099-nec", pdfNum: "f1099nec", title: "Nonemployee Compensation" },
  { num: "1099-misc", pdfNum: "f1099msc", title: "Miscellaneous Information" },
  { num: "1099-int", pdfNum: "f1099int", title: "Interest Income" },
  { num: "1099-div", pdfNum: "f1099div", title: "Dividends and Distributions" },
  { num: "1099-k", pdfNum: "f1099k", title: "Payment Card and Third Party Network Transactions" },
  { num: "1099-r", pdfNum: "f1099r", title: "Distributions From Pensions, Annuities, Retirement Plans" },
  { num: "1099-b", pdfNum: "f1099b", title: "Proceeds from Broker and Barter Exchange Transactions" },
  { num: "1099-s", pdfNum: "f1099s", title: "Proceeds from Real Estate Transactions" },
  { num: "1099-g", pdfNum: "f1099g", title: "Certain Government Payments" },
  { num: "1099-a", pdfNum: "f1099a", title: "Acquisition or Abandonment of Secured Property" },
  { num: "1099-c", pdfNum: "f1099c", title: "Cancellation of Debt" },
  { num: "1099-ltc", pdfNum: "f1099ltc", title: "Long-Term Care and Accelerated Death Benefits" },
  { num: "1099-oid", pdfNum: "f1099oid", title: "Original Issue Discount" },
  { num: "1099-patr", pdfNum: "f1099patr", title: "Taxable Distributions Received From Cooperatives" },
  { num: "1099-q", pdfNum: "f1099q", title: "Payments from Qualified Education Programs" },
  { num: "1099-sa", pdfNum: "f1099sa", title: "Distributions From an HSA, Archer MSA, or Medicare Advantage MSA" },
  { num: "1099-rrb", pdfNum: "f1099rrb", title: "Railroad Retirement Benefits Statement (RRB-1099)" },
  // 1098 series
  { num: "1098", pdfNum: "f1098", title: "Mortgage Interest Statement" },
  { num: "1098-e", pdfNum: "f1098e", title: "Student Loan Interest Statement" },
  { num: "1098-t", pdfNum: "f1098t", title: "Tuition Statement" },
  { num: "1098-ma", pdfNum: "f1098ma", title: "Mortgage Assistance Payments" },
  // Extensions
  { num: "4868", pdfNum: "f4868", title: "Application for Automatic Extension of Time to File" },
  { num: "7004", pdfNum: "f7004", title: "Application for Automatic Extension of Time to File Business Income Tax Returns" },
  // Employment
  { num: "941", pdfNum: "f941", title: "Employer's Quarterly Federal Tax Return" },
  { num: "941-x", pdfNum: "f941x", title: "Adjusted Employer's Quarterly Federal Tax Return" },
  { num: "940", pdfNum: "f940", title: "Employer's Annual Federal Unemployment (FUTA) Tax Return" },
  { num: "944", pdfNum: "f944", title: "Employer's Annual Federal Tax Return" },
  { num: "943", pdfNum: "f943", title: "Employer's Annual Federal Tax Return for Agricultural Employees" },
  { num: "945", pdfNum: "f945", title: "Annual Return of Withheld Federal Income Tax" },
  // Misc individual
  { num: "8949", pdfNum: "f8949", title: "Sales and Other Dispositions of Capital Assets" },
  { num: "2210", pdfNum: "f2210", title: "Underpayment of Estimated Tax by Individuals" },
  { num: "2848", pdfNum: "f2848", title: "Power of Attorney and Declaration of Representative" },
  { num: "8821", pdfNum: "f8821", title: "Tax Information Authorization" },
  { num: "8606", pdfNum: "f8606", title: "Nondeductible IRAs" },
  { num: "8862", pdfNum: "f8862", title: "Information To Claim Certain Credits After Disallowance" },
  { num: "8863", pdfNum: "f8863", title: "Education Credits" },
  { num: "8888", pdfNum: "f8888", title: "Allocation of Refund (Including Savings Bond Purchases)" },
  { num: "8917", pdfNum: "f8917", title: "Tuition and Fees Deduction" },
  { num: "8919", pdfNum: "f8919", title: "Uncollected Social Security and Medicare Tax on Wages" },
  { num: "8962", pdfNum: "f8962", title: "Premium Tax Credit (PTC)" },
  // Schedules
  { num: "schedule-c", pdfNum: "f1040sc", title: "Profit or Loss From Business" },
  { num: "schedule-d", pdfNum: "f1040sd", title: "Capital Gains and Losses" },
  { num: "schedule-e", pdfNum: "f1040se", title: "Supplemental Income and Loss" },
  { num: "schedule-a", pdfNum: "f1040sa", title: "Itemized Deductions" },
  { num: "schedule-b", pdfNum: "f1040sb", title: "Interest and Ordinary Dividends" },
  { num: "schedule-se", pdfNum: "f1040sse", title: "Self-Employment Tax" },
  { num: "schedule-1", pdfNum: "f1040s1", title: "Additional Income and Adjustments to Income" },
  { num: "schedule-2", pdfNum: "f1040s2", title: "Additional Taxes" },
  { num: "schedule-3", pdfNum: "f1040s3", title: "Additional Credits and Payments" },
  { num: "schedule-eic", pdfNum: "f1040sei", title: "Earned Income Credit" },
  { num: "schedule-k-1-1065", pdfNum: "f1065sk1", title: "Partner's Share of Income, Deductions, Credits, etc." },
  { num: "schedule-k-1-1120s", pdfNum: "f1120ssk1", title: "Shareholder's Share of Income, Deductions, Credits, etc." },
  // Business / entity
  { num: "1065", pdfNum: "f1065", title: "U.S. Return of Partnership Income" },
  { num: "1120", pdfNum: "f1120", title: "U.S. Corporation Income Tax Return" },
  { num: "1120-s", pdfNum: "f1120s", title: "U.S. Income Tax Return for an S Corporation" },
  { num: "1120-x", pdfNum: "f1120x", title: "Amended U.S. Corporation Income Tax Return" },
  { num: "2553", pdfNum: "f2553", title: "Election by a Small Business Corporation" },
  { num: "ss-4", pdfNum: "fss4", title: "Application for Employer Identification Number (EIN)" },
  { num: "5500", pdfNum: "f5500", title: "Annual Return/Report of Employee Benefit Plan" },
  { num: "5471", pdfNum: "f5471", title: "Information Return of U.S. Persons With Respect To Certain Foreign Corporations" },
  { num: "5472", pdfNum: "f5472", title: "Information Return of a 25% Foreign-Owned U.S. Corp or Foreign Corp Engaged in U.S. Trade" },
  // Nonprofit
  { num: "990", pdfNum: "f990", title: "Return of Organization Exempt From Income Tax" },
  { num: "990-ez", pdfNum: "f990ez", title: "Short Form Return of Organization Exempt From Income Tax" },
  { num: "990-pf", pdfNum: "f990pf", title: "Return of Private Foundation" },
  { num: "1023", pdfNum: "f1023", title: "Application for Recognition of Exemption Under Section 501(c)(3)" },
  // International
  { num: "fbar-114", pdfNum: "f8938", title: "Statement of Specified Foreign Financial Assets (Form 8938)" },
  { num: "8938", pdfNum: "f8938", title: "Statement of Specified Foreign Financial Assets" },
  { num: "2555", pdfNum: "f2555", title: "Foreign Earned Income" },
  { num: "1116", pdfNum: "f1116", title: "Foreign Tax Credit" },
];

// Forms hub
shortcuts.push(
  navShortcut({
    id: "open-forms-pubs",
    intent: "Open the Forms & Publications hub",
    url: "https://www.irs.gov/forms-pubs",
    question: "Is the IRS Forms & Publications hub page now visible?",
  }),
  navShortcut({
    id: "open-current-forms",
    intent: "Open the page listing current-year IRS forms",
    url: "https://www.irs.gov/forms-instructions",
    question: "Is the IRS Forms, Instructions, and Publications search/list page now visible?",
  }),
  navShortcut({
    id: "open-prior-year-forms",
    intent: "Open the page for prior-year IRS forms",
    url: "https://www.irs.gov/prior-year-forms-and-instructions",
    question: "Is the IRS prior-year forms and instructions page now visible?",
  })
);

for (const f of FORMS) {
  const pdfNum = f.pdfNum ?? `f${f.num.replace(/-/g, "")}`;
  const aboutNum = f.num.replace(/-/g, "-");
  const id = `download-form-${f.num}`;
  shortcuts.push(
    navShortcut({
      id,
      intent: `Download Form ${f.num.toUpperCase()} (${f.title}) PDF`,
      url: `https://www.irs.gov/pub/irs-pdf/${pdfNum}.pdf`,
      question: `Has Form ${f.num.toUpperCase()} (${f.title}) been downloaded or opened in the browser PDF viewer?`,
    })
  );
}

// PUBLICATIONS (~20)
const PUBS = [
  { num: "17", title: "Your Federal Income Tax (For Individuals)" },
  { num: "501", title: "Dependents, Standard Deduction, and Filing Information" },
  { num: "502", title: "Medical and Dental Expenses" },
  { num: "503", title: "Child and Dependent Care Expenses" },
  { num: "505", title: "Tax Withholding and Estimated Tax" },
  { num: "519", title: "U.S. Tax Guide for Aliens" },
  { num: "523", title: "Selling Your Home" },
  { num: "525", title: "Taxable and Nontaxable Income" },
  { num: "526", title: "Charitable Contributions" },
  { num: "527", title: "Residential Rental Property" },
  { num: "529", title: "Miscellaneous Deductions" },
  { num: "530", title: "Tax Information for Homeowners" },
  { num: "535", title: "Business Expenses" },
  { num: "550", title: "Investment Income and Expenses" },
  { num: "554", title: "Tax Guide for Seniors" },
  { num: "590-a", pdfNum: "p590a", title: "Contributions to Individual Retirement Arrangements (IRAs)" },
  { num: "590-b", pdfNum: "p590b", title: "Distributions from Individual Retirement Arrangements (IRAs)" },
  { num: "596", title: "Earned Income Credit (EIC)" },
  { num: "936", title: "Home Mortgage Interest Deduction" },
  { num: "970", title: "Tax Benefits for Education" },
];

for (const p of PUBS) {
  const pdfNum = p.pdfNum ?? `p${p.num.replace(/-/g, "")}`;
  const id = `download-pub-${p.num}`;
  shortcuts.push(
    navShortcut({
      id,
      intent: `Download IRS Publication ${p.num.toUpperCase()} (${p.title}) PDF`,
      url: `https://www.irs.gov/pub/irs-pdf/${pdfNum}.pdf`,
      question: `Has Publication ${p.num.toUpperCase()} (${p.title}) been downloaded or opened?`,
    })
  );
}

// INTERACTIVE TAX ASSISTANT (~15)
shortcuts.push(
  navShortcut({
    id: "open-ita",
    intent: "Open the Interactive Tax Assistant homepage",
    url: "https://www.irs.gov/help/ita",
    question: "Is the Interactive Tax Assistant (ITA) home page now visible?",
  }),
  navShortcut({
    id: "ita-dependents",
    intent: "Open the ITA tool for determining who can be claimed as a dependent",
    url: "https://www.irs.gov/help/ita/whom-may-i-claim-as-a-dependent",
    question: "Is the ITA 'Whom May I Claim as a Dependent?' tool now visible?",
  }),
  navShortcut({
    id: "ita-filing-status",
    intent: "Open the ITA tool for determining filing status",
    url: "https://www.irs.gov/help/ita/what-is-my-filing-status",
    question: "Is the ITA 'What Is My Filing Status?' tool now visible?",
  }),
  navShortcut({
    id: "ita-must-file",
    intent: "Open the ITA tool for determining whether you must file a return",
    url: "https://www.irs.gov/help/ita/do-i-need-to-file-a-tax-return",
    question: "Is the ITA 'Do I Need to File a Tax Return?' tool now visible?",
  }),
  navShortcut({
    id: "ita-eitc",
    intent: "Open the ITA tool for Earned Income Tax Credit eligibility",
    url: "https://www.irs.gov/help/ita/am-i-eligible-to-claim-the-earned-income-credit",
    question: "Is the ITA EITC eligibility tool now visible?",
  }),
  navShortcut({
    id: "ita-ctc",
    intent: "Open the ITA tool for Child Tax Credit eligibility",
    url: "https://www.irs.gov/help/ita/does-my-child-qualify-for-the-child-tax-credit",
    question: "Is the ITA Child Tax Credit eligibility tool now visible?",
  }),
  navShortcut({
    id: "ita-deduct-medical",
    intent: "Open the ITA tool for medical-expense deductibility",
    url: "https://www.irs.gov/help/ita/can-i-deduct-my-medical-and-dental-expenses",
    question: "Is the ITA medical/dental deduction tool now visible?",
  }),
  navShortcut({
    id: "ita-deduct-charity",
    intent: "Open the ITA tool for charitable contributions deduction",
    url: "https://www.irs.gov/help/ita/can-i-deduct-my-charitable-contributions",
    question: "Is the ITA charitable contributions deduction tool now visible?",
  }),
  navShortcut({
    id: "ita-deduct-mortgage",
    intent: "Open the ITA tool for home mortgage interest deduction",
    url: "https://www.irs.gov/help/ita/can-i-deduct-my-mortgage-related-expenses",
    question: "Is the ITA mortgage interest deduction tool now visible?",
  }),
  navShortcut({
    id: "ita-must-make-est-tax",
    intent: "Open the ITA tool for whether you must make estimated tax payments",
    url: "https://www.irs.gov/help/ita/am-i-required-to-make-estimated-tax-payments",
    question: "Is the ITA estimated-tax-required tool now visible?",
  }),
  navShortcut({
    id: "ita-ira-deduct",
    intent: "Open the ITA tool for IRA contribution deductibility",
    url: "https://www.irs.gov/help/ita/can-i-deduct-my-ira-contribution",
    question: "Is the ITA IRA-contribution-deduction tool now visible?",
  }),
  navShortcut({
    id: "ita-tip-income",
    intent: "Open the ITA tool for whether tip income is taxable",
    url: "https://www.irs.gov/help/ita/are-my-tips-taxable",
    question: "Is the ITA tips-taxable tool now visible?",
  }),
  navShortcut({
    id: "ita-self-employed",
    intent: "Open the ITA tool for self-employment income reporting",
    url: "https://www.irs.gov/help/ita/how-do-i-report-self-employment-income",
    question: "Is the ITA self-employment income reporting tool now visible?",
  }),
  navShortcut({
    id: "ita-401k-rollover",
    intent: "Open the ITA tool for 401(k) rollover taxability",
    url: "https://www.irs.gov/help/ita/is-my-401k-distribution-taxable",
    question: "Is the ITA 401(k) distribution taxability tool now visible?",
  }),
  navShortcut({
    id: "ita-amend",
    intent: "Open the ITA tool on whether you should amend your return",
    url: "https://www.irs.gov/help/ita/should-i-file-an-amended-return",
    question: "Is the ITA 'Should I File an Amended Return?' tool now visible?",
  })
);

// TAX TOPICS (~20)
const TAX_TOPICS = [
  { num: 151, title: "Your Appeal Rights" },
  { num: 152, title: "Refund Information" },
  { num: 153, title: "What to Do if You Haven't Filed Your Tax Return" },
  { num: 154, title: "Form W-2 and Form 1099-R (What to Do if Incorrect or Not Received)" },
  { num: 159, title: "How to Get a Wage and Income Transcript or Copy of Form W-2" },
  { num: 161, title: "Returning an Erroneous Refund" },
  { num: 201, title: "The Collection Process" },
  { num: 202, title: "Tax Payment Options" },
  { num: 203, title: "Reduced Refund (Treasury Offset Program)" },
  { num: 253, title: "Substitute Tax Forms" },
  { num: 301, title: "When, How, and Where to File" },
  { num: 304, title: "Extensions of Time to File Your Tax Return" },
  { num: 305, title: "Recordkeeping" },
  { num: 308, title: "Amended Returns" },
  { num: 313, title: "Qualified Tuition Programs (QTPs)" },
  { num: 352, title: "Which Form 1040 to Use" },
  { num: 502, title: "Medical and Dental Expenses" },
  { num: 506, title: "Charitable Contributions" },
  { num: 856, title: "Foreign Tax Credit" },
  { num: 901, title: "Is a Person With Income From Puerto Rico Required to File a U.S. Federal Income Tax Return?" },
];

for (const t of TAX_TOPICS) {
  const id = `open-tax-topic-${t.num}`;
  shortcuts.push(
    navShortcut({
      id,
      intent: `Open IRS Tax Topic ${t.num} (${t.title})`,
      url: `https://www.irs.gov/taxtopics/tc${t.num}`,
      question: `Is IRS Tax Topic ${t.num} (${t.title}) now visible?`,
    })
  );
}

// IDENTITY THEFT (~10)
shortcuts.push(
  navShortcut({
    id: "open-id-theft-info",
    intent: "Open the IRS Identity Theft information hub",
    url: "https://www.irs.gov/identity-theft-fraud-scams",
    question: "Is the IRS Identity Theft / Fraud / Scams hub page now visible?",
  }),
  navShortcut({
    id: "report-id-theft",
    intent: "Open the IRS page for reporting tax-related identity theft",
    url: "https://www.irs.gov/identity-theft-fraud-scams/identity-theft",
    question: "Is the IRS report-identity-theft / Identity Theft Central page now visible?",
  }),
  navShortcut({
    id: "download-form-14039",
    intent: "Download Form 14039 (Identity Theft Affidavit) PDF",
    url: "https://www.irs.gov/pub/irs-pdf/f14039.pdf",
    question: "Has Form 14039 (Identity Theft Affidavit) been downloaded or opened?",
  }),
  navShortcut({
    id: "open-ip-pin-info",
    intent: "Open the IRS Identity Protection PIN (IP PIN) information page",
    url: "https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin",
    question: "Is the IRS IP PIN information page now visible?",
  }),
  navShortcut({
    id: "request-ip-pin",
    intent: "Open the Get an IP PIN online application",
    url: "https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin",
    question: "Is the Get an IP PIN application page (with the 'Get an IP PIN' button) now visible?",
  }),
  navShortcut({
    id: "ip-pin-portal",
    intent: "Go directly to the IP PIN online portal (ID.me sign-in)",
    url: "https://sa.www4.irs.gov/icce-core/loadIPpin.action",
    question: "Is the IP PIN sign-in / ID.me page now visible?",
  }),
  navShortcut({
    id: "opt-out-ip-pin",
    intent: "Open the page describing how to opt out of the IP PIN program",
    url: "https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin#optout",
    question: "Is the IP PIN page now visible, scrolled to (or with) the opt-out section?",
  }),
  navShortcut({
    id: "open-id-theft-victim-faq",
    intent: "Open the IRS identity theft victim FAQ",
    url: "https://www.irs.gov/identity-theft-fraud-scams/identity-theft-victim-assistance-how-it-works",
    question: "Is the IRS Identity Theft Victim Assistance page now visible?",
  }),
  navShortcut({
    id: "report-phishing",
    intent: "Open the IRS page for reporting phishing emails or scams",
    url: "https://www.irs.gov/privacy-disclosure/report-phishing",
    question: "Is the IRS Report Phishing page now visible?",
  }),
  navShortcut({
    id: "id-theft-fraud-scam-alerts",
    intent: "Open the IRS scam alerts page",
    url: "https://www.irs.gov/newsroom/tax-scams-consumer-alerts",
    question: "Is the IRS tax scams / consumer alerts page now visible?",
  })
);

// AMENDED RETURN (~10)
shortcuts.push(
  navShortcut({
    id: "open-amended-return-info",
    intent: "Open the IRS Amended Return information hub",
    url: "https://www.irs.gov/filing/amended-returns",
    question: "Is the IRS amended-returns information hub page now visible?",
  }),
  navShortcut({
    id: "open-form-1040x-info",
    intent: "Open the About Form 1040-X page (amended return instructions)",
    url: "https://www.irs.gov/forms-pubs/about-form-1040x",
    question: "Is the About Form 1040-X page now visible?",
  }),
  navShortcut({
    id: "download-instructions-1040x",
    intent: "Download Form 1040-X instructions PDF",
    url: "https://www.irs.gov/pub/irs-pdf/i1040x.pdf",
    question: "Have the Form 1040-X instructions been downloaded or opened?",
  }),
  navShortcut({
    id: "amended-where-to-file",
    intent: "Open the IRS Where to File Your Amended Return page",
    url: "https://www.irs.gov/filing/wheres-my-amended-return",
    question: "Is the IRS Where's My Amended Return information page now visible?",
  }),
  navShortcut({
    id: "amended-return-tracker",
    intent: "Open the Where's My Amended Return tracker",
    url: "https://www.irs.gov/filing/wheres-my-amended-return",
    question: "Is the Where's My Amended Return tracker page now visible?",
  }),
  navShortcut({
    id: "amended-electronic-filing",
    intent: "Open the page on filing 1040-X electronically",
    url: "https://www.irs.gov/filing/individuals/amended-returns-form-1040-x",
    question: "Is the page on filing Form 1040-X electronically now visible?",
  }),
  navShortcut({
    id: "amended-faq",
    intent: "Open the FAQ page for amended returns",
    url: "https://www.irs.gov/faqs/irs-procedures/amended-returns-form-1040-x",
    question: "Is the IRS amended returns FAQ page now visible?",
  }),
  navShortcut({
    id: "amended-time-limits",
    intent: "Open the page describing time limits for filing an amended return",
    url: "https://www.irs.gov/taxtopics/tc308",
    question: "Is IRS Tax Topic 308 (Amended Returns) now visible?",
  }),
  navShortcut({
    id: "amended-paper-filing",
    intent: "Open the page describing paper-filing addresses for 1040-X",
    url: "https://www.irs.gov/filing/where-to-file-addresses-for-taxpayers-and-tax-professionals-filing-form-1040-x",
    question: "Is the IRS where-to-file-1040X paper addresses page now visible?",
  }),
  navShortcut({
    id: "amended-status-by-phone",
    intent: "Open the page with the IRS amended-return phone hotline number",
    url: "https://www.irs.gov/help/let-us-help-you",
    question: "Is the IRS Let Us Help You page (with telephone numbers) now visible?",
  })
);

// INSTALLMENT AGREEMENTS (~10)
shortcuts.push(
  navShortcut({
    id: "open-installment-info",
    intent: "Open the IRS Installment Agreements information page",
    url: "https://www.irs.gov/payments/online-payment-agreement-application",
    question: "Is the IRS Online Payment Agreement information page now visible?",
  }),
  navShortcut({
    id: "open-installment-app",
    intent: "Open the Online Payment Agreement application directly",
    url: "https://sa.www4.irs.gov/opa/",
    question: "Is the IRS Online Payment Agreement application page now visible?",
  }),
  navShortcut({
    id: "apply-short-term-plan",
    intent: "Apply for a short-term payment plan (180 days or less)",
    url: "https://sa.www4.irs.gov/opa/?plan=short",
    question: "Is the Online Payment Agreement page now visible with short-term plan selected (or as default)?",
    risk: "financial",
  }),
  navShortcut({
    id: "apply-long-term-plan",
    intent: "Apply for a long-term installment agreement (more than 180 days)",
    url: "https://sa.www4.irs.gov/opa/?plan=long",
    question: "Is the Online Payment Agreement page now visible with long-term installment selected?",
    risk: "financial",
  }),
  navShortcut({
    id: "view-existing-plan",
    intent: "View an existing installment agreement",
    url: "https://sa.www4.irs.gov/opa/?action=view",
    question: "Is the Online Payment Agreement view-existing-plan page now visible?",
  }),
  navShortcut({
    id: "modify-existing-plan",
    intent: "Modify an existing installment agreement (change amount or due date)",
    url: "https://sa.www4.irs.gov/opa/?action=modify",
    question: "Is the Online Payment Agreement modify-existing-plan page now visible?",
    risk: "financial",
  }),
  navShortcut({
    id: "cancel-installment-plan",
    intent: "Cancel an existing installment agreement",
    url: "https://sa.www4.irs.gov/opa/?action=cancel",
    question: "Is the Online Payment Agreement cancel-existing-plan page now visible?",
    risk: "destructive",
  }),
  navShortcut({
    id: "download-form-9465",
    intent: "Download Form 9465 (Installment Agreement Request) PDF",
    url: "https://www.irs.gov/pub/irs-pdf/f9465.pdf",
    question: "Has Form 9465 (Installment Agreement Request) been downloaded or opened?",
  }),
  navShortcut({
    id: "open-installment-fees",
    intent: "Open the page describing installment agreement setup fees",
    url: "https://www.irs.gov/payments/payment-plans-installment-agreements",
    question: "Is the IRS payment plans / installment agreements info page (showing fees) now visible?",
  }),
  navShortcut({
    id: "open-default-warning",
    intent: "Open the page describing what happens if you default on an installment agreement",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/failure-to-pay-penalty",
    question: "Is the IRS failure-to-pay-penalty page (relevant to default on installment plans) now visible?",
  })
);

// WITHHOLDING ESTIMATOR (~15)
shortcuts.push(
  navShortcut({
    id: "open-withholding-estimator",
    intent: "Open the IRS Tax Withholding Estimator",
    url: "https://www.irs.gov/individuals/tax-withholding-estimator",
    question: "Is the IRS Tax Withholding Estimator landing page now visible?",
  }),
  navShortcut({
    id: "withholding-estimator-app",
    intent: "Open the Tax Withholding Estimator application directly",
    url: "https://apps.irs.gov/app/tax-withholding-estimator",
    question: "Is the Tax Withholding Estimator application page now visible (asking for filing status)?",
  }),
  keyShortcut({
    id: "withholding-step-filing-status",
    intent: "On the Withholding Estimator filing status page, select a filing status by typing it",
    parameters: [{ name: "filing_status", type: "string", required: true }],
    actions: [
      { type: "type_text", text: "{filing_status}" },
      { type: "key", key: "tab" },
      { type: "key", key: "enter" },
    ],
    question: "Has the Withholding Estimator advanced past the filing-status step (with {filing_status} entered)?",
  }),
  keyShortcut({
    id: "withholding-step-income",
    intent: "Enter primary annual gross income on the Withholding Estimator income page",
    parameters: [{ name: "annual_income", type: "number", required: true }],
    actions: [
      { type: "type_text", text: "{annual_income}" },
      { type: "key", key: "tab" },
      { type: "key", key: "enter" },
    ],
    question: "Has the Withholding Estimator accepted the income value {annual_income} and advanced?",
  }),
  keyShortcut({
    id: "withholding-step-deductions",
    intent: "Enter standard or itemized deduction amount on the Withholding Estimator deductions page",
    parameters: [{ name: "deduction_amount", type: "number", required: true }],
    actions: [
      { type: "type_text", text: "{deduction_amount}" },
      { type: "key", key: "tab" },
      { type: "key", key: "enter" },
    ],
    question: "Has the Withholding Estimator accepted the deduction amount {deduction_amount}?",
  }),
  keyShortcut({
    id: "withholding-step-credits",
    intent: "Enter expected tax credits on the Withholding Estimator credits page",
    parameters: [{ name: "credits_amount", type: "number", required: true }],
    actions: [
      { type: "type_text", text: "{credits_amount}" },
      { type: "key", key: "tab" },
      { type: "key", key: "enter" },
    ],
    question: "Has the Withholding Estimator accepted the credits amount {credits_amount}?",
  }),
  keyShortcut({
    id: "withholding-view-results",
    intent: "Submit and view the final results from the Withholding Estimator",
    actions: [{ type: "key", key: "enter" }],
    question: "Are the Withholding Estimator results visible (showing recommended W-4 line entries and projected refund/balance)?",
  }),
  navShortcut({
    id: "withholding-estimator-faq",
    intent: "Open the FAQ for the Tax Withholding Estimator",
    url: "https://www.irs.gov/individuals/tax-withholding",
    question: "Is the IRS Tax Withholding info / FAQ page now visible?",
  }),
  navShortcut({
    id: "open-w4-info",
    intent: "Open the About Form W-4 page",
    url: "https://www.irs.gov/forms-pubs/about-form-w-4",
    question: "Is the About Form W-4 page now visible?",
  }),
  navShortcut({
    id: "open-pub-505",
    intent: "Open Publication 505 (Tax Withholding and Estimated Tax)",
    url: "https://www.irs.gov/pub/irs-pdf/p505.pdf",
    question: "Has Publication 505 (Tax Withholding and Estimated Tax) been downloaded or opened?",
  }),
  navShortcut({
    id: "estimator-pension-income",
    intent: "Open the Withholding Estimator with pension/annuity income mode",
    url: "https://apps.irs.gov/app/tax-withholding-estimator?mode=pension",
    question: "Is the Tax Withholding Estimator now visible with pension-income mode active?",
  }),
  navShortcut({
    id: "estimator-self-employed",
    intent: "Open the Withholding Estimator with self-employment-income mode",
    url: "https://apps.irs.gov/app/tax-withholding-estimator?mode=self-employed",
    question: "Is the Tax Withholding Estimator now visible with self-employment-income mode active?",
  }),
  navShortcut({
    id: "estimator-multiple-jobs",
    intent: "Open the Withholding Estimator multiple-jobs information page",
    url: "https://apps.irs.gov/app/tax-withholding-estimator?mode=multiple-jobs",
    question: "Is the Tax Withholding Estimator multiple-jobs page now visible?",
  }),
  navShortcut({
    id: "estimator-results-print",
    intent: "Open the print-friendly results page from the Withholding Estimator",
    url: "https://apps.irs.gov/app/tax-withholding-estimator/results/print",
    question: "Is the Withholding Estimator print-friendly results page now visible?",
  }),
  navShortcut({
    id: "estimator-restart",
    intent: "Restart the Tax Withholding Estimator from step 1",
    url: "https://apps.irs.gov/app/tax-withholding-estimator/restart",
    question: "Is the Tax Withholding Estimator now reset to step 1?",
  })
);

// BUSINESS (~15)
shortcuts.push(
  navShortcut({
    id: "open-business-hub",
    intent: "Open the IRS Small Business and Self-Employed hub",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed",
    question: "Is the IRS Small Businesses & Self-Employed hub page now visible?",
  }),
  navShortcut({
    id: "open-ein-info",
    intent: "Open the EIN information page",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/employer-id-numbers",
    question: "Is the IRS EIN information page now visible?",
  }),
  navShortcut({
    id: "open-ein-app",
    intent: "Open the online EIN application (weekdays 7am-10pm ET only)",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
    question: "Is the EIN online application landing page now visible?",
  }),
  navShortcut({
    id: "open-ein-app-portal",
    intent: "Go directly to the EIN application portal",
    url: "https://sa.www4.irs.gov/modiein/individual/index.jsp",
    question: "Is the EIN application portal page now visible?",
  }),
  navShortcut({
    id: "change-ein-responsible-party",
    intent: "Open the page on changing an EIN responsible party (Form 8822-B)",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/responsible-parties-and-nominees",
    question: "Is the IRS responsible-parties-and-nominees page now visible?",
  }),
  navShortcut({
    id: "download-form-8822-b",
    intent: "Download Form 8822-B (Change of Address or Responsible Party — Business)",
    url: "https://www.irs.gov/pub/irs-pdf/f8822b.pdf",
    question: "Has Form 8822-B been downloaded or opened?",
  }),
  navShortcut({
    id: "open-employment-tax",
    intent: "Open the IRS Employment Taxes hub",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/employment-taxes",
    question: "Is the IRS Employment Taxes hub page now visible?",
  }),
  navShortcut({
    id: "open-self-employment",
    intent: "Open the Self-Employed Individuals Tax Center",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/self-employed-individuals-tax-center",
    question: "Is the IRS Self-Employed Individuals Tax Center page now visible?",
  }),
  navShortcut({
    id: "open-business-statistics",
    intent: "Open the SOI Tax Stats — Business activity statistics page",
    url: "https://www.irs.gov/statistics/soi-tax-stats-business-tax-statistics",
    question: "Is the SOI Tax Stats — Business activity statistics page now visible?",
  }),
  navShortcut({
    id: "open-corp-taxes",
    intent: "Open the Corporations tax hub",
    url: "https://www.irs.gov/businesses/corporations",
    question: "Is the IRS Corporations tax hub page now visible?",
  }),
  navShortcut({
    id: "open-partnerships",
    intent: "Open the Partnerships tax hub",
    url: "https://www.irs.gov/businesses/partnerships",
    question: "Is the IRS Partnerships hub page now visible?",
  }),
  navShortcut({
    id: "open-llc-info",
    intent: "Open the IRS LLC information page",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc",
    question: "Is the IRS LLC information page now visible?",
  }),
  navShortcut({
    id: "open-business-deductions",
    intent: "Open the deducting business expenses page",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/deducting-business-expenses",
    question: "Is the IRS Deducting Business Expenses page now visible?",
  }),
  navShortcut({
    id: "open-quarterly-estimated",
    intent: "Open the page on quarterly estimated taxes for businesses",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes",
    question: "Is the IRS estimated-taxes-for-businesses page now visible?",
  }),
  navShortcut({
    id: "open-business-tax-id-tools",
    intent: "Open the page on IRS taxpayer ID tools for businesses",
    url: "https://www.irs.gov/individuals/taxpayer-identification-numbers-tin",
    question: "Is the IRS Taxpayer Identification Numbers (TIN) page now visible?",
  })
);

// TAX PROFESSIONALS (~10)
shortcuts.push(
  navShortcut({
    id: "open-tax-pros-hub",
    intent: "Open the Tax Professionals hub",
    url: "https://www.irs.gov/tax-professionals",
    question: "Is the IRS Tax Professionals hub page now visible?",
  }),
  navShortcut({
    id: "open-ptin-info",
    intent: "Open the PTIN (Preparer Tax Identification Number) information page",
    url: "https://www.irs.gov/tax-professionals/ptin-requirements-for-tax-return-preparers",
    question: "Is the IRS PTIN information page now visible?",
  }),
  navShortcut({
    id: "open-ptin-renew",
    intent: "Open the PTIN application/renewal portal",
    url: "https://rpr.irs.gov/datamart/mainMenuUSIRS.do",
    question: "Is the IRS PTIN portal sign-in page now visible?",
  }),
  navShortcut({
    id: "open-eservices",
    intent: "Open the IRS e-Services landing page",
    url: "https://www.irs.gov/tax-professionals/e-services",
    question: "Is the IRS e-Services landing page now visible?",
  }),
  navShortcut({
    id: "eservices-login",
    intent: "Open the e-Services sign-in page",
    url: "https://la.www4.irs.gov/e-services/Registration/index.htm",
    question: "Is the IRS e-Services sign-in page now visible?",
  }),
  navShortcut({
    id: "open-efin-info",
    intent: "Open the EFIN (Electronic Filing Identification Number) information page",
    url: "https://www.irs.gov/tax-professionals/become-an-authorized-e-file-provider",
    question: "Is the IRS EFIN / Become an Authorized E-File Provider page now visible?",
  }),
  navShortcut({
    id: "efin-application",
    intent: "Begin or continue the EFIN application",
    url: "https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider",
    question: "Is the EFIN application info page now visible?",
  }),
  navShortcut({
    id: "open-caf-lookup",
    intent: "Open the CAF (Centralized Authorization File) information page",
    url: "https://www.irs.gov/tax-professionals/centralized-authorization-file-caf",
    question: "Is the IRS CAF information page now visible?",
  }),
  navShortcut({
    id: "open-tax-pro-account",
    intent: "Open the Tax Pro Account portal",
    url: "https://www.irs.gov/tax-professionals/use-tax-pro-account",
    question: "Is the IRS Tax Pro Account information page now visible?",
  }),
  navShortcut({
    id: "open-cpe-info",
    intent: "Open the IRS CPE (continuing professional education) information page",
    url: "https://www.irs.gov/tax-professionals/continuing-education-for-tax-professionals",
    question: "Is the IRS Continuing Education for Tax Professionals page now visible?",
  })
);

// HELP & CONTACT (~10)
shortcuts.push(
  navShortcut({
    id: "open-find-local-office",
    intent: "Open the Contact Your Local IRS Office locator",
    url: "https://www.irs.gov/help/contact-your-local-irs-office",
    question: "Is the IRS Contact Your Local Office page now visible?",
  }),
  navAndFill({
    id: "find-local-office-by-zip",
    intent: "Look up a local IRS office by ZIP code",
    url: "https://apps.irs.gov/app/officeLocator/index.jsp",
    parameters: [{ name: "zip", type: "string", required: true, description: "5-digit ZIP code" }],
    fields: [
      { value: "{zip}", advance: "enter" },
    ],
    question: "Is the IRS office locator showing results for ZIP code {zip}?",
  }),
  navShortcut({
    id: "open-taxpayer-advocate",
    intent: "Open the Taxpayer Advocate Service homepage",
    url: "https://www.taxpayeradvocate.irs.gov",
    question: "Is the Taxpayer Advocate Service (TAS) homepage now visible?",
  }),
  navShortcut({
    id: "tas-find-local",
    intent: "Open the TAS local office locator",
    url: "https://www.taxpayeradvocate.irs.gov/contact-us",
    question: "Is the TAS contact / local office locator page now visible?",
  }),
  navShortcut({
    id: "open-customer-service-numbers",
    intent: "Open the IRS Telephone Assistance / customer service phone numbers page",
    url: "https://www.irs.gov/help/telephone-assistance",
    question: "Is the IRS Telephone Assistance page (showing phone numbers and hours) now visible?",
  }),
  navShortcut({
    id: "open-tac-appointment",
    intent: "Open the page on scheduling an in-person Taxpayer Assistance Center (TAC) appointment",
    url: "https://www.irs.gov/help/contact-your-local-irs-office",
    question: "Is the IRS Contact Your Local IRS Office / TAC appointment info page now visible?",
  }),
  navShortcut({
    id: "open-international-support",
    intent: "Open the page on international taxpayer support",
    url: "https://www.irs.gov/individuals/international-taxpayers",
    question: "Is the IRS International Taxpayers page now visible?",
  }),
  navShortcut({
    id: "open-disability-services",
    intent: "Open the IRS services for disabled taxpayers page",
    url: "https://www.irs.gov/help/services-for-individuals-with-disabilities",
    question: "Is the IRS Services for Individuals with Disabilities page now visible?",
  }),
  navShortcut({
    id: "open-vita",
    intent: "Open the VITA (Volunteer Income Tax Assistance) information page",
    url: "https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers",
    question: "Is the IRS Free Tax Return Preparation (VITA/TCE) information page now visible?",
  }),
  navShortcut({
    id: "open-vita-locator",
    intent: "Open the VITA/TCE site locator",
    url: "https://irs.treasury.gov/freetaxprep/",
    question: "Is the VITA/TCE Free Tax Prep site locator now visible?",
  })
);

// LANGUAGE / ACCESSIBILITY (~10)
shortcuts.push(
  navShortcut({
    id: "open-spanish-version",
    intent: "Open the IRS website in Spanish",
    url: "https://www.irs.gov/es",
    question: "Is the IRS website now showing in Spanish (es) at the homepage?",
  }),
  navShortcut({
    id: "open-chinese-traditional",
    intent: "Open the IRS website in Chinese (Traditional)",
    url: "https://www.irs.gov/zh-hant",
    question: "Is the IRS website now showing in Traditional Chinese (zh-hant)?",
  }),
  navShortcut({
    id: "open-chinese-simplified",
    intent: "Open the IRS website in Chinese (Simplified)",
    url: "https://www.irs.gov/zh-hans",
    question: "Is the IRS website now showing in Simplified Chinese (zh-hans)?",
  }),
  navShortcut({
    id: "open-korean-version",
    intent: "Open the IRS website in Korean",
    url: "https://www.irs.gov/ko",
    question: "Is the IRS website now showing in Korean (ko)?",
  }),
  navShortcut({
    id: "open-russian-version",
    intent: "Open the IRS website in Russian",
    url: "https://www.irs.gov/ru",
    question: "Is the IRS website now showing in Russian (ru)?",
  }),
  navShortcut({
    id: "open-vietnamese-version",
    intent: "Open the IRS website in Vietnamese",
    url: "https://www.irs.gov/vi",
    question: "Is the IRS website now showing in Vietnamese (vi)?",
  }),
  navShortcut({
    id: "open-haitian-creole",
    intent: "Open the IRS website in Haitian Creole",
    url: "https://www.irs.gov/ht",
    question: "Is the IRS website now showing in Haitian Creole (ht)?",
  }),
  navShortcut({
    id: "open-large-print-forms",
    intent: "Open the page for large-print and accessible IRS forms",
    url: "https://www.irs.gov/forms-pubs/accessible-irs-tax-products",
    question: "Is the IRS Accessible Tax Products page now visible?",
  }),
  navShortcut({
    id: "open-accessibility-statement",
    intent: "Open the IRS accessibility statement",
    url: "https://www.irs.gov/accessibility",
    question: "Is the IRS Accessibility page now visible?",
  }),
  navShortcut({
    id: "open-multilingual-products",
    intent: "Open the IRS multilingual products / publications page",
    url: "https://www.irs.gov/forms-pubs/multilingual-tax-products",
    question: "Is the IRS Multilingual Products page now visible?",
  })
);

// ---- write ----------------------------------------------------------------

console.log(`Generated ${shortcuts.length} shortcuts.`);

// De-dup check (safety net)
const seen = new Set();
for (const s of shortcuts) {
  if (seen.has(s.id)) {
    throw new Error(`Duplicate shortcut id: ${s.id}`);
  }
  seen.add(s.id);
}

const out = {
  schema_version: 1,
  app_id: "irs",
  shortcuts,
};

writeFileSync(join(HERE, "shortcuts.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote shortcuts.json with ${shortcuts.length} entries.`);
