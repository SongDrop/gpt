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
    <div
      className="rounded-xl shadow-sm p-6 mb-8 border border-[var(--color-border)]"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/2">
          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: "var(--color-foreground)" }}
          >
            Texture Upscaler
          </h2>
          <p
            className="mb-6 opacity-80"
            style={{ color: "var(--color-foreground)" }}
          >
            Enhance your game textures with AI-powered upscaling while
            preserving details.
          </p>

          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--color-foreground)" }}
            >
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
                className="px-4 py-2 text-white rounded-md transition"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-background)",
                }}
                onClick={triggerFileInput}
              >
                Choose File
              </button>
              <span
                className="ml-4 text-sm truncate max-w-xs opacity-80"
                style={{ color: "var(--color-foreground)" }}
              >
                {file ? file.name : "No file selected"}
              </span>
            </div>
            <p
              className="mt-1 text-sm opacity-70"
              style={{ color: "var(--color-foreground)" }}
            >
              Supports JPG, PNG, TGA. Max file size: 10MB.
            </p>
          </div>

          {previewUrl && (
            <div className="mb-6">
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--color-foreground)" }}
              >
                Preview
              </label>
              <div
                className="rounded-lg p-2"
                style={{
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-secondary)",
                }}
              >
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
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--color-foreground)" }}
              >
                Upscale Factor
              </label>
              <select
                value={upscaleFactor}
                onChange={(e) => setUpscaleFactor(e.target.value)}
                className="w-full rounded-md px-3 py-2"
                style={{
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-foreground)",
                }}
              >
                <option value="2">2x (Good)</option>
                <option value="4">4x (Recommended)</option>
                <option value="8">8x (Best Quality)</option>
              </select>
            </div>
            <div>
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
                <option value="png">PNG (Lossless)</option>
                <option value="tga">TGA (Game Texture)</option>
                <option value="dds">DDS (Compressed)</option>
                <option value="jpg">JPG (Compressed)</option>
              </select>
            </div>
          </div>

          <button
            className={`w-full px-4 py-3 text-white rounded-md transition flex items-center justify-center ${
              !file || loading ? "cursor-not-allowed" : ""
            }`}
            style={{
              backgroundColor:
                file && !loading
                  ? "var(--color-primary)"
                  : "var(--color-secondary)",
              color: file && !loading ? "white" : "gray",
            }}
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
          <div
            className="rounded-xl p-6 h-full"
            style={{
              backgroundColor: "var(--color-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--color-foreground)" }}
            >
              How it works
            </h3>
            <div className="space-y-4">
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: "var(--color-background)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center mr-3"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-background)",
                    }}
                  >
                    1
                  </div>
                  <h4
                    className="font-medium"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Upload your texture
                  </h4>
                </div>
                <p
                  className="text-sm mt-2 ml-11 opacity-80"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Game textures are often low resolution. Upload your base
                  texture for enhancement.
                </p>
              </div>

              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center mr-3"
                    style={{
                      backgroundColor: "var(--color-border)",
                      color: "var(--color-foreground)",
                    }}
                  >
                    2
                  </div>
                  <h4
                    className="font-medium"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    AI Upscaling
                  </h4>
                </div>
                <p
                  className="text-sm mt-2 ml-11 opacity-80"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Our AI analyzes your texture and enhances details while
                  preserving artistic style.
                </p>
              </div>

              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center mr-3"
                    style={{
                      backgroundColor: "var(--color-border)",
                      color: "var(--color-foreground)",
                    }}
                  >
                    3
                  </div>
                  <h4
                    className="font-medium"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Compare & Export
                  </h4>
                </div>
                <p
                  className="text-sm mt-2 ml-11 opacity-80"
                  style={{ color: "var(--color-foreground)" }}
                >
                  Compare before/after results and export in your preferred game
                  format.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h4
                className="font-medium mb-3"
                style={{ color: "var(--color-foreground)" }}
              >
                Tips for best results
              </h4>
              <ul className="space-y-2 text-sm">
                {[
                  "Use source textures rather than compressed in-game assets",
                  "For tileable textures, ensure edges match before upscaling",
                  "Higher resolution inputs produce better results",
                  "Use TGA for lossless quality, DDS for compressed game assets",
                ].map((tip, index) => (
                  <li
                    key={index}
                    className="flex items-start"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    <span
                      className="mr-2 text-sm"
                      style={{ color: "var(--color-primary)" }}
                    >
                      ✓
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextureUpscaler;
