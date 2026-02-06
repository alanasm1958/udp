"use client";

import * as React from "react";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function GlassButton({
  children,
  variant = "default",
  size = "md",
  className = "",
  disabled,
  ...props
}: GlassButtonProps) {
  const variantClasses = {
    default: "bg-white/10 hover:bg-white/20 text-white border-white/15",
    primary: "bg-blue-500/80 hover:bg-blue-500/90 text-white border-blue-400/30",
    ghost: "bg-transparent hover:bg-white/10 text-white/80 border-transparent",
    danger: "bg-red-500/80 hover:bg-red-500/90 text-white border-red-400/30",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        backdrop-blur-md
        border rounded-xl
        font-medium
        transition-all duration-150
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        focus:outline-none focus:ring-2 focus:ring-white/25 focus:ring-offset-0
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
