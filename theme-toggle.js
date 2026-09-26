(() => {
  const key = "write-placid-theme";
  const root = document.documentElement;

  function apply(theme, updateControls = true) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (!updateControls) return;
    for (const toggle of document.querySelectorAll("[data-theme-toggle]")) {
      const light = theme === "light";
      toggle.setAttribute("aria-pressed", String(light));
      toggle.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
    }
  }

  let theme = root.dataset.theme === "dark" ? "dark" : "light";
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
  apply(theme, false);
  window.addEventListener("load", () => apply(theme), { once: true });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-theme-toggle]")) return;
    theme = root.dataset.theme === "light" ? "dark" : "light";
    apply(theme);
    try {
      localStorage.setItem(key, theme);
    } catch {
      // The visual theme still changes when persistence is unavailable.
    }
  });
})();
