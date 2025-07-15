import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  FileUp,
  X,
  Youtube,
  FileText,
  FileJson,
  FileInput,
  FileArchive,
  Loader,
  ChevronUp,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FileUploadProps = {
  files: File[];
  onUploadComplete: () => void;
  onClearFiles: () => void;
};

type UploadJob = {
  id: string;
  type: "youtube" | "json" | "pdf" | "code" | "archive";
  files: File[];
  status:
    | "pending"
    | "processing"
    | "uploading"
    | "completed"
    | "error"
    | "cancelled";
  progress: number;
  message?: string;
};

const FileUpload: React.FC<FileUploadProps> = ({
  files,
  onUploadComplete,
  onClearFiles,
}) => {
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isMainModalOpen, setIsMainModalOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Track which job file lists are expanded
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});

  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!files.length) {
      setUploadJobs([]);
      setIsLoading(false);
      setIsMainModalOpen(true); // reset modal state
      return;
    }

    setIsLoading(true);

    const categorizeFilesAsync = async () => {
      const jobs: UploadJob[] = [];
      const fileGroups: Record<string, File[]> = {};
      const youtubeLinkFiles: File[] = [];

      // Helper: check if object contains YouTube URLs
      const containsYouTubeLinks = (obj: any): boolean => {
        if (typeof obj === "string") {
          return obj.includes("youtube.com") || obj.includes("youtu.be");
        }
        if (Array.isArray(obj)) {
          return obj.some(containsYouTubeLinks);
        }
        if (typeof obj === "object" && obj !== null) {
          return Object.values(obj).some(containsYouTubeLinks);
        }
        return false;
      };

      // Process files sequentially (could be optimized)
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        let type: UploadJob["type"] = "code";

        if (ext === "json") {
          try {
            const text = await file.text();
            const json = JSON.parse(text);
            if (containsYouTubeLinks(json)) {
              // Mark this JSON as containing YouTube links
              youtubeLinkFiles.push(file);
              continue; // skip adding to other groups
            } else if (file.name.includes("_meta_data.json")) {
              type = "json";
            } else {
              type = "json";
            }
          } catch {
            // If JSON parse fails, treat as generic JSON
            type = "json";
          }
        } else if (ext === "pdf") {
          type = "pdf";
        } else if (ext === "zip" || ext === "pk3") {
          type = "archive";
        } else if (
          file.type.includes("video") ||
          file.name.includes("youtube")
        ) {
          type = "youtube";
        }

        if (!fileGroups[type]) fileGroups[type] = [];
        fileGroups[type].push(file);
      }

      // Add normal file groups as jobs
      Object.entries(fileGroups).forEach(([type, files]) => {
        jobs.push({
          id: Math.random().toString(36).substring(2, 9),
          type: type as UploadJob["type"],
          files,
          status: "pending",
          progress: 0,
        });
      });

      // Add special job for JSON files with YouTube links
      if (youtubeLinkFiles.length > 0) {
        jobs.push({
          id: Math.random().toString(36).substring(2, 9),
          type: "youtube",
          files: youtubeLinkFiles,
          status: "pending",
          progress: 0,
        });
      }

      setUploadJobs(jobs);
      setIsLoading(false);
    };

    categorizeFilesAsync();

    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
      intervalsRef.current = {};
    };
  }, [files]);

  const getJobIcon = (type: UploadJob["type"]) => {
    switch (type) {
      case "youtube":
        return <Youtube className="w-5 h-5" />;
      case "json":
        return <FileJson className="w-5 h-5" />;
      case "pdf":
        return <FileText className="w-5 h-5" />;
      case "archive":
        return <FileArchive className="w-5 h-5" />;
      default:
        return <FileInput className="w-5 h-5" />;
    }
  };

  const getActionOptions = (type: UploadJob["type"]) => {
    const baseOptions = [{ id: "show", label: "Show Files" }];

    switch (type) {
      case "youtube":
        return [
          ...baseOptions,
          { id: "transcript", label: "Extract Transcript" },
          { id: "upload", label: "Upload to RAG" },
          { id: "both", label: "Both" },
        ];
      case "json":
        return [
          ...baseOptions,
          { id: "upload", label: "Upload as-is" },
          { id: "chunk", label: "Chunk & Upload" },
        ];
      case "pdf":
        return [
          ...baseOptions,
          { id: "extract", label: "Extract Text" },
          { id: "upload", label: "Upload to RAG" },
        ];
      case "archive":
        return [
          ...baseOptions,
          { id: "extract", label: "Extract Files" },
          { id: "upload", label: "Upload to RAG" },
        ];
      default:
        return [
          ...baseOptions,
          { id: "upload", label: "Upload to RAG" },
          { id: "analyze", label: "Analyze Code" },
        ];
    }
  };

  const startProcessing = useCallback(
    (jobId: string, action: string) => {
      setUploadJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: "processing",
                message: `Starting ${action}...`,
                progress: 0,
              }
            : job
        )
      );

      const interval = setInterval(() => {
        setUploadJobs((prev) => {
          let completed = false;
          const updated = prev.map((job) => {
            if (job.id === jobId) {
              if (job.status === "cancelled") {
                clearInterval(interval);
                return job;
              }
              const newProgress = Math.min(
                job.progress + Math.random() * 10,
                100
              );
              let newStatus = job.status;
              let message = job.message;

              if (newProgress >= 30 && job.status === "processing") {
                newStatus = "uploading";
                message = "Uploading to RAG...";
              }

              if (newProgress >= 100) {
                newStatus = "completed";
                message = "Upload complete!";
                completed = true;
              }

              return {
                ...job,
                progress: newProgress,
                status: newStatus,
                message,
              };
            }
            return job;
          });

          if (completed) {
            clearInterval(interval);
            setTimeout(() => onUploadComplete(), 2000);
          }
          return updated;
        });
      }, 500);

      intervalsRef.current[jobId] = interval;

      return () => {
        clearInterval(interval);
        setUploadJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? { ...job, status: "cancelled", message: "Cancelled" }
              : job
          )
        );
      };
    },
    [onUploadComplete]
  );

  const toggleJobExpand = (jobId: string) => {
    setExpandedJobs((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const handleActionSelect = (jobId: string, action: string) => {
    if (action === "show") {
      toggleJobExpand(jobId);
      return;
    }
    setSelectedAction(action);
    startProcessing(jobId, action);
  };

  const cancelJob = (jobId: string) => {
    if (intervalsRef.current[jobId]) {
      clearInterval(intervalsRef.current[jobId]);
      delete intervalsRef.current[jobId];
    }
    setUploadJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, status: "cancelled", message: "Cancelled" }
          : job
      )
    );
  };

  const allUploadsComplete =
    uploadJobs.length > 0 &&
    uploadJobs.every((job) => job.status === "completed");

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ zIndex: 1000 }}
    >
      {isLoading && (
        <div className="pointer-events-auto flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-lg w-80 m-auto mt-24">
          <Loader className="w-10 h-10 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-700 font-semibold">Preparing files...</p>
        </div>
      )}

      {!isLoading && isMainModalOpen && uploadJobs.length > 0 && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="pointer-events-auto bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden m-auto mt-12"
        >
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">Process Uploaded Files</h3>
            <button
              onClick={() => {
                setIsMainModalOpen(false);
                onClearFiles();
              }}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close upload modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[70vh]">
            {uploadJobs.map((job) => (
              <div key={job.id} className="mb-6 last:mb-0">
                <div className="flex items-center gap-3 mb-2">
                  {getJobIcon(job.type)}
                  <h4 className="font-medium capitalize">
                    {job.type} Files ({job.files.length})
                  </h4>
                  {job.status !== "pending" && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        job.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : job.status === "error"
                          ? "bg-red-100 text-red-800"
                          : job.status === "cancelled"
                          ? "bg-gray-200 text-gray-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {job.status}
                    </span>
                  )}
                </div>

                <div className="pl-8">
                  {job.status === "pending" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        What would you like to do with these files?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getActionOptions(job.type).map((option) => (
                          <button
                            key={option.id}
                            onClick={() =>
                              handleActionSelect(job.id, option.id)
                            }
                            className="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {expandedJobs[job.id] && (
                        <ul className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 mt-1 text-xs text-gray-700">
                          {job.files.map((file) => (
                            <li
                              key={`${file.name}-${Math.random()
                                .toString(36)
                                .substr(2, 9)}`}
                              className="truncate"
                              title={file.name}
                            >
                              {file.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">{job.message}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>

                      {job.status !== "completed" &&
                        job.status !== "cancelled" && (
                          <button
                            onClick={() => cancelJob(job.id)}
                            className="mt-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                          >
                            Cancel Upload
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
            <button
              onClick={() => {
                if (allUploadsComplete) {
                  onClearFiles();
                } else {
                  setIsMainModalOpen(false);
                }
              }}
              className={`px-4 py-2 rounded-md ${
                allUploadsComplete
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500"
              }`}
            >
              {allUploadsComplete ? "Done" : "Minimize"}
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {(uploadJobs.some(
          (job) => job.status === "processing" || job.status === "uploading"
        ) ||
          !isMainModalOpen) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="pointer-events-auto fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg p-4 w-72"
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium flex items-center gap-2">
                <FileUp className="w-4 h-4" />
                Upload Progress
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsMainModalOpen(true)}
                  aria-label="Expand upload modal"
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to cancel all ongoing uploads?"
                      )
                    ) {
                      uploadJobs.forEach((job) => {
                        if (
                          job.status !== "completed" &&
                          job.status !== "cancelled"
                        ) {
                          cancelJob(job.id);
                        }
                      });
                      console.log("clear files upload queue");
                      onClearFiles();
                    }
                  }}
                  aria-label="Cancel all uploads"
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <XCircle className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>

            {uploadJobs
              .filter(
                (job) =>
                  job.status !== "completed" && job.status !== "cancelled"
              )
              .map((job) => (
                <div key={job.id} className="mb-2 last:mb-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize truncate max-w-[140px]">
                      {job.type} ({job.files.length})
                    </span>
                    <span>{Math.round(job.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              ))}

            <div className="text-xs text-gray-500">
              {uploadJobs.filter((j) => j.status === "completed").length}/
              {uploadJobs.length} uploads completed
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;
