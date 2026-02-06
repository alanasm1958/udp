"use client";

import * as React from "react";
import { GlassCard } from "./glass-card";
import { GlassButton } from "./glass-button";
import { Spinner } from "./spinner";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !loading) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md animate-scale-up">
        <GlassCard padding="lg" className="border-white/20">
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-white/70 mb-6">{message}</p>

          <div className="flex items-center justify-end gap-3">
            <GlassButton
              variant="ghost"
              onClick={onClose}
              disabled={loading}
            >
              {cancelLabel}
            </GlassButton>
            <GlassButton
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : null}
              {confirmLabel}
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
