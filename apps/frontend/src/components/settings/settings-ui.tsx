// ============================================================
// LEGALIR — Settings UI primitives
// ============================================================
// Small, dependency-free building blocks shared by every /settings/*
// sub-page: a card wrapper, an accessible toggle switch, a toggle
// group, and the loading / error / empty states. Extracted from the
// former monolithic settings page so each sub-route stays focused.
// ============================================================

import { SwitchRow } from "@legalir/ui";
import { IconInfo, IconRefresh, IconWarning } from "@/lib/icons";

/** Card wrapper used by every settings section. */
export function SettingsCard({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-large bg-surface shadow-elevation-1 border border-divider mb-6 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-divider bg-surface-container px-6 py-4">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-primary-container text-primary">
                {icon}
              </span>
            )}
            {title && <h2 className="text-h3 text-on-surface">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export interface ToggleItem {
  key: string;
  label: string;
  description?: string;
}

/**
 * A vertical group of boolean preferences backed by a flat map.
 *
 * Every row renders the ONE shared `SwitchRow` from `@legalir/ui` — no local
 * look-alike. `savingKey` and `failedKey` let a single row show its own
 * in-flight / failed state, so the rest of the list stays usable while one
 * preference is being written.
 */
export function PreferenceToggleGroup({
  items,
  values,
  onChange,
  disabled,
  saving,
  savingKey,
  failedKey,
  errorMessage,
  disabledReason,
}: {
  items: ToggleItem[];
  values: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  disabled: boolean;
  saving: boolean;
  /** The key currently being written. */
  savingKey?: string | null;
  /** The key whose last write failed — its error is shown under that row. */
  failedKey?: string | null;
  errorMessage?: string | null;
  disabledReason?: string;
}) {
  return (
    <div className="divide-y divide-divider">
      {items.map((item) => (
        <SwitchRow
          key={item.key}
          label={item.label}
          description={item.description}
          checked={!!values[item.key]}
          disabled={disabled}
          disabledReason={disabled ? disabledReason : undefined}
          saving={saving && savingKey === item.key}
          error={failedKey === item.key ? errorMessage ?? undefined : undefined}
          onChange={(e) => onChange(item.key, e.target.checked)}
          className="py-1.5"
        />
      ))}
    </div>
  );
}

/** Inline "saving…" indicator shown while a preference mutation is in flight. */
export function SavingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-muted">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      در حال ذخیره...
    </span>
  );
}

function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return <div className={`h-4 ${width} bg-divider rounded animate-pulse`} />;
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-large bg-error-container p-6 text-center">
      <IconWarning className="text-error" size={28} />
      <p className="text-body-1 text-error">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-surface-hover"
        >
          <IconRefresh size={16} />
          تلاش مجدد
        </button>
      )}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <IconInfo size={32} className="text-muted" />
      <p className="text-body-2 text-muted">{text}</p>
    </div>
  );
}
