"use client";

/**
 * Glass UI Component Library - Barrel Re-export
 *
 * All components have been split into individual files for better
 * code organization and tree-shaking. This file re-exports everything
 * so existing imports from "@/components/ui/glass" continue to work.
 *
 * For new code, prefer importing directly from the individual files:
 *   import { GlassCard } from "@/components/ui/glass-card"
 */

export { GlassCard } from "./glass-card";
export { GlassButton } from "./glass-button";
export { GlassInput } from "./glass-input";
export { GlassSelect } from "./glass-select";
export { GlassTable } from "./glass-table";
export { PageHeader } from "./page-header";
export { StatPill } from "./stat-pill";
export { GlassBadge } from "./glass-badge";
export { GlassTabs } from "./glass-tabs";
export { Spinner } from "./spinner";
export { Skeleton, SkeletonTable, SkeletonCard, SkeletonStats } from "./skeletons";
export { ToastProvider, useToast } from "./toast";
export { ConfirmDialog } from "./confirm-dialog";
export { SlideOver } from "./slide-over";
export { EmptyState } from "./empty-state";
export { ErrorAlert } from "./error-alert";
export { GlassTextarea } from "./glass-textarea";
