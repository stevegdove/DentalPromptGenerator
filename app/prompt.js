export function ensurePeriod(s) {
  s = (s || "").trim();
  if (!s) return "";
  return /[.!?]$/.test(s) ? s : s + ".";
}

export function capitalize(s) {
  s = (s || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export function resolveSafety(pack, roleValue) {
  const role = (pack.roles || []).find((r) => r.value === roleValue);
  const keys = (role && role.safetyKeys) || pack.defaultSafety || [];
  return keys.map((k) => pack.safety[k]).filter(Boolean);
}
