export function ThemeToggle() {
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Switch to dark theme"
      aria-pressed="true"
      data-theme-toggle
      suppressHydrationWarning
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}
