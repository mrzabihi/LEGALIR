// ============================================================
// LEGALIR — Preset profile avatars (pure, no I/O)
// ============================================================
// Five minimal, brand-consistent avatars a user can pick without uploading a
// photograph. Each is an abstract silhouette (head + shoulders) on a soft
// brand-tinted disc — deliberately NOT a real face and NOT a monogram.
//
// A chosen preset is persisted on the profile as `avatarUrl = "preset:<id>"`,
// so the value stays small, readable and reversible (delete/reset simply
// clears the field). An uploaded portrait instead stores a real URL served by
// `/api/v1/me/avatar`.

export interface AvatarPreset {
  id: string;
  /** Persian label shown under the swatch. */
  label: string;
  /** Soft background disc colour. */
  bg: string;
  /** Silhouette colour. */
  fg: string;
}

/** The five presets, in display order. Brand-green first. */
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: "sprout", label: "سبز", bg: "#DCF3EA", fg: "#12735A" },
  { id: "teal", label: "فیروزه", bg: "#D6EDF0", fg: "#0F6C78" },
  { id: "indigo", label: "نیلی", bg: "#E0E4F6", fg: "#3B4C9E" },
  { id: "amber", label: "کهربا", bg: "#F6EAD2", fg: "#93660F" },
  { id: "plum", label: "بنفش", bg: "#EEE0F1", fg: "#7A3B8A" },
] as const;

const PREFIX = "preset:";

/** The stored value for a preset id. */
export function presetToken(id: string): string {
  return `${PREFIX}${id}`;
}

/** The preset id in a stored avatarUrl, or null when it is not a preset. */
export function parsePresetToken(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(PREFIX)) return null;
  const id = value.slice(PREFIX.length);
  return AVATAR_PRESETS.some((p) => p.id === id) ? id : null;
}

/** True when the stored avatarUrl is an uploaded file (not a preset). */
export function isUploadedAvatar(value: string | null | undefined): boolean {
  return Boolean(value) && !value!.startsWith(PREFIX) && !value!.startsWith("data:");
}

/** The SVG data-URI for a preset, suitable for an `<img src>`. */
export function renderPresetAvatarSrc(id: string): string {
  const preset = AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0]!;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">` +
    `<rect width="120" height="120" rx="60" fill="${preset.bg}"/>` +
    `<circle cx="60" cy="47" r="20" fill="${preset.fg}"/>` +
    `<path d="M24 120c0-20 16-34 36-34s36 14 36 34z" fill="${preset.fg}"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
