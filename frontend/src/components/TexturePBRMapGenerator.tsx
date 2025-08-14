// components/PBRMapGenerator.tsx
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
    <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
      <h2 className="text-xl font-semibold mb-6">PBR Map Generator</h2>
      <p className="text-gray-600 mb-6">
        Generate Physically-Based Rendering maps from your source textures for
        realistic game materials.
      </p>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/3">
          <div
            className={`drop-zone border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              !previewUrl
                ? "border-gray-300 hover:border-primary"
                : "border-primary"
            }`}
            onClick={triggerFileInput}
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
                <span className="material-icons text-4xl text-gray-400 mb-3">
                  cloud_upload
                </span>
                <p className="font-medium text-gray-700">
                  Drag & drop an image file here
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  or click to browse files
                </p>
                <p className="text-xs text-gray-400 mt-4">
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
                  <p className="text-sm font-medium truncate">{file?.name}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Material Type
            </label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output Format
            </label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="tga">TGA (Recommended)</option>
              <option value="png">PNG (Lossless)</option>
              <option value="dds">DDS (Compressed)</option>
            </select>
          </div>

          <button
            className={`w-full mt-6 px-4 py-3 text-white rounded-md transition flex items-center justify-center ${
              file && !loading
                ? "bg-primary hover:bg-secondary"
                : "bg-gray-400 cursor-not-allowed"
            }`}
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
                className={`map-type p-4 border rounded-lg cursor-pointer transition-transform ${
                  selectedMap === map.key
                    ? "border-primary bg-blue-50"
                    : "border-gray-200 hover:shadow-md"
                }`}
                onClick={() => setSelectedMap(map.key)}
              >
                <div className="flex items-center mb-3">
                  <div
                    className={`w-10 h-10 rounded-md flex items-center justify-center mr-3 ${
                      selectedMap === map.key
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <span className="material-icons">{map.icon}</span>
                  </div>
                  <h3 className="font-medium">{map.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">{map.description}</p>
                <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-32 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Preview</span>
                </div>
              </div>
            ))}
          </div>

          {selectedMap && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">
                {mapTypes.find((m) => m.key === selectedMap)?.name} Map Settings
              </h4>

              <div className="intensity-control">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intensity: {mapIntensity}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={mapIntensity}
                  onChange={(e) => setMapIntensity(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-600">
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
