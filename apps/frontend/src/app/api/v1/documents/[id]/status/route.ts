// ============================================================
// LEGALIR — GET /api/v1/documents/[id]/status
// ============================================================
// The review page polls this while a document is being processed, so the
// progress bar reflects the real pipeline instead of a guess.
//
// Every value is DERIVED from the stored document and its own job list —
// nothing is simulated:
//   • progress     — the running job's own progress, the failed job's own
//                    progress, or 100 once the document is ready;
//   • currentStage — the stage of the job actually in flight (null once
//                    the document is settled);
//   • errorCode    — taken from the job that failed, never invented.
//
// Ownership is enforced from the session, exactly like the detail route:
// a document that is not the caller's is indistinguishable from missing.

import { NextResponse } from "next/server";
import type { V1DocumentStatusResponse } from "@legalir/types";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import { getDemoDocument } from "@/lib/demo-seed";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const doc = getDemoDocument(userId, id);
  if (!doc) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "سند یافت نشد" },
      { status: 404 }
    );
  }

  const jobs = doc.jobs ?? [];
  const failedJob = jobs.find((job) => job.status === "failed") ?? null;
  const runningJob = jobs.find((job) => job.status === "running") ?? null;
  const lastJob = jobs.length > 0 ? jobs[jobs.length - 1] : null;

  let progress = 0;
  let currentStage: string | null = null;
  let errorCode: string | null = null;

  if (doc.status === "ready") {
    progress = 100;
  } else if (doc.status === "failed") {
    // A failure reports exactly how far it got and why — never a guess.
    progress = failedJob?.progress ?? 0;
    currentStage = failedJob?.stage ?? null;
    errorCode = failedJob?.errorCode ?? null;
  } else {
    const active = runningJob ?? lastJob;
    progress = active?.progress ?? 0;
    currentStage = active?.stage ?? doc.status;
  }

  const body: V1DocumentStatusResponse = {
    id: doc.id,
    status: doc.status,
    progress,
    currentStage,
    errorCode,
  };

  return NextResponse.json({ data: body });
}
