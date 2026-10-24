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
import { Button, buttonClasses } from "@legalir/ui";
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

// The source-link slot is a chip in BOTH states (usable link / not recorded), so
// it is one box contract — and that contract is `Button`'s medium box: `h-10`,
// `max-desktop:min-h-11`, `rounded-medium`, `whitespace-nowrap`. The link branch
// reaches it through `buttonClasses()`; this mirrors it by hand for the inert
// chip, which must not inherit a button's hover/press state layers (a status
// chip that lights up under the cursor claims to be clickable).
//
// The row used to mix three boxes. Measured on a 390px viewport: the buttons
// stood 44px, the link chip 48px (`.touch-target`'s floor, unreachable here
// because no seeded source has a URL yet), and the "not recorded" chip wrapped
// its sentence onto two lines and stood 62px. The row is `items-center`, so
// that read as a mis-alignment, not as hierarchy.
const INERT_CHIP_CLASS = [
  "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap",
  "rounded-medium border border-divider bg-surface-container px-5",
  "text-caption text-muted",
  "max-desktop:min-h-11",
].join(" ");

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
      // The row is a `scrollbar-hide` scroller. `Button` is
      // `overflow-hidden` + `whitespace-nowrap`, so a squeezed button clips
      // its own label — and with the scrollbar hidden, that clipping is
      // invisible and unrecoverable. Refusing to shrink makes the row scroll
      // instead, which is the whole point of `overflow-x-auto` here.
      className="shrink-0"
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
          // A navigation target wearing the button primitive's own classes,
          // which is what `buttonClasses()` is exported for. Hand-rolling this
          // is how it drifted out of the row in the first place.
          className={buttonClasses({ variant: "secondary" })}
          // Below tablet the visible label is hidden (same density rule as the
          // sibling ActionButtons), so the link is icon-only and needs a name of
          // its own — it had none before.
          aria-label="مشاهده منبع"
        >
          <IconLinkSource />
          <span className="hidden tablet:inline">مشاهده منبع</span>
        </a>
      ) : (
        <span className={INERT_CHIP_CLASS}>
          <IconLinkSource className="opacity-40" />
          {/* The full sentence does not fit beside three 57px icon buttons on a
              390px viewport, and being content it cannot be hidden on small
              screens the way an action's label can. Short form there, the real
              sentence from tablet up. */}
          <span className="tablet:hidden">بدون لینک</span>
          <span className="hidden tablet:inline">لینک منبع ثبت نشده است</span>
        </span>
      )}
      <ActionButton label="اشتراک‌گذاری" icon={<IconShare />} onClick={handleShare} />
    </div>
  );
}
