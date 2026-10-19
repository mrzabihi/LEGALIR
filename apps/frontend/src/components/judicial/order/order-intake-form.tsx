// ============================================================
// LEGALIR — Tracked request intake (the two provider services)
// ============================================================
// The real form behind «گواهی عدم سوءپیشینه» and «استعلام اعتبار معاملاتی».
// It is one component used twice — by the create page and by the owner's
// detail page while the request is still a draft — so there is exactly one
// place where a field is rendered, validated and serialised.
//
// What this form never does:
//   • it never claims an outcome: the service's own note (served by the API)
//     states who actually issues the artifact and that Ligalir only tracks
//     the request;
//   • it never sends a hidden required field: the consent declaration for the
//     credit check is a real, visible checkbox, and the server re-checks it;
//   • it never invents attachment ids: only the caller's own ready documents
//     can be selected, and the server filters the list again.
// ============================================================

"use client";

import { useState } from "react";
import { Button, Checkbox, Select, Textarea, TextField, snackbar } from "@legalir/ui";
import { JUDICIAL_ORDER_STATUS_FA } from "@legalir/types";
import type { JudicialServiceView } from "@legalir/types";
import {
  IconFile,
  IconInfo,
  IconSend,
  IconUpload,
  IconWarning,
} from "@/lib/icons";
import { UploadZone } from "@/components/documents/upload-zone";
import { useCompleteUpload, useDocuments, useInitiateUpload } from "@/hooks/useDocuments";
import { formatFileSize } from "@/lib/persian-utils";
import {
  judicialOrderConfig,
  validateOrderForm,
  type OrderFormValues,
} from "@/lib/judicial/order-fields";

export interface OrderIntakePayload {
  values: OrderFormValues;
  purpose: string;
  consent: boolean;
  note: string;
  attachmentIds: string[];
}

export interface OrderIntakeFormProps {
  service: JudicialServiceView;
  /** `true` when the service still accepts new hand-offs for this caller. */
  openForRequests: boolean;
  initial?: OrderIntakePayload;
  busy: boolean;
  error: string | null;
  /** `submit=false` saves a draft; `submit=true` hands it to an operator. */
  onSave: (payload: OrderIntakePayload, submit: boolean) => void;
}

const EMPTY: OrderIntakePayload = {
  values: {},
  purpose: "",
  consent: false,
  note: "",
  attachmentIds: [],
};

