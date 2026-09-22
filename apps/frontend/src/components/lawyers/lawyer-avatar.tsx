"use client";

// ============================================================
// LEGALIR — Lawyer Avatar
// ============================================================
// Circular portrait with a fixed footprint (no layout shift), a subtle
// ring, and an optional availability dot. When the image is missing or
// fails to load we fall back to an initials chip — the card never shows a
// broken image.
//
// Demo portraits are synthetic. The alt text says «تصویر نمایه» (profile
// image) and never claims to be a real photograph of the named person.
// ============================================================

import { useState } from "react";
import type { LawyerAvatarType } from "@legalir/types";
import { TONE_DOT_CLASS, type AvailabilityTone } from "@/lib/lawyers/availability";

interface LawyerAvatarProps {
  name: string;
  avatarUrl: string | null;
  avatarType: LawyerAvatarType;
  /** Rendered size in px. The card uses 72 on desktop, 64 on mobile. */
  size?: number;
  /** When set, a small status dot is pinned to the avatar. */
  tone?: AvailabilityTone;
  className?: string;
}

/** First letter of the first two name parts, e.g. «علی ذبیحی» → «ع ذ». */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return `${first}${second ? ` ${second}` : ""}`;
}

export function LawyerAvatar({
  name,
  avatarUrl,
  avatarType,
  size = 72,
  tone,
  className = "",
}: LawyerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary/10 shadow-elevation-1 ring-2 ring-surface">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl!}
            alt={`تصویر نمایه ${name}`}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            data-avatar-type={avatarType}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={`تصویر نمایه ${name}`}
            className="select-none font-semibold text-primary-700"
            style={{ fontSize: Math.round(size * 0.32) }}
          >
            {initials(name)}
          </span>
        )}
      </div>

      {tone && (
        <span
          className={`absolute bottom-0.5 left-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface ${TONE_DOT_CLASS[tone]}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
