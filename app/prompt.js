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

// Legacy team/index.html phrasing (the "patient" phrasing profile). Used
// whenever sel.phrasing is not supplied, so existing callers/fixtures that
// predate the phrasing-profile system keep producing identical output.
export const DEFAULT_PATIENT_PHRASING = {
  emptyRole: "[role]",
  contextMode: "speaking-to",
  toneTemplate: "Use a {tones} tone.",
  askClause: "Before you write, ask me 2–3 quick questions to get the details right.",
  placeholderLine: true,
  pasteTemplate:
    "Here is the {label} to work from. Paste it between the lines below, " +
    "with any patient names or identifiers removed — use [brackets] instead:\n" +
    "---\n[ paste the {label} here ]\n---"
};

function joinWithAnd(words) {
  if (words.length === 1) return words[0];
  if (words.length === 2) return words[0] + " and " + words[1];
  return words.slice(0, -1).join(", ") + ", and " + words[words.length - 1];
}

export function buildPrompt(pack, sel) {
  const role = sel.rolePrompt;
  // Mirrors legacy team/index.html:1095 — all-empty selection yields no prompt.
  if (!role && !sel.task && !sel.format) return "";

  const ph = sel.phrasing || DEFAULT_PATIENT_PHRASING;

  const parts = [];

  if (ph.contextMode === "situation") {
    // Owner/advisor phrasing: role and situation are separate sentences.
    parts.push(ensurePeriod("Act as " + (role || ph.emptyRole)));
    if (sel.context) parts.push(ensurePeriod("Here's the situation: " + sel.context));
  } else {
    // Team/patient phrasing: role and audience are one combined sentence.
    let s1 = "Act as " + (role || ph.emptyRole);
    if (sel.context) s1 += " speaking to " + sel.context;
    parts.push(ensurePeriod(s1));
  }

  parts.push(ensurePeriod(capitalize(sel.task || "[task]")));

  if (sel.taskDetail) parts.push(ensurePeriod(sel.taskDetail));
  if (sel.detailSentences && sel.detailSentences.length) {
    parts.push(sel.detailSentences.join(" "));
  }
  if (sel.tones && sel.tones.length) {
    parts.push(ph.toneTemplate.replace("{tones}", joinWithAnd(sel.tones)));
  }
  parts.push(sel.format ? "Format: " + ensurePeriod(sel.format.text) : "Format: [format].");
  if (ph.placeholderLine && sel.format && sel.format.ph) parts.push(PLACEHOLDER_LINE);
  if (sel.researchNote) parts.push(sel.researchNote);
  if (sel.ask) parts.push(ph.askClause);

  const sections = [parts.join(" ")];
  if (sel.taskInput) {
    sections.push(ph.pasteTemplate.replace(/\{label\}/g, sel.taskInput));
  }
  resolveSafety(pack, sel.roleValue).forEach((s) => sections.push(s));
  return sections.join("\n\n");
}
