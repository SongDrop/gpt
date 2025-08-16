import React, { useState, useRef } from "react";
import { MapType, TextureHistoryItem } from "./types";

interface TexturePBRMapGeneratorProps {
  processTexture: (
    file: File,
    type: "upscale" | "pbr"
  ) => Promise<TextureHistoryItem>;
  addToHistory: (item: TextureHistoryItem) => void;
}

const TexturePBRMapGenerator: React.FC<TexturePBRMapGeneratorProps> = ({
  processTexture,
  addToHistory,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [materialType, setMaterialType] = useState<string>("");
  const [outputFormat, setOutputFormat] = useState<string>("tga");
  const [selectedMap, setSelectedMap] = useState<string>("normal");
  const [mapIntensity, setMapIntensity] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapTypes: MapType[] = [
    {
      name: "Diffuse/Albedo",
      description:
        "Defines the base color and appearance of an object's surface.",
      key: "diffuse",
      icon: "texture",
    },
    {
      name: "Normal/Bump/Height",
      description:
        "Simulates small surface details like wrinkles and scratches.",
      key: "normal",
      icon: "terrain",
    },
    {
      name: "Displacement",
      description:
        "Modifies the actual geometry by displacing vertices based on grayscale values.",
      key: "displacement",
      icon: "height",
    },
    {
      name: "Ambient Occlusion",
      description: "Simulates soft shadows and light occlusion in crevices.",
      key: "ao",
      icon: "contrast",
    },
    {
      name: "Roughness",
      description:
        "Controls the roughness or smoothness of a material's surface.",
      key: "roughness",
      icon: "brightness_low",
    },
    {
      name: "Specular",
      description: "Determines how shiny or reflective a surface is.",
      key: "specular",
      icon: "brightness_high",
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleGenerateMaps = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await processTexture(file, "pbr");
      addToHistory(result);
      alert(`PBR maps generated successfully!`);
    } catch (error) {
      console.error("Error generating PBR maps:", error);
      alert("Failed to generate PBR maps");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-xl shadow-sm p-6 mb-8 border border-[var(--color-border)]"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <h2
        className="text-xl font-semibold mb-6"
        style={{ color: "var(--color-foreground)" }}
      >
        PBR Map Generator
      </h2>
      <p
        className="mb-6 opacity-80"
        style={{ color: "var(--color-foreground)" }}
      >
        Generate Physically-Based Rendering maps from your source textures for
        realistic game materials.
      </p>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/3">
          <div
            className={`drop-zone rounded-lg p-8 text-center cursor-pointer transition-colors ${
              !previewUrl
                ? "border-dashed hover:border-primary"
                : "border-primary"
            }`}
            onClick={triggerFileInput}
            style={{
              border: !previewUrl
                ? "2px dashed var(--color-border)"
                : "1px solid var(--color-primary)",
              backgroundColor: "var(--color-secondary)",
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />

            {!previewUrl ? (
              <>
                <span
                  className="material-icons text-4xl mb-3"
                  style={{ color: "var(--color-border)" }}
                >
                  cloud_upload
                </span>
                <p
                  className="font-medium"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Drag & drop an image file here
                </p>
                <p
                  className="text-sm mt-2 opacity-80"
                  style={{ color: "var(--color-foreground)" }}
                >
                  or click to browse files
                </p>
                <p
                  className="text-xs mt-4 opacity-70"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Supports JPG, PNG, TGA (Max 10MB)
                </p>
              </>
            ) : (
              <div className="source-preview">
                <img
                  src={previewUrl}
                  alt="Source preview"
                  className="max-w-full max-h-48 mx-auto rounded-md"
                />
                <div className="source-info mt-3">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    {file?.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--color-foreground)" }}
            >
              Material Type
            </label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value)}
              className="w-full rounded-md px-3 py-2"
              style={{
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            >
              <option value="">Select material type</option>
              <option value="wood">Wood</option>
              <option value="metal">Metal</option>
              <option value="fabric">Fabric</option>
              <option value="stone">Stone</option>
              <option value="concrete">Concrete</option>
              <option value="brick">Brick</option>
              <option value="ground">Ground/Terrain</option>
            </select>
          </div>

          <div className="mt-6">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--color-foreground)" }}
            >
              Output Format
            </label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full rounded-md px-3 py-2"
              style={{
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-foreground)",
              }}
            >
              <option value="tga">TGA (Recommended)</option>
              <option value="png">PNG (Lossless)</option>
              <option value="dds">DDS (Compressed)</option>
            </select>
          </div>

          <button
            className={`w-full mt-6 px-4 py-3 text-white rounded-md transition flex items-center justify-center ${
              !file || loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
            style={{
              backgroundColor:
                file && !loading
                  ? "var(--color-primary)"
                  : "var(--color-secondary)",
              color: file && !loading ? "white" : "gray",
            }}
            onClick={handleGenerateMaps}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <span>Generating...</span>
                <span className="ml-2 animate-spin">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: "var(--color-background)" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </span>
              </>
            ) : (
              "Generate PBR Maps"
            )}
          </button>
        </div>

        <div className="w-full lg:w-2/3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mapTypes.map((map) => (
              <div
                key={map.key}
                className={`map-type p-4 rounded-lg cursor-pointer transition-transform ${
                  selectedMap === map.key
                    ? "border-primary"
                    : "border-gray-200 hover:shadow-md"
                }`}
                onClick={() => setSelectedMap(map.key)}
                style={{
                  border:
                    selectedMap === map.key
                      ? "1px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                  backgroundColor:
                    selectedMap === map.key
                      ? "var(--color-secondary)"
                      : "var(--color-background)",
                  transform:
                    selectedMap === map.key ? "translateY(-2px)" : "none",
                }}
              >
                <div className="flex items-center mb-3">
                  <div
                    className={`w-10 h-10 rounded-md flex items-center justify-center mr-3`}
                    style={{
                      backgroundColor:
                        selectedMap === map.key
                          ? "var(--color-primary)"
                          : "var(--color-secondary)",
                      color:
                        selectedMap === map.key
                          ? "var(--color-background)"
                          : "var(--color-foreground)",
                    }}
                  >
                    <span className="material-icons">{map.icon}</span>
                  </div>
                  <h3
                    className="font-medium"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    {map.name}
                  </h3>
                </div>
                <p
                  className="text-sm mb-4 opacity-80"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {map.description}
                </p>
                <div
                  className="border-2 border-dashed rounded-xl w-full h-32 flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <span
                    className="text-sm opacity-70"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Preview
                  </span>
                </div>
              </div>
            ))}
          </div>

          {selectedMap && (
            <div
              className="mt-6 p-4 rounded-lg"
              style={{
                backgroundColor: "var(--color-secondary)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h4
                className="font-medium mb-3"
                style={{ color: "var(--color-foreground)" }}
              >
                {mapTypes.find((m) => m.key === selectedMap)?.name} Map Settings
              </h4>

              <div className="intensity-control">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Intensity: {mapIntensity}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={mapIntensity}
                  onChange={(e) => setMapIntensity(parseInt(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: "var(--color-primary)",
                  }}
                />
              </div>

              <div className="mt-4">
                <p
                  className="text-sm opacity-80"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Adjust the intensity to control how pronounced the effect will
                  be in your material.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TexturePBRMapGenerator;
