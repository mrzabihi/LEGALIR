// ============================================================
// LEGALIR — useDiscoveryFlow
// ============================================================
// Orchestrates the «از کجا شروع کنم؟» flow on /Suggest_law. It ties three
// things together that previously lived apart:
//
//   1. the localStorage hand-off from /new (the user's own words);
//   2. the SERVER analysis (POST /api/v1/intake/analyze) — the structured,
//      capability-clamped path recommendation;
//   3. a PERSISTED draft (a DRAFT LegalRequest) so the flow is resumable and
//      visible to the user's history and the admin panel — never a page that
//      evaporates on refresh.
//
// Design guarantees:
//   · The draft request is created AT MOST ONCE (idempotency key minted once
//     and reused), so a refresh / double mount / retry never duplicates it.
//   · Edits are autosaved (debounced) onto the same draft; a failed save is
//     surfaced, never swallowed, and is retried on the next change.
//   · The analysis is triggered explicitly (on load + «تحلیل مجدد»), not on
//     every keystroke, so a re-render never re-bills the model.
//   · Nothing is ever lost: if the analysis fails, the client-side deterministic
//     hint still offers a real path, and the description stays on screen.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createLegalRequest,
  patchLegalRequest,
  requestDiscoveryAnalysis,
} from "@/lib/api/v1";
import { generateIdempotencyKey } from "@/lib/api/idempotency";
import {
  buildRulesAnalysis,
  discoveryTitle,
  markSelectedPath,
  type DiscoveryInput,
} from "@/lib/intake/discovery";
import {
  readSuggestLawDraft,
  suggestCategorySlug,
  type IntakeIntent,
  type SuggestLawDraft,
} from "@/lib/intake/start-request";
import type { LegalRequestDiscovery } from "@legalir/types";

/** The save lifecycle shown next to the draft. */
export type DiscoverySaveState = "idle" | "creating" | "saving" | "saved" | "error";

/** How long edits settle before autosaving (ms). */
const AUTOSAVE_DEBOUNCE_MS = 800;

export interface DiscoveryFlow {
  /** `undefined` until the localStorage hand-off has been read. */
  seeded: boolean;
  /** True when there is a usable request to show. */
  hasRequest: boolean;
  draft: SuggestLawDraft | null;

  text: string;
  intent: IntakeIntent | null;
  category: string | null;
  hasDocument: boolean;
  documentName: string | null;

  editing: boolean;
  setEditing: (v: boolean) => void;
  /** Edit handlers — they update state and trigger a debounced autosave. */
  setText: (v: string) => void;
  setIntent: (v: IntakeIntent | null) => void;
  setCategory: (v: string | null) => void;

  /** The server analysis for the current snapshot, or null while unavailable. */
  analysis: LegalRequestDiscovery | null;
  isAnalyzing: boolean;
  analysisError: boolean;
  /** Re-run the analysis for the CURRENT text/intent/category. */
  reanalyze: () => void;

  /** A deterministic client hint, shown instantly and used if the server fails. */
  hint: LegalRequestDiscovery;

  /** The persisted draft request id, once created. */
  requestId: string | null;
  saveState: DiscoverySaveState;

  /** Record the user's chosen path onto the persisted draft + local state. */
  choosePath: (intent: IntakeIntent) => void;
}

