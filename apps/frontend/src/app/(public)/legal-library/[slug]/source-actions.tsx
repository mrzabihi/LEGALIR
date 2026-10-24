"use client";

// ============================================================
// LEGALIR — source detail actions (client island)
// ============================================================
// Bookmark / copy-citation / share are the only interactive parts of the source
// detail page. They live in this island so the page itself can stay a SERVER
// component and ship complete HTML for crawlers — the same split the blog
// article page uses for its reading progress and actions.
//
// Bookmarking requires a session: a guest is routed to /login rather than shown
// a control that would fail.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@legalir/ui";
import { useMe, useSetLegalBookmark } from "@/hooks/useDashboard";
import { IconCheckCircle, IconCopy, IconLinkSource } from "@/lib/icons";

function SvgIcon({
  children,
  size = 18,
  className = "",
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconBookmark = ({ filled, size = 18 }: { filled?: boolean; size?: number }) => (
  <SvgIcon size={size}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={filled ? "currentColor" : "none"} />
  </SvgIcon>
);

const IconShare = ({ size = 18 }: { size?: number }) => (
  <SvgIcon size={size}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
  </SvgIcon>
);

function ActionButton({
  label,
  icon,
  onClick,
  active,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={active ? "filled" : "secondary"}
      onClick={onClick}
      loading={loading}
      startIcon={icon}
      // Below tablet the visible label is hidden, so the button is
      // icon-only and needs an explicit accessible name.
      aria-label={label}
      aria-pressed={active}
    >
      <span className="hidden tablet:inline">{label}</span>
    </Button>
  );
}

export function SourceActions({
  id,
  title,
  authority,
  updatedAt,
  sourceUrl,
  isBookmarked,
}: {
  id: string;
  title: string;
  authority: string | null;
  updatedAt: string;
  sourceUrl: string | null;
  isBookmarked: boolean;
}) {
  const router = useRouter();
  const me = useMe();
  const setBookmark = useSetLegalBookmark(id);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // The page is server-rendered, so the stored flag arrives as a prop. Mirror it
  // in local state to flip the label in the same frame as the click, and resync
  // whenever the server sends a new value (after `router.refresh()`).
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  useEffect(() => setBookmarked(isBookmarked), [isBookmarked]);

  const isAuthed = Boolean(me.data?.user);

  const flashCopied = useCallback(() => {
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, []);

  const handleCopyCitation = useCallback(() => {
    const citation = `${title} — ${authority ?? ""} (${updatedAt})\n${
      sourceUrl ?? "لینک منبع ثبت نشده است"
    }`;
    navigator.clipboard
      .writeText(citation)
      .then(flashCopied)
      .catch(() => {
        // Clipboard API can be unavailable (insecure context / denied) — the
        // copy button simply does not flip to its "copied" state.
      });
  }, [title, authority, updatedAt, sourceUrl, flashCopied]);

  const handleShare = useCallback(async () => {
    const shareData = { title, text: title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        flashCopied();
      }
    } catch {
      /* user cancelled */
    }
  }, [title, flashCopied]);

  const handleBookmark = useCallback(() => {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    setBookmark.mutate(next, {
      // Reconcile with the server either way: on success the refresh confirms
      // the new flag, on failure it reverts the optimistic flip.
      onSettled: () => router.refresh(),
    });
  }, [isAuthed, router, setBookmark, bookmarked]);

  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <ActionButton
        label={bookmarked ? "ذخیره‌شده" : "ذخیره"}
        icon={<IconBookmark filled={bookmarked} />}
        onClick={handleBookmark}
        active={bookmarked}
        loading={setBookmark.isPending}
      />
      <ActionButton
        label={copyFeedback ? "کپی شد" : "کپی ارجاع"}
        icon={copyFeedback ? <IconCheckCircle className="text-success" /> : <IconCopy />}
        onClick={handleCopyCitation}
      />
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-4 py-2.5 text-button font-medium text-on-surface transition-colors hover:bg-surface-hover active:scale-[0.97] touch-target"
        >
          <IconLinkSource />
          <span className="hidden tablet:inline">مشاهده منبع</span>
        </a>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface-container px-4 py-2.5 text-caption text-muted">
          <IconLinkSource className="opacity-40" />
          لینک منبع ثبت نشده است
        </span>
      )}
      <ActionButton label="اشتراک‌گذاری" icon={<IconShare />} onClick={handleShare} />
    </div>
  );
}
