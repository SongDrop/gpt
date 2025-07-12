import React, { useState, useEffect, useRef } from "react";
import { getMessagesBySession, getAllSessions } from "./messageDb";

interface SearchResult {
  sessionId: string;
  messageId?: string;
  content: string;
  timestamp: string;
  role: "user" | "assistant" | "system";
  matches: { start: number; end: number }[];
}

interface SearchComponentProps {
  onClose: () => void;
  onSelectResult: (sessionId: string, messageId?: string) => void;
}

export const SearchComponent: React.FC<SearchComponentProps> = ({
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null
  );
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Auto-focus the search input when component mounts
    const searchInput = document.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const searchMessages = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const sessions = await getAllSessions();
      console.log(sessions);
      const allResults: SearchResult[] = [];

      for (const session of sessions) {
        const messages = await getMessagesBySession(session.id);

        for (const message of messages) {
          const matches = findMatches(message.content, query);
          if (matches.length > 0) {
            allResults.push({
              sessionId: session.id,
              messageId: message.id,
              content: message.content,
              timestamp: message.timestamp,
              role: message.role,
              matches,
            });
          }
        }
      }

      setResults(allResults);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const findMatches = (text: string, searchQuery: string) => {
    const matches: { start: number; end: number }[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    let pos = 0;

    while ((pos = lowerText.indexOf(lowerQuery, pos)) >= 0) {
      matches.push({
        start: pos,
        end: pos + searchQuery.length,
      });
      pos += searchQuery.length;
    }

    return matches;
  };

  const highlightText = (
    text: string,
    matches: { start: number; end: number }[]
  ) => {
    if (matches.length === 0) return text;

    const highlighted: JSX.Element[] = [];
    let lastIndex = 0;

    matches.forEach((match, i) => {
      // Add text before match
      if (match.start > lastIndex) {
        highlighted.push(
          <span key={`before-${i}`}>
            {text.substring(lastIndex, match.start)}
          </span>
        );
      }

      // Add highlighted match
      highlighted.push(
        <mark key={`match-${i}`} className="bg-yellow-200">
          {text.substring(match.start, match.end)}
        </mark>
      );

      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      highlighted.push(<span key="after">{text.substring(lastIndex)}</span>);
    }

    return highlighted;
  };

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result);
    setActiveSession(result.sessionId);
    // In a real app, you would navigate to the specific message
    console.log(
      "Navigate to session:",
      result.sessionId,
      "message:",
      result.messageId
    );
    onSelectResult(result.sessionId, result.messageId);
    onClose(); // optionally close the search UI
  };

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      searchMessages();
    }, 500); // 500ms timeout (adjust as needed)
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-start justify-center p-4 z-50 pt-20 animate-fade-in">
      {/* Search Modal */}
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 animate-slide-down border border-white/20">
        {/* Gradient Header with Close Button */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 border-b border-white/10 relative overflow-hidden">
          {/* Grid Pattern - Added z-0 and pointer-events-none */}
          <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:24px_24px] z-0"></div>
          {/* Close Button - z-10 to stay above grid */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 z-50"
            aria-label="Close search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Content Container - z-10 to stay above grid */}
          <div className="relative z-10 pr-8">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Advanced Search
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search messages, sessions..."
                className="flex-1 p-3 rounded-lg border-0 focus:ring-2 focus:ring-white focus:ring-opacity-50 bg-white/90 text-gray-800 placeholder-gray-500 shadow-sm"
                onKeyDown={(e) => e.key === "Enter" && searchMessages()}
              />
              <button
                onClick={searchMessages}
                disabled={isSearching}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 shadow-md sm:w-auto w-full"
              >
                {isSearching ? (
                  <>
                    <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    Search
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Container - Responsive Improvements */}
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length > 0 ? (
            <>
              <div className="px-4 sm:px-6 py-4 border-b sticky top-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                {" "}
                {/* Stacked on mobile */}
                <h3 className="font-semibold text-gray-700 text-sm sm:text-base">
                  <span className="text-blue-600">{results.length}</span>{" "}
                  {results.length === 1 ? "result" : "results"} found
                </h3>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">
                  {new Date().toLocaleDateString()}
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {results.map((result, index) => (
                  <div
                    key={`${result.sessionId}-${result.messageId || index}`}
                    onClick={() => handleResultClick(result)}
                    className={`p-4 sm:p-5 hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                      selectedResult?.sessionId === result.sessionId &&
                      selectedResult?.messageId === result.messageId
                        ? "bg-blue-50/70 border-l-4 border-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                      {" "}
                      {/* Stacked on mobile */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            result.role === "user"
                              ? "bg-purple-100 text-purple-800"
                              : result.role === "assistant"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {result.role.charAt(0).toUpperCase() +
                            result.role.slice(1)}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          {new Date(result.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        {result.sessionId.slice(
                          0,
                          window.innerWidth < 640 ? 4 : 6
                        )}
                        ...{result.sessionId.slice(-4)}
                      </span>
                    </div>
                    <div className="message-preview text-sm sm:text-base text-gray-800 pl-2 border-l-2 border-gray-200">
                      {highlightText(result.content, result.matches)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : query && !isSearching ? (
            <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center">
              <div className="relative mb-4 sm:mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 sm:h-16 w-12 sm:w-16 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-600 mb-1">
                No matches found
              </h3>
              <p className="text-sm sm:text-base text-gray-500 max-w-xs sm:max-w-md">
                No results for <span className="font-medium">"{query}"</span>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
