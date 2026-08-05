"use client";

import { useState, useCallback } from "react";
import { IconCopy, IconCheck } from "@/lib/icons";

interface CitationCopyButtonProps {
  text: string;
  label?: string;
}

export function CitationCopyButton({ text, label = "کپی" }: CitationCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-medium text-labelSmall text-onSurfaceVariant hover:bg-surfaceVariant transition-colors touch-target"
      aria-label={`${label}: ${text}`}
      type="button"
    >
      {copied ? (
        <>
          <IconCheck size={14} className="text-success" />
          <span className="text-success">کپی شد</span>
        </>
      ) : (
        <>
          <IconCopy size={14} />
          {label}
        </>
      )}
    </button>
  );
}
