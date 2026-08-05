"use client";

import React from "react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Full-page mode (centered, larger padding) */
  fullPage?: boolean;
  className?: string;
}

const ErrorIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-error/60">
    <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="2" />
    <path d="M32 20v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="32" cy="43" r="2" fill="currentColor" />
  </svg>
);

export function ErrorState({
  title = "خطایی رخ داده است",
  message = "لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید",
  onRetry,
  fullPage = false,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        fullPage ? "min-h-[400px] py-20" : "py-8"
      } px-4 ${className}`}
      role="alert"
    >
      <div className="mb-4">
        <ErrorIcon />
      </div>
      <h3 className="text-titleLarge text-onSurface mb-1">{title}</h3>
      <p className="text-bodyMedium text-onSurfaceVariant max-w-sm mb-6">
        {message}
      </p>
      {onRetry && (
        <Button variant="filled" onClick={onRetry}>
          تلاش مجدد
        </Button>
      )}
    </div>
  );
}
