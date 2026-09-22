// ============================================================
// LEGALIR — ArticleToc
// ============================================================
// The article's table of contents. On desktop it is a sticky rail
// beside the reading column; on mobile it collapses into a
// disclosure above the article so it never pushes the first
// paragraph below the fold.
//
// The active heading is tracked with an IntersectionObserver, so the
// rail highlights where the reader actually is without a scroll
// handler. Anchors are real `<a href="#id">` links — they work with
// keyboard, with the browser's own history, and with print.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { IconChevronDown } from "@/lib/icons";

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function ArticleToc({
  headings,
  variant = "rail",
}: {
  headings: TocHeading[];
  /** `rail` is the desktop sidebar; `disclosure` is the mobile block. */
  variant?: "rail" | "disclosure";
}) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // A band just under the sticky header: a heading becomes active
      // as it enters the top quarter of the viewport.
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const list = (
    <ul className="space-y-1">
      {headings.map((h) => {
        const active = h.id === activeId;
        return (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={active ? "location" : undefined}
              onClick={() => setOpen(false)}
              className={`block border-s-2 py-1.5 pe-2 text-body-2 leading-relaxed transition-colors duration-short3 ${
                h.level === 3 ? "ps-6" : "ps-3"
              } ${
                active
                  ? "border-secondary-500 text-primary-800 font-medium"
                  : "border-transparent text-muted hover:text-primary-700 hover:border-divider"
              }`}
            >
              {h.text}
            </a>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "disclosure") {
    return (
      <nav
        aria-label="فهرست مطالب"
        className="no-print rounded-large border border-divider bg-surface-container-low"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-labelLarge text-primary-800"
        >
          فهرست مطالب
          <IconChevronDown
            size={18}
            className={`text-muted transition-transform duration-medium1 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && <div className="px-4 pb-4">{list}</div>}
      </nav>
    );
  }

  return (
    <nav aria-label="فهرست مطالب" className="no-print">
      <p className="text-labelLarge text-primary-800 mb-3">فهرست مطالب</p>
      {list}
    </nav>
  );
}
