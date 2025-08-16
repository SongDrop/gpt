import React, { useState, useRef, useEffect } from "react";
import TextureUpscaler from "./components/TextureUpscaler";
import TexturePBRMapGenerator from "./components/TexturePBRMapGenerator";
import TextureComparison from "./components/TextureComparison";
import TextureHistorySection from "./components/TextureHistorySection";
import { TextureHistoryItem } from "./components/types";

function DeveloperTexture() {
  const [activeTab, setActiveTab] = useState<
    "upscaler" | "comparison" | "maps"
  >("upscaler");
  const [history, setHistory] = useState<TextureHistoryItem[]>([]);
  const [user, setUser] = useState({ name: "gpt-image-1", role: "Modder" });

  useEffect(() => {
    document.title = "AI Texture Assistant";
  }, []);

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
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1
              className="text-3xl font-bold flex items-center gap-2"
              style={{ color: "var(--color-foreground)" }}
            >
              <a
                href="/"
                className="cursor-pointer transition-transform active:scale-95 rounded-md p-1 flex-shrink-0 inline-flex"
                style={{
                  width: "40px",
                  height: "40px",
                  position: "relative",
                  backgroundColor: "var(--color-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 32,
                    height: 32,
                    transform: "translate(-50%, -50%)",
                    WebkitMaskSize: "cover",
                    maskSize: "cover",
                    WebkitMaskImage: 'url("./gitgptlogo.svg")',
                    maskImage: 'url("./gitgptlogo.svg")',
                    backgroundColor: "var(--color-foreground)",
                  }}
                />
              </a>
              Game Texture Tool Suite
            </h1>
            <p
              className="mt-2 opacity-80"
              style={{ color: "var(--color-foreground)" }}
            >
              Create, upscale, and compare game textures with AI-powered tools
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center">
            <div
              className="rounded-lg p-2 flex items-center"
              style={{
                backgroundColor: "var(--color-secondary)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span
                className="material-icons mr-2"
                style={{ color: "var(--color-primary)" }}
              >
                photo
              </span>
              <span style={{ color: "var(--color-foreground)" }}>
                {user.name}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="rounded-xl shadow-sm mb-6"
          style={{
            backgroundColor: "var(--color-background)",
          }}
        >
          <div
            className="flex"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <button
              className={`tab-button py-4 px-6 font-medium relative ${
                activeTab === "upscaler" ? "active" : "opacity-80"
              }`}
              onClick={() => setActiveTab("upscaler")}
              style={{ color: "var(--color-foreground)" }}
            >
              Texture Upscaler
              {activeTab === "upscaler" && (
                <div
                  className="absolute bottom-0 left-0 w-full h-1"
                  style={{ backgroundColor: "var(--color-primary)" }}
                ></div>
              )}
            </button>
            <button
              className={`tab-button py-4 px-6 font-medium relative ${
                activeTab === "comparison" ? "active" : "opacity-80"
              }`}
              onClick={() => setActiveTab("comparison")}
              style={{ color: "var(--color-foreground)" }}
            >
              Texture Comparison
              {activeTab === "comparison" && (
                <div
                  className="absolute bottom-0 left-0 w-full h-1"
                  style={{ backgroundColor: "var(--color-primary)" }}
                ></div>
              )}
            </button>
            <button
              className={`tab-button py-4 px-6 font-medium relative ${
                activeTab === "maps" ? "active" : "opacity-80"
              }`}
              onClick={() => setActiveTab("maps")}
              style={{ color: "var(--color-foreground)" }}
            >
              PBR Map Generator
              {activeTab === "maps" && (
                <div
                  className="absolute bottom-0 left-0 w-full h-1"
                  style={{ backgroundColor: "var(--color-primary)" }}
                ></div>
              )}
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

export default DeveloperTexture;
