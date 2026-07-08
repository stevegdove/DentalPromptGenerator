import { test } from "node:test";
import assert from "node:assert/strict";
import { djb2 } from "../app/hash.js";

test("djb2 is stable and hex", () => {
  assert.match(djb2("hello"), /^[0-9a-f]+$/);
  assert.equal(djb2("hello"), djb2("hello"));
});
test("different inputs differ", () => {
  assert.notEqual(djb2("a"), djb2("b"));
});
