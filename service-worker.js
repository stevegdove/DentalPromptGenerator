/* Bridge Dental Prompt Builders — service worker.
   Strategy:
     - HTML / navigations : network-first (content edits ship immediately;
                            cached shell only used when offline)
     - Google Fonts       : cache-first (they never change)
     - same-origin assets : stale-while-revalidate
     - analytics & other  : passthrough, never cached
   Bump CACHE_VERSION on any change here to retire old caches on activate. */

const CACHE_VERSION = "bridge-pwa-v1";
const SHELL_CACHE = CACHE_VERSION + "-shell";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

/* Paths are relative to the service worker's location, so this works both on
   the GitHub Pages subpath (/DentalPromptGenerator/) and a custom domain root. */
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./team/",
  "./team/index.html",
  "./owner/",
  "./owner/index.html",
  "./manifest.webmanifest",
  "./assets/favicon.png",
  "./assets/bridge-logo-color.png",
  "./assets/bridge-logo-white.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // Cache resiliently — one missing asset must not fail the whole install.
      return Promise.allSettled(
        SHELL_ASSETS.map(function (url) {
          return cache.add(new Request(url, { cache: "reload" }));
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) {
            return k.indexOf(CACHE_VERSION) !== 0;
          })
          .map(function (k) {
            return caches.delete(k);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isFontRequest(url) {
  return (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  );
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);

  // Google Fonts — cache-first (immutable).
  if (isFontRequest(url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && (res.ok || res.type === "opaque")) {
              cache.put(req, res.clone());
            }
            return res;
          });
        });
      })
    );
    return;
  }

  // Only manage our own origin beyond fonts; let analytics etc. pass through.
  if (url.origin !== self.location.origin) return;

  var isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  // HTML — network-first so prompt/content edits are picked up immediately.
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(SHELL_CACHE).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // Same-origin assets — stale-while-revalidate.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        var network = fetch(req)
          .then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(function () {
            return hit;
          });
        return hit || network;
      });
    })
  );
});
