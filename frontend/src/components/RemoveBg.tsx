import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import useLocalStorage from "./useLocalStorage";
import GptImageGridItem from "./GptImageGridItem";
import {
  Download,
  X,
  Image as ImageIcon,
  Link,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import {
  saveImageToDb,
  getAllImagesFromDb,
  deleteImageFromDb,
} from "./imageBgRemoveDb";
import "./GptImage.css";

interface ImageEntry {
  id: number;
  base64: string;
  created: string;
}

interface RemoveBgProps {
  onClose: () => void;
}

const RemoveBg: React.FC<RemoveBgProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useLocalStorage<string>("remove-bg-api-key", "");
  const [inputType, setInputType] = useState<"file" | "url">("file");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [originalImagePreview, setOriginalImagePreview] = useState<string>("");
  const [processedImage, setProcessedImage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [downloadFilename, setDownloadFilename] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState<string | null>(null);
  const [liveTime, setLiveTime] = useState<string>("0.0");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [isMainViewOpen, setIsMainViewOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load image history from database
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous state
    setImageUrl("");
    setError("");
    setProcessedImage("");

    if (file.size > 5 * 1024 * 1024) {
      setError("Image file must be less than 5MB");
      return;
    }

    setImageFile(file);
    setOriginalImagePreview(URL.createObjectURL(file));

    // Set default download filename
    const stem = file.name.substring(0, file.name.lastIndexOf("."));
    setDownloadFilename(`${stem}_no_bg.png`);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageFile(null);
    setOriginalImagePreview("");
    setProcessedImage("");
    setError("");
    setImageUrl(e.target.value);

    // Set default download filename from URL
    try {
      const urlObj = new URL(e.target.value);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
      if (filename) {
        const stem = filename.substring(0, filename.lastIndexOf("."));
        setDownloadFilename(`${stem}_no_bg.png`);
      }
    } catch {
      setDownloadFilename("background_removed.png");
    }
  };

  const handleSubmit = async () => {
    if (!apiKey) {
      setError("API Key is required");
      return;
    }

    if (inputType === "file" && !imageFile) {
      setError("Please select an image file");
      return;
    }

    if (inputType === "url" && !imageUrl) {
      setError("Please enter an image URL");
      return;
    }

    setLoading(true);
    setError("");
    setProcessedImage("");
    setElapsedTime(null);
    startTimeRef.current = Date.now();
    setLiveTime("0.0");

    intervalRef.current = setInterval(() => {
      setLiveTime(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
    }, 100);

    try {
      const formData = new FormData();
      formData.append("size", "auto");

      if (inputType === "file" && imageFile) {
        formData.append("image_file", imageFile);
      } else if (inputType === "url" && imageUrl) {
        formData.append("image_url", imageUrl);
      }

      const response = await axios.post(
        "https://api.remove.bg/v1.0/removebg",
        formData,
        {
          headers: {
            "X-Api-Key": apiKey,
          },
          responseType: "blob",
        }
      );

      // Create object URL from blob
      const blob = response.data;
      const processedImageUrl = URL.createObjectURL(blob);
      setProcessedImage(processedImageUrl);

      // Convert blob to base64 for storage
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
      });

      // Save to database
      const insertedId = await saveImageToDb(base64Data);
      setImages((prev) => [
        {
          id: insertedId as number,
          base64: base64Data,
          created: new Date().toISOString(),
        },
        ...prev,
      ]);

      const timeTaken = ((Date.now() - startTimeRef.current) / 1000).toFixed(2);
      setElapsedTime(timeTaken);

      // Open main view after processing
      setIsMainViewOpen(true);
    } catch (err: any) {
      let errorMessage = "Failed to process image";
      if (err.response) {
        if (err.response.status === 402) {
          errorMessage = "Payment required - check your API credits";
        } else if (err.response.status === 400) {
          errorMessage = "Invalid image or URL";
        } else {
          // Attempt to parse error message from blob
          if (err.response.data instanceof Blob) {
            const errorText = await err.response.data.text();
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.errors?.[0]?.title || errorMessage;
            } catch {
              errorMessage = `API error: ${err.response.status}`;
            }
          } else {
            errorMessage = `API error: ${err.response.status} - ${err.response.data}`;
          }
        }
      } else if (err.request) {
        errorMessage = "No response from API server";
      }
      setError(errorMessage);
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoading(false);
    }
  };

  const handleDeleteImage = async (id: number) => {
    await deleteImageFromDb(id);
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const downloadImage = () => {
    if (!processedImage) return;

    const a = document.createElement("a");
    a.href = processedImage;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetForm = () => {
    setImageFile(null);
    setImageUrl("");
    setOriginalImagePreview("");
    setProcessedImage("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      {/* FULL VIEW */}
      {isMainViewOpen && (
        <div className="image-generator-container">
          <div className="image-generator-card bg-[var(--color-secondary)] shadow-lg">
            <header className="image-generator-header">
              <div className="flex items-center justify-between">
                <button
                  className="bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] border border-[var(--color-border)] rounded"
                  onClick={onClose}
                  id="back-button-gpt-1"
                  aria-label="Back to console"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <h1 className="image-generator-title text-[var(--color-primary)]">
                  Background Remover
                </h1>
                <button
                  className="bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] border border-[var(--color-border)] rounded opacity-0"
                  onClick={onClose}
                  id="back-button-gpt-1"
                  aria-label="Back to console"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
              <p className="image-generator-subtitle text-[var(--color-foreground)] opacity-80">
                Remove backgrounds from images using AI
              </p>
            </header>

            <div className="image-generator-form">
              {/* API Key Input */}
              <div className="mb-4">
                <label className="form-label">Remove.bg API Key *</label>
                <div className="flex">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your remove.bg API key"
                    className="form-input flex-grow bg-[var(--color-background)] border border-[var(--color-border)] p-2"
                  />
                  <a
                    href="https://www.remove.bg/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-sm text-blue-500 hover:underline self-center"
                  >
                    Get Key
                  </a>
                </div>
              </div>

              {/* Input Type Toggle */}
              <div className="mb-4">
                <label className="form-label">Input Type</label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded ${
                      inputType === "file"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-background)] text-[var(--color-foreground)]"
                    }`}
                    onClick={() => setInputType("file")}
                  >
                    <div className="flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      File Upload
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded ${
                      inputType === "url"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-background)] text-[var(--color-foreground)]"
                    }`}
                    onClick={() => setInputType("url")}
                  >
                    <div className="flex items-center justify-center">
                      <Link className="w-4 h-4 mr-2" />
                      Image URL
                    </div>
                  </button>
                </div>
              </div>

              {/* File Upload */}
              {inputType === "file" && (
                <div className="mb-4">
                  <label className="form-label">Upload Image</label>
                  <div className="file-upload-container bg-[var(--color-background)] hover:bg-[var(--color-secondary)] rounded border border-[var(--color-border)]">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      className="file-upload-input"
                      id="remove-bg-file-upload"
                    />
                    <label
                      htmlFor="remove-bg-file-upload"
                      className="file-upload-label"
                    >
                      {imageFile ? imageFile.name : "Choose an image..."}
                    </label>
                    {imageFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="file-clear-btn"
                        aria-label="Clear selected image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="file-hint">Max 5MB (JPEG, PNG)</p>
                </div>
              )}

              {/* URL Input */}
              {inputType === "url" && (
                <div className="mb-4">
                  <label className="form-label">Image URL</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={handleUrlChange}
                    placeholder="https://example.com/image.jpg"
                    className="form-input bg-[var(--color-background)] border border-[var(--color-border)] p-2 w-[100%]"
                  />
                </div>
              )}

              {/* Preview Original Image */}
              {(originalImagePreview || (inputType === "url" && imageUrl)) && (
                <div className="mb-4">
                  <label className="form-label">Original Image</label>
                  <div className="border border-[var(--color-border)] rounded p-2 bg-[var(--color-background)]">
                    <img
                      src={
                        inputType === "file" ? originalImagePreview : imageUrl
                      }
                      alt="Original preview"
                      className="max-h-64 mx-auto"
                      onError={() => setError("Failed to load image")}
                    />
                  </div>
                </div>
              )}

              {error && <div className="error-message mb-4">{error}</div>}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !apiKey}
                  className="generate-btn bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Removing Background... ({liveTime}s)
                    </>
                  ) : (
                    "Remove Background"
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="clear-btn text-[var(--color-foreground)] bg-[var(--color-background)] hover:bg-[var(--color-secondary)] rounded border border-[var(--color-border)]"
                >
                  Reset
                </button>
              </div>

              {/* Processed Image Result */}
              {processedImage && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="form-label">Background Removed</label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={downloadImage}
                        className="flex items-center text-sm bg-[var(--color-primary)] text-white px-3 py-1 rounded hover:opacity-90"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </button>
                      {elapsedTime && (
                        <span className="time-elapsed text-sm text-[var(--color-foreground)]">
                          ⏱️ Processed in {elapsedTime}s
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border border-[var(--color-border)] rounded p-2 bg-[var(--color-background)]">
                    <img
                      src={processedImage}
                      alt="Background removed"
                      className="max-h-64 mx-auto"
                    />
                  </div>
                </div>
              )}

              {/* Image History */}
              {images.length > 0 && (
                <>
                  <div className="flex justify-between p-2 mt-4">
                    <h2 className="text-lg font-semibold">
                      Processed Images History
                    </h2>
                    <button
                      className="text-[var(--color-error)] hover:text-[var(--color-error)] text-sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to clear all images?"
                          )
                        ) {
                          images.forEach((entry) =>
                            handleDeleteImage(entry.id)
                          );
                        }
                      }}
                    >
                      Clear History
                    </button>
                  </div>
                  <div className="image-grid bg-[var(--color-background)]">
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
        </div>
      )}

      {/* MINI VIEW */}
      {!isMainViewOpen && (
        <div
          onClick={() => setIsMainViewOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-32 h-32 bg-[var(--color-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg cursor-pointer flex flex-col items-center justify-center p-2"
          aria-label="Expand background remover"
          title="Click to expand"
        >
          {loading ? (
            <div className="shimmer-effect">
              <div className="absolute inset-0 pointer-events-none">
                <Sparkles
                  className="w-4 h-4 absolute top-2 left-2 opacity-5 opacity-pulse"
                  style={{ animationDelay: "0s" }}
                />
                <Sparkles
                  className="w-4 h-4 absolute top-2 right-2 opacity-15 opacity-pulse"
                  style={{ animationDelay: "0.5s" }}
                />
                <Sparkles
                  className="w-4 h-4 absolute bottom-2 left-2 opacity-10 opacity-pulse"
                  style={{ animationDelay: "1s" }}
                />
                <Sparkles
                  className="w-4 h-4 absolute bottom-2 right-2 opacity-20 opacity-pulse"
                  style={{ animationDelay: "1.5s" }}
                />
                <Sparkles
                  className="w-20 h-20 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-20 opacity-pulse"
                  style={{ animationDelay: "2s" }}
                />
              </div>
              <p className="mt-2 text-center text-sm text-[var(--color-foreground)] ">
                Processing... ({liveTime}s)
              </p>
            </div>
          ) : (
            <>
              {processedImage && (
                <img
                  src={processedImage}
                  alt="Processed preview"
                  className="max-w-full max-h-full rounded-md shadow-md bg-[var(--color-secondary)]"
                />
              )}
              {!processedImage && images.length > 0 && (
                <img
                  src={images[0].base64}
                  alt="Recent processed preview"
                  className="max-w-full max-h-full rounded-md shadow-md bg-[var(--color-secondary)]"
                />
              )}
              {!processedImage && images.length === 0 && (
                <img
                  src="https://i.postimg.cc/Ss7S7MfN/generated-image-2025-06-17.png"
                  className="max-w-full max-h-full rounded-md shadow-md bg-[var(--color-secondary)]"
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

export default RemoveBg;
