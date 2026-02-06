"use client";

import * as React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4 text-white/40">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-white/50 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
