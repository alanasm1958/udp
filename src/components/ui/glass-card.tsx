"use client";

import * as React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function GlassCard({ children, className = "", padding = "md", ...props }: GlassCardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-3",
    md: "p-4 md:p-6",
    lg: "p-6 md:p-8",
  };

  return (
    <div
      className={`
        bg-white/10 backdrop-blur-xl
        border border-white/15
        shadow-lg shadow-black/5
        rounded-2xl
        ${paddingClasses[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
