export function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function getThemeColors() {
  const isDark = isDarkTheme();
  return {
    text: isDark ? "#e2e8f0" : "#334155",
    textSoft: isDark ? "#9ca3af" : "#6b7280",
    grid: isDark ? "#334155" : "#e2e8f0",
    tooltipBg: isDark ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)",
    tooltipText: isDark ? "#f3f4f6" : "#1f2937",
    tooltipBorder: isDark ? "#334155" : "#e5e7eb",
    gridChart: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
  };
}
