import { test } from "node:test";
import assert from "node:assert/strict";
import { eventName, track } from "../app/analytics.js";

test("eventName without target", () => {
  assert.equal(eventName("dental", "copy"), "dental-copy");
});
test("eventName with target", () => {
  assert.equal(eventName("dental", "open", "chatgpt"), "dental-open-chatgpt");
});
test("track no-ops when goatcounter absent", () => {
  assert.doesNotThrow(() => track("dental-copy"));
});
