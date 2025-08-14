// components/TextureComparison.tsx
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
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-6">Texture Comparison</h2>
      <p className="text-gray-600 mb-6">
        Compare original and enhanced textures side-by-side with a draggable
        slider.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div
            ref={containerRef}
            className="slider-container relative w-full h-96 bg-black rounded-lg overflow-hidden"
            onMouseMove={handleDrag}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
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
              className="slider absolute top-0 h-full w-1 bg-white cursor-ew-resize z-10"
              style={{ left: `${sliderPosition}%` }}
              onMouseDown={startDrag}
            >
              <div className="slider-handle absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-gray-700 select-none">↔</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-between">
            <div className="text-sm font-medium">Original</div>
            <div className="text-sm font-medium">Enhanced</div>
          </div>
        </div>

        <div>
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-medium mb-4">
              How to compare textures
            </h3>

            <div className="mb-6">
              <h4 className="font-medium mb-2">Option 1: Upload Files</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original Texture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm"
                    onChange={(e) => handleFileUpload(setOriginalImage, e)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enhanced Texture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm"
                    onChange={(e) => handleFileUpload(setEnhancedImage, e)}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">
                Tips for effective comparison
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  Ensure both textures are the same resolution for accurate
                  comparison
                </li>
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  Compare details in different lighting conditions
                </li>
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  Pay attention to edge details and repetitive patterns
                </li>
                <li className="flex items-start">
                  <span className="material-icons text-primary mr-2 text-sm">
                    check_circle
                  </span>
                  Check how textures tile when repeated
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextureComparison;
