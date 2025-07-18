/**
 * ThemeManager.tsx
 *
 * This React component manages a VSCode-style theming system for your app,
 * enabling multiple customizable themes defined via JSON objects.
 *
 * WHY THIS FILE EXISTS:
 * - Centralizes all theme-related logic: loading, applying, switching, and saving themes.
 * - Provides a JSON-based theme schema similar to VSCode's, allowing import/export and customization.
 * - Applies themes using CSS variables dynamically on the document root for flexible styling.
 * - Provides a UI for selecting, editing, importing, and exporting themes.
 * - Persists user choices in localStorage for session persistence.
 *
 * HOW TO USE:
 * - Import and render <ThemeManager> near your app root.
 * - Wrap your app UI inside the <ThemeManager> children prop (if extended).
 * - Use CSS variables (e.g., var(--color-background)) in your styles.
 * - Extend this to add syntax token coloring or advanced customization.
 */

import React, { useEffect, useState, useCallback } from "react";
import useLocalStorage from "./useLocalStorage";
import {
  ChevronLeft,
  FileInput,
  FileDown,
  Plus,
  Trash,
  CheckCircle,
  RotateCcw,
} from "lucide-react";

type ThemeColors = {
  background: string;
  foreground: string;
  primary: string;
  primaryHover: string;
  codeBackground: string;
  codeForeground: string;
  [key: string]: string;
};

type ThemeJson = {
  name: string;
  colors: ThemeColors;
};

const DEFAULT_THEMES: ThemeJson[] = [
  {
    name: "Light",
    colors: {
      background: "#ffffff",
      foreground: "#333333",
      primary: "#2563EB",
      primaryHover: "#1D4ED8",
      secondary: "#f9fafb",
      secondaryHover: "#edeeefff",
      accent: "#ff4081",
      error: "#d32f2f",
      errorHover: "#b71c1c",
      warning: "#ffa000",
      success: "#388e3c",
      successHover: "#2e7031", // darker green for hover
      info: "#1976d2",
      codeBackground: "#f5f5f5",
      codeForeground: "#333333",
      border: "#D1D5DB",
      borderHover: "#9CA3AF",
      link: "#0066cc",
      linkHover: "#004999",
    },
  },
  {
    name: "Dark",
    colors: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      primary: "#569cd6",
      primaryHover: "#3a6ea5",
      secondary: "#2d2d2d",
      secondaryHover: "#222222ff",
      accent: "#ff4081",
      error: "#f44336",
      errorHover: "#ea3d31ff",
      warning: "#ffb300",
      success: "#4caf50",
      successHover: "#3a8a3a", // slightly darker green
      info: "#2196f3",
      codeBackground: "#252526",
      codeForeground: "#d4d4d4",
      border: "#3c3c3c",
      borderHover: "#343333ff",
      link: "#3794ff",
      linkHover: "#1a73e8",
    },
  },
  {
    name: "Solarized",
    colors: {
      background: "#fdf6e3",
      foreground: "#657b83",
      primary: "#268bd2",
      primaryHover: "#2aa198",
      secondary: "#eee8d5",
      secondaryHover: "#f0e7caff",
      accent: "#b58900",
      error: "#dc322f",
      errorHover: "#a01f1fff",
      warning: "#cb4b16",
      success: "#859900",
      successHover: "#6e7a00", // darker olive green
      info: "#268bd2",
      codeBackground: "#eee8d5",
      codeForeground: "#657b83",
      border: "#93a1a16e",
      borderHover: "#87969683",
      link: "#268bd2",
      linkHover: "#2aa198",
    },
  },
  {
    name: "Monokai",
    colors: {
      background: "#272822",
      foreground: "#f8f8f2",
      primary: "#f92672",
      primaryHover: "#d5005b",
      secondary: "#383830",
      secondaryHover: "#31312aff",
      accent: "#66d9ef",
      error: "#f92672",
      errorHover: "#d5005b",
      warning: "#fd971f",
      success: "#a6e22e",
      successHover: "#89b522", // slightly darker lime green
      info: "#66d9ef",
      codeBackground: "#272822",
      codeForeground: "#f8f8f2",
      border: "#49483e",
      borderHover: "#414037ff",
      link: "#f92672",
      linkHover: "#d5005b",
    },
  },
  {
    name: "Dracula",
    colors: {
      background: "#282a36",
      foreground: "#f8f8f2",
      primary: "#6272a4",
      primaryHover: "#44475a",
      secondary: "#44475a",
      secondaryHover: "#383a4bff",
      accent: "#ff79c6",
      error: "#ff5555",
      errorHover: "#ff4444",
      warning: "#f1fa8c",
      success: "#50fa7b",
      successHover: "#3ed661", // slightly darker bright green
      info: "#8be9fd",
      codeBackground: "#44475a",
      codeForeground: "#f8f8f2",
      border: "#6273a4ac",
      borderHover: "#5e6d9b97",
      link: "#bd93f9",
      linkHover: "#ff79c6",
    },
  },
];

