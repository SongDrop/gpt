import React, { useState, useEffect, KeyboardEvent, ChangeEvent } from "react";
import useLocalStorage from "./useLocalStorage";

interface DatabaseCreateProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    description?: string;
    tags?: string[];
    contributorName?: string;
  }) => Promise<void>;
}

const GITHUB_USERNAME_REGEX = /^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/;

const DatabaseCreate: React.FC<DatabaseCreateProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contributorName, setContributor] = useLocalStorage<string>(
    "contributor",
    ""
  );
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState(true);

  // Reset form when opened (except contributorName stays persisted)
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setTags([]);
      setTagInput("");
      setFormError(null);
      setIsSubmitting(false);
      // contributorName persists in localStorage - do not reset here
    }
  }, [open]);

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim();
    if (
      normalizedTag &&
      !tags.includes(normalizedTag) &&
      !normalizedTag.includes(" ")
    ) {
      setTags([...tags, normalizedTag]);
    }
  };

  const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (tagInput.trim() !== "") {
        addTag(tagInput);
        setTagInput("");
      }
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      e.preventDefault();
      removeTag(tags.length - 1);
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const onContributorNameChange = (value: string) => {
    setContributor(value);
    setIsUsernameValid(value === "" || GITHUB_USERNAME_REGEX.test(value));
  };

  const githubAvatarUrl =
    isUsernameValid && contributorName
      ? `https://github.com/${contributorName}.png`
      : null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!contributorName.trim()) {
      setFormError("Contributor GitHub username is required");
      return;
    }
    if (!isUsernameValid) {
      setFormError("Contributor GitHub username is invalid");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        tags,
        contributorName: contributorName.trim(),
      });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create database"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50"
      style={{ zIndex: 1000 }}
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Create New Database</h2>
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="new-db-title"
              className="block text-sm font-medium text-gray-700"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="new-db-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter database title"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Give your database a unique and descriptive name. This will help
              others identify its content and purpose.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              A RAG (Retrieval-Augmented Generation) database helps the language
              model perform more accurate and context-aware searches on your
              uploaded documents and topics. Think of it as a specialized
              knowledge base for your AI assistant.
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="new-db-description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="new-db-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a description (optional)"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Contributor GitHub Username */}
          <div>
            <label
              htmlFor="contributor-name"
              className="block text-sm font-medium text-gray-700"
            >
              Contributor GitHub Username{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center space-x-3 mt-1">
              <input
                id="contributor-name"
                type="text"
                value={contributorName}
                onChange={(e) => onContributorNameChange(e.target.value.trim())}
                className={`flex-grow border rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isUsernameValid ? "border-gray-300" : "border-red-500"
                }`}
                placeholder="GitHub username"
                disabled={isSubmitting}
              />
              {githubAvatarUrl && (
                <a
                  href={`https://github.com/${contributorName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-10 h-10 rounded-full overflow-hidden border border-gray-300"
                  title={`View GitHub profile: ${contributorName}`}
                >
                  <img
                    src={githubAvatarUrl}
                    alt={`${contributorName}'s GitHub avatar`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                </a>
              )}
            </div>
            {!isUsernameValid && (
              <p className="mt-1 text-xs text-red-600">
                Invalid GitHub username. Only alphanumeric characters and
                hyphens are allowed. Cannot start or end with a hyphen.
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topics (separate with spaces)
            </label>
            <div
              className="flex flex-wrap items-center min-h-[40px] border border-gray-300 rounded-md px-2 py-1 focus-within:ring-2 focus-within:ring-blue-500"
              onClick={() => {
                const input = document.getElementById("tag-input");
                input?.focus();
              }}
            >
              {tags.map((tag, idx) => (
                <div
                  key={idx}
                  className="flex items-center bg-gray-200 text-gray-800 text-sm rounded-full px-2 py-1 mr-1 mb-1"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(idx)}
                    className="ml-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={`Remove tag ${tag}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setTagInput(e.target.value)
                }
                onKeyDown={handleTagInputKeyDown}
                disabled={isSubmitting}
                className="flex-grow min-w-[50px] py-1 px-1 border-none outline-none"
                placeholder="Add topics"
              />
            </div>
          </div>

          {formError && <p className="text-red-600 text-sm">{formError}</p>}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseCreate;