export function OrderIntakeForm({
  service,
  openForRequests,
  initial,
  busy,
  error,
  onSave,
}: OrderIntakeFormProps) {
  const config = judicialOrderConfig(service.id);
  const start = initial ?? EMPTY;

  const [values, setValues] = useState<OrderFormValues>(start.values);
  const [purpose, setPurpose] = useState(start.purpose);
  const [consent, setConsent] = useState(start.consent);
  const [note, setNote] = useState(start.note);
  const [attachmentIds, setAttachmentIds] = useState<string[]>(start.attachmentIds);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const documents = useDocuments({ pageSize: 30, status: "ready" });
  const initiate = useInitiateUpload();
  const complete = useCompleteUpload();
  const [uploading, setUploading] = useState(false);

  function clearError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function setValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    clearError(fieldId);
  }

  function toggleAttachment(id: string) {
    setAttachmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const created = await initiate.mutateAsync({
        name: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      await complete.mutateAsync({ id: created.id, file });
      // The new document belongs to the caller now, and the API only accepts
      // owned ids — attach it straight away so the operator receives it.
      setAttachmentIds((prev) => [...prev, created.id]);
      await documents.refetch();
      snackbar.show({ message: "فایل بارگذاری و پیوست شد.", variant: "success" });
    } catch (e) {
      snackbar.show({
        message: e instanceof Error ? e.message : "بارگذاری فایل ناموفق بود.",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  function save(submit: boolean) {
    const errors = validateOrderForm(config, values, purpose, consent, submit);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSave({ values, purpose, consent, note, attachmentIds }, submit);
  }

  const openDocuments = documents.data?.items ?? [];

  return (
    <div className="space-y-5">
      {/* The service's own honesty note — served, never written here. */}
      <p className="flex items-start gap-2 rounded-medium bg-surface-container-low px-3 py-2.5 text-caption leading-6 text-on-surface-variant">
        <IconInfo size={15} className="mt-0.5 shrink-0" />
        {service.availabilityNoteFa ??
          service.statusNoteFa ??
          "این درخواست ثبت و پیگیری می‌شود؛ تحویل نتیجه به مرجع رسمی وابسته است."}
      </p>

      {!openForRequests && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-medium bg-warning-container px-3 py-2.5 text-caption leading-6 text-on-surface"
        >
          <IconWarning size={15} className="mt-0.5 shrink-0" />
          این خدمت در حال حاضر درخواست جدید نمی‌پذیرد. پیش‌نویس شما محفوظ است و
          پس از فعال شدن دوباره، از همین صفحه قابل ارسال است.
        </p>
      )}

      <fieldset className="space-y-4" disabled={busy || uploading}>
        <legend className="mb-2 text-titleSmall text-on-surface">اطلاعات درخواست</legend>

        {config.fields.map((field) => {
          const error = fieldErrors[field.id];
          const label = `${field.labelFa}${field.required ? " *" : ""}`;
          if (field.options) {
            return (
              <Select
                key={field.id}
                label={label}
                value={values[field.id] ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                fullWidth
                options={field.options.map((o) => ({ value: o.value, label: o.labelFa }))}
                supportingText={field.hintFa}
                errorMessage={error}
              />
            );
          }
          if (field.multiline) {
            return (
              <Textarea
                key={field.id}
                label={label}
                value={values[field.id] ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                rows={4}
                fullWidth
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                supportingText={field.hintFa}
                errorMessage={error}
              />
            );
          }
          return (
            <TextField
              key={field.id}
              label={label}
              value={values[field.id] ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              fullWidth
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              supportingText={field.hintFa}
              errorMessage={error}
            />
          );
        })}

        {config.requiresPurpose && (
          <Textarea
            label={`${config.purposeLabelFa ?? "هدف درخواست"} *`}
            value={purpose}
            onChange={(e) => {
              setPurpose(e.target.value);
              clearError("purpose");
            }}
            rows={3}
            fullWidth
            maxLength={500}
            supportingText="این توضیح برای بررسی مشروعیت درخواست ثبت می‌شود."
            errorMessage={fieldErrors["purpose"]}
          />
        )}

        {config.requiresConsent && (
          <div>
            <Checkbox
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                clearError("consent");
              }}
              label={config.consentFa}
            />
            {fieldErrors["consent"] && (
              <p role="alert" className="mt-1 px-1 text-caption text-error">
                {fieldErrors["consent"]}
              </p>
            )}
          </div>
        )}

        <Textarea
          label="توضیح تکمیلی (اختیاری)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          fullWidth
          maxLength={2_000}
          supportingText="فقط برای پیگیری همین درخواست استفاده می‌شود."
        />
      </fieldset>

      {/* Attachments — the caller's OWN ready documents, by id. */}
      <section aria-labelledby="order-attachments-title" className="space-y-3">
        <div>
          <h3 id="order-attachments-title" className="text-labelLarge text-on-surface">
            مدارک پیوست
          </h3>
          <p className="mt-0.5 text-caption leading-6 text-on-surface-variant">
            فایل‌ها در «اسناد من» شما می‌مانند و این درخواست فقط به آن‌ها ارجاع
            می‌دهد.
          </p>
        </div>

        {documents.isLoading && (
          <div className="h-16 animate-pulse rounded-medium bg-surface-container" />
        )}

        {!documents.isLoading && openDocuments.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 tablet:grid-cols-2">
            {openDocuments.map((doc) => (
              <li
                key={doc.id}
                className="rounded-medium border border-[color:var(--color-outline-variant)] px-3 py-2"
              >
                <Checkbox
                  checked={attachmentIds.includes(doc.id)}
                  onChange={() => toggleAttachment(doc.id)}
                  disabled={busy || uploading}
                  label={
                    <span className="flex min-w-0 items-center gap-2">
                      <IconFile size={16} className="shrink-0 text-on-surface-variant" />
                      <span className="min-w-0">
                        <span className="block truncate text-labelLarge text-on-surface">
                          {doc.name}
                        </span>
                        <span className="block text-caption text-on-surface-variant">
                          {formatFileSize(doc.sizeBytes)}
                        </span>
                      </span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {!documents.isLoading && openDocuments.length === 0 && (
          <p className="rounded-medium bg-surface-container-low px-3 py-2 text-caption text-on-surface-variant">
            هنوز سند آماده‌ای در «اسناد من» ندارید؛ می‌توانید همین‌جا فایل جدید
            بارگذاری کنید.
          </p>
        )}

        <UploadZone onFile={(file) => void upload(file)} disabled={busy || uploading} />
        {uploading && (
          <p className="flex items-center gap-1.5 text-caption text-on-surface-variant">
            <IconUpload size={14} />
            در حال بارگذاری…
          </p>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-medium bg-error-container px-3 py-2 text-body-2 text-on-surface"
        >
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-divider pt-4">
        <Button
          onClick={() => save(true)}
          loading={busy}
          disabled={!openForRequests || uploading}
          startIcon={<IconSend size={18} />}
        >
          ثبت نهایی درخواست
        </Button>
        <Button
          variant="outlined"
          onClick={() => save(false)}
          disabled={busy || uploading}
        >
          ذخیرهٔ پیش‌نویس
        </Button>
        <span className="text-caption text-on-surface-variant">
          {openForRequests
            ? `وضعیت فعلی: ${JUDICIAL_ORDER_STATUS_FA.draft} — ثبت نهایی، درخواست را به کارشناس می‌سپارد.`
            : "ثبت نهایی تا فعال شدن خدمت بسته است؛ پیش‌نویس محفوظ می‌ماند."}
        </span>
      </div>
    </div>
  );
}
