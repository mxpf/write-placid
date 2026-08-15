(() => {
  "use strict";

  const script = document.currentScript;
  if (!script || navigator.globalPrivacyControl === true || navigator.doNotTrack === "1") {
    return;
  }

  const site = script.dataset.site;
  const endpoint = script.dataset.endpoint || new URL("/api/collect", script.src).href;
  if (!site || !endpoint) return;

  const path = window.location.pathname.replace(/\/{2,}/g, "/");
  const day = new Date().toISOString().slice(0, 10);
  const dailyKey = `trackinghaus:v1:${site}:read:${day}:${path}`;
  const seenKey = `trackinghaus:v1:${site}:seen`;

  try {
    if (window.sessionStorage.getItem(dailyKey)) return;
    window.sessionStorage.setItem(dailyKey, "1");
  } catch {
    // Storage can be unavailable in hardened browsers. Counting still works.
  }

  let returning = false;
  try {
    returning = window.localStorage.getItem(seenKey) === "1";
    window.localStorage.setItem(seenKey, "1");
  } catch {
    // Returning status simply remains false when local storage is unavailable.
  }

  const searchHosts = /(^|\.)(google|bing|duckduckgo|kagi|yahoo|brave|ecosia|perplexity)\./i;
  const socialHosts = /(^|\.)(x|twitter|linkedin|mastodon|bsky|facebook|instagram|threads|reddit)\./i;

  function sourceCategory() {
    if (!document.referrer) return "direct";
    try {
      const referrer = new URL(document.referrer);
      if (referrer.hostname === window.location.hostname) return "direct";
      if (searchHosts.test(referrer.hostname)) return "search";
      if (socialHosts.test(referrer.hostname)) return "social";
      return "referral";
    } catch {
      return "direct";
    }
  }

  const payload = JSON.stringify({
    site,
    path,
    title: document.title,
    source: sourceCategory(),
    returning,
  });

  const send = () => {
    if (navigator.sendBeacon && navigator.sendBeacon(endpoint, payload)) return;
    fetch(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: payload,
    }).catch(() => {});
  };

  if ("requestIdleCallback" in window) window.requestIdleCallback(send, { timeout: 1500 });
  else window.setTimeout(send, 0);
})();
