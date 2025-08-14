// Textures.tsx
import React, { useState, useRef, useEffect } from "react";
import TextureUpscaler from "./components/TextureUpscaler";
import TexturePBRMapGenerator from "./components/TexturePBRMapGenerator";
import TextureComparison from "./components/TextureComparison";
import TextureHistorySection from "./components/TextureHistorySection";
import { TextureHistoryItem } from "./components/types";

function TextureDeveloper() {
  const [activeTab, setActiveTab] = useState<
    "upscaler" | "comparison" | "maps"
  >("upscaler");
  const [history, setHistory] = useState<TextureHistoryItem[]>([]);
  const [user, setUser] = useState({ name: "Game Developer", role: "Modder" });

  // Simulated texture processing
  const processTexture = (file: File, type: "upscale" | "pbr") => {
    return new Promise<TextureHistoryItem>((resolve) => {
      setTimeout(() => {
        const newItem: TextureHistoryItem = {
          id: Date.now().toString(),
          name: `${file.name.replace(/\.[^/.]+$/, "")}_${
            type === "upscale" ? "upscaled" : "pbr"
          }`,
          resolution: "2048x2048",
          format: type === "upscale" ? "TGA" : "PNG",
          type,
          timestamp: new Date().toISOString(),
          originalName: file.name,
        };
        resolve(newItem);
      }, 2000);
    });
  };

  const addToHistory = (item: TextureHistoryItem) => {
    setHistory((prev) => [item, ...prev.slice(0, 5)]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Game Texture Tool Suite
            </h1>
            <p className="text-gray-600 mt-2">
              Create, upscale, and compare game textures with AI-powered tools
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center">
            <div className="bg-gray-100 rounded-lg p-2 flex items-center">
              <span className="material-icons text-primary mr-2">
                account_circle
              </span>
              <span className="text-gray-700">{user.name}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              className={`tab-button py-4 px-6 font-medium ${
                activeTab === "upscaler" ? "active" : "text-gray-600"
              }`}
              onClick={() => setActiveTab("upscaler")}
            >
              Texture Upscaler
            </button>
            <button
              className={`tab-button py-4 px-6 font-medium ${
                activeTab === "comparison" ? "active" : "text-gray-600"
              }`}
              onClick={() => setActiveTab("comparison")}
            >
              Texture Comparison
            </button>
            <button
              className={`tab-button py-4 px-6 font-medium ${
                activeTab === "maps" ? "active" : "text-gray-600"
              }`}
              onClick={() => setActiveTab("maps")}
            >
              PBR Map Generator
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "upscaler" && (
            <TextureUpscaler
              processTexture={processTexture}
              addToHistory={addToHistory}
            />
          )}

          {activeTab === "maps" && (
            <TexturePBRMapGenerator
              processTexture={processTexture}
              addToHistory={addToHistory}
            />
          )}

          {activeTab === "comparison" && <TextureComparison />}
        </div>

        {/* History Section */}
        <TextureHistorySection
          history={history}
          clearHistory={() => setHistory([])}
        />
      </div>
    </div>
  );
}

export default TextureDeveloper;
