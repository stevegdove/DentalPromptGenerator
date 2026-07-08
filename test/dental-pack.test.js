import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePack } from "../app/pack.js";
import { buildPrompt } from "../app/prompt.js";

const pack = JSON.parse(readFileSync(new URL("../verticals/dental.json", import.meta.url)));

test("dental pack is schema-valid", () => {
  const r = validatePack(pack);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test("dental has the three safety rules and expected role coverage", () => {
  assert.ok(pack.safety.phi && pack.safety.confidential && pack.safety.verify);
  const money = pack.roles.filter((r) => r.safetyKeys.includes("verify")).map((r) => r.value);
  assert.deepEqual(money.sort(), ["cfo", "deals", "expansion"]);
});

test("a known frontdesk selection reproduces legacy output", () => {
  const role = pack.roles.find((r) => r.value === "frontdesk");
  const task = role.tasks.find((t) => t.text === "Re-engage overdue patients");
  const out = buildPrompt(pack, {
    rolePrompt: role.prompt, roleValue: role.value,
    context: "a busy adult overdue 12+ months", task: task.text,
    taskDetail: task.detail || "", taskInput: task.input || "", detailSentences: [],
    tones: ["caring"],
    format: pack.formats.find((f) => f.text === "3 short text messages (under 35 words each)"),
    ask: false
  });
  assert.ok(out.startsWith("Act as a front desk coordinator speaking to a busy adult overdue 12+ months."));
  assert.ok(out.trim().endsWith(pack.safety.phi));
});

const TEAM_ROLE_VALUES = ["frontdesk", "hygienist", "assistant", "treatment", "manager", "marketing", "doctor"];
const OWNER_ROLE_VALUES = ["cfo", "expansion", "deals", "ops", "growth", "coach"];

test("every team role carries the patient phrasing, every owner role the advisor phrasing", () => {
  TEAM_ROLE_VALUES.forEach((v) => {
    const role = pack.roles.find((r) => r.value === v);
    assert.ok(role, `role ${v} exists`);
    assert.equal(role.phrasing, "patient", `role ${v} should use patient phrasing`);
  });
  OWNER_ROLE_VALUES.forEach((v) => {
    const role = pack.roles.find((r) => r.value === v);
    assert.ok(role, `role ${v} exists`);
    assert.equal(role.phrasing, "advisor", `role ${v} should use advisor phrasing`);
  });
});

test("pack.phrasings has patient and advisor profiles", () => {
  assert.ok(pack.phrasings && typeof pack.phrasings === "object");
  assert.ok(pack.phrasings.patient);
  assert.ok(pack.phrasings.advisor);
  assert.equal(pack.phrasings.patient.contextMode, "speaking-to");
  assert.equal(pack.phrasings.advisor.contextMode, "situation");
  assert.equal(pack.phrasings.patient.placeholderLine, true);
  assert.equal(pack.phrasings.advisor.placeholderLine, false);
});

test("the three web-research owner tasks are marked research:true", () => {
  const RESEARCH_TASKS = [
    "Compare a dental-supply invoice against other vendors",
    "Evaluate a potential second location",
    "Screen available properties on Crexi or LoopNet"
  ];
  RESEARCH_TASKS.forEach((text) => {
    let found = null;
    pack.roles.forEach((r) => {
      const t = (r.tasks || []).find((tt) => tt.text === text);
      if (t) found = t;
    });
    assert.ok(found, `task "${text}" exists in pack`);
    assert.equal(found.research, true, `task "${text}" should be research:true`);
  });
});

test("a CFO buildPrompt, resolving phrasing from the pack, uses advisor phrasing and never shows the placeholder line", () => {
  const role = pack.roles.find((r) => r.value === "cfo");
  const ph = pack.phrasings[role.phrasing];
  const task = role.tasks.find((t) => t.text === "Review the P&L and flag categories that need attention");
  const out = buildPrompt(pack, {
    rolePrompt: role.prompt, roleValue: role.value,
    context: "overhead feels too high", task: task.text,
    taskDetail: task.detail || "", taskInput: task.input || "", detailSentences: [],
    tones: ["direct"],
    format: pack.formats.find((f) => f.text === "An email (short and warm)"), // ph: true, to prove it's suppressed
    ask: false,
    phrasing: ph
  });
  assert.match(out, /Here's the situation:/);
  assert.match(out, /Keep it direct\./);
  assert.equal(out.includes("Where a specific detail is needed"), false);
});
