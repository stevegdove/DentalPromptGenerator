import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = new URL("../verticals/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));

test("manifest lists dental and points at an existing pack", () => {
  assert.ok(Array.isArray(manifest.verticals));
  const dental = manifest.verticals.find((v) => v.id === "dental");
  assert.ok(dental, "dental entry present");
  assert.equal(dental.path, "dental/");
  // referenced pack file exists
  assert.doesNotThrow(() => readFileSync(new URL(dental.id + ".json", base)));
});
