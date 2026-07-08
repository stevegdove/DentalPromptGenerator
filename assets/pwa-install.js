/* Bridge Dental Prompt Builders — PWA installer + custom install prompt.
   Included on every page. No dependencies, no build step.

   What it does:
     1. Registers the root service worker (offline shell).
     2. Shows a tasteful, branded "install" prompt AFTER brief real usage
        (copied/opened a prompt, OR 2+ page views, OR ~45s engaged) — never
        on first paint, never nagging.
     3. Android/Chromium uses the native beforeinstallprompt flow; iOS Safari
        gets Add-to-Home-Screen instructions (no install event exists there).
     4. Fires GoatCounter events so the install funnel is measurable.

   Anti-nag: never shown once installed, dismissal snoozes for 14 days, and a
   hard lifetime cap of 3 shows. On the password-gated owner page the prompt
   only appears once the courtesy gate is unlocked. */

(function () {
  "use strict";

  // Resolve the app root from this script's own URL, so start_url/scope and the
  // SW path are correct whether the site is served from the GitHub Pages
  // subpath (/DentalPromptGenerator/) or a custom domain root.
  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) return "./";
    return s.replace(/assets\/pwa-install\.js.*$/, "");
  })();

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function track(path) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, event: true });
      }
    } catch (e) {}
  }

  var isStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  // Launched from the home screen: record the install and log the launch once.
  if (isStandalone) {
    lsSet("bp_pwa_installed", "1");
    if (lsGet("bp_pwa_launch_tracked") !== "1") {
      track("pwa-launch");
      lsSet("bp_pwa_launch_tracked", "1");
    }
  }

  // Register the service worker (root scope). Optional — the site works without it.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register(ROOT + "service-worker.js", { scope: ROOT })
        .catch(function () {});
    });
  }

  if (isStandalone) return; // never prompt inside the installed app

  // ---- platform detection ----
  var ua = navigator.userAgent || "";
  var isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
  var isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);

  // ---- anti-nag guards ----
  function suppressed() {
    if (lsGet("bp_pwa_installed") === "1") return true;
    var until = parseInt(lsGet("bp_pwa_snooze_until") || "0", 10);
    if (until && Date.now() < until) return true;
    var shows = parseInt(lsGet("bp_pwa_shows") || "0", 10);
    if (shows >= 3) return true;
    return false;
  }

  // On the owner page, wait until the courtesy password gate is unlocked.
  function ownerGateOK() {
    if (location.pathname.indexOf("/owner") === -1) return true;
    return lsGet("bd-owner-unlocked") === "f36b8ed8";
  }

  // ---- "brief usage" gate ----
  var views = parseInt(lsGet("bp_pwa_views") || "0", 10) + 1;
  lsSet("bp_pwa_views", String(views));

  var engaged = false;
  var deferredPrompt = null;
  var shown = false;

  function usageQualifies() {
    return lsGet("bp_pwa_intent") === "1" || views >= 2 || engaged;
  }

  function markIntent() {
    lsSet("bp_pwa_intent", "1");
    maybeShow();
  }
  window.bridgePWA = { markIntent: markIntent }; // pages may signal intent explicitly

  // Zero-touch intent: copying a prompt or opening a provider tab.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    var _write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (t) {
      var p = _write(t);
      try { p.then(markIntent, function () {}); } catch (e) {}
      return p;
    };
  }
  var _open = window.open;
  window.open = function () {
    try { markIntent(); } catch (e) {}
    return _open.apply(window, arguments);
  };

  // ~45s engaged on the page also qualifies.
  setTimeout(function () { engaged = true; maybeShow(); }, 45000);

  // If the visitor already qualifies on load (returning visit or prior intent),
  // attempt shortly after load — giving beforeinstallprompt a moment to arrive first.
  setTimeout(maybeShow, 3000);

  // Android / desktop Chromium.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    maybeShow();
  });

  window.addEventListener("appinstalled", function () {
    lsSet("bp_pwa_installed", "1");
    track("pwa-installed");
    removeBanner();
  });

  function maybeShow() {
    if (shown || isStandalone) return;
    if (!ownerGateOK() || suppressed() || !usageQualifies()) return;
    if (deferredPrompt) { showBanner("android"); return; }
    if (isIOS && isSafari) { showBanner("ios"); return; }
    // Other browsers offer no install affordance — stay silent.
  }

  // ---- UI ----
  function snooze(days) {
    lsSet("bp_pwa_snooze_until", String(Date.now() + days * 86400000));
  }

  function injectStyles() {
    if (document.getElementById("bp-pwa-styles")) return;
    var css =
      ".bp-pwa{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;" +
      "max-width:460px;margin:0 auto;display:flex;gap:12px;align-items:center;" +
      "padding:14px 16px;border-radius:16px;background:#fff;color:#2A2E3F;" +
      "font-family:'Mulish',system-ui,-apple-system,sans-serif;" +
      "box-shadow:0 8px 30px rgba(42,46,63,.22);border:1px solid #E6E6EE;" +
      "animation:bp-pwa-in .32s ease}" +
      "@keyframes bp-pwa-in{from{transform:translateY(120%);opacity:0}to{transform:none;opacity:1}}" +
      "@media (prefers-reduced-motion:reduce){.bp-pwa{animation:none}}" +
      ".bp-pwa__icon{width:44px;height:44px;border-radius:11px;flex:0 0 auto;" +
      "box-shadow:0 1px 4px rgba(42,46,63,.12)}" +
      ".bp-pwa__body{flex:1 1 auto;min-width:0;line-height:1.35}" +
      ".bp-pwa__body strong{display:block;font-family:'Poppins',system-ui,sans-serif;" +
      "font-weight:700;font-size:15px;color:#2A2E3F}" +
      ".bp-pwa__body span{display:block;font-size:13px;color:#5C6070;margin-top:2px}" +
      ".bp-pwa__body span svg{vertical-align:-3px;margin:0 1px}" +
      ".bp-pwa__actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}" +
      ".bp-pwa__install{border:0;cursor:pointer;font:inherit;font-weight:700;" +
      "font-family:'Poppins',system-ui,sans-serif;font-size:14px;color:#fff;" +
      "padding:9px 16px;border-radius:999px;" +
      "background:linear-gradient(104deg,#3A1F6E,#D62B56)}" +
      ".bp-pwa__install:hover{filter:brightness(1.06)}" +
      ".bp-pwa__close{border:0;background:transparent;cursor:pointer;color:#8B8F9B;" +
      "font-size:22px;line-height:1;padding:4px 8px;border-radius:8px}" +
      ".bp-pwa__close:hover{background:#F0F0F2;color:#2A2E3F}";
    var el = document.createElement("style");
    el.id = "bp-pwa-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  var SHARE_ICON =
    "<svg width='15' height='15' viewBox='0 0 24 24' fill='none' aria-hidden='true'>" +
    "<path d='M12 3v12M12 3l-4 4M12 3l4 4' stroke='#3A1F6E' stroke-width='2' " +
    "stroke-linecap='round' stroke-linejoin='round'/>" +
    "<path d='M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1' " +
    "stroke='#3A1F6E' stroke-width='2' stroke-linecap='round'/></svg>";

  function removeBanner() {
    var b = document.getElementById("bp-pwa-banner");
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function showBanner(mode) {
    if (shown) return;
    shown = true;
    lsSet("bp_pwa_shows", String(parseInt(lsGet("bp_pwa_shows") || "0", 10) + 1));
    injectStyles();

    var wrap = document.createElement("div");
    wrap.id = "bp-pwa-banner";
    wrap.className = "bp-pwa";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "Install Bridge Prompts");

    var body =
      mode === "ios"
        ? "<strong>Add Bridge Prompts to your Home Screen</strong>" +
          "<span>Tap " + SHARE_ICON + " Share, then <b>Add to Home Screen</b>.</span>"
        : "<strong>Install Bridge Prompts</strong>" +
          "<span>Add it to your home screen for one-tap access.</span>";

    var actions =
      (mode === "android"
        ? "<button class='bp-pwa__install' type='button'>Install</button>"
        : "") +
      "<button class='bp-pwa__close' type='button' aria-label='Dismiss'>&times;</button>";

    wrap.innerHTML =
      "<img class='bp-pwa__icon' src='" + ROOT + "assets/icons/icon-192.png' alt='' />" +
      "<div class='bp-pwa__body'>" + body + "</div>" +
      "<div class='bp-pwa__actions'>" + actions + "</div>";

    document.body.appendChild(wrap);
    track("pwa-prompt-shown");

    var closeBtn = wrap.querySelector(".bp-pwa__close");
    closeBtn.addEventListener("click", function () {
      track("pwa-install-dismissed");
      snooze(14);
      removeBanner();
    });

    var installBtn = wrap.querySelector(".bp-pwa__install");
    if (installBtn) {
      installBtn.addEventListener("click", function () {
        if (!deferredPrompt) { removeBanner(); return; }
        deferredPrompt.prompt();
        deferredPrompt.userChoice
          .then(function (choice) {
            if (choice && choice.outcome === "accepted") {
              track("pwa-install-accepted");
            } else {
              track("pwa-install-dismissed");
              snooze(14);
            }
          })
          .catch(function () {})
          .then(function () {
            deferredPrompt = null;
            removeBanner();
          });
      });
    }
  }
})();
