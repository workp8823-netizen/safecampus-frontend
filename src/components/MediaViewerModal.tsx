import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export interface MediaViewerProps {
  media: { url: string; isVideo: boolean } | null;
  onClose: () => void;
}

export function MediaViewerModal({ media, onClose }: MediaViewerProps) {
  useBodyScrollLock(!!media);

  return (
    <AnimatePresence>
      {media && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 flex max-h-[95dvh] max-w-[95vw] sm:max-w-5xl items-center justify-center overflow-hidden rounded-xl bg-black/50 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-2 top-2 sm:right-4 sm:top-4 z-20 rounded-full bg-black/50 p-2 text-white hover:bg-black/80 backdrop-blur transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            {media.isVideo ? (
              <video
                src={media.url}
                controls
                autoPlay
                playsInline
                className="max-h-[90dvh] max-w-full object-contain"
              />
            ) : (
              <img
                src={media.url}
                alt="Media view"
                className="max-h-[90dvh] max-w-full object-contain"
              />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
