"use client";

import * as React from "react";

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
