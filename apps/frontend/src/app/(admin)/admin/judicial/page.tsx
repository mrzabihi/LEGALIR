// ============================================================
// LEGALIR — Admin · Judicial services (خدمات اوراق قضایی)
// ============================================================
// The release control for the judicial document family. Each row is one
// service (اظهارنامه / لایحه / دادخواست / شکواییه / گواهی عدم سوءپیشینه /
// استعلام اعتبار) with the settings the product surfaces read at runtime.
//
// Two honest-reporting rules are visible here, not just enforced in code:
//
//   • `availability` is the EFFECTIVE state (config AND flag AND provider
//     requirement). The row shows all three so an operator can see that a
//     label change alone does not make a provider-dependent service live.
//   • a service whose required external provider is not connected cannot be
//     switched to «در دسترس» — the server refuses and the refusal is audited.
//
// Questionnaire editing lives below: publishing a version is an explicit,
// audited act, and requests that already answered an older version keep it.
// ============================================================

"use client";

import { useState } from "react";
import {
  useAdminJudicial,
  useAdminMe,
  useCreateJudicialQuestionnaireVersion,
  usePublishJudicialQuestionnaire,
  useUpdateAdminJudicialService,
} from "@/hooks/useAdmin";
import { JUDICIAL_STATUS_FA } from "@legalir/types";
import type {
  JudicialDocumentType,
  JudicialQuestionnaire,
  JudicialServiceStatus,
  JudicialServiceView,
} from "@legalir/types";
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  Field,
  InlineNotice,
  InfoBanner,
  PageHeader,
  Section,
  Select,
  StateView,
  Tabs,
  Td,
  TextInput,
  Th,
  type TabItem,
} from "@/components/admin/ui";
import { JudicialReviewQueue } from "@/components/admin/judicial-review-queue";
import { JudicialOrdersQueue } from "@/components/admin/judicial-orders-queue";

const DOCUMENT_TYPE_FA: Record<JudicialDocumentType, string> = {
  statement: "اظهارنامه",
  brief: "لایحه",
  petition: "دادخواست",
  complaint: "شکواییه",
};

const STATUS_TONE: Record<
  JudicialServiceStatus,
  "success" | "info" | "warning" | "danger"
> = {
  available: "success",
  request_only: "info",
  soon: "warning",
  unavailable: "danger",
};

const QUESTIONNAIRE_STATUS_FA: Record<JudicialQuestionnaire["status"], string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  retired: "بازنشسته",
};

function errMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

type AdminJudicialTab = "reviews" | "orders" | "catalog";

/**
 * The section shell: the review queue, the tracked orders and the service
 * catalog are three distinct jobs with three distinct permissions. Each tab
 * is only offered when the caller actually holds its read permission, so a
 * legal reviewer never opens a tab that would 403 — and the server still
 * re-checks every call.
 */
export default function AdminJudicialPage() {
  const { can } = useAdminMe();
  const canReadReviews = can("admin:judicial:read");
  const canReadCatalog = can("admin:services:read");

  const tabs: TabItem<AdminJudicialTab>[] = [
    ...(canReadReviews
      ? [
          { value: "reviews" as const, label: "صف بررسی" },
          { value: "orders" as const, label: "سفارش‌ها" },
        ]
      : []),
    ...(canReadCatalog
      ? [{ value: "catalog" as const, label: "خدمات و پرسش‌نامه‌ها" }]
      : []),
  ];

  const [tab, setTab] = useState<AdminJudicialTab>(tabs[0]?.value ?? "catalog");

  return (
    <div>
      <PageHeader
        title="اوراق قضایی"
        description="بررسی متن‌های ارسال‌شده پیش از صدور نسخهٔ نهایی، پیگیری سفارش‌های دو خدمت بیرونی، و کنترل انتشار خدمات و نسخهٔ پرسش‌نامه‌ها."
      />
      {tabs.length > 1 && (
        <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="بخش‌های اوراق قضایی" />
      )}
      {tab === "reviews" && canReadReviews && <JudicialReviewQueue />}
      {tab === "orders" && canReadReviews && <JudicialOrdersQueue />}
      {tab === "catalog" && canReadCatalog && <CatalogSection />}
    </div>
  );
}

