export function validatePack(obj) {
  const errors = [];
  const str = (v) => typeof v === "string" && v.length > 0;
  if (!obj || typeof obj !== "object") return { ok: false, errors: ["pack is not an object"] };
  ["id", "name"].forEach((k) => { if (!str(obj[k])) errors.push(`missing/invalid ${k}`); });
  ["theme", "vocabulary", "safety"].forEach((k) => {
    if (!obj[k] || typeof obj[k] !== "object" || Array.isArray(obj[k])) errors.push(`missing/invalid ${k}`);
  });
  const safetyKeys = obj.safety && typeof obj.safety === "object" ? Object.keys(obj.safety) : [];
  if (!safetyKeys.length) errors.push("safety has no rules");
  if (!Array.isArray(obj.defaultSafety) || !obj.defaultSafety.length) {
    errors.push("defaultSafety must be a non-empty array");
  } else {
    obj.defaultSafety.forEach((k) => { if (!safetyKeys.includes(k)) errors.push(`defaultSafety references unknown safety rule "${k}"`); });
  }
  if (!Array.isArray(obj.roles) || !obj.roles.length) errors.push("roles must be a non-empty array");
  else obj.roles.forEach((r, i) => {
    if (r === null || Array.isArray(r) || typeof r !== "object") {
      errors.push(`role[${i}] is not an object`);
      return;
    }
    ["value", "label", "prompt"].forEach((k) => { if (!str(r[k])) errors.push(`role[${i}] missing/invalid ${k}`); });
    if (!Array.isArray(r.safetyKeys)) errors.push(`role[${i}] safetyKeys must be an array`);
    else r.safetyKeys.forEach((k) => { if (!safetyKeys.includes(k)) errors.push(`role[${i}] references unknown safety rule "${k}"`); });
    if (!Array.isArray(r.tasks)) errors.push(`role[${i}] tasks must be an array`);
    else r.tasks.forEach((t, j) => {
      if (t && typeof t === "object" && !Array.isArray(t) && t.safetyKeys !== undefined) {
        if (!Array.isArray(t.safetyKeys)) errors.push(`role[${i}].tasks[${j}] safetyKeys must be an array`);
        else t.safetyKeys.forEach((k) => { if (!safetyKeys.includes(k)) errors.push(`role[${i}].tasks[${j}] references unknown safety rule "${k}"`); });
      }
    });
    if (typeof r.phrasing === "string" && r.phrasing) {
      const hasPhrasing = obj.phrasings && typeof obj.phrasings === "object" && !Array.isArray(obj.phrasings)
        && Object.prototype.hasOwnProperty.call(obj.phrasings, r.phrasing);
      if (!hasPhrasing) errors.push(`role[${i}] references unknown phrasing profile "${r.phrasing}"`);
    }
  });
  if (!Array.isArray(obj.formats) || !obj.formats.length) errors.push("formats must be a non-empty array");
  else obj.formats.forEach((f, i) => {
    if (f === null || Array.isArray(f) || typeof f !== "object") {
      errors.push(`format[${i}] is not an object`);
      return;
    }
    if (!str(f.text)) errors.push(`format[${i}] missing text`);
    if (typeof f.ph !== "boolean") errors.push(`format[${i}] ph must be boolean`);
  });
  return { ok: errors.length === 0, errors };
}

export async function loadPack(url, fetchFn = fetch) {
  const res = await fetchFn(url);
  const obj = await res.json();
  const { ok, errors } = validatePack(obj);
  if (!ok) throw new Error("Invalid pack (" + url + "): " + errors.join("; "));
  return obj;
}
