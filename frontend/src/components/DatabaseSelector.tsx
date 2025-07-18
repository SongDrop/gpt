import React, { useState, useEffect, ForwardedRef } from "react";
import {
  RagDatabase,
  DatabaseType,
  Contributor,
  DatabaseFilterOptions,
} from "./types";
import { Database } from "lucide-react";
//
const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/ProjectIGIRemakeTeam/prompt-templates/main/gpt-rag-db.json";

interface DatabaseSelectorProps {
  databases: RagDatabase[];
  currentUser: Contributor;
  onSelectionChange: (selectedDatabases: RagDatabase[]) => void;
  onClose: () => void;
  onCreateNew: () => void;
  onUploadFiles: (databaseId: string, files: File[]) => Promise<void>;
  className?: string;
}

const DatabaseSelector = React.forwardRef<
  HTMLDivElement,
  DatabaseSelectorProps
>(
  (
    {
      databases: initialDatabases,
      currentUser,
      onSelectionChange,
      onClose,
      onCreateNew,
      onUploadFiles,
      className,
    },
    ref: ForwardedRef<HTMLDivElement>
  ) => {
    const [databases, setDatabases] = useState<RagDatabase[]>(initialDatabases);
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState<DatabaseFilterOptions>({
      searchQuery: "",
      typeFilter: "all",
      ownershipFilter: "all",
      sortBy: "lastUpdated",
      sortDirection: "desc",
    });
    const [selectedDatabaseForUpload, setSelectedDatabaseForUpload] = useState<
      string | null
    >(null);
    const [uploadProgress, setUploadProgress] = useState<
      Record<string, number>
    >({});
    const [dragActive, setDragActive] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
      setDatabases(initialDatabases);
    }, [initialDatabases]);

    useEffect(() => {
      async function fetchRemoteDatabases() {
        try {
          const response = await fetch(GITHUB_RAW_URL);
          if (!response.ok)
            throw new Error("Failed to fetch databases from GitHub");
          const remoteDbs: RagDatabase[] = await response.json();

          // Merge remote with current selections (from initialDatabases or current state)
          const mergedMap = new Map<string, RagDatabase>();
          remoteDbs.forEach((db) => mergedMap.set(db.id, db));

          const mergedList = Array.from(mergedMap.values()).map((db) => {
            const existing = databases.find((d) => d.id === db.id);
            return existing
              ? { ...db, isSelected: existing.isSelected }
              : { ...db, isSelected: false };
          });

          setDatabases(mergedList);
          setFetchError(null);
        } catch (error) {
          setFetchError((error as Error).message);
        }
      }

      fetchRemoteDatabases();
    }, []);

    const toggleDatabaseSelection = (id: string) => {
      const updatedDatabases = databases.map((db) => ({
        ...db,
        isSelected: db.id === id,
      }));

      setDatabases(updatedDatabases);
      onSelectionChange(updatedDatabases.filter((db) => db.isSelected));
    };

    const handleFileUpload = async (databaseId: string, files: File[]) => {
      const uploads: Record<string, number> = {};
      files.forEach((file) => {
        uploads[file.name] = 0;
      });
      setUploadProgress(uploads);

      try {
        await onUploadFiles(databaseId, files);
        // Refresh database list or update specific database
        setSelectedDatabaseForUpload(null);
        setUploadProgress({});
      } catch (error) {
        console.error("Upload failed:", error);
      }
    };

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      } else if (e.type === "dragleave") {
        setDragActive(false);
      }
    };

    const handleDrop = (e: React.DragEvent, databaseId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(databaseId, Array.from(e.dataTransfer.files));
      }
    };

    const filteredDatabases = databases
      .filter((db) => {
        const matchesSearch =
          db.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          db.description
            .toLowerCase()
            .includes(filters.searchQuery.toLowerCase()) ||
          db.tags.some((tag) =>
            tag.toLowerCase().includes(filters.searchQuery.toLowerCase())
          );

        const matchesType =
          filters.typeFilter === "all" || db.type === filters.typeFilter;

        const matchesOwnership =
          filters.ownershipFilter === "all" ||
          (filters.ownershipFilter === "mine" &&
            db.owner.id === currentUser.id) ||
          (filters.ownershipFilter === "community" && db.isPublic);

        return matchesSearch && matchesType && matchesOwnership;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "documentCount":
            comparison = a.documentCount - b.documentCount;
            break;
          case "usageCount":
            comparison = a.usageCount - b.usageCount;
            break;
          case "lastUpdated":
          default:
            comparison =
              new Date(a.lastUpdated).getTime() -
              new Date(b.lastUpdated).getTime();
            break;
        }
        return filters.sortDirection === "asc" ? comparison : -comparison;
      });

    const getTypeIcon = (type: DatabaseType) => {
      const baseClass = "w-5 h-5";
      switch (type) {
        case "Azure Cognitive Search":
          return (
            <svg
              className={`${baseClass} text-blue-500`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          );
        case "Azure Cosmos DB":
          return (
            <svg
              className={`${baseClass} text-purple-500`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
          );
        case "Azure Blob Storage":
          return (
            <svg
              className={`${baseClass} text-green-500`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          );
        case "Community Shared":
          return (
            <svg
              className={`${baseClass} text-yellow-500`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          );
        default:
          return null;
      }
    };

    const renderDatabaseItem = (database: RagDatabase) => (
      <div
        key={database.id}
        className={`p-4 border border-[var(--color-border)] rounded-lg mb-3 hover:shadow-md transition-shadow ${
          database.isSelected
            ? "bg-[var(--color-background)] border-[var(--color-primary)]"
            : "bg-[var(--color-secondary)]"
        }`}
      >
        <div className="flex items-start">
          <input
            type="checkbox"
            checked={database.isSelected}
            onChange={() => toggleDatabaseSelection(database.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 text-[var(--color-primary)] bg-[var(--color-background)] rounded focus:ring-blue-500 mr-3 mt-1 cursor-pointer"
          />
          <div className="flex-grow min-w-0">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold text-[var(--color-foreground)] ">
                    {database.name}
                  </h3>
                  {database.isPublic && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                      Community
                    </span>
                  )}
                  {database.owner.id === currentUser.id && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Owner
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-foreground)] mt-1">
                  {database.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {database.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 text-xs text-[var(--color-foreground)] rounded-full ${
                        database.isSelected
                          ? "bg-[var(--color-secondary)]"
                          : "bg-[var(--color-background)]"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-[var(--color-foreground)]">
                  {database.documentCount.toLocaleString()} docs
                </span>
                <div className="flex -space-x-2">
                  {database.contributors.slice(0, 3).map((contributor) => (
                    <div
                      key={contributor.id}
                      className="w-8 h-8 rounded-full bg-[var(--color-background)] border-2 border-[var(--color-border)] flex items-center justify-center text-sm font-medium text-[var(--color-foreground)]"
                      title={contributor.name}
                    >
                      {contributor.avatar ? (
                        <img
                          src={contributor.avatar}
                          alt={contributor.name}
                          className="w-full h-full rounded-full"
                        />
                      ) : (
                        contributor.name.charAt(0).toUpperCase()
                      )}
                    </div>
                  ))}
                  {database.contributors.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-background)] border-2 border-white flex items-center justify-center text-xs font-medium text-[var(--color-foreground)]">
                      +{database.contributors.length - 3}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  {getTypeIcon(database.type)}
                  <span className="ml-1 text-sm text-[var(--color-foreground)]">
                    {database.type}
                  </span>
                </div>
                <span className="text-sm text-[var(--color-foreground)]">
                  Updated {new Date(database.lastUpdated).toLocaleDateString()}
                </span>
                {database.usageCount > 0 && (
                  <span className="text-sm text-[var(--color-foreground)]">
                    {database.usageCount.toLocaleString()} uses
                  </span>
                )}
                {database.rating && (
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="ml-1 text-sm text-[var(--color-foreground)]">
                      {database.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDatabaseForUpload(database.id);
                }}
                className="px-3 py-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white text-sm rounded-md "
              >
                Add Files
              </button>
            </div>

            {selectedDatabaseForUpload === database.id && (
              <div
                className={`mt-3 p-4 border-2 border-dashed rounded-lg ${
                  dragActive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                    : "border-[var(--color-border)]"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={(e) => handleDrop(e, database.id)}
              >
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-bg-[var(--color-foreground)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <div className="mt-1 flex text-sm text-[var(--color-foreground)]">
                    <label
                      htmlFor={`file-upload-${database.id}`}
                      className="relative cursor-pointer bg-white pl-1 pr-1 rounded-md font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)] focus-within:outline-none"
                    >
                      <span>Upload files</span>
                      <input
                        id={`file-upload-${database.id}`}
                        name="file-upload"
                        type="file"
                        className="sr-only bg-[var(--color-background)]"
                        multiple
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileUpload(
                              database.id,
                              Array.from(e.target.files)
                            );
                          }
                        }}
                      />
                    </label>
                    <p className="pl-1 text-[var(--color-secondary)">
                      or drag and drop
                    </p>
                  </div>
                  <p className="text-xs text-[var(--color-secondary)">
                    PDF, DOCX, TXT up to 10MB
                  </p>
                </div>

                {Object.keys(uploadProgress).length > 0 && (
                  <div className="mt-4 space-y-2">
                    {Object.entries(uploadProgress).map(
                      ([filename, progress]) => (
                        <div key={filename} className="mb-1">
                          <div className="flex justify-between text-xs text-[var(--color-secondary)] mb-1">
                            <span>{filename}</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {database.files && database.files.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <h4 className="text-sm font-medium text-[var(--color-foreground)] mb-2">
                  Files
                </h4>
                <div className="space-y-2">
                  {database.files.map((file) => (
                    <div
                      key={file.name}
                      className="flex justify-between items-center text-sm text-[var(--color-foreground)]"
                    >
                      <div className="flex items-center truncate text-[var(--color-foreground)]">
                        <svg
                          className="flex-shrink-0 h-4 w-4  mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="truncate">{file.name}</span>
                      </div>
                      <span className="text-[var(--color-foreground)]">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    const handleOpen = (is_Open: boolean) => {
      setIsOpen(is_Open);
    };

    // In your DatabaseSelector component
    useEffect(() => {
      if (!isOpen) return;

      const scrollToBottom = () => {
        if (ref && "current" in ref && ref.current) {
          const container = ref.current;
          const height = container.scrollHeight - 100;

          container.scrollTo({
            top: height,
            behavior: "smooth",
          });
        }
      };

      const timeoutId = setTimeout(scrollToBottom, 100);

      return () => clearTimeout(timeoutId);
    }, [isOpen, filteredDatabases]);

    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => handleOpen(!isOpen)}
          className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-4 py-3 mb-1 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-[var(--color-secondary)] transition-colors"
        >
          <span className="inline-flex items-center space-x-1 truncate max-w-full ">
            <Database className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {databases.filter((db) => db.isSelected).length > 0
                ? databases
                    .filter((db) => db.isSelected)
                    .map((db) => db.name)
                    .join(", ")
                : "Select RAG databases"}
            </span>
          </span>
          <svg
            className={`w-5 h-5 text-[var(--color-foreground)] transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full bg-[var(--color-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)]">
              <div className="relative mb-4 text-[var(--color-foreground)]">
                <input
                  type="text"
                  placeholder="Search databases..."
                  className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] bg-[var(--color-background)]  hover:bg-[var(--color-secondary)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filters.searchQuery}
                  onChange={(e) =>
                    setFilters({ ...filters, searchQuery: e.target.value })
                  }
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-[var(--color-foreground)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <select
                  className="px-3 py-1 border border-[var(--color-border)]  bg-[var(--color-background)] hover:bg-[var(--color-secondary)] cursor-pointer rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filters.typeFilter}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      typeFilter: e.target.value as DatabaseType | "all",
                    })
                  }
                >
                  <option value="all">All Types</option>
                  <option value="Azure Cognitive Search">
                    Cognitive Search
                  </option>
                  <option value="Azure Cosmos DB">Cosmos DB</option>
                  <option value="Azure Blob Storage">Blob Storage</option>
                  <option value="Community Shared">Community</option>
                </select>

                <select
                  className="px-3 py-1 border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-secondary)] cursor-pointer rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filters.ownershipFilter}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      ownershipFilter: e.target.value as
                        | "all"
                        | "mine"
                        | "community",
                    })
                  }
                >
                  <option value="all">All Databases</option>
                  <option value="mine">My Databases</option>
                  <option value="community">Community</option>
                </select>

                <select
                  className="px-3 py-1 border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-secondary)] cursor-pointer rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      sortBy: e.target.value as
                        | "lastUpdated"
                        | "name"
                        | "documentCount"
                        | "usageCount",
                    })
                  }
                >
                  <option value="lastUpdated">Sort by Last Updated</option>
                  <option value="name">Sort by Name</option>
                  <option value="documentCount">Sort by Document Count</option>
                  <option value="usageCount">Sort by Usage</option>
                </select>

                <button
                  onClick={() =>
                    setFilters({
                      ...filters,
                      sortDirection:
                        filters.sortDirection === "asc" ? "desc" : "asc",
                    })
                  }
                  className="px-3 py-1 border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-secondary)] rounded-md text-sm flex items-center"
                >
                  {filters.sortDirection === "asc" ? (
                    <>
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                        />
                      </svg>
                      Asc
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                        />
                      </svg>
                      Desc
                    </>
                  )}
                </button>

                <button
                  onClick={onCreateNew}
                  className="ml-auto px-3 py-1 bg-[var(--color-success)] hover:bg-[var(--color-success)] text-white text-sm rounded-md  flex items-center"
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  New Database
                </button>
              </div>
            </div>

            <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-4">
              {filteredDatabases.length > 0 ? (
                filteredDatabases.map(renderDatabaseItem)
              ) : (
                <div className="text-center py-8">
                  <svg
                    className="mx-auto h-12 w-12 text-[var(--color-foreground)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-[var(--color-foreground)] opacity-80">
                    No databases found
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-foreground)] opacity-80">
                    {filters.searchQuery
                      ? "Try adjusting your search or filters"
                      : "Create a new database to get started"}
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={onCreateNew}
                      className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-md hover:bg-[var(--color-primary)]"
                    >
                      Create New Database
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--color-border)]  bg-[var(--color-secondary)] flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {databases.filter((db) => db.isSelected).length} selected •{" "}
                {filteredDatabases.length} shown
              </span>
              <div className="space-x-3">
                <button
                  onClick={() => {
                    const updatedDatabases = databases.map((db) => ({
                      ...db,
                      isSelected: false,
                    }));
                    setDatabases(updatedDatabases);
                    onSelectionChange([]);
                  }}
                  className="px-4 py-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-md hover:-[var(--color-primary)]"
                >
                  Confirm Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default DatabaseSelector;
