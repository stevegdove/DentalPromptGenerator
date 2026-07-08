import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../app/prompt.js";

const PHI = "Safety rule: Use no patient identifiers. Never include patient names, dates of birth, addresses, phone numbers, chart/account numbers, or insurance IDs — use [bracket] placeholders instead. This output is a first draft; review it before anyone (especially a patient) sees it.";
const CONF = "Safety rule: Keep confidential data out of this prompt. Don't include account or card numbers, bank details, patient names, individual employee pay, EINs, or other sensitive specifics — redact them or use [bracket] placeholders. Treat the output as a first draft and sanity-check the numbers before acting on them.";
const VERIFY = "Verify rule: AI-found figures and estimates are a starting point — confirm against primary sources, and with your CPA and attorney, before any offer, purchase, or filing.";
const PLACEHOLDER = "Where a specific detail is needed, use bracketed placeholders like [first name], [date], [time], [booking link], or [practice name].";

// The owner/advisor phrasing profile — mirrors legacy owner/index.html:1229-1300
// (role alone, separate "Here's the situation:" sentence, "Keep it {tones}.",
// no placeholder line ever, research note after format/before ask, and the
// "attach or paste" document block).
const ADVISOR_PHRASING = {
  emptyRole: "[expert]",
  contextMode: "situation",
  toneTemplate: "Keep it {tones}.",
  askClause: "Before you start, ask me 2–3 quick questions to get the details right.",
  placeholderLine: false,
  researchNote: "Use a web-connected AI tool for this (ChatGPT with search, Gemini, Grok, or Claude with web) so it can look up current data.",
  pasteTemplate:
    "Attach the {label} in your AI tool, or paste it between the lines below. " +
    "First remove anything confidential — account or card numbers, patient names, individual " +
    "employee pay, bank details — or replace it with [brackets]:\n" +
    "---\n[ attach or paste the {label} here ]\n---"
};

const pack = {
  safety: { phi: PHI, confidential: CONF, verify: VERIFY },
  defaultSafety: ["phi"],
  roles: [
    { value: "frontdesk", safetyKeys: ["phi"] },
    { value: "cfo", safetyKeys: ["confidential", "verify"] }
  ]
};

test("team-style prompt matches legacy output", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a front desk coordinator",
    roleValue: "frontdesk",
    context: "a busy adult overdue 12+ months",
    task: "Re-engage overdue patients",
    taskDetail: "", taskInput: "", detailSentences: [],
    tones: ["caring"],
    format: { text: "3 short text messages (under 35 words each)", ph: true },
    ask: false
  });
  const expected =
    "Act as a front desk coordinator speaking to a busy adult overdue 12+ months. " +
    "Re-engage overdue patients. Use a caring tone. " +
    "Format: 3 short text messages (under 35 words each). " +
    PLACEHOLDER +
    "\n\n" + PHI;
  assert.equal(out, expected);
});

test("owner money role appends confidential then verify", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a fractional CFO for a dental practice",
    roleValue: "cfo",
    context: "", task: "Compare lease vs buy", taskDetail: "", taskInput: "",
    detailSentences: [], tones: [],
    format: { text: "Short labeled bullet points", ph: false },
    ask: false
  });
  const expected =
    "Act as a fractional CFO for a dental practice. Compare lease vs buy. " +
    "Format: Short labeled bullet points." +
    "\n\n" + CONF + "\n\n" + VERIFY;
  assert.equal(out, expected);
});

test("three tones use oxford-comma join", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a dental hygienist", roleValue: "frontdesk",
    context: "", task: "X", taskDetail: "", taskInput: "", detailSentences: [],
    tones: ["calm", "clear", "warm"],
    format: { text: "An email (short and warm)", ph: true }, ask: false
  });
  assert.match(out, /Use a calm, clear, and warm tone\./);
});

