import React, { useState, useCallback, useRef, useEffect } from "react";

export interface DroppedItem {
  type: "file" | "folder" | "link";
  name: string;
  path?: string;
  file?: File;
  url?: string;
}

interface DragDropAreaProps {
  onDropItems: (items: DroppedItem[]) => void;
  className?: string;
}

export default function DragDropArea({
  onDropItems,
  className,
}: DragDropAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [previewType, setPreviewType] = useState<
    "default" | "file" | "folder" | "link"
  >("default");
  const dragCounter = useRef(0);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  const detectContentType = (items: DataTransferItemList) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry?.isDirectory) return "folder";
        return "file";
      }
      if (item.kind === "string" && item.type === "text/uri-list") {
        return "link";
      }
    }
    return "default";
  };

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
      setIsVisible(true);
      setPreviewType(detectContentType(e.dataTransfer.items));
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
      setIsVisible(false);
      setPreviewType("default");
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
      setPreviewType(detectContentType(e.dataTransfer.items));
    }
  }, []);

  const traverseFileTree = useCallback(
    (item: any, path = ""): Promise<DroppedItem[]> => {
      return new Promise((resolve) => {
        if (item.isFile) {
          item.file((file: File) => {
            resolve([
              {
                type: "file",
                name: file.name,
                path: path + file.name,
                file,
              },
            ]);
          });
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          let entries: any[] = [];

          const readEntries = () => {
            dirReader.readEntries(async (results: any[]) => {
              if (!results.length) {
                const promises = entries.map((ent) =>
                  traverseFileTree(ent, path + item.name + "/")
                );
                const nestedFiles = await Promise.all(promises);
                resolve(nestedFiles.flat());
              } else {
                entries = entries.concat(Array.from(results));
                readEntries();
              }
            });
          };
          readEntries();
        } else {
          resolve([]);
        }
      });
    },
    []
  );

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setIsVisible(false);
      dragCounter.current = 0;

      if (!e.dataTransfer) return;

      const items = e.dataTransfer.items;
      const droppedItems: DroppedItem[] = [];

      if (items) {
        const entries = Array.from(items)
          .map((item) =>
            item.webkitGetAsEntry ? item.webkitGetAsEntry() : null
          )
          .filter(Boolean);

        for (const entry of entries) {
          if (entry) {
            const filesFromEntry = await traverseFileTree(entry);
            droppedItems.push(...filesFromEntry);
          }
        }
      }

      const urlData =
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain");
      if (urlData && urlData.startsWith("http")) {
        droppedItems.push({
          type: "link",
          name: urlData,
          url: urlData,
        });
      }

      if (droppedItems.length === 0 && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          droppedItems.push({
            type: "file",
            name: file.name,
            file,
          });
        }
      }

      if (droppedItems.length > 0) {
        onDropItems(droppedItems);
      }
    },
    [onDropItems, traverseFileTree]
  );

  useEffect(() => {
    document.body.addEventListener("dragenter", handleDragEnter);
    document.body.addEventListener("dragleave", handleDragLeave);
    document.body.addEventListener("dragover", handleDragOver);
    document.body.addEventListener("drop", handleDrop);

    return () => {
      document.body.removeEventListener("dragenter", handleDragEnter);
      document.body.removeEventListener("dragleave", handleDragLeave);
      document.body.removeEventListener("dragover", handleDragOver);
      document.body.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const renderPreviewIcon = () => {
    const baseClasses = "w-32 h-32 mb-6 transition-all duration-300";

    switch (previewType) {
      case "file":
        return (
          <div className={`${baseClasses} text-blue-500`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        );
      case "folder":
        return (
          <div className={`${baseClasses} text-yellow-500`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
        );
      case "link":
        return (
          <div className={`${baseClasses} text-green-500`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className={`${baseClasses} text-gray-500 animate-pulse`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
        );
    }
  };

  const getTypeLabel = () => {
    switch (previewType) {
      case "file":
        return "Files detected";
      case "folder":
        return "Folder detected";
      case "link":
        return "Link detected";
      default:
        return "Drag files, folders or links";
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={dropAreaRef}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-90 backdrop-blur-sm transition-all duration-300 ${
        isDragging ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-label="Drag and drop area"
    >
      <div className="relative bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 shadow-2xl max-w-md w-full text-center transition-all duration-300 hover:border-blue-400 hover:shadow-blue-100 hover:bg-blue-50">
        {renderPreviewIcon()}

        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          {getTypeLabel()}
        </h3>

        <p className="text-gray-600 mb-6">
          {previewType === "default"
            ? "Drop anywhere on this screen"
            : `Drop to ${
                previewType === "link" ? "add link" : `upload ${previewType}`
              }`}
        </p>

        <div
          className="absolute -inset-4 border-4 border-blue-400 rounded-xl pointer-events-none opacity-0 transition-opacity duration-300"
          style={{ opacity: isDragging ? 1 : 0 }}
        />

        <button
          onClick={() => {
            setIsVisible(false);
          }}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="mt-8 text-sm text-gray-500">
        <p>Supports files, folders, and web links</p>
      </div>
    </div>
  );
}
