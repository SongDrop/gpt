// components/HistorySection.tsx
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
          <span className="material-icons text-green-600 mr-1 text-sm">
            image
          </span>
        );
      case "PNG":
        return (
          <span className="material-icons text-blue-600 mr-1 text-sm">
            collections
          </span>
        );
      case "DDS":
        return (
          <span className="material-icons text-purple-600 mr-1 text-sm">
            texture
          </span>
        );
      case "JPG":
        return (
          <span className="material-icons text-yellow-600 mr-1 text-sm">
            photo
          </span>
        );
      default:
        return (
          <span className="material-icons mr-1 text-sm">insert_drive_file</span>
        );
    }
  };

  const typeBadge = (type: string) => {
    if (type === "upscale") {
      return (
        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
          Upscaled
        </span>
      );
    }
    return (
      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
        PBR Map
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Recent Textures</h2>
        {history.length > 0 && (
          <button
            className="text-sm text-primary hover:text-secondary font-medium"
            onClick={clearHistory}
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-10">
          <span className="material-icons text-gray-300 text-6xl">
            folder_open
          </span>
          <p className="text-gray-500 mt-4">No processed textures yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Your processed textures will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {history.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="bg-gray-200 h-32 flex items-center justify-center">
                <span className="material-icons text-gray-400 text-4xl">
                  {item.type === "upscale" ? "zoom_in" : "texture"}
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm font-medium truncate">{item.name}</div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    {item.resolution}
                  </span>
                  <div className="flex items-center">
                    {formatIcon(item.format)}
                    <span className="text-xs">{item.format}</span>
                  </div>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-xs text-gray-500">
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
