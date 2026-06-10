import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./ui/button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  variant = "danger",
  isLoading = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: "text-destructive bg-destructive/10 border-destructive/20 hover:bg-destructive hover:text-white",
    warning: "text-accent bg-accent/10 border-accent/20 hover:bg-accent hover:text-white",
    primary: "text-primary bg-primary/10 border-primary/20 hover:bg-primary hover:text-white",
  };

  const btnColors = {
    danger: "bg-destructive text-white hover:bg-destructive/90",
    warning: "bg-accent text-white hover:bg-accent/90",
    primary: "bg-primary text-white hover:bg-primary/90",
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-surface p-8 shadow-2xl"
        >
          <button 
            onClick={onClose}
            className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/50"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${variant === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>
              <AlertTriangle className="h-8 w-8" />
            </div>
            
            <h3 className="mb-2 text-xl font-bold">{title}</h3>
            <p className="mb-8 text-sm text-muted-foreground">
              {message}
            </p>

            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="h-12 flex-1 rounded-2xl"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                className={`h-12 flex-1 rounded-2xl ${btnColors[variant]}`}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : confirmText}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
