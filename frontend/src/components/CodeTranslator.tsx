import React, { useState, useRef, useEffect } from "react";
import useLocalStorage from "./useLocalStorage";
import {
  Copy,
  Check,
  ArrowLeftRight,
  FileInput,
  FileUp,
  X,
  Code,
  Languages,
} from "lucide-react";

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

const exportToFile = (content: string, language: Language) => {
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
  a.download = `translated.${extensionMap[language] || "txt"}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

type Language = (typeof SUPPORTED_LANGUAGES)[number];

interface CodeTranslatorProps {
  defaultSourceLanguage?: Language;
  defaultTargetLanguages?: Language[];
  onTranslate?: (
    source: string,
    sourceLang: Language,
    targetLang: Language
  ) => Promise<string>;
  onClose: () => void;
  showCopyButtons?: boolean;
  showSwapButton?: boolean;
  showFileButtons?: boolean;
  initialSourceCode?: string;
}

const CodeTranslator: React.FC<CodeTranslatorProps> = ({
  defaultSourceLanguage = "JavaScript",
  defaultTargetLanguages = ["TypeScript", "Python", "Java"],
  onTranslate,
  onClose,
  showCopyButtons = true,
  showSwapButton = true,
  showFileButtons = true,
  initialSourceCode = "",
}) => {
  const [sourceLanguage, setSourceLanguage] = useLocalStorage<Language>(
    "codeTranslator-sourceLanguage",
    defaultSourceLanguage
  );
  const [targetLanguages, setTargetLanguages] = useLocalStorage<Language[]>(
    "codeTranslator-targetLanguages",
    defaultTargetLanguages
  );
  const [sourceCode, setSourceCode] = useLocalStorage(
    "codeTranslator-sourceCode",
    initialSourceCode
  );
  const [translations, setTranslations] = useState<Record<Language, string>>(
    {} as Record<Language, string>
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  const targetFileInputRefs = useRef<Record<Language, HTMLInputElement | null>>(
    Object.fromEntries(
      SUPPORTED_LANGUAGES.map((lang) => [lang, null])
    ) as Record<Language, HTMLInputElement | null>
  );

  // Initialize target languages in translations state
  useEffect(() => {
    const initialTranslations = {} as Record<Language, string>;
    targetLanguages.forEach((lang) => {
      initialTranslations[lang] = translations[lang] || "";
    });
    setTranslations(initialTranslations);
  }, [targetLanguages]);

  const handleTranslate = async (targetLang: Language) => {
    if (!sourceCode.trim() || !onTranslate) return;

    setIsTranslating(true);
    try {
      const translatedCode = await onTranslate(
        sourceCode,
        sourceLanguage,
        targetLang
      );
      setTranslations((prev) => ({
        ...prev,
        [targetLang]: translatedCode,
      }));
    } catch (error) {
      console.error("Translation failed:", error);
      setTranslations((prev) => ({
        ...prev,
        [targetLang]: `// Translation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateAll = async () => {
    if (!sourceCode.trim() || !onTranslate) return;

    setIsTranslating(true);
    try {
      const results = await Promise.all(
        targetLanguages.map((lang) =>
          onTranslate(sourceCode, sourceLanguage, lang)
        )
      );

      const newTranslations = {} as Record<Language, string>;
      targetLanguages.forEach((lang, i) => {
        newTranslations[lang] = results[i];
      });

      setTranslations(newTranslations);
    } catch (error) {
      console.error("Translation failed:", error);
      const newTranslations = {} as Record<Language, string>;
      targetLanguages.forEach((lang) => {
        newTranslations[lang] = `// Translation error: ${
          error instanceof Error ? error.message : String(error)
        }`;
      });
      setTranslations(newTranslations);
    } finally {
      setIsTranslating(false);
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

  const addTargetLanguage = (lang: Language) => {
    if (!targetLanguages.includes(lang)) {
      setTargetLanguages([...targetLanguages, lang]);
    }
  };

  const removeTargetLanguage = (lang: Language) => {
    setTargetLanguages(targetLanguages.filter((l) => l !== lang));
  };

  return (
    <div
      className="code-translator-container m-2"
      style={{ color: "var(--color-foreground)" }}
    >
      <div
        className="translator-controls mb-4 p-4 rounded-lg"
        style={{
          backgroundColor: "var(--color-background)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="language-selector">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-foreground)" }}
            >
              Source Language
            </label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value as Language)}
              className="p-2 rounded hover:bg-[var(--color-secondary)] bg-[var(--color-background)] cursor-pointer border rounded border-[var(--color-border)]"
            >
              {SUPPORTED_LANGUAGES.map((lang, index) => (
                <option key={`source-${lang}-${index}`} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="target-languages">
            <label className="block text-sm font-medium mb-1 text-var(--color-foreground)">
              Target Languages
            </label>
            <div className="flex flex-wrap gap-2">
              {targetLanguages.map((lang, index) => (
                <div
                  key={`target-${lang}-${index}`}
                  style={{
                    backgroundColor: "var(--color-success-bg)",
                    borderRadius: "0.375rem",
                    padding: "0.25rem 0.75rem",
                    display: "flex",
                    alignItems: "center",
                    color: "var(--color-success)",
                  }}
                >
                  <span>{lang}</span>
                  <button
                    onClick={() => removeTargetLanguage(lang)}
                    style={{
                      marginLeft: "0.5rem",
                      color: "var(--color-border)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color =
                        "var(--color-success-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--color-border)")
                    }
                    aria-label={`Remove target language ${lang}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    addTargetLanguage(e.target.value as Language);
                    e.target.value = "";
                  }
                }}
                className="p-2 rounded bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)] cursor-pointer border rounded border-[var(--color-border)]"
              >
                <option value="">Add Language...</option>
                {SUPPORTED_LANGUAGES.filter(
                  (lang) => !targetLanguages.includes(lang)
                ).map((lang, index) => (
                  <option key={`add-${lang}-${index}`} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleTranslateAll}
            disabled={isTranslating || !sourceCode.trim()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--color-primary)",
              color: "white",
              borderRadius: "0.375rem",
              marginLeft: "auto",
              cursor:
                isTranslating || !sourceCode.trim() ? "not-allowed" : "pointer",
              opacity: isTranslating || !sourceCode.trim() ? 0.5 : 1,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              !isTranslating &&
              sourceCode.trim() &&
              (e.currentTarget.style.backgroundColor =
                "var(--color-primary-hover)")
            }
            onMouseLeave={(e) =>
              !isTranslating &&
              sourceCode.trim() &&
              (e.currentTarget.style.backgroundColor = "var(--color-primary)")
            }
          >
            {isTranslating ? "Translating..." : "Translate All"}
          </button>
        </div>
      </div>

      <div className="translator-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <span className="font-medium">{sourceLanguage}</span>
            </div>
            <div className="flex gap-2">
              {showFileButtons && (
                <>
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
                </>
              )}
              {showCopyButtons && (
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
              )}
            </div>
          </div>
          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            className="w-full h-full p-4 h-64 font-mono text-sm focus:outline-none resize-none"
            placeholder={`Enter ${sourceLanguage} code here...`}
            style={{
              backgroundColor: "var(--color-background)",
              color: "var(--color-foreground)",
              border: "none",
            }}
          />
        </div>

        {/* Target Editors */}
        <div className="target-editors grid grid-cols-1 md:grid-cols-2 gap-6">
          {targetLanguages.map((lang, index) => (
            <div
              key={`${lang}-${index}`}
              className="target-editor border rounded-lg overflow-hidden"
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
                  <Languages className="w-5 h-5 mr-2" />
                  <span className="font-medium">{lang}</span>
                </div>
                <div className="flex gap-2">
                  {showSwapButton && (
                    <button
                      onClick={() => {
                        // Swap source and target
                        const newSourceCode = translations[lang] || "";
                        const newSourceLang = lang;
                        const newTargetLanguages = [
                          ...targetLanguages.filter((l) => l !== lang),
                          sourceLanguage,
                        ];

                        setSourceLanguage(newSourceLang);
                        setTargetLanguages(newTargetLanguages);
                        setSourceCode(newSourceCode);
                        setTranslations((prev) => ({
                          ...prev,
                          [sourceLanguage]: sourceCode,
                        }));
                      }}
                      style={{ color: "var(--color-border)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color =
                          "var(--color-foreground)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--color-border)")
                      }
                      title="Swap with source"
                    >
                      <ArrowLeftRight className="w-5 h-5" />
                    </button>
                  )}
                  {showFileButtons && (
                    <>
                      <button
                        onClick={() =>
                          targetFileInputRefs.current[lang]?.click()
                        }
                        style={{ color: "var(--color-border)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color =
                            "var(--color-foreground)")
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
                        ref={(el) => (targetFileInputRefs.current[lang] = el)}
                        onChange={(e) =>
                          handleFileUpload(e, (code) => {
                            setTranslations((prev) => ({
                              ...prev,
                              [lang]: code,
                            }));
                          })
                        }
                        className="hidden"
                      />
                    </>
                  )}
                  <button
                    onClick={() => handleTranslate(lang)}
                    disabled={isTranslating || !sourceCode.trim()}
                    style={{
                      color: "var(--color-primary)",
                      cursor:
                        isTranslating || !sourceCode.trim()
                          ? "not-allowed"
                          : "pointer",
                      opacity: isTranslating || !sourceCode.trim() ? 0.5 : 1,
                    }}
                    title="Translate"
                  >
                    {isTranslating ? "..." : "↻"}
                  </button>
                  {showCopyButtons && (
                    <button
                      onClick={() =>
                        copyToClipboard(
                          translations[lang] || "",
                          `target-${lang}`
                        )
                      }
                      style={{ color: "var(--color-border)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color =
                          "var(--color-foreground)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--color-border)")
                      }
                      title="Copy code"
                    >
                      {copied[`target-${lang}`] ? (
                        <Check
                          className="w-5 h-5"
                          style={{ color: "var(--color-success)" }}
                        />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => exportToFile(translations[lang] || "", lang)}
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
                value={translations[lang] || ""}
                onChange={(e) =>
                  setTranslations((prev) => ({
                    ...prev,
                    [lang]: e.target.value,
                  }))
                }
                className="w-full p-4 h-64 font-mono text-sm focus:outline-none resize-none"
                placeholder={`${lang} translation will appear here...`}
                readOnly={!onTranslate}
                style={{
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-foreground)",
                  border: "none",
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap p-4">
          <button
            onClick={handleTranslateAll}
            disabled={isTranslating || !sourceCode.trim()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--color-primary)",
              color: "white",
              borderRadius: "0.375rem",
              cursor:
                isTranslating || !sourceCode.trim() ? "not-allowed" : "pointer",
              opacity: isTranslating || !sourceCode.trim() ? 0.5 : 1,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              !isTranslating &&
              sourceCode.trim() &&
              (e.currentTarget.style.backgroundColor =
                "var(--color-primary-hover)")
            }
            onMouseLeave={(e) =>
              !isTranslating &&
              sourceCode.trim() &&
              (e.currentTarget.style.backgroundColor = "var(--color-primary)")
            }
          >
            {isTranslating ? "Translating..." : "Translate All"}
          </button>
          <button
            onClick={() => onClose()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--color-error)",
              color: "white",
              borderRadius: "0.375rem",
              transition: "background-color 0.2s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--color-error-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-error)")
            }
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeTranslator;