function CatalogSection() {
  const { can } = useAdminMe();
  const canManage = can("admin:services:manage");

  const catalog = useAdminJudicial();
  const updateService = useUpdateAdminJudicialService();
  const createVersion = useCreateJudicialQuestionnaireVersion();
  const publishVersion = usePublishJudicialQuestionnaire();

  const [feedback, setFeedback] = useState<
    { tone: "error" | "success"; text: string } | null
  >(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<JudicialServiceView>>>({});
  const [newVersionType, setNewVersionType] = useState<JudicialDocumentType>("statement");

  function draftOf(service: JudicialServiceView): JudicialServiceView {
    return { ...service, ...(drafts[service.id] ?? {}) } as JudicialServiceView;
  }

  async function save(service: JudicialServiceView) {
    const draft = drafts[service.id];
    if (!draft) return;
    setFeedback(null);
    try {
      await updateService.mutateAsync({
        id: service.id,
        input: {
          titleFa: draft.titleFa,
          shortTitleFa: draft.shortTitleFa,
          descriptionFa: draft.descriptionFa,
          ctaFa: draft.ctaFa,
          status: draft.status,
          order: draft.order,
          surfaces: draft.surfaces,
        },
      });
      setFeedback({ tone: "success", text: `تنظیمات «${service.titleFa}» ذخیره شد.` });
      // Drop this row's pending edits without mutating the draft map in place.
      setDrafts((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => id !== service.id))
      );
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ذخیرهٔ تنظیمات ناموفق بود") });
    }
  }

  async function onCreateVersion() {
    setFeedback(null);
    try {
      const created = await createVersion.mutateAsync({ documentType: newVersionType });
      setFeedback({
        tone: "success",
        text: `نسخهٔ پیش‌نویس برای ${DOCUMENT_TYPE_FA[newVersionType]} ساخته شد (v${created.version}).`,
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "ساخت نسخهٔ جدید ناموفق بود") });
    }
  }

  async function onPublish(questionnaire: JudicialQuestionnaire) {
    setFeedback(null);
    try {
      await publishVersion.mutateAsync(questionnaire.id);
      setFeedback({
        tone: "success",
        text: `نسخهٔ v${questionnaire.version} پرسش‌نامهٔ ${DOCUMENT_TYPE_FA[questionnaire.documentType]} منتشر شد.`,
      });
    } catch (err) {
      setFeedback({ tone: "error", text: errMessage(err, "انتشار نسخه ناموفق بود") });
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-3xl text-body-2 text-muted">
        وضعیت انتشار، متن‌های نمایشی و نسخهٔ پرسش‌نامهٔ هر خدمت. وضعیت مؤثر از تنظیم خدمت +
        پرچم ویژگی + الزام اتصال بیرونی محاسبه می‌شود؛ تغییر متن به‌تنهایی خدمتی را فعال
        نمی‌کند.
      </p>

      {!canManage && (
        <InfoBanner tone="warning">
          شما مجوز مدیریت خدمات را ندارید؛ این صفحه فقط‌خواندنی است.
        </InfoBanner>
      )}

      {feedback && <InlineNotice tone={feedback.tone}>{feedback.text}</InlineNotice>}

      <StateView query={catalog} loadingRows={6}>
        {(data) => (
          <>
            <Section
              title="خدمات"
              subtitle="وضعیت، ترتیب و محل نمایش هر خدمت"
              infoFa="وضعیت مؤثر ممکن است از وضعیت تنظیم‌شده پایین‌تر باشد: اگر پرچم ویژگی خاموش باشد یا الزام بیرونی متصل نباشد، خدمت «در دسترس» نمایش داده نمی‌شود."
            >
              <DataTable
                head={
                  <tr>
                    <Th>خدمت</Th>
                    <Th>وضعیت تنظیم</Th>
                    <Th>وضعیت مؤثر</Th>
                    <Th>پرچم</Th>
                    <Th>الزام بیرونی</Th>
                    <Th>ترتیب</Th>
                    <Th>نمایش در</Th>
                    {canManage && <Th>اقدام</Th>}
                  </tr>
                }
              >
                {data.services.map((service) => {
                  const draft = draftOf(service);
                  const dirty = drafts[service.id] !== undefined;
                  const blockedPublish =
                    service.requirement.kind === "external" &&
                    !service.requirement.configured;
                  return (
                    <tr key={service.id}>
                      <Td>
                        <div className="min-w-[200px]">
                          {canManage ? (
                            <TextInput
                              value={draft.titleFa}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [service.id]: { ...prev[service.id], titleFa: e.target.value },
                                }))
                              }
                              aria-label={`عنوان ${service.titleFa}`}
                            />
                          ) : (
                            <span className="font-medium">{service.titleFa}</span>
                          )}
                          <div className="mt-1 text-caption text-muted">{service.id}</div>
                        </div>
                      </Td>
                      <Td>
                        {canManage ? (
                          <Select
                            value={draft.status}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [service.id]: {
                                  ...prev[service.id],
                                  status: e.target.value as JudicialServiceStatus,
                                },
                              }))
                            }
                            aria-label={`وضعیت ${service.titleFa}`}
                          >
                            {(Object.keys(JUDICIAL_STATUS_FA) as JudicialServiceStatus[]).map(
                              (s) => (
                                <option key={s} value={s}>
                                  {JUDICIAL_STATUS_FA[s]}
                                </option>
                              )
                            )}
                          </Select>
                        ) : (
                          JUDICIAL_STATUS_FA[service.status]
                        )}
                        {blockedPublish && (
                          <div className="mt-1 text-caption text-muted">
                            تا اتصال ارائه‌دهنده، «در دسترس» ممکن نیست.
                          </div>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[service.availability]} dot>
                          {JUDICIAL_STATUS_FA[service.availability]}
                        </Badge>
                        {service.availabilityNoteFa && (
                          <div className="mt-1 max-w-[240px] text-caption text-muted">
                            {service.availabilityNoteFa}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={service.flagEnabled ? "success" : "neutral"}>
                          {service.flagEnabled ? "روشن" : "خاموش"}
                        </Badge>
                      </Td>
                      <Td>
                        {service.requirement.kind === "internal" ? (
                          <Badge tone="neutral">داخلی</Badge>
                        ) : (
                          <div className="max-w-[220px] text-caption">
                            <Badge
                              tone={service.requirement.configured ? "success" : "warning"}
                            >
                              {service.requirement.configured ? "متصل" : "متصل‌نشده"}
                            </Badge>
                            <div className="mt-1 text-muted">
                              {service.requirement.providerFa ?? "—"}
                            </div>
                          </div>
                        )}
                      </Td>
                      <Td>
                        {canManage ? (
                          <TextInput
                            type="number"
                            value={draft.order}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [service.id]: {
                                  ...prev[service.id],
                                  order: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-20"
                            aria-label={`ترتیب ${service.titleFa}`}
                          />
                        ) : (
                          service.order
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1 text-caption">
                          {(
                            [
                              ["home", "خانه"],
                              ["services", "خدمات"],
                              ["new", "شروع جدید"],
                              ["cases", "پرونده‌ها"],
                            ] as const
                          ).map(([key, label]) => {
                            const on = draft.surfaces?.[key] ?? service.surfaces[key];
                            return canManage ? (
                              <label key={key} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [service.id]: {
                                        ...prev[service.id],
                                        surfaces: {
                                          ...service.surfaces,
                                          ...prev[service.id]?.surfaces,
                                          [key]: e.target.checked,
                                        },
                                      },
                                    }))
                                  }
                                />
                                {label}
                              </label>
                            ) : (
                              <Badge key={key} tone={on ? "info" : "neutral"}>
                                {label}
                              </Badge>
                            );
                          })}
                        </div>
                      </Td>
                      {canManage && (
                        <Td>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!dirty || updateService.isPending}
                            onClick={() => save(service)}
                          >
                            ذخیره
                          </Button>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </DataTable>
            </Section>

            <Section
              title="پرسش‌نامه‌ها"
              subtitle="هر نسخه جداگانه؛ ویرایش، نسخهٔ جدید می‌سازد، نسخهٔ منتشرشده را بازنویسی نمی‌کند"
              infoFa="درخواست‌هایی که با نسخهٔ قدیمی ساخته شده‌اند همان نسخه را نگه می‌دارند؛ انتشار نسخهٔ جدید فقط درخواست‌های بعدی را تغییر می‌دهد."
            >
              {canManage && (
                <Card className="mb-4">
                  <CardBody>
                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="نوع سند">
                        <Select
                          value={newVersionType}
                          onChange={(e) =>
                            setNewVersionType(e.target.value as JudicialDocumentType)
                          }
                        >
                          {(Object.keys(DOCUMENT_TYPE_FA) as JudicialDocumentType[]).map((t) => (
                            <option key={t} value={t}>
                              {DOCUMENT_TYPE_FA[t]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button
                        variant="secondary"
                        disabled={createVersion.isPending}
                        onClick={onCreateVersion}
                      >
                        ساخت نسخهٔ پیش‌نویس جدید
                      </Button>
                      <p className="text-caption text-muted">
                        نسخهٔ جدید از آخرین نسخه کپی می‌شود و تا انتشار، در دسترس کاربران
                        نیست.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              )}

              <DataTable
                head={
                  <tr>
                    <Th>نوع سند</Th>
                    <Th>نسخه</Th>
                    <Th>وضعیت</Th>
                    <Th>تعداد گام</Th>
                    <Th>انتشار</Th>
                    {canManage && <Th>اقدام</Th>}
                  </tr>
                }
              >
                {data.questionnaires.map((q) => (
                  <tr key={q.id}>
                    <Td>{DOCUMENT_TYPE_FA[q.documentType]}</Td>
                    <Td>v{q.version}</Td>
                    <Td>
                      <Badge
                        tone={
                          q.status === "published"
                            ? "success"
                            : q.status === "draft"
                              ? "info"
                              : "neutral"
                        }
                        dot
                      >
                        {QUESTIONNAIRE_STATUS_FA[q.status]}
                      </Badge>
                    </Td>
                    <Td>{q.steps.length}</Td>
                    <Td className="text-caption text-muted">
                      {q.publishedAt
                        ? new Date(q.publishedAt).toLocaleDateString("fa-IR")
                        : "—"}
                    </Td>
                    {canManage && (
                      <Td>
                        <Button
                          size="sm"
                          variant={q.status === "draft" ? "primary" : "ghost"}
                          disabled={q.status !== "draft" || publishVersion.isPending}
                          onClick={() => onPublish(q)}
                        >
                          {q.status === "draft" ? "انتشار" : "—"}
                        </Button>
                      </Td>
                    )}
                  </tr>
                ))}
              </DataTable>
            </Section>
          </>
        )}
      </StateView>
    </div>
  );
}
