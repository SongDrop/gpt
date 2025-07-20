import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import useLocalStorage from "./useLocalStorage";
import CodeTranslator from "./CodeTranslator";
import {
  Bold,
  Italic,
  Terminal,
  FolderDown,
  ChevronDown,
  X,
  FileDiff,
  Copy,
  Check,
  ArrowLeftRight,
  FileInput,
  FileUp,
  FileDown,
  Image,
  Database,
  Code,
} from "lucide-react";
import { relative } from "path";
import BuyMeACoffeeWidget from "./BuyMeACoffeeWidget";
import BuyMeACoffeeSVG from "./BuyMeACoffeSVG";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onImage: () => void;
  onDatabase: () => void;
  onDownload: () => void;
  onTranslate?: (
    source: string,
    sourceLang: string,
    targetLang: string
  ) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
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

const FILE_EXTENSIONS =
  ".txt,.md,.markdown,.json,.js,.ts,.jsx,.tsx,.py,.html,.uc,.css,.scss,.less,.sql,.yaml,.yml,.cpp,.c,.h,.hpp,.cc,.java,.kt,.go,.rs,.php,.rb,.sh,.pl,.pm,.lua,.r,.m,.swift,.scala,.groovy,.dart,.elm,.clj,.cljs,.cljc,.edn,.ex,.exs,.hs,.purs,.erl,.hrl,.fs,.fsx,.fsi,.v,.sv,.vhd,.vhdl,.tex,.bib,.rkt,.rktl,.rktd,.scrbl,.plt,.ss,.sch,.rkt~,.st,.cs,.vb,.fs,.fsscript,.fsharp,.pas,.pp,.inc,.lpr,.dpr,.adb,.ads,.ada,.asm,.s,.S,.inc,.ino,.pde,.coffee,.litcoffee,.iced,.jl,.tcl,.nim,.zig,.v,.sv,.svh,.uc,.uci,.upkg,.nut,.vala,.vapi,.gml,.gmx,.yy,.yyp,.gmx,.project.gmx,.gm81,.gmk,.gm6,.gmd,.gms,.agc,.aea,.tex,.sty,.cls,.bst,.bib,.Rnw,.Rmd,.Rd,.Rtex,.Rhtml,.Rcss,.Rjs,.jl,.ipynb";

type Language = (typeof SUPPORTED_LANGUAGES)[number];

type DiffLine = {
  type: "unchanged" | "added" | "removed" | "empty";
  leftLine?: string;
  rightLine?: string;
  lineNumber?: number;
};

