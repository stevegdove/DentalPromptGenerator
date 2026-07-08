import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePack, loadPack } from "../app/pack.js";

const good = {
  id: "x", name: "X", theme: {}, vocabulary: {},
  safety: { phi: "P" }, defaultSafety: ["phi"],
  roles: [{ value: "r", label: "R", prompt: "an r", safetyKeys: ["phi"], tasks: [] }],
  formats: [{ text: "F", ph: true }]
};

test("valid pack passes", () => {
  assert.deepEqual(validatePack(good), { ok: true, errors: [] });
});

test("missing id fails", () => {
  const bad = { ...good, id: undefined };
  const r = validatePack(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("id")));
});

test("safetyKeys referencing unknown rule fails", () => {
  const bad = { ...good, roles: [{ ...good.roles[0], safetyKeys: ["nope"] }] };
  const r = validatePack(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("nope")));
});

test("loadPack throws on invalid", async () => {
  const fakeFetch = async () => ({ json: async () => ({ id: "x" }) });
  await assert.rejects(() => loadPack("u", fakeFetch), /Invalid pack/);
});

test("loadPack returns pack on valid", async () => {
  const fakeFetch = async () => ({ json: async () => good });
  const p = await loadPack("u", fakeFetch);
  assert.equal(p.id, "x");
});
