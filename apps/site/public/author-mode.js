(() => {
  const storageKey = "write-placid-author-mode";
  const studioOrigin = document.body.dataset.studioUrl || "";
  const clearActivationHash = () => {
    try {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    } catch {
      // History may be unavailable in restrictive browser contexts.
    }
  };

  let enabled = false;

  if (window.location.hash === "#edit") {
    enabled = true;
    try {
      window.localStorage.setItem(storageKey, "on");
    } catch {
      // Author mode remains active for this page when storage is unavailable.
    }
    clearActivationHash();
  } else if (window.location.hash === "#edit-off") {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Nothing needs clearing when storage is unavailable.
    }
    clearActivationHash();
  } else {
    try {
      enabled = window.localStorage.getItem(storageKey) === "on";
    } catch {
      // Author mode stays off when storage is unavailable.
    }
  }

  if (!enabled || !studioOrigin) return;

  try {
    const article = document.querySelector("[data-content-slug]");
    const action = article?.querySelector(".author-edit-action");
    const link = action?.querySelector("a");
    if (!article || !action || !link) return;

    const destination = new URL(studioOrigin);
    destination.searchParams.set("slug", article.dataset.contentSlug || "");
    destination.searchParams.set("title", article.dataset.contentTitle || "");
    link.href = destination.toString();
    action.hidden = false;
  } catch {
    // The public site remains unchanged when browser storage is unavailable.
  }
})();
