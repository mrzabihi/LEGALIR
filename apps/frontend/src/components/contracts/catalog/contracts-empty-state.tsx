// ============================================================
// LEGALIR — Contract catalog empty state
// ============================================================
// Exactly the copy the brief specifies for a search/filter that returns
// nothing. The CTA files a real «درخواست قرارداد جدید» request (see
// `ActivateServiceCta`) — it does not fake a success.

import { IconSearch } from "@/lib/icons";
import { ActivateServiceCta } from "./activate-service-cta";

interface ContractsEmptyStateProps {
  /** The query the user searched with, echoed back for context. */
  query?: string;
}

export function ContractsEmptyState({ query }: ContractsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface px-4 py-14 text-center">
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-xlarge bg-surface-container text-muted"
      >
        <IconSearch size={30} />
      </span>
      <h3 className="text-body-1 font-medium text-on-surface">
        قرارداد موردنظر خود را پیدا نکردید؟
      </h3>
      <p className="max-w-md text-body-2 text-on-surface-variant">
        {query ? (
          <>
            برای «{query}» قراردادی یافت نشد. اگر نوع قرارداد موردنظر شما در فهرست نیست، می‌توانید
            درخواست خود را ثبت کنید تا در توسعه خدمات آینده لیگالیر در نظر گرفته شود.
          </>
        ) : (
          <>
            اگر نوع قرارداد موردنظر شما در فهرست نیست، می‌توانید درخواست خود را ثبت کنید تا در
            توسعه خدمات آینده لیگالیر در نظر گرفته شود.
          </>
        )}
      </p>
      <div className="mt-2">
        <ActivateServiceCta />
      </div>
    </div>
  );
}
