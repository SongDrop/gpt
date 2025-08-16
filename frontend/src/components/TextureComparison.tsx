import React, { useState, useRef, useEffect } from "react";

const TextureComparison: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (
    setImage: React.Dispatch<React.SetStateAction<string | null>>,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImage(url);
    }
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!containerRef.current || !isDragging) return;

    const rect = containerRef.current.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    const position = Math.max(0, Math.min(100, (xPos / rect.width) * 100));

    setSliderPosition(position);
  };

  const startDrag = () => {
    setIsDragging(true);
  };

  const stopDrag = () => {
    setIsDragging(false);
  };

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (originalImage) URL.revokeObjectURL(originalImage);
      if (enhancedImage) URL.revokeObjectURL(enhancedImage);
    };
  }, [originalImage, enhancedImage]);

  return (
    <div
      className="rounded-xl shadow-sm p-6 border border-[var(--color-border)]"
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <h2
        className="text-xl font-semibold mb-6"
        style={{ color: "var(--color-foreground)" }}
      >
        Texture Comparison
      </h2>
      <p
        className="mb-6 opacity-80"
        style={{ color: "var(--color-foreground)" }}
      >
        Compare original and enhanced textures side-by-side with a draggable
        slider.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div
            ref={containerRef}
            className="slider-container relative w-full h-96 rounded-lg overflow-hidden"
            onMouseMove={handleDrag}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            style={{ backgroundColor: "var(--color-secondary)" }}
          >
            {originalImage && (
              <div
                className="image absolute top-0 left-0 w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${originalImage})` }}
              ></div>
            )}

            {enhancedImage && (
              <div
                className="image absolute top-0 left-0 w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${enhancedImage})`,
                  clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
                }}
              ></div>
            )}

            <div
              ref={sliderRef}
              className="slider absolute top-0 h-full w-1 cursor-ew-resize z-10"
              style={{
                left: `${sliderPosition}%`,
                backgroundColor: "var(--color-primary)",
              }}
              onMouseDown={startDrag}
            >
              <div
                className="slider-handle absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  backgroundColor: "var(--color-background)",
                  border: "1px solid var(--color-primary)",
                  color: "var(--color-foreground)",
                }}
              >
                <span className="select-none">↔</span>
              </div>
            </div>
          </div>

          <div
            className="mt-4 flex justify-between text-sm font-medium"
            style={{ color: "var(--color-foreground)" }}
          >
            <div>Original</div>
            <div>Enhanced</div>
          </div>
        </div>

        <div>
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: "var(--color-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-lg font-medium mb-4"
              style={{ color: "var(--color-foreground)" }}
            >
              How to compare textures
            </h3>

            <div className="mb-6">
              <h4
                className="font-medium mb-2"
                style={{ color: "var(--color-foreground)" }}
              >
                Option 1: Upload Files
              </h4>
              <div className="space-y-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Original Texture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm rounded"
                    onChange={(e) => handleFileUpload(setOriginalImage, e)}
                    style={{
                      backgroundColor: "var(--color-background)",
                      color: "var(--color-foreground)",
                      border: "1px solid var(--color-border)",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    Enhanced Texture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm rounded"
                    onChange={(e) => handleFileUpload(setEnhancedImage, e)}
                    style={{
                      backgroundColor: "var(--color-background)",
                      color: "var(--color-foreground)",
                      border: "1px solid var(--color-border)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4
                className="font-medium mb-3"
                style={{ color: "var(--color-foreground)" }}
              >
                Tips for effective comparison
              </h4>
              <ul className="space-y-2 text-sm">
                {[
                  "Ensure both textures are the same resolution for accurate comparison",
                  "Compare details in different lighting conditions",
                  "Pay attention to edge details and repetitive patterns",
                  "Check how textures tile when repeated",
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
                    <span className="opacity-80">{tip}</span>
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

export default TextureComparison;
