import { test } from "node:test";
import assert from "node:assert/strict";
import { ensurePeriod, capitalize, resolveSafety } from "../app/prompt.js";

const pack = {
  safety: { phi: "PHI-RULE", confidential: "CONF-RULE", verify: "VERIFY-RULE" },
  defaultSafety: ["phi"],
  roles: [
    { value: "frontdesk", safetyKeys: ["phi"] },
    { value: "cfo", safetyKeys: ["confidential", "verify"] }
  ]
};

test("ensurePeriod", () => {
  assert.equal(ensurePeriod("hello"), "hello.");
  assert.equal(ensurePeriod("hello."), "hello.");
  assert.equal(ensurePeriod("hi!"), "hi!");
  assert.equal(ensurePeriod("  "), "");
});

test("capitalize", () => {
  assert.equal(capitalize("re-engage"), "Re-engage");
  assert.equal(capitalize(""), "");
});

test("resolveSafety: single rule", () => {
  assert.deepEqual(resolveSafety(pack, "frontdesk"), ["PHI-RULE"]);
});

test("resolveSafety: money role gets confidential then verify", () => {
  assert.deepEqual(resolveSafety(pack, "cfo"), ["CONF-RULE", "VERIFY-RULE"]);
});

test("resolveSafety: unknown role falls back to defaultSafety", () => {
  assert.deepEqual(resolveSafety(pack, "__other__"), ["PHI-RULE"]);
});
