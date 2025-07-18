import { CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect } from "react";

const UploadCompletePopup: React.FC<{ show: boolean; onClose: () => void }> = ({
  show,
  onClose,
}) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // 3 seconds visible
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <div className="pointer-events-auto bg-[var(--color-background)] border border-[var(--color-success)] rounded-lg shadow-lg p-6 flex flex-col items-center gap-3">
            <CheckCircle className="w-12 h-12 text-[var(--color-success)] animate-pulse" />
            <p className="text-[var(--color-success)] font-semibold text-lg">
              Files uploaded successfully!
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadCompletePopup;
