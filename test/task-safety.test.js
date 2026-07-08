import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSafety, buildPrompt } from "../app/prompt.js";

const pack = {
  safety: { confidential: "CONF", taxAdvice: "TAX", investmentAdvice: "INVEST" },
  defaultSafety: ["confidential"],
  roles: [
    { value: "preparer", safetyKeys: ["confidential", "taxAdvice"] },
    { value: "wealth", safetyKeys: ["confidential", "investmentAdvice"] }
  ]
};

test("resolveSafety without extra keys is unchanged", () => {
  assert.deepEqual(resolveSafety(pack, "preparer"), ["CONF", "TAX"]);
});

test("resolveSafety appends task-level extra keys after role keys", () => {
  assert.deepEqual(
    resolveSafety(pack, "preparer", ["investmentAdvice"]),
    ["CONF", "TAX", "INVEST"]
  );
});

test("resolveSafety dedups keys already present on the role", () => {
  assert.deepEqual(
    resolveSafety(pack, "wealth", ["confidential", "taxAdvice"]),
    ["CONF", "INVEST", "TAX"]
  );
});

test("resolveSafety tolerates missing/empty extra keys", () => {
  assert.deepEqual(resolveSafety(pack, "preparer", []), ["CONF", "TAX"]);
  assert.deepEqual(resolveSafety(pack, "preparer", undefined), ["CONF", "TAX"]);
});

test("buildPrompt threads sel.extraSafetyKeys into the trailing safety sections", () => {
  const out = buildPrompt(pack, {
    rolePrompt: "a tax preparer", roleValue: "preparer",
    context: "", task: "Explain a Roth conversion's tax impact", taskDetail: "",
    taskInput: "", detailSentences: [], tones: [],
    format: { text: "Short labeled bullet points", ph: false }, ask: false,
    phrasing: { emptyRole: "[specialist]", contextMode: "situation", toneTemplate: "Keep it {tones}.", askClause: "", placeholderLine: false, pasteTemplate: "" },
    extraSafetyKeys: ["investmentAdvice"]
  });
  assert.ok(out.endsWith("CONF\n\nTAX\n\nINVEST"), "safety order: role (CONF, TAX) then task (INVEST)");
});