export function useDiscoveryFlow(isEnabled: (flagKey: string) => boolean): DiscoveryFlow {
  const [draft, setDraft] = useState<SuggestLawDraft | null | undefined>(undefined);
  const [text, setTextState] = useState("");
  const [intent, setIntentState] = useState<IntakeIntent | null>(null);
  const [category, setCategoryState] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // The persisted draft + the snapshot handed to the analysis query.
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<DiscoverySaveState>("idle");
  const [chosen, setChosen] = useState<IntakeIntent | null>(null);
  const [analysisSnapshot, setAnalysisSnapshot] = useState<DiscoveryInput | null>(null);

  const idemKeyRef = useRef<string>("");
  const requestIdRef = useRef<string | null>(null);

  // Read the hand-off once, then push the initial snapshot to the engine.
  useEffect(() => {
    const d = readSuggestLawDraft();
    setDraft(d ?? null);
    if (d) {
      setTextState(d.text);
      setIntentState(d.intent);
      setCategoryState(d.category);
      setAnalysisSnapshot({
        text: d.text,
        intent: d.intent,
        category: d.category,
        hasDocument: d.document !== null,
      });
    }
  }, []);

  const document = draft?.document ?? null;
  const hasDoc = document !== null;
  const seeded = draft !== undefined;
  const hasRequest = seeded && draft !== null && text.trim().length > 0;

  // ---- Instant, deterministic client hint --------------------------------
  const hint = useMemo(
    () => buildRulesAnalysis({ text, intent, category, hasDocument: hasDoc }, isEnabled),
    [text, intent, category, hasDoc, isEnabled]
  );

  // ---- Server analysis ---------------------------------------------------
  const analysisQuery = useQuery({
    queryKey: [
      "discovery",
      "analyze",
      analysisSnapshot?.text,
      analysisSnapshot?.intent,
      analysisSnapshot?.category,
      analysisSnapshot?.hasDocument,
    ],
    queryFn: () => requestDiscoveryAnalysis(analysisSnapshot!),
    enabled: analysisSnapshot !== null && analysisSnapshot.text.trim().length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const analysis = analysisQuery.data ?? null;

  // ---- Create the persisted draft exactly once ---------------------------
  useEffect(() => {
    if (!hasRequest || requestIdRef.current) return;
    if (!idemKeyRef.current) idemKeyRef.current = generateIdempotencyKey();
    let cancelled = false;
    setSaveState("creating");
    (async () => {
      try {
        const created = await createLegalRequest(
          {
            title: discoveryTitle(text),
            category: category ?? suggestCategorySlug(text) ?? "other",
            intakeAnswers: { "شرح موضوع": text.trim() },
            attachmentDocumentIds: document ? [document.id] : [],
          },
          idemKeyRef.current
        );
        if (cancelled) return;
        requestIdRef.current = created.id;
        setRequestId(created.id);
        setSaveState("saved");
      } catch {
        if (!cancelled) setSaveState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally scoped to the first creation; later edits go through the
    // autosave effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRequest, requestId]);

  // ---- Persist the analysis onto the draft once it arrives ---------------
  const persistedAnalysisRef = useRef<LegalRequestDiscovery | null>(null);
  useEffect(() => {
    if (!analysis || !requestIdRef.current) return;
    if (persistedAnalysisRef.current === analysis) return;
    persistedAnalysisRef.current = analysis;
    setSaveState("saving");
    patchLegalRequest(requestIdRef.current, { discovery: analysis })
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }, [analysis, requestId]);

  // ---- Debounced autosave of user edits ----------------------------------
  const pending = useRef<{
    text: string;
    intent: IntakeIntent | null;
    category: string | null;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const body = pending.current;
    if (!body || !requestIdRef.current) return;
    pending.current = null;
    const base = persistedAnalysisRef.current;
    const discovery: LegalRequestDiscovery | undefined = base
      ? {
          ...base,
          description: body.text.trim(),
          explicitIntent: body.intent,
          explicitCategory: body.category,
        }
      : undefined;
    setSaveState("saving");
    patchLegalRequest(requestIdRef.current, {
      title: discoveryTitle(body.text),
      category: body.category ?? suggestCategorySlug(body.text) ?? undefined,
      intakeAnswers: { "شرح موضوع": body.text.trim() },
      ...(discovery ? { discovery } : {}),
    })
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }, []);

  const scheduleSave = useCallback(
    (next: { text: string; intent: IntakeIntent | null; category: string | null }) => {
      if (!requestIdRef.current) return;
      pending.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Flush any pending edit on unmount so a navigation never drops it.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flush();
    };
  }, [flush]);

  const setText = useCallback(
    (v: string) => {
      setTextState(v);
      scheduleSave({ text: v, intent, category });
    },
    [scheduleSave, intent, category]
  );
  const setIntent = useCallback(
    (v: IntakeIntent | null) => {
      setIntentState(v);
      scheduleSave({ text, intent: v, category });
    },
    [scheduleSave, text, category]
  );
  const setCategory = useCallback(
    (v: string | null) => {
      setCategoryState(v);
      scheduleSave({ text, intent, category: v });
    },
    [scheduleSave, text, intent]
  );

  const reanalyze = useCallback(() => {
    setAnalysisSnapshot({ text, intent, category, hasDocument: hasDoc });
  }, [text, intent, category, hasDoc]);

  const choosePath = useCallback((chosenIntent: IntakeIntent) => {
    setChosen(chosenIntent);
    const base = persistedAnalysisRef.current;
    if (base && requestIdRef.current) {
      const withSelection: LegalRequestDiscovery = {
        ...base,
        paths: markSelectedPath(base.paths, chosenIntent),
      };
      persistedAnalysisRef.current = withSelection;
      patchLegalRequest(requestIdRef.current, { discovery: withSelection }).catch(() => {
        /* selection is best-effort; the hand-off still proceeds */
      });
    }
  }, []);

  // Reflect the chosen path into the analysis the page renders.
  const analysisWithChoice = useMemo(() => {
    if (!analysis || !chosen) return analysis;
    return { ...analysis, paths: markSelectedPath(analysis.paths, chosen) };
  }, [analysis, chosen]);

  return {
    seeded,
    hasRequest,
    draft: draft ?? null,
    text,
    intent,
    category,
    hasDocument: hasDoc,
    documentName: document?.name ?? null,
    editing,
    setEditing,
    setText,
    setIntent,
    setCategory,
    analysis: analysisWithChoice,
    isAnalyzing: analysisQuery.isFetching,
    analysisError: analysisQuery.isError,
    reanalyze,
    hint,
    requestId,
    saveState,
    choosePath,
  };
}
