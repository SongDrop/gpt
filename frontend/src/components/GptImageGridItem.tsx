import React from "react";

interface GptImageGridItemProps {
  dataUri: string;
  onDelete: () => void;
  onSelect?: () => void;
}

const GptImageGridItem: React.FC<GptImageGridItemProps> = ({
  dataUri,
  onDelete,
  onSelect,
}) => {
  return (
    <div className="grid-item">
      <img src={dataUri} alt="Generated" className="grid-image" />
      <button
        type="button"
        id="image-del-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete image"
      >
        ✕
      </button>
    </div>
  );
};

export default GptImageGridItem;
