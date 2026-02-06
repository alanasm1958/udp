"use client";

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        border-2 border-white/20 border-t-white/80
        rounded-full animate-spin
      `}
    />
  );
}
