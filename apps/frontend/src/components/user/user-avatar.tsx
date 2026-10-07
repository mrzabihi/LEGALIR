// ============================================================
// LEGALIR — User avatar (single renderer for every surface)
// ============================================================
// The signed-in user's avatar appears in the app header, the sidebar, the
// admin shell and the profile hero. All of them read the SAME value —
// `profile.avatarUrl` from the shared `["me"]` query — and render it through
// this one component, so a preset pick or an upload shows up everywhere in the
// same frame (see `useUpdateProfile` / `useUploadUserAvatar`, which patch the
// `["me"]` cache before any refetch).
//
// A stored `avatarUrl` is one of:
//   • null            → no avatar → fall back to the name's initial
//   • "preset:<id>"   → one of the built-in vector presets
//   • "data:..."      → an inline image
//   • "/api/..."|http → an uploaded portrait served by the API
// If the image URL fails to load (a stale upload, an offline asset) we degrade
// to the initial rather than showing the browser's broken-image icon, so the
// surface is never blank or broken.

"use client";

import { useEffect, useState } from "react";
import { parsePresetToken, renderPresetAvatarSrc } from "@/lib/avatars/presets";

/** Collapse a stored `avatarUrl` into an `<img src>`, or null when unset. */
export function resolveAvatarSrc(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  const presetId = parsePresetToken(avatarUrl);
  if (presetId) return renderPresetAvatarSrc(presetId);
  return avatarUrl;
}

/** The name's first letter, or "ک" when there is no usable name. */
export function nameInitial(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed.charAt(0) : "ک";
}

export interface UserAvatarProps {
  /** `profile.avatarUrl` from the ["me"] cache — a preset token, an upload URL, or null. */
  avatarUrl?: string | null;
  /** Display name — the source of the initial fallback. */
  name?: string | null;
  /** Diameter in px (drives both the box and the initial's font size). */
  size?: number;
  /** Extra classes applied to whichever element renders. */
  className?: string;
  /** Classes for the initial circle — each surface keeps its own accent. */
  fallbackClassName?: string;
}

/**
 * Renders the user's chosen avatar image, or the name initial when there is
 * none (or the image fails). The one place every user-facing surface should
 * draw the signed-in user's identity from.
 */
export function UserAvatar({
  avatarUrl,
  name,
  size = 32,
  className = "",
  fallbackClassName = "bg-primary text-on-primary",
}: UserAvatarProps) {
  const src = resolveAvatarSrc(avatarUrl);
  const initial = nameInitial(name);
  const [failed, setFailed] = useState(false);

  // A new source (a preset pick / upload / delete) deserves a fresh attempt.
  useEffect(() => setFailed(false), [src]);

  const box = { width: size, height: size };

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={box}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${fallbackClassName} ${className}`}
      style={{ ...box, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
