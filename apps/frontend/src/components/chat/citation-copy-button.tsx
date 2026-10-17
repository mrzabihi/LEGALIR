"use client";

import { useState, useCallback } from "react";
import { Button } from "@legalir/ui";
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
    <Button
      type="button"
      variant="text"
      size="small"
      onClick={handleCopy}
      aria-label={`${label}: ${text}`}
      startIcon={copied ? <IconCheck size={14} className="text-success" /> : <IconCopy size={14} />}
    >
      <span className={copied ? "text-success" : undefined}>
        {copied ? "کپی شد" : label}
      </span>
    </Button>
  );
}
