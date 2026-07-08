// Pack-driven DOM engine for the prompt builders.
//
// This module reproduces — pack-driven — the DOM wiring that used to be
// duplicated (with hardcoded per-vertical data) in team/index.html and
// owner/index.html. It loads a vertical pack (verticals/<id>.json), then
// wires the same element IDs those pages already used.
//
// Pure logic (prompt assembly, state codec, hashing, analytics naming) lives
// in sibling modules and is reused here rather than reimplemented:
//   prompt.js:    buildPrompt, ensurePeriod
//   pack.js:      loadPack
//   state.js:     encodeState, decodeState
//   analytics.js: eventName, track
//   hash.js:      djb2

import { loadPack } from "./pack.js";
import { buildPrompt, ensurePeriod } from "./prompt.js";
import { encodeState, decodeState } from "./state.js";
import { eventName, track } from "./analytics.js";
import { djb2 } from "./hash.js";

const OTHER = "__other__";

// AI tools the prompt can be sent to. Not pack data — the same four tools are
// offered on every vertical page. prefill: provider supports a URL query
// param that pre-fills the composer.
const PROVIDERS_BY_ID = {
  chatgpt: { id: "chatgpt", name: "ChatGPT", prefill: true, base: "https://chatgpt.com/?q=" },
  claude:  { id: "claude",  name: "Claude",  prefill: true, base: "https://claude.ai/new?q=" },
  gemini:  { id: "gemini",  name: "Gemini",  prefill: false, base: "https://gemini.google.com/app" },
  grok:    { id: "grok",    name: "Grok",    prefill: true, base: "https://grok.com/?q=" }
};

// Generic follow-up suggestions shown after copying, used when a task has no
// followups of its own (not pack data — same fallback across every vertical).
const DEFAULT_FOLLOWUPS = [
  "Make it shorter and warmer.",
  "Give me two more versions to choose from.",
  "What did I forget to consider?"
];

// Courtesy-gate hash for the shared password. Not a secret in any real sense
// (it ships to the browser) — see the per-pack README for how to change it.
const GATE_HASH = "f36b8ed8";

