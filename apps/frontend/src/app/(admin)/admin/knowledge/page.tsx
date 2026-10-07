// ============================================================
// LEGALIR — Admin · Legal Knowledge Inventory
// ============================================================
// The staff surface for the Legal Knowledge Engine. It lists every legal
// source the AI can cite, with:
//
//   • its AUTHORITY TIER (قانون اساسی > قانون > آیین‌نامه > رویه > نظر)
//   • its PROVENANCE (which pass surfaced it, its content hash)
//   • its VERIFICATION STATUS (so unverified content can be found)
//
// Read-only: the knowledge base is seeded from the official law catalog
// and the ingested corpus, so there is no free-form write path.
//
// Presentation: the shell (AdminShell) already gates the whole panel on a
// platform-staff role and provides the padding/RTL context, so this page is
// a thin, token-driven view over the same `useKnowledgeInventory` query.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useKnowledgeInventory } from "@/hooks/useKnowledge";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconShield,
  IconShieldCheck,
  IconWarning,
  IconDocument,
  IconDatabase,
  IconHistory,
} from "@/lib/icons";
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  StateView,
  FilterPills,
  ExportButton,
} from "@/components/admin/ui";
import type { KnowledgeInventoryItem } from "@legalir/types";

const TIER_ORDER = [
  "CONSTITUTION",
  "STATUTE",
  "REGULATION",
  "PRECEDENT",
  "OPINION",
  "USER_DOCUMENT",
] as const;

// Solid, token-driven tones (no raw palette / opacity modifiers, which emit
// nothing on a var() colour under Tailwind 3.4). Higher authority reads as a
// stronger tone; the tail tiers fall back to neutral.
type BadgeTone = "brand" | "info" | "warning" | "neutral";

const TIER_TONE: Record<string, BadgeTone> = {
  CONSTITUTION: "brand",
  STATUTE: "info",
  REGULATION: "info",
  PRECEDENT: "warning",
  OPINION: "neutral",
  USER_DOCUMENT: "neutral",
};

const VERIFICATION_FA: Record<string, string> = {
  VERIFIED_OFFICIAL: "تأیید رسمی",
  VERIFIED_SECONDARY: "تأیید ثانویه",
  DEMO_VERIFIED: "تأیید نمایشی",
  UNVERIFIED: "تأییدنشده",
};

const ORIGIN_FA: Record<string, string> = {
  LIBRARY: "کتابخانه حقوقی",
  CATALOG: "فهرست قوانین",
  CORPUS: "پیکره ایندکس‌شده",
};

function SourceRow({ item }: { item: KnowledgeInventoryItem }) {
  return (
    <li className="flex flex-col gap-2 bg-surface px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TIER_TONE[item.tier] ?? "neutral"}>{item.tierFa}</Badge>
          <span className="truncate text-body-2 font-medium text-on-surface">{item.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <span>{item.authority}</span>
          {item.locator && <span className="tabular-nums">{item.locator}</span>}
          <span>{ORIGIN_FA[item.origin] ?? item.origin}</span>
          {item.textHash && (
            <span className="font-mono" dir="ltr" title={item.textHash}>
              {item.textHash.slice(0, 10)}…
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone="neutral">
          {VERIFICATION_FA[item.verificationStatus] ?? item.verificationStatus}
        </Badge>
        {item.status !== "valid" && <Badge tone="warning">{item.status}</Badge>}
      </div>
    </li>
  );
}

export default function AdminKnowledgePage() {
  const [tier, setTier] = useState<string>("");
  const [verificationStatus, setVerificationStatus] = useState<string>("");

  const query = useKnowledgeInventory({
    tier: tier || undefined,
    verificationStatus: verificationStatus || undefined,
  });

  const data = query.data;

  const tierCounts = useMemo(() => {
    const counts = data?.byTier ?? {};
    return TIER_ORDER.map((t) => ({ tier: t, count: counts[t] ?? 0 })).filter((t) => t.count > 0);
  }, [data]);

  const tierOptions = useMemo(
    () => [
      { value: "", label: "همه سطوح" },
      ...TIER_ORDER.map((t) => ({
        value: t as string,
        label: data?.items.find((i) => i.tier === t)?.tierFa ?? t,
      })),
    ],
    [data]
  );

  const highestTierFa = tierCounts[0]
    ? (data?.items.find((i) => i.tier === tierCounts[0]!.tier)?.tierFa ?? "—")
    : "—";

  return (
    <div>
      <PageHeader
        icon={<IconDatabase size={22} />}
        title="پایگاه دانش حقوقی"
        description="همه منابعی که هوش مصنوعی می‌تواند به آن‌ها استناد کند — همراه با سطح اعتبار، منشأ و وضعیت تأیید."
        actions={<ExportButton kind="knowledge" label="خروجی پایگاه دانش" />}
      />

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 tablet:grid-cols-4">
        <StatCard
          label="کل منابع"
          value={toPersianNumber(data?.total ?? 0)}
          icon={<IconDatabase size={16} />}
        />
        <StatCard
          label="بالاترین سطح"
          value={highestTierFa}
          hint={tierCounts[0] ? `${toPersianNumber(tierCounts[0].count)} منبع` : undefined}
          icon={<IconShield size={16} />}
          tone={tierCounts[0] ? "success" : "default"}
        />
        <StatCard
          label="تأیید رسمی"
          value={toPersianNumber(data?.byStatus["VERIFIED_OFFICIAL"] ?? 0)}
          icon={<IconShieldCheck size={16} />}
          tone="success"
        />
        <StatCard
          label="نیازمند بازبینی"
          value={toPersianNumber(
            (data?.byStatus["UNVERIFIED"] ?? 0) + (data?.byStatus["DEMO_VERIFIED"] ?? 0)
          )}
          icon={<IconWarning size={16} />}
          tone="warning"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPills options={tierOptions} value={tier} onChange={setTier} />
        <span className="mx-1 h-5 w-px bg-divider" aria-hidden="true" />
        <button
          type="button"
          onClick={() =>
            setVerificationStatus(verificationStatus === "UNVERIFIED" ? "" : "UNVERIFIED")
          }
          aria-pressed={verificationStatus === "UNVERIFIED"}
          className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors ${
            verificationStatus === "UNVERIFIED"
              ? "border-primary bg-primary text-on-primary shadow-elevation-1"
              : "border-divider bg-surface text-muted hover:border-primary-300 hover:text-on-surface"
          }`}
        >
          تأییدنشده
        </button>
      </div>

      {/* Inventory */}
      <StateView
        query={query}
        loadingRows={4}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="منبعی با این فیلتر یافت نشد."
      >
        {(d) => (
          <ul className="divide-y divide-divider overflow-hidden rounded-large border border-divider">
            {d.items.map((item) => (
              <SourceRow key={`${item.origin}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </StateView>

      {/* Legend */}
      <Card className="mt-5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <IconHistory size={16} className="text-muted" />
          <p className="text-body-2 font-medium text-on-surface">سلسله‌مراتب اعتبار</p>
        </div>
        <p className="text-caption leading-relaxed text-muted">
          در تعارض میان دو منبع، منبع با اعتبار بالاتر مقدم است: قانون اساسی › قانون › آیین‌نامه ›
          رویه قضایی › نظر حقوقی › سند کاربر. منابع با تأیید رسمی و وضعیت «معتبر» در رتبه‌بندی
          بازیابی وزن بیشتری می‌گیرند.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconDocument size={14} /> کتابخانه حقوقی
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconDatabase size={14} /> پیکره ایندکس‌شده (SHA-256)
          </span>
        </div>
      </Card>
    </div>
  );
}