// Utility to apply CSS variables to document root with optional suffix
function applyThemeColors(colors: ThemeColors, suffix = "") {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${toKebabCase(key)}${suffix}`, value);
  });
}

// Convert camelCase to kebab-case for CSS variable names
function toKebabCase(str: string) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

interface ThemeManagerProps {
  open: boolean;
  onClose: () => void;
}

const ThemeManager: React.FC<ThemeManagerProps> = ({ open, onClose }) => {
  // Load themes from localStorage or use defaults
  const [themes, setThemes] = useLocalStorage<ThemeJson[]>(
    "themes",
    DEFAULT_THEMES
  );

  // Active theme index with fallback to 0 (selected/edited in UI)
  const [activeThemeIndex, setActiveThemeIndex] = useLocalStorage<number>(
    "activeThemeIndex",
    0
  );

  // Applied theme index (actually applied colors)
  const [appliedThemeIndex, setAppliedThemeIndex] = useLocalStorage<number>(
    "appliedThemeIndex",
    0
  );

  const resetThemes = () => {
    setThemes(DEFAULT_THEMES);
    setActiveThemeIndex(0);
    setAppliedThemeIndex(0);
    setThemeEditorJson("");
    setJsonError(null);

    // Clear localStorage or reset keys to defaults
    setThemes(DEFAULT_THEMES);
    setActiveThemeIndex(0);
    setAppliedThemeIndex(0);
  };

  // JSON editor content for editing theme
  const [themeEditorJson, setThemeEditorJson] = useState<string>("");

  // JSON parse error message
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Apply theme colors only when appliedThemeIndex or themes change (applied globally)
  useEffect(() => {
    // resetThemes();
    const theme = themes[appliedThemeIndex];
    if (theme) {
      applyThemeColors(theme.colors); // no suffix = applied colors
      setActiveThemeIndex(appliedThemeIndex);
    }
  }, [appliedThemeIndex, themes]);

  // Add a new blank theme
  const addNewTheme = () => {
    const blankTheme: ThemeJson = {
      name: "New Theme",
      colors: {
        background: "#ffffff",
        foreground: "#333333",
        primary: "#2563EB",
        primaryHover: "#1D4ED8",
        secondary: "#f9fafb",
        secondaryHover: "#edeeefff",
        accent: "#ff4081",
        error: "#d32f2f",
        errorHover: "#b71c1c",
        warning: "#ffa000",
        success: "#388e3c",
        info: "#1976d2",
        codeBackground: "#f5f5f5",
        codeForeground: "#333333",
        border: "#D1D5DB",
        borderHover: "#9CA3AF",
        link: "#0066cc",
        linkHover: "#004999",
      },
    };
    setThemes((prev) => [...prev, blankTheme]);
    setActiveThemeIndex(themes.length);
  };

  // Update editor JSON when activeThemeIndex or themes change (for editing)
  // AND apply preview colors immediately
  useEffect(() => {
    const theme = themes[activeThemeIndex];
    if (theme) {
      setThemeEditorJson(JSON.stringify(theme, null, 2));
      setJsonError(null);
      setActiveThemeIndex(activeThemeIndex);
      // Apply preview colors immediately
      applyThemeColors(theme.colors, "--preview");
    }
  }, [activeThemeIndex, themes]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // Handle JSON editor changes with validation
  const onThemeEditorChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newJson = e.target.value;
      setThemeEditorJson(newJson);

      try {
        const parsed = JSON.parse(newJson) as ThemeJson;

        if (!parsed.name || !parsed.colors) {
          setJsonError("JSON must have 'name' and 'colors' fields");
          return;
        }

        setThemes((prev) => {
          const updated = [...prev];
          updated[activeThemeIndex] = parsed;
          return updated;
        });
        setJsonError(null);

        // Update preview colors live as user edits
        applyThemeColors(parsed.colors, "--preview");
      } catch (error) {
        setJsonError("Invalid JSON: " + (error as Error).message);
      }
    },
    [activeThemeIndex]
  );

  // Remove a theme safely (not default)
  const removeTheme = (index: number) => {
    if (index < DEFAULT_THEMES.length) {
      alert("Cannot remove default themes.");
      return;
    }
    setThemes((prev) => prev.filter((_, i) => i !== index));
    if (activeThemeIndex === index) setActiveThemeIndex(0);
    else if (activeThemeIndex > index) setActiveThemeIndex((idx) => idx - 1);
    if (appliedThemeIndex === index) setAppliedThemeIndex(0);
    else if (appliedThemeIndex > index) setAppliedThemeIndex((idx) => idx - 1);
  };

  // Export current theme as JSON file
  const exportTheme = () => {
    const theme = themes[activeThemeIndex];
    if (!theme) return;
    const blob = new Blob([JSON.stringify(theme, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import a theme from JSON file
  const importTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as ThemeJson;
        if (!parsed.name || !parsed.colors) {
          alert("Invalid theme JSON: missing 'name' or 'colors'");
          return;
        }
        setThemes((prev) => [...prev, parsed]);
        setActiveThemeIndex(themes.length);
      } catch {
        alert("Failed to parse theme JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Apply current selected theme colors globally
  const selectTheme = () => {
    const theme = themes[activeThemeIndex];
    if (!theme) return;
    applyThemeColors(theme.colors); // apply globally
    setAppliedThemeIndex(activeThemeIndex);
  };

  if (!open) return null;

  return (
    <div
      className="fixed top-0 bottom-0 left-5 right-5 flex flex-col max-h-[80vh] max-w-4xl mx-auto my-auto bg-[var(--color-background)] text-[var(--color-foreground)] transition-colors duration-300 rounded-lg shadow-lg border overflow-hidden"
      style={{ zIndex: 3000 }}
    >
      {/* Theme selection bar */}
      <div
        id="flexbar-scroll-theme"
        className="flex items-center gap-2 p-2 border-b bg-gray-50 text-gray-700 flex-shrink-0 overflow-x-auto whitespace-nowrap max-h-[60px] scrollbar-hide"
      >
        <button
          onClick={onClose}
          className="px-3 py-1 rounded bg-[var(--color-primary-hover--preview)] text-white border border-gray-300 hover:bg-gray-100 flex items-center justify-center group"
          title="Close Theme Manager"
        >
          <ChevronLeft className="w-4 h-4 text-white group-hover:text-gray-800 transition-colors" />
        </button>
        {themes.map((t, i) => (
          <button
            key={t.name + i}
            onClick={() => setActiveThemeIndex(i)}
            className={`px-3 py-1 rounded ${
              i === activeThemeIndex
                ? "font-bold underline bg-[var(--color-primary-hover--preview)] text-white"
                : "opacity-70 hover:opacity-100"
            }`}
            title={`Select theme: ${t.name}`}
          >
            {t.name}
            {i === appliedThemeIndex && (
              <span className="inline-flex items-center gap-1 ml-2 text-xs">
                <CheckCircle className="w-3 h-3" />
              </span>
            )}
          </button>
        ))}
        {activeThemeIndex >= DEFAULT_THEMES.length && (
          <button
            onClick={() => removeTheme(activeThemeIndex)}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"
            title="Delete current theme"
          >
            <Trash className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={addNewTheme}
          className="ml-auto px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
          title="Add new blank theme"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={exportTheme}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
          title="Export current theme as JSON"
        >
          <FileInput className="w-4 h-4" />
        </button>
        <label
          htmlFor="import-theme"
          className="cursor-pointer px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center"
          title="Import theme from JSON"
        >
          <FileDown className="w-4 h-4" />
          <input
            type="file"
            id="import-theme"
            accept=".json,application/json"
            onChange={importTheme}
            className="hidden"
          />
        </label>
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to reset all themes?")) {
              resetThemes();
            }
          }}
          className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"
          title="Reset all themes"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Theme JSON editor (preview uses --preview CSS variables) */}
      <div
        className="flex-1 p-4 overflow-auto font-mono text-sm relative"
        style={{
          backgroundColor: "var(--color-code-background--preview)",
          color: "var(--color-code-foreground--preview)",
        }}
      >
        <textarea
          aria-label="Theme JSON editor"
          spellCheck={false}
          className="w-full h-full resize-none bg-transparent focus:outline-none"
          value={themeEditorJson}
          onChange={onThemeEditorChange}
        />
        {jsonError && (
          <div className="mt-2 text-red-500 font-semibold">{jsonError}</div>
        )}
        <button
          onClick={selectTheme}
          className="px-3 py-1 rounded font-bold bg-[var(--color-primary-hover--preview)] text-white absolute bottom-4 right-4 flex items-center gap-2"
          title="Apply Theme"
        >
          Apply Theme
        </button>
      </div>
    </div>
  );
};

export default ThemeManager;
