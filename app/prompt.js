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

export const PLACEHOLDER_LINE =
  "Where a specific detail is needed, use bracketed placeholders like [first name], [date], [time], [booking link], or [practice name].";

function joinWithAnd(words) {
  if (words.length === 1) return words[0];
  if (words.length === 2) return words[0] + " and " + words[1];
  return words.slice(0, -1).join(", ") + ", and " + words[words.length - 1];
}

export function buildPrompt(pack, sel) {
  const role = sel.rolePrompt;
  // Mirrors legacy team/index.html:1095 — all-empty selection yields no prompt.
  if (!role && !sel.task && !sel.format) return "";

  let s1 = "Act as " + (role || "[role]");
  if (sel.context) s1 += " speaking to " + sel.context;
  s1 = ensurePeriod(s1);

  const parts = [s1, ensurePeriod(capitalize(sel.task || "[task]"))];

  if (sel.taskDetail) parts.push(ensurePeriod(sel.taskDetail));
  if (sel.detailSentences && sel.detailSentences.length) {
    parts.push(sel.detailSentences.join(" "));
  }
  if (sel.tones && sel.tones.length) {
    parts.push("Use a " + joinWithAnd(sel.tones) + " tone.");
  }
  parts.push(sel.format ? "Format: " + ensurePeriod(sel.format.text) : "Format: [format].");
  if (sel.format && sel.format.ph) parts.push(PLACEHOLDER_LINE);
  if (sel.ask) parts.push("Before you write, ask me 2–3 quick questions to get the details right.");

  const sections = [parts.join(" ")];
  if (sel.taskInput) {
    sections.push(
      "Here is the " + sel.taskInput + " to work from. Paste it between the lines below, " +
      "with any patient names or identifiers removed — use [brackets] instead:\n" +
      "---\n[ paste the " + sel.taskInput + " here ]\n---"
    );
  }
  resolveSafety(pack, sel.roleValue).forEach((s) => sections.push(s));
  return sections.join("\n\n");
}
