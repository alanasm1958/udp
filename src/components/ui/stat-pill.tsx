"use client";

import * as React from "react";

interface StatPillProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatPill({ label, value, trend, className = "" }: StatPillProps) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/60",
  };

  return (
    <div
      className={`
        flex flex-col gap-1
        bg-white/8 backdrop-blur-md
        border border-white/10
        rounded-xl px-4 py-3
        ${className}
      `}
    >
      <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${trend ? trendColors[trend] : "text-white"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
