"use client";

import * as React from "react";

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function GlassSelect({ label, options, className = "", id, ...props }: GlassSelectProps) {
  const generatedId = React.useId();
  const selectId = id || generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-white/70 pl-1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full px-3 py-2
          bg-white/8 backdrop-blur-md
          border border-white/15 rounded-xl
          text-sm text-white
          transition-all duration-150
          focus:outline-none focus:bg-white/12 focus:border-white/25 focus:ring-2 focus:ring-white/10
          disabled:opacity-50 disabled:cursor-not-allowed
          [&>option]:bg-zinc-900 [&>option]:text-white
          ${className}
        `}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
