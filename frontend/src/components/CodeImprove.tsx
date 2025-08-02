import React, { useState, useEffect, useRef } from "react";
import useLocalStorage from "./useLocalStorage";
import {
  Copy,
  Check,
  FileInput,
  FileUp,
  X,
  Code,
  Wand,
  ArrowLeftRight,
  Info,
} from "lucide-react";

// Define response type for the diff-based improvement
interface CodeDiffResponse {
  diff: string;
  improved_code: string | null;
  explanation: string;
  changed_lines: number[];
}

const SUPPORTED_LANGUAGES = [
  // Popular General Purpose
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C#",
  "C++",
  "C",
  "Go",
  "Rust",
  "Swift",
  "Kotlin",
  "Dart",
  "Ruby",
  "PHP",
  "Scala",

  // Web Technologies
  "HTML",
  "CSS",
  "Sass",
  "Less",
  "JSX",
  "TSX",

  // Mobile Development
  "Objective-C",
  "Dart",
  "Kotlin",
  "Swift",

  // Systems Programming
  "Rust",
  "Go",
  "Zig",
  "Nim",

  // Functional Programming
  "Haskell",
  "Elm",
  "F#",
  "OCaml",
  "Clojure",
  "Erlang",
  "Elixir",

  // Scripting Languages
  "Bash",
  "PowerShell",
  "Perl",
  "Lua",
  "Raku",
  "Groovy",

  // Data Science & Analytics
  "R",
  "Julia",
  "MATLAB",
  "SAS",

  // Database & Query Languages
  "SQL",
  "PL/SQL",
  "T-SQL",
  "GraphQL",

  // Configuration & Markup
  "YAML",
  "JSON",
  "XML",
  "TOML",
  "HCL",
  "MARKDOWN",
  "PLAINTEXT",

  // Game Development
  "GDScript",
  "UnrealScript",
  "HLSL",
  "GLSL",

  // Other Notable Languages
  "Fortran",
  "COBOL",
  "Lisp",
  "Scheme",
  "Prolog",
  "Ada",
  "D",
  "V",
  "Red",
  "Reason",
  "PureScript",
  "Idris",
] as const;

type Language = (typeof SUPPORTED_LANGUAGES)[number];

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  leftLine?: string;
  rightLine?: string;
  lineNumber?: number;
}

const generateDiff = (original: string, improved: string): DiffLine[] => {
  const originalLines = original.split("\n");
  const improvedLines = improved.split("\n");
  const diffLines: DiffLine[] = [];

  const maxLines = Math.max(originalLines.length, improvedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i];
    const improvedLine = improvedLines[i];

    if (originalLine === improvedLine) {
      diffLines.push({
        type: "unchanged",
        leftLine: originalLine,
        rightLine: improvedLine,
        lineNumber: i + 1,
      });
    } else if (originalLine && !improvedLine) {
      diffLines.push({
        type: "removed",
        leftLine: originalLine,
        lineNumber: i + 1,
      });
    } else if (!originalLine && improvedLine) {
      diffLines.push({
        type: "added",
        rightLine: improvedLine,
        lineNumber: i + 1,
      });
    } else {
      diffLines.push(
        {
          type: "removed",
          leftLine: originalLine,
          lineNumber: i + 1,
        },
        {
          type: "added",
          rightLine: improvedLine,
          lineNumber: i + 1,
        }
      );
    }
  }

  return diffLines;
};