// ---------- PHI detection (shared across every vertical) ----------
const reDate = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;
const reEmail = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
const rePhone = /(?:\+?\d[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/;
const reLongNum = /\d{7,}/;

function looksLikePHI(text) {
  if (!text) return false;
  const stripped = text.replace(/\[[^\]]*\]/g, ""); // ignore content inside [brackets]
  return reDate.test(stripped) || reEmail.test(stripped) ||
    rePhone.test(stripped) || reLongNum.test(stripped);
}

export async function initApp({ verticalId }) {
  const packUrl = new URL(`../verticals/${verticalId}.json`, import.meta.url);
  const pack = await loadPack(packUrl);

  const STORAGE_KEY = "bridge-" + pack.id + "-prompt-v1";
  const FAVS_KEY = STORAGE_KEY + "-favs";
  const UNLOCK_KEY = "bd-" + pack.id + "-unlocked";

  const TONE_CLAUSE = {};
  (pack.tones || []).forEach((t) => { TONE_CLAUSE[t.value] = t.clause; });

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const roleSel = $("role"), ctxSel = $("context"), taskSel = $("task"), fmtSel = $("format");
  const roleOtherWrap = $("role-other-wrap"), ctxOtherWrap = $("context-other-wrap"),
    taskOtherWrap = $("task-other-wrap"), fmtOtherWrap = $("format-other-wrap");
  const roleOther = $("role-other"), ctxOther = $("context-other"),
    taskOther = $("task-other"), fmtOther = $("format-other");
  const promptOut = $("prompt-out");
  const genBtn = $("generate-btn"), copyBtn = $("copy-btn"), resetBtn = $("reset-btn");
  const copyLabel = $("copy-label");
  const askToggle = $("ask-toggle");
  const toneGroup = $("tone-group");
  const providerRow = $("provider-row"), sendNote = $("send-note");
  const detailsPanel = $("details-panel"), detailsWrap = $("details-wrap"), detailsWarn = $("details-warn");
  const shareBtn = $("share-btn"), shareLabel = $("share-label");
  const exampleRow = $("example-row");
  const followupsPanel = $("followups"), followupRow = $("followup-row");
  const saveBtn = $("save-btn"), saveLabel = $("save-label");
  const saveRow = $("save-row"), saveName = $("save-name"), saveConfirm = $("save-confirm");
  const favsCard = $("favs-card"), favsList = $("favs-list");

  // ---------- Small DOM helpers ----------
  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  function makeOption(value, label) {
    const o = document.createElement("option");
    o.value = value; o.textContent = label;
    return o;
  }

  // When `popular` (array of option values) is given, the list is split into a
  // "★ Most popular" optgroup and a `restLabel` optgroup; values stay identical
  // so saved picks, share links, and favorites keep working.
  function fillSelect(sel, items, placeholder, popular, restLabel) {
    sel.innerHTML = "";
    sel.appendChild(makeOption("", placeholder));
    if (popular && popular.length) {
      const top = document.createElement("optgroup");
      top.label = "★ Most popular";
      popular.forEach((val) => {
        items.forEach((it) => { if (it.value === val) top.appendChild(makeOption(it.value, it.label)); });
      });
      const rest = document.createElement("optgroup");
      rest.label = restLabel || "All options";
      items.forEach((it) => { if (popular.indexOf(it.value) === -1) rest.appendChild(makeOption(it.value, it.label)); });
      sel.appendChild(top);
      sel.appendChild(rest);
    } else {
      items.forEach((it) => sel.appendChild(makeOption(it.value, it.label)));
    }
    sel.appendChild(makeOption(OTHER, "Other…"));
  }

  function toggleOther(sel, wrap, input) {
    if (sel.value === OTHER) { show(wrap); }
    else { hide(wrap); input.value = ""; clearWarn(input); }
  }

  function warnElFor(input) { return $(input.id.replace("-other", "-warn")); }
  function checkWarn(input) {
    const w = warnElFor(input);
    if (!w) return;
    if (looksLikePHI(input.value)) show(w); else hide(w);
  }
  function clearWarn(input) {
    const w = warnElFor(input);
    if (w) hide(w);
  }

  // ---------- Pack lookups ----------
  function findRole(value) { return (pack.roles || []).find((r) => r.value === value); }
  function isSensitiveRole(role) { return !!(role && (pack.sensitiveRoles || []).includes(role.value)); }
  function isSensitive(roleValue) { return isSensitiveRole(findRole(roleValue)); }

  function currentTaskObj() {
    if (!taskSel.value || taskSel.value === OTHER) return null;
    const role = findRole(roleSel.value);
    if (!role) return null;
    return (role.tasks || []).find((t) => t.text === taskSel.value) || null;
  }

  // ---------- Populate controls from the pack ----------
  function populateRoles() {
    fillSelect(roleSel, (pack.roles || []).map((r) => ({ value: r.value, label: r.label })), "Choose a role…");
  }

  function populateFormats() {
    const items = (pack.formats || []).map((f) => ({ value: f.text, label: f.text }));
    fillSelect(fmtSel, items, "Choose a format…", pack.popularFormats || [], "All formats");
  }

  // Context list for a role: role.contexts, plus pack.sharedContext UNLESS the
  // role is sensitive (owner/sensitive roles already carry their own shared
  // situations baked into role.contexts during pack authoring).
  function populateContext(roleVal) {
    const role = findRole(roleVal);
    const base = role ? (role.contexts || []) : [];
    const list = isSensitiveRole(role) ? base : base.concat(pack.sharedContext || []);
    fillSelect(ctxSel, list.map((c) => ({ value: c, label: c })), "Pick a situation…");
    ctxSel.disabled = false;
  }

  function populateTasks(roleVal) {
    const role = findRole(roleVal);
    const tasks = role ? (role.tasks || []) : [];
    const items = tasks.map((t) => ({ value: t.text, label: t.text }));
    const popular = tasks.filter((t) => t.popular).map((t) => t.text);
    fillSelect(taskSel, items, "Pick a task…", popular, "All tasks");
    taskSel.disabled = false;
  }

  function resetDependent() {
    ctxSel.innerHTML = ""; ctxSel.appendChild(makeOption("", "Pick a role first…")); ctxSel.disabled = true;
    taskSel.innerHTML = ""; taskSel.appendChild(makeOption("", "Pick a role first…")); taskSel.disabled = true;
    hide(ctxOtherWrap); hide(taskOtherWrap);
    ctxOther.value = ""; taskOther.value = "";
    clearWarn(ctxOther); clearWarn(taskOther);
  }

  // ---------- Task detail fields ----------
  function currentFieldDefs() {
    const task = currentTaskObj();
    return (task && task.fields && task.fields.length) ? task.fields : null;
  }

  function renderDetailFields() {
    const defs = currentFieldDefs();
    detailsWrap.innerHTML = "";
    hide(detailsWarn);
    if (!defs) { hide(detailsPanel); return; }
    defs.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "detail-field";
      const lab = document.createElement("label");
      lab.textContent = f.label;
      lab.setAttribute("for", "detail-" + f.key);
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "bd-text";
      inp.id = "detail-" + f.key;
      inp.placeholder = f.placeholder || "";
      inp.setAttribute("data-key", f.key);
      wrap.appendChild(lab); wrap.appendChild(inp);
      detailsWrap.appendChild(wrap);
    });
    show(detailsPanel);
  }

  function collectDetails() {
    const o = {};
    detailsWrap.querySelectorAll("input").forEach((i) => {
      if (i.value.trim()) o[i.getAttribute("data-key")] = i.value.trim();
    });
    return o;
  }

  function detailSentences() {
    const defs = currentFieldDefs();
    if (!defs) return [];
    const vals = collectDetails();
    const out = [];
    defs.forEach((f) => {
      if (vals[f.key]) out.push(ensurePeriod(f.sentence.replace("{v}", vals[f.key])));
    });
    return out;
  }

  function checkDetailsWarn() {
    let any = false;
    detailsWrap.querySelectorAll("input").forEach((i) => { if (looksLikePHI(i.value)) any = true; });
    if (any) show(detailsWarn); else hide(detailsWarn);
  }

  // ---------- Selection readout ----------
  function selectedToneValues() {
    const out = [];
    toneGroup.querySelectorAll(".chip").forEach((c) => {
      if (c.getAttribute("aria-pressed") === "true") out.push(c.getAttribute("data-tone"));
    });
    return out;
  }
  function selectedToneClauses() {
    return selectedToneValues().map((v) => TONE_CLAUSE[v] || v);
  }

  function getRolePrompt() {
    if (roleSel.value === OTHER) return roleOther.value.trim();
    const r = findRole(roleSel.value);
    return r ? r.prompt : "";
  }
  function getContextText() {
    if (!ctxSel.value) return "";
    if (ctxSel.value === OTHER) return ctxOther.value.trim();
    return ctxSel.value;
  }
  function getTaskText() {
    if (!taskSel.value) return "";
    if (taskSel.value === OTHER) return taskOther.value.trim();
    return taskSel.value;
  }
  function getFormatInfo() {
    if (!fmtSel.value) return null;
    if (fmtSel.value === OTHER) {
      const t = fmtOther.value.trim();
      return t ? { text: t, ph: true } : null;
    }
    const f = (pack.formats || []).find((x) => x.text === fmtSel.value);
    return f || { text: fmtSel.value, ph: false };
  }

  function readyToGenerate() {
    return !!(getRolePrompt() && getTaskText() && getFormatInfo());
  }

  // Build the `sel` object buildPrompt(pack, sel) expects (Task 3 shape).
  function buildSel() {
    const task = currentTaskObj();
    return {
      rolePrompt: getRolePrompt(),
      roleValue: roleSel.value,
      context: getContextText(),
      task: getTaskText(),
      taskDetail: task ? (task.detail || "") : "",
      taskInput: task ? (task.input || "") : "",
      detailSentences: detailSentences(),
      tones: selectedToneClauses(),
      format: getFormatInfo(),
      ask: askToggle.checked
    };
  }

  // ---------- Courtesy gate (role-triggered) ----------
  let gateEl = null;

  function isUnlocked() {
    try { return localStorage.getItem(UNLOCK_KEY) === GATE_HASH; } catch (e) { return false; }
  }

  function ensureGateEl() {
    if (gateEl) return gateEl;
    gateEl = document.createElement("div");
    gateEl.id = "bd-gate";
    gateEl.hidden = true;
    gateEl.setAttribute("role", "dialog");
    gateEl.setAttribute("aria-modal", "true");
    gateEl.setAttribute("aria-labelledby", "bd-gate-title");
    gateEl.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(20,10,30,.55);padding:1rem;";
    gateEl.innerHTML =
      '<div class="bd-gate-card" style="background:#fff;border-radius:16px;padding:1.5rem;' +
      'max-width:24rem;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:system-ui,sans-serif;">' +
      '<h2 id="bd-gate-title" style="margin:0 0 .5rem;font-size:1.2rem;">This role is password-protected.</h2>' +
      '<p style="margin:0 0 1rem;color:#5C6070;">Enter the password to unlock prompts for this role on this device.</p>' +
      '<form id="bd-gate-form" style="display:flex;gap:.5rem;flex-wrap:wrap;">' +
      '<label for="bd-gate-pass" style="position:absolute;left:-9999px;">Password</label>' +
      '<input id="bd-gate-pass" type="password" autocomplete="off" placeholder="Password" ' +
      'style="flex:1;min-width:10rem;padding:.6rem .8rem;border:1px solid #ccc;border-radius:8px;" />' +
      '<button type="submit" class="btn btn--primary">Unlock</button>' +
      "</form>" +
      '<p id="bd-gate-err" hidden style="color:#B8772A;font-weight:600;margin:.8rem 0 0;">' +
      "That&rsquo;s not it &mdash; double-check the password.</p>" +
      '<button type="button" id="bd-gate-cancel" style="margin-top:1rem;background:none;border:none;' +
      'color:#8B8F9B;cursor:pointer;text-decoration:underline;padding:0;">' +
      "Cancel and pick a different role</button>" +
      "</div>";
    document.body.appendChild(gateEl);

    gateEl.querySelector("#bd-gate-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = gateEl.querySelector("#bd-gate-pass");
      const ok = djb2(input.value.trim().toLowerCase()) === GATE_HASH;
      if (ok) {
        try { localStorage.setItem(UNLOCK_KEY, GATE_HASH); } catch (err) { /* ignore */ }
        hideGate();
        track(eventName(pack.id, "gate", "success"));
        updatePreview();
      } else {
        gateEl.querySelector("#bd-gate-err").hidden = false;
        track(eventName(pack.id, "gate", "fail"));
      }
    });
    gateEl.querySelector("#bd-gate-cancel").addEventListener("click", () => {
      roleSel.value = "";
      resetDependent();
      renderDetailFields();
      hideGate();
      updatePreview();
    });
    return gateEl;
  }

  function showGate() {
    ensureGateEl();
    if (!gateEl.hidden) return; // already open — don't clobber what the user is typing
    gateEl.querySelector("#bd-gate-err").hidden = true;
    const input = gateEl.querySelector("#bd-gate-pass");
    input.value = "";
    gateEl.hidden = false;
    setTimeout(() => input.focus(), 0);
  }
  function hideGate() {
    if (gateEl) gateEl.hidden = true;
  }

  // ---------- Assemble / preview ----------
  function updatePreview() {
    const sensitive = isSensitive(roleSel.value);
    const gated = sensitive && !isUnlocked();

    if (gated) showGate(); else hideGate();

    const ready = !gated && readyToGenerate();
    genBtn.disabled = !ready;
    copyBtn.disabled = !ready;
    shareBtn.disabled = !ready;
    if (saveBtn) saveBtn.disabled = !ready;
    if (!ready) hide(saveRow);
    hide(followupsPanel); // selections changed — stale suggestions

    providerRow.querySelectorAll(".provider-btn").forEach((b) => { b.disabled = !ready; });
    if (!ready) sendNote.hidden = true;

    const prompt = gated ? "" : buildPrompt(pack, buildSel());
    if (!prompt) {
      promptOut.textContent = gated
        ? "Enter the password above to unlock prompts for this role."
        : "Pick a Role, Task, and Format to see your prompt here. The PHI safety rule is added automatically.";
      promptOut.classList.add("placeholder");
    } else {
      promptOut.textContent = prompt;
      promptOut.classList.remove("placeholder");
    }
    save();
  }

  // ---------- Clipboard ----------
  function copyText(text, onDone) {
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand("copy"); if (onDone) onDone(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => { if (onDone) onDone(); }, fallback);
    } else {
      fallback();
    }
  }

  // ---------- State (persistence, share links, examples) ----------
  function currentState() {
    return {
      role: roleSel.value, roleOther: roleOther.value,
      context: ctxSel.value, contextOther: ctxOther.value,
      task: taskSel.value, taskOther: taskOther.value,
      format: fmtSel.value, formatOther: fmtOther.value,
      tones: selectedToneValues(),
      ask: askToggle.checked,
      details: collectDetails()
    };
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState())); } catch (e) { /* ignore */ }
  }

  // Clear every control back to the blank state (does not touch localStorage).
  function clearForm() {
    roleSel.value = ""; fmtSel.value = "";
    hide(roleOtherWrap); hide(fmtOtherWrap);
    roleOther.value = ""; fmtOther.value = "";
    clearWarn(roleOther); clearWarn(fmtOther);
    resetDependent();
    toneGroup.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    askToggle.checked = false;
    renderDetailFields();
  }

  // Apply a saved / shared / example state to the form.
  function applyState(d) {
    clearForm();
    if (d.role) {
      roleSel.value = d.role;
      if (roleSel.value !== d.role) roleSel.value = ""; // option missing
    }
    if (roleSel.value) {
      toggleOther(roleSel, roleOtherWrap, roleOther);
      if (d.roleOther) { roleOther.value = d.roleOther; checkWarn(roleOther); }
      // Populate for custom ("Other…") roles too — they get the shared
      // contexts and an "Other…" task slot.
      populateContext(roleSel.value);
      populateTasks(roleSel.value);
      if (d.context) ctxSel.value = d.context;
      if (d.task) taskSel.value = d.task;
      toggleOther(ctxSel, ctxOtherWrap, ctxOther);
      toggleOther(taskSel, taskOtherWrap, taskOther);
      if (d.contextOther) { ctxOther.value = d.contextOther; checkWarn(ctxOther); }
      if (d.taskOther) { taskOther.value = d.taskOther; checkWarn(taskOther); }
    }
    if (d.format) {
      fmtSel.value = d.format;
      if (fmtSel.value !== d.format) fmtSel.value = ""; // option missing
      toggleOther(fmtSel, fmtOtherWrap, fmtOther);
      if (d.formatOther) { fmtOther.value = d.formatOther; checkWarn(fmtOther); }
    }
    if (d.tones && d.tones.length) {
      toneGroup.querySelectorAll(".chip").forEach((c) => {
        if (d.tones.indexOf(c.getAttribute("data-tone")) !== -1) c.setAttribute("aria-pressed", "true");
      });
    }
    if (d.ask) askToggle.checked = true;
    renderDetailFields();
    if (d.details) {
      detailsWrap.querySelectorAll("input").forEach((i) => {
        const k = i.getAttribute("data-key");
        if (d.details[k]) i.value = d.details[k];
      });
      checkDetailsWarn();
    }
    updatePreview();
  }

  function restore() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;
    let d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    applyState(d);
  }

  function readShareLink() {
    try {
      const m = location.search.match(/[?&]p=([^&]+)/);
      return m ? decodeState(m[1]) : null;
    } catch (e) { return null; }
  }

  // ---------- Events ----------
  roleSel.addEventListener("change", () => {
    toggleOther(roleSel, roleOtherWrap, roleOther);
    if (roleSel.value) {
      // A custom ("Other…") role still gets the shared contexts and an
      // "Other…" task slot, so the rest of the form stays usable.
      populateContext(roleSel.value);
      populateTasks(roleSel.value);
      hide(ctxOtherWrap); hide(taskOtherWrap);
      ctxOther.value = ""; taskOther.value = "";
      clearWarn(ctxOther); clearWarn(taskOther);
    } else {
      resetDependent();
    }
    renderDetailFields();
    updatePreview();
  });

  ctxSel.addEventListener("change", () => { toggleOther(ctxSel, ctxOtherWrap, ctxOther); updatePreview(); });
  taskSel.addEventListener("change", () => {
    toggleOther(taskSel, taskOtherWrap, taskOther);
    renderDetailFields();
    updatePreview();
  });
  fmtSel.addEventListener("change", () => { toggleOther(fmtSel, fmtOtherWrap, fmtOther); updatePreview(); });

  [roleOther, ctxOther, taskOther, fmtOther].forEach((inp) => {
    inp.addEventListener("input", () => { checkWarn(inp); updatePreview(); });
  });

  toneGroup.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const pressed = chip.getAttribute("aria-pressed") === "true";
    chip.setAttribute("aria-pressed", pressed ? "false" : "true");
    updatePreview();
  });

  askToggle.addEventListener("change", updatePreview);

  genBtn.addEventListener("click", () => {
    updatePreview();
    promptOut.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  copyBtn.addEventListener("click", () => {
    const text = buildPrompt(pack, buildSel());
    if (!text) return;
    track(eventName(pack.id, "copy"));
    copyText(text, () => {
      copyBtn.classList.add("copied");
      copyLabel.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyLabel.textContent = "Copy prompt";
      }, 1800);
      showFollowups();
    });
  });

  // Open the prompt in a chosen AI tool. Always copy first (the fallback for any
  // provider that doesn't pre-fill, and a safety net if the URL param is dropped).
  providerRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".provider-btn");
    if (!btn || btn.disabled) return;
    const p = PROVIDERS_BY_ID[btn.getAttribute("data-provider")];
    if (!p) return;
    const text = buildPrompt(pack, buildSel());
    if (!text) return;

    track(eventName(pack.id, "open", p.id));
    copyText(text);
    const url = p.prefill ? p.base + encodeURIComponent(text) : p.base;
    window.open(url, "_blank", "noopener");

    sendNote.hidden = false;
    sendNote.textContent = p.prefill
      ? "Opening " + p.name + " with your prompt. It's also copied — just paste (Cmd/Ctrl+V) if it didn't carry over."
      : "Opening " + p.name + ". Your prompt is copied — paste it (Cmd/Ctrl+V) into the box.";
    showFollowups();
  });

  resetBtn.addEventListener("click", () => {
    clearForm();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    updatePreview();
  });

  detailsWrap.addEventListener("input", () => { checkDetailsWarn(); updatePreview(); });

  // Copy a link that reopens this app with the current picks pre-filled.
  shareBtn.addEventListener("click", () => {
    if (!readyToGenerate()) return;
    const url = location.href.split(/[?#]/)[0] + "?p=" + encodeState(currentState());
    track(eventName(pack.id, "share"));
    copyText(url, () => {
      shareLabel.textContent = "Link copied!";
      setTimeout(() => { shareLabel.textContent = "Copy share link"; }, 1800);
    });
  });

  // ---------- Follow-ups ----------
  function showFollowups() {
    const task = currentTaskObj();
    const list = (task && task.followups && task.followups.length) ? task.followups : DEFAULT_FOLLOWUPS;
    followupRow.innerHTML = "";
    list.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = t;
      b.addEventListener("click", () => {
        copyText(t, () => {
          b.textContent = "Copied!";
          setTimeout(() => { b.textContent = t; }, 1200);
        });
      });
      followupRow.appendChild(b);
    });
    show(followupsPanel);
  }

  // ---------- Saved prompts (favorites) ----------
  // Kept as plain localStorage for this phase; the unified Library (Phase 3)
  // replaces this — leave untouched here.
  function loadFavs() {
    try { return JSON.parse(localStorage.getItem(FAVS_KEY)) || []; } catch (e) { return []; }
  }
  function storeFavs(favs) {
    try { localStorage.setItem(FAVS_KEY, JSON.stringify(favs)); } catch (e) { /* ignore */ }
  }
  function renderFavs() {
    if (!favsCard || !favsList) return;
    const favs = loadFavs();
    favsList.innerHTML = "";
    if (!favs.length) { hide(favsCard); return; }
    favs.forEach((f, idx) => {
      const row = document.createElement("div");
      row.className = "fav-row";
      const load = document.createElement("button");
      load.type = "button"; load.className = "fav-load"; load.textContent = f.name;
      load.addEventListener("click", () => {
        applyState(f.state);
        const pc = document.querySelector(".preview-card");
        if (pc) pc.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      const del = document.createElement("button");
      del.type = "button"; del.className = "fav-del"; del.textContent = "×";
      del.setAttribute("aria-label", "Delete saved prompt: " + f.name);
      del.addEventListener("click", () => {
        const cur = loadFavs();
        cur.splice(idx, 1);
        storeFavs(cur);
        renderFavs();
      });
      row.appendChild(load); row.appendChild(del);
      favsList.appendChild(row);
    });
    show(favsCard);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (saveBtn.disabled || !saveRow) return;
      saveRow.hidden = !saveRow.hidden;
      if (!saveRow.hidden && saveName) saveName.focus();
    });
  }
  function confirmSave() {
    const name = (saveName && saveName.value.trim()) || getTaskText() || "Saved prompt";
    const favs = loadFavs();
    favs.unshift({ name: name, state: currentState(), ts: Date.now() });
    if (favs.length > 20) favs.length = 20; // keep the list sane
    storeFavs(favs);
    renderFavs();
    if (saveName) saveName.value = "";
    hide(saveRow);
    if (saveLabel) {
      saveLabel.textContent = "Saved!";
      setTimeout(() => { saveLabel.textContent = "Save"; }, 1500);
    }
  }
  if (saveConfirm) saveConfirm.addEventListener("click", confirmSave);
  if (saveName) {
    saveName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); confirmSave(); }
    });
  }

  // ---------- Examples ----------
  function buildExampleChips() {
    if (!exampleRow) return;
    (pack.examples || []).forEach((ex) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = ex.label;
      b.addEventListener("click", () => {
        applyState(ex.state);
        const pc = document.querySelector(".preview-card");
        if (pc) pc.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      exampleRow.appendChild(b);
    });
  }

  // ---------- Init ----------
  populateRoles();
  populateFormats();
  buildExampleChips();
  renderFavs();
  const linkState = readShareLink();
  if (linkState) {
    applyState(linkState);
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* ignore */ }
  } else {
    restore();
  }
  updatePreview();
}
