// ============================================================
// LEGALIR — Lawyer workbench · Settlement account (حساب تسویه)
// ============================================================
// §7's secure section: the holder name, bank, IBAN, account number and card
// used to settle fees.
//
// The form itself is `components/lawyer/settlement-account.tsx` — the SAME
// component the profile and /lawyer/settings render, so the validation, the
// copy and the mutation exist once. This page is only the full-width host: it
// pairs the editor with the stored record and the immutable event log.
//
//   · The full IBAN comes back ONLY to the owning lawyer — the route resolves
//     the lawyer from the session, and every other surface (admin list, audit,
//     events) reads a masked form.
//   · Saving a change returns the record to PENDING_REVIEW and appends an
//     immutable event; an authorised operator then verifies it or returns it
//     for correction with a recorded reason.
// ============================================================

"use client";

import { useLawyerBank } from "@/hooks/useLawyerPortal";
import { PageHeader } from "@/components/admin/ui";
import {
  SettlementAccountForm,
  SettlementAccountSummary,
  bankStatusBadge,
} from "@/components/lawyer/settlement-account";
import { IconBalance } from "@/lib/icons";

export default function LawyerBankPage() {
  const query = useLawyerBank();

  return (
    <div>
      <PageHeader
        title="حساب تسویه"
        description="شماره شبای شما برای واریز دستمزد. این اطلاعات فقط برای شما و تیم مالی مجاز نمایش داده می‌شود."
        icon={<IconBalance size={22} />}
        actions={query.data ? bankStatusBadge(query.data.status) : undefined}
      />

      <div className="grid gap-5 laptop:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <SettlementAccountForm />
        <SettlementAccountSummary />
      </div>
    </div>
  );
}
