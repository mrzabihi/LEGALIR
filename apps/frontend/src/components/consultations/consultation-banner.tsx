"use client";

// ============================================================
// LEGALIR — Human-vs-AI distinction banner
// ============================================================
// A persistent, unmissable marker that this room is a consultation with
// a HUMAN lawyer, not the AI assistant. It also states plainly that the
// AI chat history is never shared automatically — the client decides
// what to disclose.
// ============================================================

import { IconBalance, IconInfo } from "@/lib/icons";

export function ConsultationBanner() {
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <IconBalance size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-body-2 font-semibold text-on-surface">
          مشاوره با وکیل انسانی
        </p>
        <p className="mt-0.5 text-caption text-muted">
          این گفت‌وگو خصوصی و مخصوص همین پرونده است. تاریخچه گفت‌وگوی شما با دستیار هوشمند
          به‌صورت خودکار با وکیل به اشتراک گذاشته نمی‌شود.
        </p>
      </div>
    </div>
  );
}

/** A quieter inline note used inside the wizard's review step. */
export function InfoSharingNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-surface-container p-3 text-caption text-muted">
      <IconInfo size={16} className="mt-0.5 shrink-0" />
      <span>
        با ارسال این درخواست، خلاصه موضوع و پیوست‌هایی که انتخاب می‌کنید برای وکیل نمایش داده
        می‌شود. سایر گفت‌وگوها و اسناد شما به اشتراک گذاشته نمی‌شود.
      </span>
    </div>
  );
}
