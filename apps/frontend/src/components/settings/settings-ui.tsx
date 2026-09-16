// ============================================================
// LEGALIR — Settings UI primitives
// ============================================================
// Small, dependency-free building blocks shared by every /settings/*
// sub-page: a card wrapper, an accessible toggle switch, a toggle
// group, and the loading / error / empty states. Extracted from the
// former monolithic settings page so each sub-route stays focused.
// ============================================================

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
        <div className="flex items-center justify-between gap-3 border-b border-divider/70 bg-surface-container/40 px-6 py-4">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
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

/** Accessible toggle switch. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="group -mx-3 flex items-center justify-between gap-4 rounded-medium px-3 py-3.5 transition-colors hover:bg-surface-container/60">
      <div className="flex flex-col gap-0.5">
        <span className={`text-body-1 ${disabled ? "text-muted" : "text-on-surface"}`}>
          {label}
        </span>
        {description && <span className="text-body-2 text-muted">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
        } ${
          checked
            ? "bg-success focus-visible:ring-success/50"
            : "bg-error focus-visible:ring-error/50"
        }`}
      >
        <span
          className={`inline-block h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ease-out group-active:scale-95 ${
            checked ? "translate-x-[20px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export interface ToggleItem {
  key: string;
  label: string;
  description?: string;
}

/** A vertical group of toggles backed by a flat boolean map. */
export function PreferenceToggleGroup({
  items,
  values,
  onChange,
  disabled,
  saving,
}: {
  items: ToggleItem[];
  values: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  disabled: boolean;
  saving: boolean;
}) {
  return (
    <div className="divide-y divide-divider/70">
      {items.map((item) => (
        <Toggle
          key={item.key}
          label={item.label}
          description={item.description}
          checked={!!values[item.key]}
          disabled={disabled || saving}
          onChange={(v) => onChange(item.key, v)}
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
    <div className="flex flex-col items-center gap-3 rounded-large bg-error/10 p-6 text-center">
      <IconWarning className="text-error" size={28} />
      <p className="text-body-1 text-error">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-2 text-primary transition hover:bg-primary/10"
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
