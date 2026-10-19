// ============================================================
// LEGALIR — Admin · One user's requests & referrals (درخواست‌های کاربر)
// ============================================================
// §8 — the admin user dossier must be able to show a person's requests, their
// current state, the assigned lawyer and the SLA health in one place, and let
// the operator drill into a single request's full history.
//
// Everything here comes from `GET /admin/users/:id/requests` (permission
// `admin:requests:read`); no row is synthesised. Opening a row mounts the same
// RequestDetailDrawer the requests queue uses, so the operator sees the very
// same events/messages/lawyer-actions timeline the lawyer and client see.
// ============================================================

"use client";

import { useState } from "react";
import { Drawer } from "@legalir/ui";
import { useAdminUserRequests } from "@/hooks/useAdmin";
import {
  Badge,
  Button,
  DataTable,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  Th,
  Td,
} from "@/components/admin/ui";
import { RequestDetailDrawer } from "@/components/admin/request-detail-drawer";
import { LEGAL_REQUEST_STATE_FA } from "@legalir/types";
import type { LegalRequestState, SlaHealth } from "@legalir/types";
import { formatRemaining } from "@/lib/lawyer-portal/sla";
import { toPersianDate } from "@/lib/persian-utils";

const STATE_TONES: Record<
  LegalRequestState,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  DRAFT: "neutral",
  AI_INTAKE: "info",
  AI_ANALYSIS_READY: "info",
  LAWYER_REQUESTED: "info",
  MATCHING: "info",
  LAWYER_PROPOSED: "info",
  LAWYER_SELECTED: "brand",
  WAITING_FOR_ACCEPTANCE: "warning",
  DECLINED: "danger",
  ACCEPTED: "brand",
  SCHEDULED: "brand",
  IN_PROGRESS: "brand",
  WAITING_FOR_CLIENT: "warning",
  WAITING_FOR_LAWYER: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
  CLOSED: "neutral",
};

const SLA_TONES: Record<SlaHealth, "neutral" | "success" | "warning" | "danger" | "info"> = {
  ON_TRACK: "success",
  AT_RISK: "warning",
  BREACHED: "danger",
  PAUSED: "info",
  MET: "success",
  MISSED: "warning",
  NONE: "neutral",
};

export function UserRequestsDrawer({
  userId,
  userName,
  canManage,
  open,
  onClose,
}: {
  userId: string | null;
  userName: string | null;
  canManage: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const query = useAdminUserRequests(open ? userId : null);
  const [drillRequestId, setDrillRequestId] = useState<string | null>(null);

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={760}
        title={userName ? `درخواست‌های ${userName}` : "درخواست‌های کاربر"}
      >
        {query.isLoading && <LoadingBlock rows={5} />}
        {query.isError && (
          <ErrorBlock
            message="دریافت درخواست‌های این کاربر ناموفق بود."
            onRetry={() => void query.refetch()}
          />
        )}
        {query.data && query.data.items.length === 0 && (
          <EmptyBlock message="این کاربر هنوز درخواستی ثبت نکرده است." />
        )}
        {query.data && query.data.items.length > 0 && (
          <DataTable
            minWidth={640}
            head={
              <tr>
                <Th>درخواست</Th>
                <Th>وضعیت</Th>
                <Th>وکیل</Th>
                <Th>SLA</Th>
                <Th>ثبت</Th>
                <Th>عملیات</Th>
              </tr>
            }
          >
            {query.data.items.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-on-surface">{r.title}</span>
                    <span className="mt-0.5 text-caption text-muted">{r.category}</span>
                  </div>
                </Td>
                <Td>
                  <Badge tone={STATE_TONES[r.state]}>{LEGAL_REQUEST_STATE_FA[r.state]}</Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  {r.selectedLawyerName ?? <span className="text-muted">ارجاع نشده</span>}
                </Td>
                <Td>
                  <div className="flex flex-col gap-0.5">
                    <Badge tone={SLA_TONES[r.sla.health]}>{r.sla.healthFa}</Badge>
                    {r.sla.dueAt && (
                      <span className="text-caption text-muted tabular-nums">
                        {r.sla.paused ? "متوقف — " : ""}
                        {formatRemaining(r.sla.remainingMs)}
                      </span>
                    )}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{toPersianDate(r.createdAt)}</Td>
                <Td>
                  <Button size="sm" variant="secondary" onClick={() => setDrillRequestId(r.id)}>
                    جزئیات
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Drawer>

      <RequestDetailDrawer
        requestId={drillRequestId}
        canManage={canManage}
        onClose={() => setDrillRequestId(null)}
      />
    </>
  );
}
