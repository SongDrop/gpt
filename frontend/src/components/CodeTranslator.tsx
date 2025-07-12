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
    <div className="code-translator-container m-2">
      <div className="translator-controls mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap items-center gap-4">
          <div className="language-selector">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Language
            </label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value as Language)}
              className="p-2 border rounded"
            >
              {SUPPORTED_LANGUAGES.map((lang, index) => (
                <option key={`source-${lang}-${index}`} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="target-languages">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Languages
            </label>
            <div className="flex flex-wrap gap-2">
              {targetLanguages.map((lang, index) => (
                <div
                  key={`target-${lang}-${index}`}
                  className="flex items-center bg-blue-100 rounded px-3 py-1"
                >
                  <span>{lang}</span>
                  <button
                    onClick={() => removeTargetLanguage(lang)}
                    className="ml-2 text-gray-500 hover:text-gray-700"
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
                className="p-2 border rounded"
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
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 ml-auto"
          >
            {isTranslating ? "Translating..." : "Translate All"}
          </button>
        </div>
      </div>

      <div className="translator-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Code Editor */}
        <div className="source-editor border rounded-lg overflow-hidden">
          <div className="editor-header bg-gray-100 p-3 border-b flex justify-between items-center">
            <div className="flex items-center">
              <Code className="w-5 h-5 mr-2" />
              <span className="font-medium">{sourceLanguage}</span>
            </div>
            <div className="flex gap-2">
              {showFileButtons && (
                <>
                  <button
                    onClick={() => sourceFileInputRef.current?.click()}
                    className="p-1 text-gray-500 hover:text-gray-700"
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
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Copy code"
                >
                  {copied["source"] ? (
                    <Check className="w-5 h-5 text-green-500" />
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
            className="w-full p-4 h-64 font-mono text-sm focus:outline-none resize-none"
            placeholder={`Enter ${sourceLanguage} code here...`}
          />
        </div>

        {/* Target Editors - will create multiple columns based on screen size */}
        <div className="target-editors grid grid-cols-1 md:grid-cols-2 gap-6">
          {targetLanguages.map((lang, index) => (
            <div
              key={`${lang}-${index}`}
              className="target-editor border rounded-lg overflow-hidden"
            >
              <div className="editor-header bg-gray-100 p-3 border-b flex justify-between items-center">
                <div className="flex items-center">
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
                      className="p-1 text-gray-500 hover:text-gray-700"
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
                        className="p-1 text-gray-500 hover:text-gray-700"
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
                    className="p-1 text-blue-500 hover:text-blue-700 disabled:opacity-50"
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
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Copy code"
                    >
                      {copied[`target-${lang}`] ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => exportToFile(translations[lang] || "", lang)}
                    className="p-1 text-gray-500 hover:text-gray-700"
                    title="Export to file"
                  >
                    <FileUp className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <textarea
                value={translations[lang] || ""}
                onChange={(e) => {
                  setTranslations((prev) => ({
                    ...prev,
                    [lang]: e.target.value,
                  }));
                }}
                className="w-full p-4 h-64 font-mono text-sm focus:outline-none resize-none"
                placeholder={`${lang} translation will appear here...`}
                readOnly={!onTranslate} // Make read-only if no translate function provided
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap p-4">
        <button
          onClick={handleTranslateAll}
          disabled={isTranslating || !sourceCode.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isTranslating ? "Translating..." : "Translate All"}
        </button>
        <button
          onClick={() => onClose()}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default CodeTranslator;
