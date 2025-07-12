import React, { useState, useRef, useEffect } from "react";
import useLocalStorage from "./useLocalStorage";
import axios from "axios";
import GptImageGridItem from "./GptImageGridItem";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import {
  saveImageToDb,
  getAllImagesFromDb,
  deleteImageFromDb,
} from "./imageDb";
import "./GptImage.css";

interface ImageEntry {
  id: number;
  base64: string;
  created: string;
}

const API_URL = process.env.REACT_APP_GPT_IMAGE_URL;
const API_KEY = process.env.REACT_APP_GPT_IMAGE_KEY;
const API_VERSION = process.env.REACT_APP_GPT_IMAGE_VERSION;

interface GptImageProps {
  onClose: () => void;
}

const aspectRatioSizes: Record<string, string> = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
};

const GptImage: React.FC<GptImageProps> = ({ onClose }) => {
  const [prompt, setPrompt] = useLocalStorage<string>(
    "gpt-image-1-prompt12",
    ""
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useLocalStorage<string>(
    "gpt-image-1-style1",
    "photorealistic"
  );
  const [aspectRatio, setAspectRatio] = useLocalStorage<string>(
    "gpt-image-1-aspect-ratio1",
    "square"
  );
  const [elapsedTime, setElapsedTime] = useState<string | null>(null);
  const [liveTime, setLiveTime] = useState<string>("0.0");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [outputFormat, setOutputFormat] = useState<string>("png");

  // NEW: State to toggle main view vs mini view
  const [isMainViewOpen, setIsMainViewOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      const entries = await getAllImagesFromDb();
      setImages(entries.reverse()); // newest first
    })();
  }, []);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (!API_URL || !API_KEY || !API_VERSION) {
      alert(
        "API configuration missing: Please provide API_URL, API_KEY, and API_VERSION."
      );
      return;
    }

    setLoading(true);
    setImageUrl("");
    setError(null);
    setElapsedTime(null);
    startTimeRef.current = Date.now();
    setLiveTime("0.0");

    intervalRef.current = setInterval(() => {
      setLiveTime(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
    }, 100);

    try {
      const headers = {
        Authorization: `Bearer ${API_KEY}`,
      };

      let response;
      if (imageFile) {
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("n", "1");
        formData.append("size", aspectRatioSizes[aspectRatio]);
        formData.append("quality", "high");
        formData.append("image", imageFile);

        response = await axios.post(
          `${API_URL}/edits?api-version=${API_VERSION}`,
          formData,
          {
            headers: {
              ...headers,
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        response = await axios.post(
          `${API_URL}/generations?api-version=${API_VERSION}`,
          {
            prompt,
            n: 1,
            size: aspectRatioSizes[aspectRatio],
            quality: "high",
            output_format: outputFormat,
          },
          {
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const b64 = response.data?.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned in base64 format");

      // Create blob and object URL for preview
      const byteCharacters = atob(b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${outputFormat}` });
      const url = URL.createObjectURL(blob);

      setImageUrl(url);

      // Store base64 string in local storage with prefix for display
      const mimeType =
        outputFormat === "jpg" ? "image/jpeg" : `image/${outputFormat}`;
      const dataUri = `data:${mimeType};base64,${b64}`;

      const insertedId = await saveImageToDb(dataUri);
      const id = insertedId as number; // ✅ Explicit cast

      setImages((prev) => [
        { id, base64: dataUri, created: new Date().toISOString() },
        ...prev,
      ]);

      const timeTaken = ((Date.now() - startTimeRef.current) / 1000).toFixed(2);
      setElapsedTime(timeTaken);

      // NEW: Once image is generated, open the main view (in case minimized)
      setIsMainViewOpen(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || err.message || "Unknown error"
      );
      const timeTaken = ((Date.now() - startTimeRef.current) / 1000).toFixed(2);
      setElapsedTime(timeTaken);
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size > 5 * 1024 * 1024) {
      setError("Image file must be less than 5MB");
      return;
    }

    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setImageFile(file);
    } else {
      setImagePreview(null);
      setImageFile(null);
    }
    setError(null);
  };

  const clearAll = () => {
    setPrompt("");
    setImageFile(null);
    setImagePreview(null);
    setImageUrl("");
    setError(null);
    setElapsedTime(null);
    setLiveTime("0.0");
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteImage = async (id: number) => {
    await deleteImageFromDb(id);
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <>
      {/* FULL VIEW */}
      {isMainViewOpen && (
        <div className="image-generator-container">
          <div className="image-generator-card">
            <header className="image-generator-header">
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  id="back-button-gpt-1"
                  aria-label="Back to console"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <h1 className="image-generator-title">gpt-image-1</h1>

                {/* Minimize button */}
                <button
                  onClick={() => setIsMainViewOpen(false)}
                  id="minimize-button-gpt-1"
                  title="Minimize"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <p className="image-generator-subtitle">
                Transform your ideas into stunning visuals
              </p>
            </header>

            <form onSubmit={handleSubmit} className="image-generator-form">
              <label htmlFor="prompt" className="form-label">
                Describe your image *
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A majestic lion in the savannah at sunset..."
                className="form-textarea"
                rows={3}
                required
              />

              <div className="grid-2-col">
                <div>
                  <label className="form-label">Image Style</label>
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value)}
                    className="form-select"
                  >
                    <option value="photorealistic">Photorealistic</option>
                    <option value="digital-art">Digital Art</option>
                    <option value="cartoon">Cartoon</option>
                    <option value="anime">Anime</option>
                    <option value="watercolor">Watercolor</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="form-select"
                  >
                    <option value="square">Square (1:1)</option>
                    <option value="portrait">Portrait (4:5)</option>
                    <option value="landscape">Landscape (16:9)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="form-select"
                >
                  <option value="png">PNG</option>
                  <option value="tga">TGA</option>
                  <option value="jpg">JPG</option>
                </select>
              </div>

              <div>
                <label className="form-label">Reference Image (optional)</label>
                <div className="file-upload-container">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="file-upload-input"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="file-upload-label">
                    {imageFile ? imageFile.name : "Choose an image..."}
                  </label>
                  {imageFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      className="file-clear-btn"
                      aria-label="Clear selected image"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="file-hint">Max 5MB (JPEG, PNG)</p>
                {imagePreview && (
                  <div className="image-preview-container">
                    <p className="preview-label">Preview:</p>
                    <img
                      src={imagePreview}
                      alt="Uploaded preview"
                      className="image-preview"
                    />
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="generate-btn"
                >
                  {loading ? (
                    <>
                      <svg
                        className="spinner"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating... ({liveTime}s)
                    </>
                  ) : (
                    "Generate Image"
                  )}
                </button>

                <button type="button" onClick={clearAll} className="clear-btn">
                  Clear
                </button>
              </div>
            </form>

            {imageUrl && (
              <section className="result-container">
                <header className="result-header">
                  <h2 className="result-title">Your Generated Image</h2>
                  <a
                    href={imageUrl}
                    download={`generated-image-${new Date()
                      .toISOString()
                      .slice(0, 10)}.${outputFormat}`}
                    className="download-btn"
                    type={`image/${outputFormat}`}
                    aria-label="Download generated image"
                  >
                    ⬇️ Download
                  </a>
                  {elapsedTime && (
                    <span className="time-elapsed">
                      ⏱️ Generated in {elapsedTime}s
                    </span>
                  )}
                </header>
                <div className="result-image-container">
                  <img
                    key={imageUrl}
                    src={imageUrl}
                    alt="Generated from prompt"
                    className="result-image"
                    onError={() => setError("Failed to load generated image")}
                  />
                </div>
                <div className="prompt-display">
                  <p>
                    <strong>Prompt:</strong> {prompt}
                  </p>
                  {imageFile && (
                    <p>
                      <strong>Reference:</strong> {imageFile.name}
                    </p>
                  )}
                </div>
              </section>
            )}

            {images.length > 0 && (
              <>
                <div className="flex justify-between p-2 mt-2">
                  <h2>
                    <strong>Generated Images History</strong>
                  </h2>
                  <button
                    className="delete-all-images"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to clear all images?"
                        )
                      ) {
                        images.forEach((entry) => handleDeleteImage(entry.id));
                      }
                    }}
                  >
                    Clear Images
                  </button>
                </div>
                <div className="image-grid">
                  {images.map((entry) => (
                    <GptImageGridItem
                      key={entry.id}
                      dataUri={entry.base64}
                      onDelete={() => handleDeleteImage(entry.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MINI VIEW */}
      {!isMainViewOpen && (
        <div
          onClick={() => setIsMainViewOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-32 h-32 bg-white rounded-lg shadow-lg cursor-pointer flex flex-col items-center justify-center p-2"
          aria-label="Expand image generator"
          title="Click to expand"
        >
          {loading ? (
            <div className="shimmer-effect">
              <p className="mt-2 text-center text-sm text-gray-600">
                Generating... ({liveTime}s)
              </p>
            </div>
          ) : (
            <>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Generated preview"
                  className="max-w-full max-h-full rounded-md shadow-md"
                />
              )}
              {!imageUrl && (
                <img
                  src="https://i.postimg.cc/Ss7S7MfN/generated-image-2025-06-17.png"
                  className="max-w-full max-h-full rounded-md shadow-md"
                  alt=""
                />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default GptImage;
