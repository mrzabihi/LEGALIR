"use client";

import React from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const DefaultIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-onSurfaceVariant/40">
    <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
    <path d="M8 20h48" stroke="currentColor" strokeWidth="2" />
    <circle cx="14" cy="17" r="2" fill="currentColor" />
    <circle cx="20" cy="17" r="2" fill="currentColor" />
    <line x1="24" y1="44" x2="40" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="24" y1="52" x2="36" y2="52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}
      role="status"
    >
      <div className="mb-4 text-onSurfaceVariant/40">
        {icon || <DefaultIcon />}
      </div>
      <h3 className="text-titleLarge text-onSurface mb-1">{title}</h3>
      {description && (
        <p className="text-bodyMedium text-onSurfaceVariant max-w-sm mb-6">
          {description}
        </p>
      )}
      <div className="flex items-center gap-3">
        {secondaryAction && (
          <Button variant="outlined" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
        {action && (
          <Button variant="filled" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
