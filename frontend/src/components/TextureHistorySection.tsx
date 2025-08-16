import React from "react";
import { TextureHistoryItem } from "./types";

interface TextureHistorySectionProps {
  history: TextureHistoryItem[];
  clearHistory: () => void;
}

const TextureHistorySection: React.FC<TextureHistorySectionProps> = ({
  history,
  clearHistory,
}) => {
  const formatIcon = (format: string) => {
    switch (format) {
      case "TGA":
        return (
          <span
            className="material-icons mr-1 text-sm"
            style={{ color: "var(--color-success)" }}
          >
            image
          </span>
        );
      case "PNG":
        return (
          <span
            className="material-icons mr-1 text-sm"
            style={{ color: "var(--color-primary)" }}
          >
            collections
          </span>
        );
      case "DDS":
        return (
          <span
            className="material-icons mr-1 text-sm"
            style={{ color: "var(--color-primary)" }}
          >
            texture
          </span>
        );
      case "JPG":
        return (
          <span
            className="material-icons mr-1 text-sm"
            style={{ color: "var(--color-primary)" }}
          >
            photo
          </span>
        );
      default:
        return (
          <span
            className="material-icons mr-1 text-sm"
            style={{ color: "var(--color-foreground)", opacity: 0.7 }}
          >
            insert_drive_file
          </span>
        );
    }
  };

  const typeBadge = (type: string) => {
    if (type === "upscale") {
      return (
        <span
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: "var(--color-success)",
            color: "var(--color-background)",
          }}
        >
          Upscaled
        </span>
      );
    }
    return (
      <span
        className="text-xs px-2 py-1 rounded"
        style={{
          backgroundColor: "var(--color-primary)",
          color: "var(--color-background)",
        }}
      >
        PBR Map
      </span>
    );
  };

  return (
    <div
      className="rounded-xl shadow-sm p-6 mt-8 border border-[var(--color-border)]"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="flex justify-between items-center mb-6">
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--color-foreground)" }}
        >
          Recent Textures
        </h2>
        {history.length > 0 && (
          <button
            className="text-sm font-medium"
            onClick={clearHistory}
            style={{
              color: "var(--color-primary)",
              cursor: "pointer",
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-10">
          <span
            className="material-icons text-6xl"
            style={{ color: "var(--color-border)", opacity: 0.5 }}
          >
            folder_open
          </span>
          <p
            className="mt-4 opacity-80"
            style={{ color: "var(--color-foreground)" }}
          >
            No processed textures yet
          </p>
          <p
            className="text-sm mt-2 opacity-70"
            style={{ color: "var(--color-foreground)" }}
          >
            Your processed textures will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {history.map((item) => (
            <div
              key={item.id}
              className="rounded-lg overflow-hidden transition-shadow"
              style={{
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                cursor: "pointer",
              }}
            >
              <div
                className="h-32 flex items-center justify-center"
                style={{ backgroundColor: "var(--color-secondary)" }}
              >
                <span
                  className="material-icons text-4xl"
                  style={{
                    color: "var(--color-foreground)",
                    opacity: 0.5,
                  }}
                >
                  {item.type === "upscale" ? "zoom_in" : "texture"}
                </span>
              </div>
              <div className="p-3">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {item.name}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span
                    className="text-xs opacity-80"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    {item.resolution}
                  </span>
                  <div className="flex items-center">
                    {formatIcon(item.format)}
                    <span
                      className="text-xs opacity-80"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      {item.format}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex justify-between">
                  <span
                    className="text-xs opacity-70"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                  {typeBadge(item.type)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TextureHistorySection;
