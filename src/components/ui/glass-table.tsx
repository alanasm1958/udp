"use client";

import * as React from "react";

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
