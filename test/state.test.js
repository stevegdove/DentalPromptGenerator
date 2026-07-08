import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeState, decodeState } from "../app/state.js";

test("round-trips a state object", () => {
  const s = { role: "frontdesk", task: "Re-engage overdue patients", tones: ["caring"], ask: false };
  assert.deepEqual(decodeState(encodeState(s)), s);
});

test("handles unicode (en dash, curly quotes)", () => {
  const s = { task: `Answer "do you take my insurance?" — now`, note: "2–3" };
  assert.deepEqual(decodeState(encodeState(s)), s);
});

test("output is URL-safe (no + / =)", () => {
  const enc = encodeState({ a: "?/+=&".repeat(5) });
  assert.doesNotMatch(enc, /[+/=]/);
});
