// components/TextureUpscaler.tsx
import React, { useState, useRef } from "react";

interface TextureUpscalerProps {
  processTexture: (file: File, type: "upscale" | "pbr") => Promise<any>;
  addToHistory: (item: any) => void;
}

const TextureUpscaler: React.FC<TextureUpscalerProps> = ({
  processTexture,
  addToHistory,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState<string>("4");
  const [outputFormat, setOutputFormat] = useState<string>("tga");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpscale = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await processTexture(file, "upscale");
      addToHistory(result);
      alert(
        `Texture upscaled successfully! Saved as ${
          result.name
        }.${outputFormat.toLowerCase()}`
      );
    } catch (error) {
      console.error("Error processing texture:", error);
      alert("Failed to process texture");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/2">
          <h2 className="text-xl font-semibold mb-4">Texture Upscaler</h2>
          <p className="text-gray-600 mb-6">
            Enhance your game textures with AI-powered upscaling while
            preserving details.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Texture
            </label>
            <div className="flex items-center">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              <button
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition"
                onClick={triggerFileInput}
              >
                Choose File
              </button>
              <span className="ml-4 text-sm text-gray-600 truncate max-w-xs">
                {file ? file.name : "No file selected"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Supports JPG, PNG, TGA. Max file size: 10MB.
            </p>
          </div>

          {previewUrl && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview
              </label>
              <div className="border border-gray-200 rounded-lg p-2">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-64 mx-auto"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upscale Factor
              </label>
              <select
                value={upscaleFactor}
                onChange={(e) => setUpscaleFactor(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="2">2x (Good)</option>
                <option value="4">4x (Recommended)</option>
                <option value="8">8x (Best Quality)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Format
              </label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="png">PNG (Lossless)</option>
                <option value="tga">TGA (Game Texture)</option>
                <option value="dds">DDS (Compressed)</option>
                <option value="jpg">JPG (Compressed)</option>
              </select>
            </div>
          </div>

          <button
            className={`w-full px-4 py-3 text-white rounded-md transition flex items-center justify-center ${
              file && !loading
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={handleUpscale}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <span>Processing...</span>
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
              "Upscale Texture"
            )}
          </button>
        </div>

        <div className="w-full md:w-1/2">
          <div className="bg-gray-50 rounded-xl p-6 h-full">
            <h3 className="text-lg font-semibold mb-4">How it works</h3>
            <div className="space-y-4">
              <div className="workflow-step active p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white mr-3">
                    1
                  </div>
                  <h4 className="font-medium">Upload your texture</h4>
                </div>
                <p className="text-sm text-gray-600 mt-2 ml-11">
                  Game textures are often low resolution. Upload your base
                  texture for enhancement.
                </p>
              </div>

              <div className="workflow-step p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white mr-3">
                    2
                  </div>
                  <h4 className="font-medium">AI Upscaling</h4>
                </div>
                <p className="text-sm text-gray-600 mt-2 ml-11">
                  Our AI analyzes your texture and enhances details while
                  preserving artistic style.
                </p>
              </div>

              <div className="workflow-step p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white mr-3">
                    3
                  </div>
                  <h4 className="font-medium">Compare & Export</h4>
                </div>
                <p className="text-sm text-gray-600 mt-2 ml-11">
                  Compare before/after results and export in your preferred game
                  format.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h4 className="font-medium mb-3">Tips for best results</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  Use source textures rather than compressed in-game assets
                </li>
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  For tileable textures, ensure edges match before upscaling
                </li>
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  Higher resolution inputs produce better results
                </li>
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  Use TGA for lossless quality, DDS for compressed game assets
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextureUpscaler;
