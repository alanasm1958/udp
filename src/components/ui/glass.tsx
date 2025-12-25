"use client";

import * as React from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   Glass Primitives - Liquid glass UI components
   ───────────────────────────────────────────────────────────────────────────── */

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

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function GlassInput({ label, className = "", id, ...props }: GlassInputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-white/70 pl-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3 py-2
          bg-white/8 backdrop-blur-md
          border border-white/15 rounded-xl
          text-sm text-white placeholder:text-white/40
          transition-all duration-150
          focus:outline-none focus:bg-white/12 focus:border-white/25 focus:ring-2 focus:ring-white/10
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      />
    </div>
  );
}

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

interface GlassTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  className?: string;
  emptyMessage?: string;
  monospaceColumns?: number[];
  rightAlignColumns?: number[];
}

export function GlassTable({
  headers,
  rows,
  className = "",
  emptyMessage = "No data",
  monospaceColumns = [],
  rightAlignColumns = [],
}: GlassTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((header, i) => (
              <th
                key={i}
                className={`
                  px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider
                  ${rightAlignColumns.includes(i) ? "text-right" : "text-left"}
                `}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-white/40 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-white/5 transition-colors duration-100"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`
                      px-4 py-3 text-sm text-white/90
                      ${monospaceColumns.includes(cellIndex) ? "font-mono" : ""}
                      ${rightAlignColumns.includes(cellIndex) ? "text-right tabular-nums" : ""}
                    `}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="text-sm text-white/50 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 mt-3 sm:mt-0">{actions}</div>}
    </div>
  );
}

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

interface GlassTabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function GlassTabs({ tabs, activeTab, onTabChange }: GlassTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            px-4 py-2 text-sm font-medium rounded-lg
            transition-all duration-150
            ${
              activeTab === tab.id
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white/80 hover:bg-white/5"
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

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