const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  (
    {
      value,
      placeholder,
      onChange,
      onSubmit,
      onImage,
      onDatabase,
      onDownload,
      onTranslate,
      disabled,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => textareaRef.current!);

    const insertText = (prefix: string, suffix = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      const newValue =
        value.substring(0, start) +
        prefix +
        selectedText +
        suffix +
        value.substring(end);
      onChange(newValue);

      const newCursorPosition = start + prefix.length + selectedText.length;

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    };
    //
    const [showTranslatorTool, setShowTranslatorTool] = useState(false);
    const [showBmcWidget, setShowBmcWidget] = React.useState(false);
    const prevShowDiffTool = useRef<boolean>(false);
    //
    const [showLanguages, setShowLanguages] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{
      top: number;
      left: number;
    }>({ top: 0, left: 0 });
    const langBtnRef = useRef<HTMLButtonElement | null>(null);
    const [showDiffTool, setShowDiffTool] = useState(false);
    const [leftDocument, setLeftDocument] = useLocalStorage<string>(
      "leftDocument-1",
      ""
    );
    const [rightDocument, setRightDocument] = useLocalStorage<string>(
      "rightDocument-1",
      ""
    );
    const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<"side-by-side" | "inline">(
      "side-by-side"
    );
    const [leftFileName, setLeftFileName] = useState("");
    const [rightFileName, setRightFileName] = useState("");
    const leftFileInputRef = useRef<HTMLInputElement>(null);
    const rightFileInputRef = useRef<HTMLInputElement>(null);
    const mainFileInputRef = useRef<HTMLInputElement>(null);
    // NEW: Manage textarea height state for resizing
    const [textareaHeight, setTextareaHeight] = useLocalStorage<number>(
      "text-area-height-markdown-editor-1",
      150
    ); // initial height px
    const dragStartY = useRef<number | null>(null);
    const dragStartHeight = useRef<number>(textareaHeight);

    // Drag handle mouse down
    const onDragHandleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStartY.current = e.clientY;
      dragStartHeight.current = textareaHeight;

      document.addEventListener("mousemove", onDragging);
      document.addEventListener("mouseup", onDragEnd);
    };

    // Mouse move - drag handler
    const onDragging = (e: MouseEvent) => {
      if (dragStartY.current === null) return;

      const deltaY = dragStartY.current - e.clientY; // drag up increases height
      let newHeight = dragStartHeight.current + deltaY;

      if (newHeight < 50) newHeight = 50; // min height
      if (newHeight > 1000) newHeight = 1000; // max height

      setTextareaHeight(newHeight);
    };

    // Mouse up - drag end
    const onDragEnd = () => {
      dragStartY.current = null;
      document.removeEventListener("mousemove", onDragging);
      document.removeEventListener("mouseup", onDragEnd);
    };

    // Double click
    const onDoubleClickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setTextareaHeight(250);
    };

    const formatText = (format: "bold" | "italic" | "inline-code") => {
      switch (format) {
        case "bold":
          insertText("**", "**");
          break;
        case "italic":
          insertText("*", "*");
          break;
        case "inline-code":
          insertText("`", "`");
          break;
      }
    };

    const insertCodeBlock = (language: Language) => {
      const placeholder = `\n\`\`\`${language}\n\n\`\`\`\n`;
      const textarea = textareaRef.current;

      const start = textarea?.selectionStart ?? value.length;
      const newText = value.slice(0, start) + placeholder + value.slice(start);

      onChange(newText);
      setShowLanguages(false);

      setTimeout(() => {
        if (textareaRef.current) {
          const cursorPosition = start + `\n\`\`\`${language}\n`.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    };

    const compareDocuments = () => {
      if (!leftDocument || !rightDocument) {
        setDiffLines([{ type: "empty" }]);
        return;
      }

      if (leftDocument === rightDocument) {
        setDiffLines([
          { type: "unchanged", leftLine: "Documents are identical" },
        ]);
        return;
      }

      const diff = generateDiff(leftDocument, rightDocument);
      setDiffLines(diff);
    };

    const generateDiff = (left: string, right: string): DiffLine[] => {
      const leftLines = left.split("\n");
      const rightLines = right.split("\n");
      const diffLines: DiffLine[] = [];

      const maxLines = Math.max(leftLines.length, rightLines.length);

      for (let i = 0; i < maxLines; i++) {
        const leftLine = leftLines[i];
        const rightLine = rightLines[i];

        if (leftLine === rightLine) {
          diffLines.push({
            type: "unchanged",
            leftLine,
            rightLine,
            lineNumber: i + 1,
          });
        } else if (leftLine && !rightLine) {
          diffLines.push({
            type: "removed",
            leftLine,
            lineNumber: i + 1,
          });
        } else if (!leftLine && rightLine) {
          diffLines.push({
            type: "added",
            rightLine,
            lineNumber: i + 1,
          });
        } else {
          diffLines.push(
            {
              type: "removed",
              leftLine,
              lineNumber: i + 1,
            },
            {
              type: "added",
              rightLine,
              lineNumber: i + 1,
            }
          );
        }
      }

      return diffLines;
    };

    const applyDiffToEditor = () => {
      if (diffLines.length > 0) {
        const newContent = diffLines
          .filter((line) => line.type !== "removed")
          .map((line) => line.rightLine || line.leftLine || "")
          .join("\n");
        onChange(newContent);
        setShowDiffTool(false);
      }
    };

    const copyDiffToClipboard = () => {
      if (diffLines.length === 0) return;

      const diffText = diffLines
        .map((line) => {
          if (line.type === "added") return `+ ${line.rightLine}`;
          if (line.type === "removed") return `- ${line.leftLine}`;
          return `  ${line.leftLine}`;
        })
        .join("\n");

      navigator.clipboard.writeText(diffText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    const swapDocuments = () => {
      setLeftDocument(rightDocument);
      setRightDocument(leftDocument);
      setLeftFileName(rightFileName);
      setRightFileName(leftFileName);
    };

    const handleFileUpload = (
      e: React.ChangeEvent<HTMLInputElement>,
      target: "left" | "right" | "main"
    ) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (target === "left") {
          setLeftDocument(content);
          setLeftFileName(file.name);
        } else if (target === "right") {
          setRightDocument(content);
          setRightFileName(file.name);
        } else {
          onChange(content);
        }
      };
      reader.readAsText(file);
      e.target.value = ""; // Reset input to allow selecting the same file again
    };

    const triggerFileInput = (target: "left" | "right" | "main") => {
      if (target === "left" && leftFileInputRef.current) {
        leftFileInputRef.current.click();
      } else if (target === "right" && rightFileInputRef.current) {
        rightFileInputRef.current.click();
      } else if (target === "main" && mainFileInputRef.current) {
        mainFileInputRef.current.click();
      }
    };

    const exportToFile = (
      content: string,
      defaultFileName = "document.txt"
    ) => {
      const fileName = prompt("Enter filename for download:", defaultFileName);

      if (fileName === null) {
        // User cancelled the prompt
        console.log("Download cancelled by user");
        return;
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    useEffect(() => {
      if (showDiffTool && !prevShowDiffTool.current) {
        // Diff tool just opened
        setLeftDocument(value);
        setRightDocument(value);
        setLeftFileName("");
        setRightFileName("");
        setDiffLines([]);
      }
      prevShowDiffTool.current = showDiffTool;
    }, [showDiffTool, value]);

    const handleOnTranslate = async (
      source: string,
      sourceLang: Language,
      targetLang: Language
    ): Promise<string> => {
      if (!onTranslate) {
        return Promise.resolve("");
      }

      // Language type is already a string (the specific language name)
      // So we can use them directly as strings
      return onTranslate(source, sourceLang, targetLang);
    };

    const toggleDropdown = () => {
      if (!showLanguages) {
        if (langBtnRef.current) {
          const rect = langBtnRef.current.getBoundingClientRect();
          setDropdownPos({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
          });
        }
      }
      setShowLanguages(!showLanguages);
    };

    return (
      <div className="not-prose p-0 m-0 !p-0 !m-0 z-40">
        <div
          className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg shadow-sm !mt-0 !p-0 text-[var(--color-foreground)] overflow-hidden"
          style={{ zIndex: 500 }}
        >
          {showLanguages && (
            <div
              className="bg-[var(--color-background)] mt-1 p-2 rounded-lg shadow-lg border border-[var(--color-border)] z-10 max-w-[150px]"
              style={{
                position: "absolute",
                top: dropdownPos.top,
                left: dropdownPos.left,
              }}
            >
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-foreground)] text-sm font-medium">
                  Select Language
                </span>
                <button
                  type="button"
                  onClick={() => setShowLanguages(false)}
                  className="text-[var(--color-border)] hover:text-[var(--color-foreground)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {SUPPORTED_LANGUAGES.map((lang, index) => (
                  <button
                    key={`${lang}-${index}`}
                    type="button"
                    onClick={() => insertCodeBlock(lang)}
                    className="text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] w-full text-left px-2 py-1 text-sm rounded transition-colors"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div
            id="flexbar-scroll"
            className="bg-[var(--color-secondary)] flex items-center gap-1 p-2 border-b border-[var(--color-border)] overflow-x-auto whitespace-nowrap max-h-[50px] scrollbar-hide"
          >
            <button
              type="button"
              onClick={() => triggerFileInput("main")}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Load from file"
            >
              <FileInput className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Save to file"
            >
              <FileDown className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <button
              type="button"
              onClick={() => formatText("bold")}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Bold"
            >
              <Bold className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <button
              type="button"
              onClick={() => formatText("italic")}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Italic"
            >
              <Italic className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <button
              type="button"
              onClick={() => formatText("inline-code")}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Inline Code"
            >
              <Terminal className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <div className="relative">
              <button
                type="button"
                ref={langBtnRef}
                onClick={() => toggleDropdown()}
                className="hover:bg-[var(--color-secondary-hover)] flex items-center gap-1 p-2 rounded transition-colors"
                title="Insert Code Block"
              >
                <FolderDown className="w-4 h-4 text-[var(--color-foreground)]" />
                <ChevronDown className="w-3 h-3 text-[var(--color-foreground)]" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowDiffTool((prev) => !prev)}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Compare Documents"
            >
              <FileDiff className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <button
              type="button"
              onClick={() => setShowTranslatorTool((prev) => !prev)}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Code Translator"
            >
              <Code className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <button
              type="button"
              onClick={() => onImage()}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Gpt-Image-1"
            >
              <Image className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            <button
              type="button"
              onClick={() => onDatabase()}
              className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors"
              title="Rag Database"
            >
              <Database className="w-4 h-4 text-[var(--color-foreground)]" />
            </button>
            {showBmcWidget && (
              <BuyMeACoffeeWidget
                id="gabzlabs"
                color="#FF813F"
                position="right"
                xMargin={24}
                yMargin={24}
                description="Support me on Buy Me a Coffee!"
                message="Thanks for stopping by!"
                onClose={() => setShowBmcWidget(false)}
              />
            )}
            <div className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors">
              <button
                onClick={() => setShowBmcWidget((prev) => !prev)}
                className="w-support"
                title="Thanks for using"
              >
                <BuyMeACoffeeSVG
                  svgUrl={`https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=%E2%98%95&slug=gabzlabs&button_colour=${encodeURIComponent(
                    getComputedStyle(document.documentElement)
                      .getPropertyValue("--color-foreground")
                      .trim()
                      .replace(/^#/, "")
                  )}&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=ffffff`}
                  fillColor={getComputedStyle(document.documentElement)
                    .getPropertyValue("--color-secondary")
                    .trim()}
                  width={16}
                  height={16}
                />
              </button>
            </div>
            <div className="hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors">
              <a
                id="g-support"
                className="g-support"
                href="https://github.com/songdrop/gpt"
                target="_blank"
                rel="noreferrer"
                title="GitHub"
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    WebkitMaskSize: "cover",
                    maskSize: "cover",
                    WebkitMaskImage:
                      'url("https://upload.wikimedia.org/wikipedia/commons/c/c2/GitHub_Invertocat_Logo.svg")',
                    maskImage:
                      'url("https://upload.wikimedia.org/wikipedia/commons/c/c2/GitHub_Invertocat_Logo.svg")',
                    backgroundColor: "var(--color-foreground)",
                  }}
                />
              </a>
            </div>
          </div>

          <input
            type="file"
            ref={mainFileInputRef}
            onChange={(e) => handleFileUpload(e, "main")}
            accept={FILE_EXTENSIONS}
            className="hidden"
          />
          {showTranslatorTool && (
            <CodeTranslator
              defaultSourceLanguage="JavaScript"
              defaultTargetLanguages={["TypeScript", "Python", "Java"]}
              onTranslate={handleOnTranslate}
              onClose={() => setShowTranslatorTool(false)}
              initialSourceCode="// Enter your JavaScript code here"
            />
          )}
          {showDiffTool && (
            <div className="bg-[var(--color-background)] p-4 border-b border-[var(--color-border)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[var(--color-foreground)] text-lg font-medium">
                  Document Comparison
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setViewMode(
                        viewMode === "side-by-side" ? "inline" : "side-by-side"
                      )
                    }
                    className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors"
                    title="Toggle view mode"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-[var(--color-foreground)]" />
                    {viewMode === "side-by-side" ? "Inline" : "Side-by-side"}
                  </button>
                  <button
                    onClick={swapDocuments}
                    className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] px-3 py-1 text-sm rounded transition-colors"
                    title="Swap documents"
                  >
                    Swap
                  </button>
                </div>
              </div>

              <input
                type="file"
                ref={leftFileInputRef}
                onChange={(e) => handleFileUpload(e, "left")}
                accept={FILE_EXTENSIONS}
                className="hidden"
              />
              <input
                type="file"
                ref={rightFileInputRef}
                onChange={(e) => handleFileUpload(e, "right")}
                accept={FILE_EXTENSIONS}
                className="hidden"
              />

              {viewMode === "side-by-side" ? (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[var(--color-foreground)] block text-sm font-medium">
                        Original Document
                      </label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => triggerFileInput("left")}
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Load from file"
                        >
                          <FileInput className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            exportToFile(
                              leftDocument,
                              leftFileName || "original.txt"
                            )
                          }
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Save to file"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {leftFileName && (
                      <div className="text-[var(--color-border)] text-xs mb-1 truncate">
                        File: {leftFileName}
                      </div>
                    )}
                    <textarea
                      value={leftDocument}
                      onChange={(e) => setLeftDocument(e.target.value)}
                      className="w-full p-2 border border-[var(--color-border)] rounded focus:outline-none min-h-[200px] font-mono text-sm bg-[var(--color-background)] text-[var(--color-foreground)]"
                      placeholder="Paste the original document here or load from file"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[var(--color-foreground)] block text-sm font-medium">
                        Modified Document
                      </label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => triggerFileInput("right")}
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Load from file"
                        >
                          <FileInput className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            exportToFile(
                              rightDocument,
                              rightFileName || "modified.txt"
                            )
                          }
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Save to file"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {rightFileName && (
                      <div className="text-[var(--color-border)] text-xs mb-1 truncate">
                        File: {rightFileName}
                      </div>
                    )}
                    <textarea
                      value={rightDocument}
                      onChange={(e) => setRightDocument(e.target.value)}
                      className="w-full p-2 border border-[var(--color-border)] rounded focus:outline-none min-h-[200px] font-mono text-sm bg-[var(--color-background)] text-[var(--color-foreground)]"
                      placeholder="Paste the modified document here or load from file"
                    />
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[var(--color-foreground)] block text-sm font-medium">
                        Original Document
                      </label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => triggerFileInput("left")}
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Load from file"
                        >
                          <FileInput className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            exportToFile(
                              leftDocument,
                              leftFileName || "original.txt"
                            )
                          }
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Save to file"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <label className="text-[var(--color-foreground)] block text-sm font-medium">
                        Modified Document
                      </label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => triggerFileInput("right")}
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Load from file"
                        >
                          <FileInput className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            exportToFile(
                              rightDocument,
                              rightFileName || "modified.txt"
                            )
                          }
                          className="text-[var(--color-border)] hover:text-[var(--color-foreground)] p-1"
                          title="Save to file"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-full">
                      {leftFileName && (
                        <div className="text-[var(--color-border)] text-xs mb-1 truncate">
                          File: {leftFileName}
                        </div>
                      )}
                      <textarea
                        value={leftDocument}
                        onChange={(e) => setLeftDocument(e.target.value)}
                        className="w-full p-2 border border-[var(--color-border)] rounded focus:outline-none min-h-[200px] font-mono text-sm bg-[var(--color-background)] text-[var(--color-foreground)]"
                        placeholder="Paste the original document here or load from file"
                      />
                    </div>
                    <div className="w-full">
                      {rightFileName && (
                        <div className="text-[var(--color-border)] text-xs mb-1 truncate">
                          File: {rightFileName}
                        </div>
                      )}
                      <textarea
                        value={rightDocument}
                        onChange={(e) => setRightDocument(e.target.value)}
                        className="w-full p-2 border border-[var(--color-border)] rounded focus:outline-none min-h-[200px] font-mono text-sm bg-[var(--color-background)] text-[var(--color-foreground)]"
                        placeholder="Paste the modified document here or load from file"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap mb-4">
                <button
                  onClick={compareDocuments}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white flex items-center gap-2 px-4 py-2 rounded transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  Compare
                </button>
                {diffLines.length > 0 && (
                  <>
                    <button
                      onClick={applyDiffToEditor}
                      className="bg-[var(--color-success)] hover:bg-[var(--color-success)] text-white px-4 py-2 rounded transition-colors"
                    >
                      Apply Diff to Editor
                    </button>
                    <button
                      onClick={copyDiffToClipboard}
                      className="text-[var(--color-primary)] hover:text-[var(--color-primary)] flex items-center gap-1 px-4 py-2 rounded transition-colors"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "Copied!" : "Copy Diff"}
                    </button>
                    <button
                      onClick={() =>
                        exportToFile(
                          diffLines
                            .map((line) => {
                              if (line.type === "added")
                                return `+ ${line.rightLine}`;
                              if (line.type === "removed")
                                return `- ${line.leftLine}`;
                              return `  ${line.leftLine}`;
                            })
                            .join("\n"),
                          "diff_result.diff"
                        )
                      }
                      className="text-[var(--color-primary)] hover:text-[var(--color-primary)] flex items-center gap-1 px-4 py-2 rounded transition-colors"
                    >
                      <FileUp className="w-4 h-4" />
                      Export Diff
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowDiffTool(false)}
                  className="bg-[var(--color-error)] hover:bg-[var(--color-error)] text-white px-4 py-2 rounded transition-colors"
                >
                  Close
                </button>
              </div>

              {diffLines.length > 0 && (
                <div className="mt-4 border border-[var(--color-border)] rounded overflow-hidden">
                  <div className="bg-[var(--color-secondary)] p-2 border-b border-[var(--color-border)] flex justify-between items-center">
                    <span className="text-[var(--color-foreground)] text-sm font-medium">
                      Comparison Results
                    </span>
                    <span className="text-xs text-[var(--color-border)]">
                      {
                        diffLines.filter(
                          (l) => l.type === "added" || l.type === "removed"
                        ).length
                      }{" "}
                      changes
                    </span>
                  </div>
                  <div className="max-h-60 overflow-auto font-mono text-sm">
                    {viewMode === "side-by-side" ? (
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
                                className={`p-1 border-r border-[var(--color-border)] ${
                                  line.type === "removed"
                                    ? "text-[var(--color-error)]"
                                    : "text-[var(--color-foreground)]"
                                }`}
                              >
                                <div className="flex">
                                  <span className="text-[var(--color-border)] w-8 text-right pr-2">
                                    {line.type !== "added"
                                      ? line.lineNumber
                                      : ""}
                                  </span>
                                  <span
                                    className={
                                      line.type === "removed"
                                        ? "line-through"
                                        : ""
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
                                    {line.type !== "removed"
                                      ? line.lineNumber
                                      : ""}
                                  </span>
                                  <span>{line.rightLine}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-2">
                        {diffLines.map((line, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              line.type === "added"
                                ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                                : line.type === "removed"
                                ? "bg-[var(--color-error-bg)] text-[var(--color-error)] line-through"
                                : ""
                            }`}
                          >
                            <span className="text-[var(--color-border)] w-8 text-right pr-2">
                              {line.lineNumber}
                            </span>
                            <span className="whitespace-pre-wrap">
                              {line.type === "added" && "+ "}
                              {line.type === "removed" && "- "}
                              {line.leftLine || line.rightLine}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resize handle centered above the textarea */}
          <div className="flex justify-center">
            <div
              onDoubleClick={onDoubleClickMouseDown}
              onMouseDown={onDragHandleMouseDown}
              className="w-12 h-2 rounded cursor-row-resize my-1 bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] transition-colors"
              title="Drag to resize textarea"
            />
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full p-3 focus:outline-none resize-none font-mono bg-[var(--color-background)] text-[var(--color-foreground)]"
            style={{ height: textareaHeight }}
            rows={4}
          />
        </div>
      </div>
    );
  }
);

export default MarkdownEditor;
