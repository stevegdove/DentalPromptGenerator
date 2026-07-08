import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../app/prompt.js";

const PHI = "Safety rule: Use no patient identifiers. Never include patient names, dates of birth, addresses, phone numbers, chart/account numbers, or insurance IDs — use [bracket] placeholders instead. This output is a first draft; review it before anyone (especially a patient) sees it.";
const CONF = "Safety rule: Keep confidential data out of this prompt. Don't include account or card numbers, bank details, patient names, individual employee pay, EINs, or other sensitive specifics — redact them or use [bracket] placeholders. Treat the output as a first draft and sanity-check the numbers before acting on them.";
const VERIFY = "Verify rule: AI-found figures and estimates are a starting point — confirm against primary sources, and with your CPA and attorney, before any offer, purchase, or filing.";
const PLACEHOLDER = "Where a specific detail is needed, use bracketed placeholders like [first name], [date], [time], [booking link], or [practice name].";

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
