// ============================================================
// LEGALIR — Contract comment composer
// ============================================================
// The FORM that writes a note about a contract. The thread itself is
// rendered by the review step; this file owns the composition rules:
//
//   • a note is typed (نظر / درخواست تغییر / یادداشت تأیید);
//   • it may be anchored to ONE clause — the options come from the SAME
//     rendered clause list the preview and the PDF use, so an anchor can
//     never point at a section this contract does not contain;
//   • its audience is an explicit choice — `internal` notes never reach
//     the counterparty, the signer page or the print version;
//   • a reply is bound to its parent's version (the server rejects a
//     cross-version reply), so a thread never spans two revisions.
//
// Nothing here edits the document text: comments live in their own
// table, keyed by the contract version they were written against.
// ============================================================

"use client";

import React, { useState } from "react";
import { Button, Textarea } from "@legalir/ui";
import { ChoiceField, Notice } from "./primitives";
import { useAddReviewComment } from "@/hooks/useContractLifecycle";
import type { ReviewCommentKind, ReviewCommentVisibility } from "@legalir/types";

/** The clause fields the composer needs — a subset of `RenderedClause`. */
export interface CommentClauseOption {
  id: string;
  headingFa: string;
}

export interface ContractCommentComposerProps {
  contractId: string;
  /** The version a new note is bound to; null blocks writing. */
  currentVersionId: string | null;
  /** The document's real clauses, in print order. */
  clauses: CommentClauseOption[];
  /** The comment being replied to, if any. */
  replyTo: string | null;
  /** Label of the reply target, for the "replying to" strip. */
  replyToLabelFa?: string;
  onCancelReply: () => void;
  /** The audience a new note starts with. */
  initialVisibility?: ReviewCommentVisibility;
}

const KIND_OPTIONS: { value: ReviewCommentKind; label: string }[] = [
  { value: "comment", label: "نظر" },
  { value: "change_request", label: "درخواست تغییر" },
  { value: "approval_note", label: "یادداشت تأیید" },
];

export function ContractCommentComposer({
  contractId,
  currentVersionId,
  clauses,
  replyTo,
  replyToLabelFa,
  onCancelReply,
  initialVisibility = "internal",
}: ContractCommentComposerProps) {
  const addComment = useAddReviewComment();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<ReviewCommentKind>("comment");
  const [visibility, setVisibility] = useState<ReviewCommentVisibility>(initialVisibility);
  const [clauseRef, setClauseRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (!text || !currentVersionId) return;
    setError(null);
    try {
      await addComment.mutateAsync({
        id: contractId,
        body: text,
        kind,
        visibility,
        clauseRef: clauseRef || null,
        parentId: replyTo,
      });
      setBody("");
      setClauseRef("");
      if (replyTo) onCancelReply();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نظر ناموفق بود");
    }
  }

  // Without a frozen version there is nothing to attach a note to, and
  // the server would refuse the write — say so instead of failing late.
  if (!currentVersionId) {
    return (
      <Notice tone="info">
        برای ثبت نظر، ابتدا محتوای قرارداد را برای بررسی ارسال کنید تا نسخه‌ای که نظر به آن گره
        می‌خورد ساخته شود.
      </Notice>
    );
  }

  return (
    <div className="space-y-2">
      {replyTo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-medium bg-surface-container p-2">
          <span className="text-caption text-muted">
            در پاسخ به {replyToLabelFa ?? "نظر انتخاب‌شده"} — پاسخ در همان نسخه ثبت می‌شود.
          </span>
          <Button size="small" variant="text" onClick={onCancelReply}>
            لغو پاسخ
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
        <ChoiceField label="نوع" value={kind} onChange={setKind} options={KIND_OPTIONS} />
        <ChoiceField
          label="بند مرتبط (اختیاری)"
          value={clauseRef}
          onChange={setClauseRef}
          options={[
            { value: "", label: "کل قرارداد" },
            ...clauses.map((c) => ({ value: c.id, label: c.headingFa })),
          ]}
        />
      </div>

      <Textarea
        label={replyTo ? "متن پاسخ" : "نظر یا درخواست اصلاح"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="نظر یا درخواست اصلاح خود را بنویسید…"
        fullWidth
      />

      <ChoiceField
        label="دسترسی این نظر"
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: "internal", label: "داخلی — فقط در کارگاه من" },
          { value: "parties", label: "مشترک با طرفین" },
        ]}
        helperText="نظر داخلی در صفحهٔ امضا و نسخهٔ چاپی طرف مقابل نمایش داده نمی‌شود."
      />

      {error && <Notice tone="error">{error}</Notice>}

      <Button
        size="small"
        disabled={!body.trim()}
        loading={addComment.isPending}
        onClick={() => void submit()}
      >
        {replyTo ? "ثبت پاسخ" : "ثبت نظر"}
      </Button>
    </div>
  );
}