const exportToFile = (
  content: string,
  language: Language,
  fileName = "improved"
) => {
  const extensionMap: Partial<Record<Language, string>> = {
    JavaScript: "js",
    TypeScript: "ts",
    Python: "py",
    Java: "java",
    "C#": "cs",
    "C++": "cpp",
    C: "c",
    Go: "go",
    Rust: "rs",
    Swift: "swift",
    Kotlin: "kt",
    Dart: "dart",
    Ruby: "rb",
    PHP: "php",
    Scala: "scala",
    HTML: "html",
    CSS: "css",
    Sass: "scss",
    Less: "less",
    JSX: "jsx",
    TSX: "tsx",
    "Objective-C": "m",
    Zig: "zig",
    Nim: "nim",
    Haskell: "hs",
    Elm: "elm",
    "F#": "fs",
    OCaml: "ml",
    Clojure: "clj",
    Erlang: "erl",
    Elixir: "ex",
    Bash: "sh",
    PowerShell: "ps1",
    Perl: "pl",
    Lua: "lua",
    Raku: "raku",
    Groovy: "groovy",
    R: "r",
    Julia: "jl",
    MATLAB: "m",
    SAS: "sas",
    SQL: "sql",
    "PL/SQL": "plsql",
    "T-SQL": "tsql",
    GraphQL: "graphql",
    YAML: "yaml",
    JSON: "json",
    XML: "xml",
    TOML: "toml",
    HCL: "hcl",
    GDScript: "gd",
    UnrealScript: "uc",
    HLSL: "hlsl",
    GLSL: "glsl",
    Fortran: "f90",
    COBOL: "cbl",
    Lisp: "lisp",
    Scheme: "scm",
    Prolog: "pl",
    Ada: "adb",
    D: "d",
    V: "v",
    Red: "red",
    Reason: "re",
    PureScript: "purs",
    Idris: "idr",
  };

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.${extensionMap[language] || "txt"}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

interface CodeImproveProps {
  defaultLanguage?: Language;
  onImprove?: (
    source: string,
    language: Language,
    instructions: string
  ) => Promise<CodeDiffResponse>;
  onClose: () => void;
  initialSourceCode?: string;
}

const CodeImprove: React.FC<CodeImproveProps> = ({
  defaultLanguage = "JavaScript",
  onImprove,
  onClose,
  initialSourceCode = "",
}) => {
  const [language, setLanguage] = useLocalStorage<Language>(
    "codeImprove-language",
    defaultLanguage
  );
  const [sourceCode, setSourceCode] = useLocalStorage(
    "codeImprove-sourceCode",
    initialSourceCode
  );
  const [improvedCode, setImprovedCode] = useLocalStorage(
    "codeImprove-improvedCode",
    ""
  );
  const [instructions, setInstructions] = useLocalStorage(
    "codeImprove-instructions",
    "Refactor for readability and performance"
  );
  const [isImproving, setIsImproving] = useState(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [viewMode, setViewMode] = useLocalStorage<"code" | "diff">(
    "codeImprove-viewMode",
    "code"
  );
  const [explanation, setExplanation] = useState<string>("");
  const [showExplanation, setShowExplanation] = useState(false);
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const improvedFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sourceCode && improvedCode) {
      setDiffLines(generateDiff(sourceCode, improvedCode));
    }
  }, [sourceCode, improvedCode]);

  const handleImprove = async () => {
    if (!sourceCode.trim() || !onImprove) return;

    setIsImproving(true);
    try {
      const result = await onImprove(sourceCode, language, instructions);
      const improvedCodeString = result.improved_code || result.diff || "";
      setImprovedCode(improvedCodeString);
      setExplanation(result.explanation || "");
      setShowExplanation(true);
      setViewMode("diff");
    } catch (error) {
      console.error("Improvement failed:", error);
      const errorMsg = `// Improvement error: ${
        error instanceof Error ? error.message : String(error)
      }`;
      setImprovedCode(errorMsg);
      setExplanation(errorMsg);
      setShowExplanation(true);
    } finally {
      setIsImproving(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    });
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setCode: (code: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCode(content);
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input to allow selecting the same file again
  };

  const applyChanges = () => {
    if (improvedCode) {
      setSourceCode(improvedCode);
      setImprovedCode("");
      setExplanation("");
      setShowExplanation(false);
      onClose();
    }
  };

  return (
    <div
      className="code-improve-container m-2"
      style={{ color: "var(--color-foreground)" }}
    >
      <div
        className="improve-controls mb-4 p-4 rounded-lg"
        style={{
          backgroundColor: "var(--color-background)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="language-selector flex-1">
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--color-foreground)" }}
              >
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="p-2 rounded hover:bg-[var(--color-secondary)] bg-[var(--color-background)] cursor-pointer border rounded border-[var(--color-border)] w-full"
              >
                {SUPPORTED_LANGUAGES.map((lang, index) => (
                  <option key={`source-${lang}-${index}`} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--color-foreground)" }}
              >
                Improvement Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full p-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]"
                rows={2}
                placeholder="Describe how to improve the code..."
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={handleImprove}
              disabled={isImproving || !sourceCode.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "white",
                cursor:
                  isImproving || !sourceCode.trim() ? "not-allowed" : "pointer",
                opacity: isImproving || !sourceCode.trim() ? 0.5 : 1,
              }}
            >
              <Wand className="w-5 h-5" />
              {isImproving ? "Improving..." : "Improve Code"}
            </button>

            <button
              onClick={() => setViewMode(viewMode === "code" ? "diff" : "code")}
              className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "var(--color-secondary)",
                color: "var(--color-foreground)",
              }}
              disabled={!improvedCode}
            >
              <ArrowLeftRight className="w-5 h-5" />
              {viewMode === "code" ? "Show Diff" : "Show Code"}
            </button>

            {explanation && (
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  color: "var(--color-foreground)",
                }}
              >
                <Info className="w-5 h-5" />
                {showExplanation ? "Hide Explanation" : "Show Explanation"}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded transition-colors"
              style={{
                backgroundColor: "var(--color-error)",
                color: "white",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="editor-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Code Editor */}
        <div
          className="source-editor border rounded-lg overflow-hidden"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-background)",
          }}
        >
          <div
            className="editor-header p-3 border-b flex justify-between items-center"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-secondary)",
            }}
          >
            <div
              className="flex items-center"
              style={{ color: "var(--color-foreground)" }}
            >
              <Code className="w-5 h-5 mr-2" />
              <span className="font-medium">Original ({language})</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => sourceFileInputRef.current?.click()}
                style={{ color: "var(--color-border)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-foreground)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-border)")
                }
                title="Load from file"
              >
                <FileInput className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={sourceFileInputRef}
                onChange={(e) => handleFileUpload(e, setSourceCode)}
                className="hidden"
              />
              <button
                onClick={() => copyToClipboard(sourceCode, "source")}
                style={{ color: "var(--color-border)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-foreground)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-border)")
                }
                title="Copy code"
              >
                {copied["source"] ? (
                  <Check
                    className="w-5 h-5"
                    style={{ color: "var(--color-success)" }}
                  />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => exportToFile(sourceCode, language, "original")}
                style={{ color: "var(--color-border)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-foreground)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-border)")
                }
                title="Export to file"
              >
                <FileUp className="w-5 h-5" />
              </button>
            </div>
          </div>
          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            className="w-full h-full p-4 min-h-[300px] font-mono text-sm focus:outline-none resize-none"
            placeholder={`Enter ${language} code here...`}
            style={{
              backgroundColor: "var(--color-background)",
              color: "var(--color-foreground)",
              border: "none",
            }}
          />
        </div>

        {/* Improved Editor / Diff View */}
        <div
          className="improved-editor border rounded-lg overflow-hidden"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-background)",
          }}
        >
          <div
            className="editor-header p-3 border-b flex justify-between items-center"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-secondary)",
            }}
          >
            <div
              className="flex items-center"
              style={{ color: "var(--color-foreground)" }}
            >
              <Wand className="w-5 h-5 mr-2" />
              <span className="font-medium">
                {viewMode === "code" ? "Improved Code" : "Changes"}
              </span>
            </div>
            <div className="flex gap-2">
              {viewMode === "code" && (
                <>
                  <button
                    onClick={() => improvedFileInputRef.current?.click()}
                    style={{ color: "var(--color-border)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--color-foreground)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--color-border)")
                    }
                    title="Load from file"
                  >
                    <FileInput className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    ref={improvedFileInputRef}
                    onChange={(e) => handleFileUpload(e, setImprovedCode)}
                    className="hidden"
                  />
                  <button
                    onClick={() => copyToClipboard(improvedCode, "improved")}
                    style={{ color: "var(--color-border)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--color-foreground)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--color-border)")
                    }
                    title="Copy code"
                  >
                    {copied["improved"] ? (
                      <Check
                        className="w-5 h-5"
                        style={{ color: "var(--color-success)" }}
                      />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      exportToFile(improvedCode, language, "improved")
                    }
                    style={{ color: "var(--color-border)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--color-foreground)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--color-border)")
                    }
                    title="Export to file"
                  >
                    <FileUp className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {viewMode === "code" ? (
            <textarea
              value={improvedCode}
              onChange={(e) => setImprovedCode(e.target.value)}
              className="w-full p-4 min-h-[300px] font-mono text-sm focus:outline-none resize-none"
              placeholder="Improved code will appear here..."
              style={{
                backgroundColor: "var(--color-background)",
                color: "var(--color-foreground)",
                border: "none",
              }}
            />
          ) : (
            <div className="diff-view max-h-[300px] overflow-auto p-4 font-mono text-sm">
              {diffLines.length === 0 ? (
                <div className="text-center text-[var(--color-border)] py-8">
                  {improvedCode
                    ? "No changes detected"
                    : "Generate improvements to see changes"}
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {diffLines.map((line, index) => (
                      <tr
                        key={index}
                        className={
                          line.type === "added"
                            ? "bg-[var(--color-success-bg)]"
                            : line.type === "removed"
                            ? "bg-[var(--color-error-bg)]"
                            : ""
                        }
                      >
                        <td
                          className={`p-1 ${
                            line.type === "removed"
                              ? "text-[var(--color-error)]"
                              : "text-[var(--color-foreground)]"
                          }`}
                        >
                          <div className="flex">
                            <span className="text-[var(--color-border)] w-8 text-right pr-2">
                              {line.lineNumber}
                            </span>
                            <span
                              className={
                                line.type === "removed" ? "line-through" : ""
                              }
                            >
                              {line.leftLine}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`p-1 ${
                            line.type === "added"
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-foreground)]"
                          }`}
                        >
                          <div className="flex">
                            <span className="text-[var(--color-border)] w-8 text-right pr-2">
                              {line.lineNumber}
                            </span>
                            <span>{line.rightLine}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {showExplanation && explanation && (
        <div
          className="mt-4 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]"
          style={{ color: "var(--color-foreground)" }}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">Explanation</h3>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(explanation, "explanation")}
                className="text-[var(--color-border)] hover:text-[var(--color-foreground)]"
                title="Copy explanation"
              >
                {copied["explanation"] ? (
                  <Check className="w-5 h-5 text-[var(--color-success)]" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setShowExplanation(false)}
                className="text-[var(--color-border)] hover:text-[var(--color-foreground)]"
                title="Close explanation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="whitespace-pre-wrap text-sm">{explanation}</div>
        </div>
      )}
    </div>
  );
};

export default CodeImprove;
