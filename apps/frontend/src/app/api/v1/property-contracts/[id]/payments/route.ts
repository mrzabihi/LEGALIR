// ============================================================
// LEGALIR — /api/v1/property-contracts/[id]/payments
// ============================================================
// GET — the payment schedule of a contract the user owns.
// PUT — replace the whole schedule (the editor sends the full list).
//
// The schedule is only meaningful for sale contracts; a rent
// contract has no payment rows, so writes are rejected there.
// ============================================================

import type { ContractPayment, PaymentMethod, ContractPaymentStatus } from "@legalir/types";
import {
  audit,
  badRequest,
  isErrorResponse,
  ok,
  requireContract,
} from "@/lib/contracts/api-helpers";
import { listPayments, replacePayments } from "@/lib/contracts/db";
import { isEditable } from "@/lib/contracts/state-machine";

type Params = { params: Promise<{ id: string }> };

const METHODS: PaymentMethod[] = ["bank_transfer", "card", "check", "sadad_check", "other"];
const STATUSES: ContractPaymentStatus[] = ["pending", "paid", "overdue", "cancelled"];

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;
  return ok(listPayments(ctx.contract.id));
}

interface PaymentInput {
  id?: string;
  sequence?: number;
  labelFa?: string;
  amount?: { amount?: number; currency?: "IRR" };
  dueDate?: string | null;
  conditionFa?: string;
  method?: PaymentMethod;
  status?: ContractPaymentStatus;
  check?: ContractPayment["check"];
  note?: string;
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = requireContract(request, id);
  if (isErrorResponse(ctx)) return ctx;

  const { userId, contract } = ctx;
  if (contract.type !== "property_sale") {
    return badRequest("برنامه پرداخت فقط برای قرارداد خرید و فروش کاربرد دارد.", "NOT_APPLICABLE");
  }
  if (!isEditable(contract.state)) {
    return badRequest("این قرارداد در وضعیت فعلی قابل ویرایش نیست.", "NOT_EDITABLE");
  }

  let body: { payments?: PaymentInput[] };
  try {
    body = (await request.json()) as { payments?: PaymentInput[] };
  } catch {
    return badRequest("اطلاعات ارسالی نامعتبر است");
  }

  if (!Array.isArray(body.payments)) {
    return badRequest("فهرست پرداخت‌ها ارسال نشده است", "INVALID_BODY");
  }

  const payments: ContractPayment[] = body.payments.map((p, index) => ({
    id: p.id ?? `pay-${crypto.randomUUID()}`,
    contractId: contract.id,
    sequence: typeof p.sequence === "number" ? p.sequence : index + 1,
    labelFa: (p.labelFa ?? "").trim() || `پرداخت ${index + 1}`,
    amount: {
      amount: Math.max(0, Math.round(p.amount?.amount ?? 0)),
      currency: "IRR",
    },
    dueDate: p.dueDate ?? null,
    conditionFa: p.conditionFa ?? "",
    method: p.method && METHODS.includes(p.method) ? p.method : "bank_transfer",
    status: p.status && STATUSES.includes(p.status) ? p.status : "pending",
    check: p.check ?? null,
    note: p.note ?? "",
  }));

  replacePayments(contract.id, payments);

  audit({
    contractId: contract.id,
    actorId: userId,
    actorLabel: "کاربر",
    action: "payments.updated",
    descriptionFa: `برنامه پرداخت با ${payments.length} قسط ذخیره شد.`,
    metadata: { count: payments.length },
  });

  return ok(payments);
}
