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
