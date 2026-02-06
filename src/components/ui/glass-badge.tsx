"use client";

import * as React from "react";

interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export function GlassBadge({ children, variant = "default" }: GlassBadgeProps) {
  const variantClasses = {
    default: "bg-white/10 text-white/80",
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/20 text-amber-400",
    danger: "bg-red-500/20 text-red-400",
    info: "bg-blue-500/20 text-blue-400",
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-xs font-medium rounded-lg
        ${variantClasses[variant]}
      `}
    >
      {children}
    </span>
  );
}
