"use client";

import * as React from "react";

interface GlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function GlassTextarea({ label, className = "", id, ...props }: GlassTextareaProps) {
  const generatedId = React.useId();
  const textareaId = id || generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-xs font-medium text-white/70 pl-1">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          w-full px-3 py-2
          bg-white/8 backdrop-blur-md
          border border-white/15 rounded-xl
          text-sm text-white placeholder:text-white/40
          transition-all duration-150
          focus:outline-none focus:bg-white/12 focus:border-white/25 focus:ring-2 focus:ring-white/10
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-none
          ${className}
        `}
        {...props}
      />
    </div>
  );
}
