import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  X,
  ChevronDown,
  Copy,
  Check,
  Search,
  Save,
  Trash2,
  Download,
} from "lucide-react";
import useLocalStorage from "./useLocalStorage";
import PROMPT_TEMPLATES from "./prompt-templates.json";

interface PromptWindowProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

interface UserPrompt {
  title: string;
  prompt: string;
  category: TemplateCategory;
}

type TemplateCategory = keyof typeof PROMPT_TEMPLATES;

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/ProjectIGIRemakeTeam/prompt-templates/main/gpt-prompts.json";

const PromptWindow = ({
  placeholder,
  onSubmit,
  disabled,
  isLoading,
}: PromptWindowProps) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useLocalStorage<TemplateCategory>(
      "promptWindow-selectedCategory",
      "coding"
    );
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useLocalStorage<string>(
    "promptWindow-selectedPrompt",
    ""
  );
  const [showSavePromptModal, setShowSavePromptModal] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptCategory, setNewPromptCategory] =
    useState<TemplateCategory>("coding");
  const [userPrompts, setUserPrompts] = useLocalStorage<
    Record<TemplateCategory, UserPrompt[]>
  >("userPrompts", {} as Record<TemplateCategory, UserPrompt[]>);

  // State to hold merged prompts (default + from GitHub)
  const [mergedPrompts, setMergedPrompts] =
    useState<Record<string, { title: string; prompt: string }[]>>(
      PROMPT_TEMPLATES
    );
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGitHubPrompts() {
      try {
        const response = await fetch(GITHUB_RAW_URL);
        if (!response.ok)
          throw new Error("Failed to fetch prompts from GitHub");
        const remotePrompts = await response.json();

        // Merge remote prompts with local prompts
        const merged = { ...PROMPT_TEMPLATES };
        for (const category in remotePrompts) {
          const key = category as TemplateCategory;
          if (merged[key]) {
            const combined = [...merged[key], ...remotePrompts[key]];
            const unique = Array.from(
              new Set(combined.map((p) => JSON.stringify(p)))
            ).map((p) => JSON.parse(p));
            merged[key] = unique;
          } else {
            merged[key] = remotePrompts[key];
          }
        }
        setMergedPrompts(merged);
        setFetchError(null);
      } catch (err) {
        setFetchError((err as Error).message);
      }
    }
    fetchGitHubPrompts();
  }, []);

  // Combine all prompts (default, remote, and user prompts)
  const allPrompts = useMemo(() => {
    const combined = { ...mergedPrompts };

    // Add user prompts to their respective categories
    Object.entries(userPrompts).forEach(([category, prompts]) => {
      const cat = category as TemplateCategory;
      if (combined[cat]) {
        combined[cat] = [...combined[cat], ...prompts];
      } else {
        combined[cat] = [...prompts];
      }
    });

    return combined;
  }, [mergedPrompts, userPrompts]);

  const handleSavePrompt = () => {
    if (!selectedPrompt.trim() || !newPromptTitle.trim()) return;

    const newUserPrompt: UserPrompt = {
      title: newPromptTitle,
      prompt: selectedPrompt,
      category: newPromptCategory,
    };

    // Update user prompts
    setUserPrompts((prev) => ({
      ...prev,
      [newPromptCategory]: [...(prev[newPromptCategory] || []), newUserPrompt],
    }));

    // Reset and close modal
    setNewPromptTitle("");
    setShowSavePromptModal(false);
  };

  const applyTemplate = (prompt: string) => {
    setSelectedPrompt(prompt);
    onSubmit(prompt);
  };
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const copyToClipboard = () => {
    if (!selectedPrompt) return;
    navigator.clipboard.writeText(selectedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      applyTemplate(selectedPrompt);
    }
  };

  const handleSubmit = (e: React.MouseEvent) => {
    applyTemplate(selectedPrompt);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const escapedQuery = escapeRegExp(query);
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-200">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const { filteredCategories, filteredTemplates } = useMemo(() => {
    if (!searchQuery) {
      return {
        filteredCategories: Object.keys(allPrompts) as TemplateCategory[],
        filteredTemplates: allPrompts,
      };
    }

    const query = searchQuery.toLowerCase();
    const result: Record<
      TemplateCategory,
      Array<{ title: string; prompt: string }>
    > = {} as any;
    const matchingCategories: TemplateCategory[] = [];

    Object.entries(allPrompts).forEach(([category, templates]) => {
      const categoryMatches = category.toLowerCase().includes(query);
      const matchedTemplates = templates.filter(
        (template) =>
          template.title.toLowerCase().includes(query) ||
          template.prompt.toLowerCase().includes(query)
      );

      if (categoryMatches || matchedTemplates.length > 0) {
        result[category as TemplateCategory] = matchedTemplates;
        matchingCategories.push(category as TemplateCategory);
      }
    });

    return {
      filteredCategories: matchingCategories,
      filteredTemplates: result,
    };
  }, [searchQuery, allPrompts]);

  useEffect(() => {
    if (
      showTemplates &&
      searchQuery &&
      filteredCategories.length > 0 &&
      !filteredCategories.includes(selectedCategory)
    ) {
      setSelectedCategory(filteredCategories[0]);
    }
  }, [searchQuery, filteredCategories, selectedCategory, showTemplates]);

  const hasSearchResults = filteredCategories.length > 0;

  const matchingTemplate = Object.values(mergedPrompts)
    .flat()
    .find((template) => template.prompt.trim() === selectedPrompt.trim());

  const handleSearchQuery = (query: string) => {
    setSearchQuery(query);
    setShowTemplates(true);
  };

  const handleDeletePrompt = (category: TemplateCategory, index: number) => {
    setUserPrompts((prev) => {
      const updated = { ...prev };
      if (updated[category]) {
        updated[category] = updated[category].filter((_, i) => i !== index);
        // Remove category if empty
        if (updated[category].length === 0) {
          delete updated[category];
        }
      }
      return updated;
    });
  };

  const exportPrompts = () => {
    const data = JSON.stringify(userPrompts, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-prompts.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Function to check if a prompt is a user prompt
  const isUserPrompt = (category: TemplateCategory, promptText: string) => {
    return userPrompts[category]?.some((p) => p.prompt === promptText);
  };

  return (
    <div className="not-prose p-0 m-0 !p-0 !m-0 ">
      <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] shadow-sm !mt-0 !p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 p-2 border-b  border-b-[var(--color-border)] bg-[var(--color-secondary)]">
          <button
            type="button"
            onClick={() => setShowTemplates((prev) => !prev)}
            className="flex items-center gap-1 p-2 rounded hover:bg-[var(--color-primary)] hover:text-white transition-colors"
            title="Prompt Templates"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">Templates</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          <div className="relative flex-1 max-w-md ml-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search prompts or categories..."
              className="block w-full pl-10 pr-3 py-2 border border-[var(--color-border)] rounded-md leading-5 bg-[var(--color-background)] placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchQuery}
              onChange={(e) => handleSearchQuery(e.target.value)}
            />
          </div>
          {/* Add Save Prompt button */}
          <button
            type="button"
            onClick={() => setShowSavePromptModal(true)}
            disabled={!selectedPrompt.trim()}
            className="flex items-center gap-1 p-2 rounded hover:bg-[var(--color-primary)] hover:text-white transition-colors disabled:opacity-50"
            title="Save Prompt"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm">Save</span>
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-1 p-2 rounded hover:bg-[var(--color-primary)] hover:text-white transition-colors ml-auto"
            title="Copy Prompt"
          >
            {copied ? (
              <Check className="w-4 h-4 text-[var(--color-success)]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="text-sm">{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>

        {fetchError && (
          <div className="text-[var(--color-error)] p-2 text-sm">
            Error loading remote prompts: {fetchError}
          </div>
        )}

        {/* Save Prompt Modal */}
        {showSavePromptModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-background)] rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Save Prompt</h3>
                <button
                  onClick={() => setShowSavePromptModal(false)}
                  className="text-[var(--color-secondary)] hover:text-[var(--color-secondary)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
                    Prompt Title
                  </label>
                  <input
                    type="text"
                    value={newPromptTitle}
                    onChange={(e) => setNewPromptTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-secondary)] rounded-md"
                    placeholder="Enter a title for your prompt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
                    Category
                  </label>
                  <select
                    value={newPromptCategory}
                    onChange={(e) =>
                      setNewPromptCategory(e.target.value as TemplateCategory)
                    }
                    className="w-full px-3 py-2 border border-[var(--color-border)] text-[var(--color-foreground)] bg-[var(--color-secondary)] rounded-md"
                  >
                    {Object.keys(allPrompts).map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setShowSavePromptModal(false)}
                    className="px-4 py-2 text-sm font-medium text-[var(--color-foreground)] bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)] rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePrompt}
                    disabled={!newPromptTitle.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)] rounded-md disabled:opacity-50"
                  >
                    Save Prompt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showTemplates && (
          <div className="p-4 pt-0 border-b border-[var(--color-border)] bg-[var(--color-background)] max-h-[800px] overflow-hidden">
            <div className="flex justify-between items-center sticky top-0 bg-[var(--color-background)] z-10 pt-2">
              <h3 className="text-lg font-medium text-[var(--color-foreground)]">
                Prompt Templates
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(false);
                  setSearchQuery("");
                }}
                className="text-[var(--color-foreground)] hover:[var(--color-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              id="prompt_categories"
              className="flex gap-2 rounded mb-2 m-0 p-2 mt-1 overflow-x-auto py-2 bg-[var(--color-secondary)] z-10"
            >
              {filteredCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 text-sm rounded transition-colors whitespace-nowrap ${
                    selectedCategory === category
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-secndary)] hover:bg-[var(--color-primary)] hover:text-white"
                  }`}
                >
                  {highlightMatch(
                    category.charAt(0).toUpperCase() + category.slice(1),
                    searchQuery
                  )}
                </button>
              ))}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {hasSearchResults ? (
                <>
                  {filteredTemplates[selectedCategory]?.length > 0 && (
                    <div className="mb-6">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-[var(--color-foreground)] mb-3">
                          {highlightMatch(
                            selectedCategory.charAt(0).toUpperCase() +
                              selectedCategory.slice(1),
                            searchQuery
                          )}
                        </h4>
                        {Object.keys(userPrompts).length > 0 && (
                          <button
                            onClick={exportPrompts}
                            className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] mb-3"
                            title="Export all prompts"
                          >
                            <Download className="w-4 h-4" />
                            <span>Export All</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredTemplates[selectedCategory].map(
                          (template, index) => {
                            const isUser = isUserPrompt(
                              selectedCategory,
                              template.prompt
                            );
                            return (
                              <div
                                key={index}
                                className={`border rounded p-3 hover:bg-[var(--color-secondary)] transition-all ${
                                  matchingTemplate?.prompt === template.prompt
                                    ? "border-[var(--color-success)] border-2 shadow-sm"
                                    : "border-[var(--color-border)]"
                                }`}
                              >
                                <div
                                  className="cursor-pointer"
                                  onClick={() => applyTemplate(template.prompt)}
                                >
                                  <h4 className="font-medium text-[var(--color-foreground)] mb-1">
                                    {highlightMatch(
                                      template.title,
                                      searchQuery
                                    )}
                                  </h4>
                                  <p className="text-sm text-[var(--color-foreground)] whitespace-pre-line opacity-80">
                                    {highlightMatch(
                                      template.prompt,
                                      searchQuery
                                    )}
                                  </p>
                                </div>
                                {isUser && (
                                  <div className="flex justify-end mt-2 space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const userPromptIndex = userPrompts[
                                          selectedCategory
                                        ].findIndex(
                                          (p) => p.prompt === template.prompt
                                        );
                                        if (userPromptIndex !== -1) {
                                          handleDeletePrompt(
                                            selectedCategory,
                                            userPromptIndex
                                          );
                                        }
                                      }}
                                      className="p-1 text-[var(--color-error)] hover:text-[var(--color-error)]"
                                      title="Delete prompt"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                  {Object.entries(filteredTemplates).map(
                    ([category, templates]) =>
                      category !== selectedCategory && (
                        <div key={category} className="mb-6">
                          <h4 className="font-medium text-[var(--color-foreground)] mb-3">
                            {highlightMatch(
                              category.charAt(0).toUpperCase() +
                                category.slice(1),
                              searchQuery
                            )}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {templates.map((template, index) => {
                              const isUser = isUserPrompt(
                                category as TemplateCategory,
                                template.prompt
                              );
                              return (
                                <div
                                  key={index}
                                  className={`border rounded p-3 hover:bg-[var(--color-secondary)] transition-all ${
                                    matchingTemplate?.prompt === template.prompt
                                      ? "border-[var(--color-success)] border-2 shadow-sm"
                                      : "border-[var(--color-border)]"
                                  }`}
                                >
                                  <div
                                    className="cursor-pointer"
                                    onClick={() =>
                                      applyTemplate(template.prompt)
                                    }
                                  >
                                    <h4 className="font-medium text-[var(--color-foreground)] mb-1">
                                      {highlightMatch(
                                        template.title,
                                        searchQuery
                                      )}
                                    </h4>
                                    <p className="text-sm text-[var(--color-foreground)] whitespace-pre-line opacity-80">
                                      {highlightMatch(
                                        template.prompt,
                                        searchQuery
                                      )}
                                    </p>
                                  </div>
                                  {isUser && (
                                    <div className="flex justify-end mt-2 space-x-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const userPromptIndex = userPrompts[
                                            category as TemplateCategory
                                          ].findIndex(
                                            (p) => p.prompt === template.prompt
                                          );
                                          if (userPromptIndex !== -1) {
                                            handleDeletePrompt(
                                              category as TemplateCategory,
                                              userPromptIndex
                                            );
                                          }
                                        }}
                                        className="p-1 text-[var(--color-error)] hover:text-[var(--color-error)]"
                                        title="Delete prompt"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-[var(--color-foreground)]">
                  No prompts found matching your search.
                </div>
              )}
            </div>
          </div>
        )}

        <textarea
          value={selectedPrompt}
          onChange={(e) => {
            setSelectedPrompt(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Enter your prompt here..."}
          disabled={disabled}
          className="w-full p-4 focus:outline-none resize-none min-h-[150px] bg-[var(--color-background)] "
          rows={5}
        />

        <div className="flex items-center justify-end gap-4 p-3 border-t border-t-[var(--color-border)] bg-[var(--color-secondary)]">
          <button
            onClick={handleSubmit}
            disabled={isLoading || disabled || !selectedPrompt.trim()}
            className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg hover:bg-[var(--color-primary-hover)]
             focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 
             flex items-center gap-2"
            aria-label="Send Prompt"
          >
            <span>Confirm</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptWindow;