test("paste block appears for taskInput", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a marketing and reputation manager", roleValue: "frontdesk",
    context: "", task: "Respond to a negative review (safe)", taskDetail: "",
    taskInput: "negative review", detailSentences: [], tones: [],
    format: { text: "A public review reply (under 70 words)", ph: true }, ask: true
  });
  assert.match(out, /Before you write, ask me 2–3 quick questions/);
  assert.match(out, /Here is the negative review to work from/);
  assert.match(out, /\[ paste the negative review here \]/);
});

test("empty selection guard returns empty string", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "", roleValue: "__x__", context: "", task: "", taskDetail: "",
    taskInput: "", detailSentences: [], tones: [], format: null, ask: false
  });
  assert.equal(out, "");
});

test("null format branch renders Format placeholder", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a dental hygienist", roleValue: "frontdesk",
    context: "", task: "X", taskDetail: "", taskInput: "",
    detailSentences: [], tones: [], format: null, ask: false
  });
  assert.match(out, /Format: \[format\]\./);
  assert.doesNotMatch(out, new RegExp(PLACEHOLDER));
});

test("owner/advisor CFO prompt reproduces legacy owner output byte-for-byte", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a fractional CFO for a dental practice",
    roleValue: "cfo",
    context: "overhead feels too high",
    task: "Review the P&L and flag categories that need attention",
    taskDetail: "", taskInput: "profit & loss statement (P&L)", detailSentences: [],
    tones: ["direct", "concise"],
    format: { text: "A prioritized list of savings with estimated dollar impact", ph: false },
    ask: true,
    phrasing: ADVISOR_PHRASING
  });
  const expected =
    "Act as a fractional CFO for a dental practice. " +
    "Here's the situation: overhead feels too high. " +
    "Review the P&L and flag categories that need attention. " +
    "Keep it direct and concise. " +
    "Format: A prioritized list of savings with estimated dollar impact. " +
    "Before you start, ask me 2–3 quick questions to get the details right.\n\n" +
    "Attach the profit & loss statement (P&L) in your AI tool, or paste it between the lines below. " +
    "First remove anything confidential — account or card numbers, patient names, individual " +
    "employee pay, bank details — or replace it with [brackets]:\n" +
    "---\n[ attach or paste the profit & loss statement (P&L) here ]\n---" +
    "\n\n" + CONF + "\n\n" + VERIFY;
  assert.equal(out, expected);
});

test("advisor phrasing with a research task inserts the research note after format, before ask", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a dental-practice expansion and site-selection analyst",
    roleValue: "cfo", // reuse cfo safetyKeys (confidential, verify) for this fixture
    context: "scouting commercial real estate",
    task: "Screen available properties on Crexi or LoopNet",
    taskDetail: "", taskInput: "", detailSentences: [], tones: [],
    format: { text: "A comparison table", ph: false },
    ask: false,
    phrasing: ADVISOR_PHRASING,
    researchNote: ADVISOR_PHRASING.researchNote
  });
  const formatIdx = out.indexOf("Format: A comparison table.");
  const researchIdx = out.indexOf(ADVISOR_PHRASING.researchNote);
  assert.ok(formatIdx !== -1 && researchIdx !== -1 && researchIdx > formatIdx);
});

test("empty-role advisor placeholder is [expert], never [role]", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "", roleValue: "cfo",
    context: "", task: "Do something", taskDetail: "", taskInput: "",
    detailSentences: [], tones: [],
    format: { text: "A checklist", ph: false }, ask: false,
    phrasing: ADVISOR_PHRASING
  });
  assert.match(out, /^Act as \[expert\]\./);
  assert.doesNotMatch(out, /\[role\]/);
});

test("advisor phrasing never shows the placeholder line, even when format.ph is true", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a fractional CFO for a dental practice", roleValue: "cfo",
    context: "just want a second opinion", task: "Give me options", taskDetail: "", taskInput: "",
    detailSentences: [], tones: [],
    format: { text: "An email (short and warm)", ph: true }, ask: false,
    phrasing: ADVISOR_PHRASING
  });
  assert.equal(out.includes(PLACEHOLDER), false);
});
