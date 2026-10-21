// ============================================================
// LEGALIR — Lawyer workbench · Settings (تنظیمات)
// ============================================================
// The one place a lawyer can review and change everything about their working
// account without hopping between pages:
//
//   · contact — the mobile the account signs in with, read from the session
//     `me` payload. It is NOT editable here: changing a sign-in mobile is an
//     OTP flow owned by the auth module, and faking an editable field that
//     cannot save would be a dead control.
//   · availability — the two switches that decide whether new referrals reach
//     the lawyer. Written through the SAME `PATCH /api/v1/lawyer/profile`
//     the profile page uses, so the marketplace reflects it immediately.
//   · settlement account — the shared `SettlementAccountForm`: holder, bank,
//     IBAN, account number and card, with the same Luhn validation and the
//     same review workflow as /lawyer/bank.
//
// Everything is the existing source of truth; nothing is duplicated.
// ============================================================

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMe } from "@/hooks/useDashboard";
import { useLawyerProfile, useUpdateLawyerProfile } from "@/hooks/useLawyerPortal";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
  PageHeader,
} from "@/components/admin/ui";
import {
  SettlementAccountForm,
  SettlementAccountSummary,
} from "@/components/lawyer/settlement-account";
import { SwitchRow, snackbar } from "@legalir/ui";
import { ApiClientError } from "@/lib/api/errors";
import { LAWYER_VERIFICATION_FA } from "@legalir/types";
import { IconChevronLeft, IconPerson, IconSettings, IconShield } from "@/lib/icons";

function ContactCard() {
  const me = useMe();

  return (
    <Card>
      <CardHeader
        title="اطلاعات تماس"
        subtitle="شمارهٔ موبایلِ ورود به حساب؛ برای تغییر آن با پشتیبانی تماس بگیرید."
      />
      <CardBody>
        {me.isLoading ? (
          <LoadingBlock rows={2} />
        ) : me.isError || !me.data ? (
          <ErrorBlock message="خطا در بارگذاری اطلاعات حساب" onRetry={() => me.refetch()} />
        ) : (
          <dl className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-caption text-muted">نام نمایشی</dt>
              <dd className="text-body-2 text-on-surface">{me.data.profile.displayName}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-caption text-muted">موبایل</dt>
              <dd className="font-mono text-body-2 text-on-surface" dir="ltr">
                {me.data.user.mobileDisplay}
              </dd>
            </div>
            {me.data.profile.email && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-caption text-muted">ایمیل</dt>
                <dd className="break-all text-body-2 text-on-surface" dir="ltr">
                  {me.data.profile.email}
                </dd>
              </div>
            )}
            {me.data.user.publicId && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-caption text-muted">شناسهٔ حساب</dt>
                <dd className="font-mono text-body-2 text-on-surface" dir="ltr">
                  {me.data.user.publicId}
                </dd>
              </div>
            )}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function AvailabilityCard({
  acceptingRequests,
  acceptingClients,
}: {
  acceptingRequests: boolean;
  acceptingClients: boolean;
}) {
  const save = useUpdateLawyerProfile();
  const [requests, setRequests] = useState(acceptingRequests);
  const [clients, setClients] = useState(acceptingClients);
  const [error, setError] = useState<string | null>(null);
  const dirty = requests !== acceptingRequests || clients !== acceptingClients;

  // Re-seed when the server row changes underneath us (another tab, an
  // operator edit) so the switches never show a value that is not saved.
  useEffect(() => {
    setRequests(acceptingRequests);
    setClients(acceptingClients);
  }, [acceptingRequests, acceptingClients]);

  async function saveAvailability() {
    setError(null);
    try {
      await save.mutateAsync({ acceptingRequests: requests, acceptingClients: clients });
      snackbar.show({ message: "وضعیت پذیرش ذخیره شد.", variant: "success" });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : "ذخیرهٔ وضعیت ناموفق بود.");
    }
  }

  return (
    <Card>
      <CardHeader
        title="پذیرش پرونده"
        subtitle="این وضعیت بلافاصله بر ارجاع‌های جدید اثر می‌گذارد."
      />
      <CardBody>
        {error && (
          <InlineNotice tone="error" className="mb-3">
            {error}
          </InlineNotice>
        )}
        <SwitchRow
          label="پذیرش درخواست جدید"
          description="اگر خاموش باشد، درخواست تازه‌ای به شما ارجاع نمی‌شود."
          checked={requests}
          onChange={(e) => setRequests(e.target.checked)}
        />
        <SwitchRow
          label="پذیرش موکل جدید"
          description="وضعیتی که در پروفایل عمومی دیده می‌شود."
          checked={clients}
          onChange={(e) => setClients(e.target.checked)}
        />
        <div className="flex justify-end pt-2">
          <Button
            onClick={() => void saveAvailability()}
            loading={save.isPending}
            disabled={!dirty}
          >
            ذخیرهٔ وضعیت پذیرش
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function LawyerSettingsPage() {
  const profile = useLawyerProfile();

  if (profile.isLoading) return <LoadingBlock rows={6} />;
  if (profile.isError || !profile.data)
    return <ErrorBlock message="خطا در بارگذاری تنظیمات" onRetry={() => profile.refetch()} />;

  const p = profile.data.profile;

  return (
    <div>
      <PageHeader
        title="تنظیمات"
        description="اطلاعات تماس، وضعیت پذیرش پرونده و حساب تسویه — همه در یک صفحه."
        icon={<IconSettings size={22} />}
        actions={
          <Badge tone={p.verificationStatus === "VERIFIED" ? "success" : "neutral"}>
            <IconShield size={13} className="me-1" aria-hidden="true" />
            {LAWYER_VERIFICATION_FA[p.verificationStatus]}
          </Badge>
        }
      />

      <div className="grid gap-5 laptop:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-5">
          <ContactCard />
          <AvailabilityCard
            acceptingRequests={p.acceptingRequests}
            acceptingClients={p.acceptingClients ?? true}
          />
          <SettlementAccountForm title="حساب تسویه" />
        </div>

        <div className="space-y-5">
          <SettlementAccountSummary events={false} />

          <Card>
            <CardHeader title="بخش‌های مرتبط" />
            <CardBody className="space-y-2">
              <Link
                href="/lawyer/profile"
                className="flex items-center justify-between rounded-medium border border-divider px-3 py-2.5 text-body-2 text-on-surface transition-colors hover:border-primary-300 hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2">
                  <IconPerson size={16} /> پروفایل حرفه‌ای
                </span>
                <IconChevronLeft size={15} className="text-muted" />
              </Link>
              <Link
                href="/lawyer/bank"
                className="flex items-center justify-between rounded-medium border border-divider px-3 py-2.5 text-body-2 text-on-surface transition-colors hover:border-primary-300 hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2">
                  <IconShield size={16} /> سابقهٔ حساب تسویه
                </span>
                <IconChevronLeft size={15} className="text-muted" />
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
