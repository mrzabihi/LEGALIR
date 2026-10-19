// ============================================================
// LEGALIR — Contract Builder wizard context
// ============================================================
// One source of truth for the whole wizard. The working domain data
// lives in local state so typing is instant; every change is pushed
// to the server through a debounced autosave.
//
// Race safety: each local edit bumps a revision counter. When an
// autosave response arrives it is only allowed to refresh the
// server-derived fields (progress, completeness, state) — never to
// overwrite the local data — and only if no newer edit happened
// while the request was in flight. A failed save is retried with
// backoff and surfaced as a status the shell renders.
// ============================================================

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ContractCompleteness,
  ContractDomainData,
  ContractParty,
  ContractPayment,
  PropertyContractDetail,
  PropertyContractState,
} from "@legalir/types";
import { ApiClientError, type ErrorCategory } from "@/lib/api/errors";
import { savePayments, updatePropertyContract } from "@/lib/api/property-contracts";
import { propertyContractKeys } from "@/hooks/usePropertyContracts";
import { computeCompleteness } from "@/lib/contracts/completeness";
import { getContractDefinition, nextWizardStepId, prevWizardStepId } from "@/lib/contracts/registry";
import { isEditable as stateIsEditable } from "@/lib/contracts/state-machine";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * The REAL reason the last write failed. The header and the step bodies
 * show this instead of a generic «ذخیره نشد»: a 409 NOT_EDITABLE, a 400
 * INVALID_STEP and a dropped connection need different actions from the
 * user, and retrying a non-transient failure forever is exactly the
 * defect this carries the fix for.
 */
export interface SaveErrorInfo {
  messageFa: string;
  code: string;
  category: ErrorCategory;
  retryable: boolean;
  correlationId: string;
  at: string;
}

export type DomainData = ContractDomainData;

interface WizardContextValue {
  contract: PropertyContractDetail;
  /** The working domain data (local, authoritative while editing). */
  data: DomainData;
  /** Patch the domain data. Deep-merges one level of nesting. */
  patchData: (patch: Partial<DomainData>) => void;
  /**
   * Patch AND persist in one step, resolving `true` only once the server
   * has accepted the exact merged data. Used by confirmation buttons: a
   * «تأیید شد» badge must never be shown for a change that did not reach
   * the store, otherwise a reload would contradict the screen.
   */
  patchDataNow: (patch: Partial<DomainData>) => Promise<boolean>;
  /** Replace the whole domain data (used by resets). */
  setData: (next: DomainData) => void;

  parties: ContractParty[];
  /** The payment schedule (sale only; empty for rent). */
  payments: ContractPayment[];
  /** Replace the payment schedule (sale only). */
  setPayments: (next: ContractPayment[]) => void;
  completeness: ContractCompleteness;
  progress: number;
  state: PropertyContractState;

  stepId: string;
  stepIndex: number;
  stepCount: number;
  goToStep: (stepId: string) => void;
  goNext: () => void;
  goPrev: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;

  saveStatus: SaveStatus;
  /** Why the last write failed — `null` once a save succeeds. */
  saveError: SaveErrorInfo | null;
  /**
   * Synchronous read of the last failure. `saveError` is React state, so a
   * caller that has just awaited a failed `patchDataNow()` would still see
   * the PREVIOUS render's value; this reads the ref the setter wrote.
   */
  getSaveError: () => SaveErrorInfo | null;
  lastSavedAt: string | null;
  /** Resolves `true` when the store accepted the data. */
  saveNow: () => Promise<boolean>;
  /** True when the contract is still editable. */
  editable: boolean;

  /** The missing field labels of the CURRENT step, from real data. */
  stepMissing: string[];
  /**
   * Set when the user tried to advance with an incomplete step. It names
   * the first missing item so the UI can point at the exact field.
   */
  advanceBlockedReason: string | null;
  clearAdvanceBlocked: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>");
  return ctx;
}

/** Deep-merge a partial patch into the domain data (arrays replace). */
function mergeData(base: DomainData, patch: Partial<DomainData>): DomainData {
  const result = { ...(base as unknown as Record<string, unknown>) };
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const existing = result[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = { ...(existing as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else {
      result[key] = value;
    }
  }
  return result as unknown as DomainData;
}

const AUTOSAVE_DEBOUNCE_MS = 700;
const MAX_RETRIES = 3;

/** Turn any thrown value into a message the user can act on. */
function describeSaveError(err: unknown): SaveErrorInfo {
  if (err instanceof ApiClientError) {
    return {
      messageFa: err.userMessage,
      code: err.code,
      category: err.category,
      // `retryable` is the server's own verdict for 4xx codes; a validation
      // or state-conflict error is never worth retrying automatically.
      retryable: err.shouldAutoRetry,
      correlationId: err.correlationId,
      at: new Date().toISOString(),
    };
  }
  return {
    messageFa: "خطا در ارتباط با سرور. اتصال اینترنت را بررسی کنید.",
    code: "NETWORK_ERROR",
    category: "network",
    retryable: true,
    correlationId: "unknown",
    at: new Date().toISOString(),
  };
}

export function WizardProvider({
  contract,
  completeness,
  children,
}: {
  contract: PropertyContractDetail;
  completeness: ContractCompleteness;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const def = useMemo(() => getContractDefinition(contract.type), [contract.type]);

  const [data, setDataState] = useState<DomainData>(contract.data);
  const [payments, setPaymentsState] = useState<ContractPayment[]>(contract.payments);
  const [stepId, setStepId] = useState<string>(contract.currentStep || def.wizardSteps[0]!.id);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveErrorState] = useState<SaveErrorInfo | null>(null);
  const saveErrorRef = useRef<SaveErrorInfo | null>(null);
  const setSaveError = useCallback((next: SaveErrorInfo | null) => {
    saveErrorRef.current = next;
    setSaveErrorState(next);
  }, []);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [serverProgress, setServerProgress] = useState(contract.progress);
  const [serverState, setServerState] = useState(contract.state);
  const [serverCompleteness, setServerCompleteness] = useState(completeness);
  const [advanceBlockedReason, setAdvanceBlockedReason] = useState<string | null>(null);

  // Revision counter — bumped on every local edit. A save response is
  // only allowed to touch server-derived state if the revision it was
  // sent with is still the current one.
  const revisionRef = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const stepRef = useRef(stepId);
  stepRef.current = stepId;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Writes are SERIALIZED through this tail. Two overlapping PATCHes can
  // land out of order on a file-backed store, and a retry fired next to a
  // fresh save used to double-write the same data. Chaining them means
  // exactly one request is in flight at any moment and every request
  // carries the newest full payload.
  const tailRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const pendingSavesRef = useRef(0);
  const lastResultRef = useRef<"ok" | "error" | null>(null);
  const dirtyRef = useRef(false);
  const retryRef = useRef(0);
  // True while a backoff retry is queued on `timerRef`. It stops the
  // `finally` block from also scheduling a debounce pass, which would
  // fire a second request for the same failed save.
  const retryPendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // One source of truth: the same predicate the server route uses. A
  // duplicated list here previously omitted REJECTED and could disagree
  // with the API about whether a contract is editable.
  const editable = useMemo(() => stateIsEditable(serverState), [serverState]);
  // `flush` is a stable callback, so it reads editability from a ref rather
  // than closing over a value that would go stale between renders.
  const editableRef = useRef(editable);
  editableRef.current = editable;

  /**
   * Push the current local state to the server.
   *
   * Resolves `true` only when a write carrying at least this call's
   * revision reached the store. A confirmation button uses that boolean to
   * decide whether «تأیید شد» may be shown at all — a badge that outlives
   * a failed save would be contradicted by the next reload.
   *
   * Writes are QUEUED, never dropped: the previous implementation returned
   * `false` the moment a debounced autosave happened to be in flight, so a
   * confirmation button reported «ذخیره نشد» for a save it had never sent.
   * That was the root cause of the recurring retry message.
   */
  const flush = useCallback(
    (dataOverride?: DomainData): Promise<boolean> => {
      // Handing over data explicitly is a content write. A frozen contract
      // rejects those with 409 NOT_EDITABLE on every attempt, so report the
      // real reason instead of looping the user through a retry that can
      // never succeed.
      if (dataOverride !== undefined && !editableRef.current) {
        const info: SaveErrorInfo = {
          messageFa: "این قرارداد در وضعیت فعلی قابل ویرایش نیست؛ تغییر ذخیره نشد.",
          code: "NOT_EDITABLE",
          category: "conflict",
          retryable: false,
          correlationId: "client",
          at: new Date().toISOString(),
        };
        lastResultRef.current = "error";
        setSaveError(info);
        setSaveStatus("error");
        return Promise.resolve(false);
      }

      const payloadData = dataOverride ?? dataRef.current;
      const sentRevision = revisionRef.current;
      // A frozen contract still accepts a step change, but not content.
      const sendsContent = editableRef.current;
      pendingSavesRef.current += 1;
      setSaveStatus("saving");

      const run = tailRef.current.then(async (): Promise<boolean> => {
        const payload = {
          currentStep: stepRef.current,
          ...(sendsContent
            ? { data: payloadData as unknown as Record<string, unknown> }
            : {}),
        };
        try {
          const detail = await updatePropertyContract(contract.id, payload);
          if (!mountedRef.current) return false;

          // Server-derived fields always refresh; local data is only
          // adopted when nothing changed while the request was in flight.
          setServerProgress(detail.progress);
          setServerState(detail.state);
          setServerCompleteness(detail.completeness);
          queryClient.setQueryData(propertyContractKeys.detail(contract.id), detail);

          retryRef.current = 0;
          lastResultRef.current = "ok";
          setSaveError(null);
          const current = revisionRef.current === sentRevision;
          if (current) {
            dirtyRef.current = false;
            setLastSavedAt(new Date().toISOString());
          }
          return current;
        } catch (err) {
          if (!mountedRef.current) return false;
          lastResultRef.current = "error";
          const info = describeSaveError(err);
          setSaveError(info);
          // Retry only transient failures, with backoff. A validation,
          // permission or state-conflict answer is identical on every
          // attempt — retrying it forever is the defect being fixed.
          if (info.retryable && retryRef.current < MAX_RETRIES) {
            retryRef.current += 1;
            const backoff = 1000 * 2 ** (retryRef.current - 1);
            retryPendingRef.current = true;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              retryPendingRef.current = false;
              if (mountedRef.current && dirtyRef.current) void flush();
            }, backoff);
          }
          return false;
        } finally {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          if (mountedRef.current) {
            setSaveStatus(
              pendingSavesRef.current > 0
                ? "saving"
                : lastResultRef.current === "error"
                  ? "error"
                  : dirtyRef.current
                    ? "idle"
                    : "saved"
            );
          }
        }
      });

      tailRef.current = run;
      return run;
    },
    [contract.id, queryClient, setSaveError]
  );

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    // A fresh edit supersedes any queued retry — the debounce below
    // will carry the newest data, so drop the retry flag with it. It also
    // renews the retry budget: a user edit is a new attempt, not a replay
    // of the one that already exhausted its backoff.
    if (timerRef.current) clearTimeout(timerRef.current);
    retryPendingRef.current = false;
    retryRef.current = 0;
    timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DEBOUNCE_MS);
  }, [flush]);

  const patchData = useCallback(
    (patch: Partial<DomainData>) => {
      revisionRef.current += 1;
      setDataState((prev) => mergeData(prev, patch));
      scheduleSave();
    },
    [scheduleSave]
  );

  /**
   * Patch and persist in one shot. The merged value is computed here and
   * handed to `flush` directly, because React state updates are async: a
   * plain `patchData()` followed by `saveNow()` would send the PREVIOUS
   * data and the confirmation timestamp would be lost.
   */
  const patchDataNow = useCallback(
    async (patch: Partial<DomainData>): Promise<boolean> => {
      revisionRef.current += 1;
      const merged = mergeData(dataRef.current, patch);
      dataRef.current = merged;
      setDataState(merged);
      if (timerRef.current) clearTimeout(timerRef.current);
      retryPendingRef.current = false;
      retryRef.current = 0;
      dirtyRef.current = true;
      return flush(merged);
    },
    [flush]
  );

  const setData = useCallback(
    (next: DomainData) => {
      revisionRef.current += 1;
      setDataState(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  /**
   * Persist the payment schedule. Payments live in their own table
   * and endpoint, so they are written immediately rather than through
   * the debounced domain-data autosave.
   */
  const setPayments = useCallback(
    (next: ContractPayment[]) => {
      setPaymentsState(next);
      void savePayments(contract.id, next).catch(() => {
        /* the editor surfaces its own error state */
      });
    },
    [contract.id]
  );

  const goToStep = useCallback(
    (next: string) => {
      if (!def.wizardSteps.some((s) => s.id === next)) return;
      setAdvanceBlockedReason(null);
      setStepId(next);
      stepRef.current = next;
      scheduleSave();
    },
    [def.wizardSteps, scheduleSave]
  );

  const stepIndex = Math.max(
    0,
    def.wizardSteps.findIndex((s) => s.id === stepId)
  );

  // The CURRENT step's missing items. Computed from the LOCAL working
  // data with the SAME pure scorer the server runs (`computeCompleteness`),
  // so the gate never lags behind what the user just typed: the server
  // value only refreshes after a full autosave round-trip, which made
  // «مرحله بعد» reject a step the user had already completed a moment
  // earlier. Identical inputs still produce identical output on both
  // sides — this is the same function, not a second rule set.
  const localCompleteness = useMemo(
    () =>
      computeCompleteness(
        data === contract.data ? contract : { ...contract, data },
        contract.parties ?? [],
        contract.documents ?? []
      ),
    [contract, data]
  );

  const stepMissing = useMemo(() => {
    const current = def.wizardSteps.find((s) => s.id === stepId);
    if (!current || current.sections.length === 0) return [];
    return localCompleteness.sections
      .filter((s) => current.sections.includes(s.key) && s.percent < 100)
      .flatMap((s) => s.missing);
  }, [def.wizardSteps, stepId, localCompleteness]);

  /**
   * «مرحله بعد» acts on the REAL status: a step with missing required
   * data does not advance, and the reason names the first missing item.
   * Backward navigation is never blocked, so data can always be fixed.
   */
  const goNext = useCallback(() => {
    if (editable && stepMissing.length > 0) {
      setAdvanceBlockedReason(
        `برای رفتن به مرحله بعد این موارد را تکمیل کنید: ${stepMissing.join("، ")}`
      );
      return;
    }
    setAdvanceBlockedReason(null);
    const next = nextWizardStepId(contract.type, stepRef.current);
    if (next) goToStep(next);
  }, [contract.type, editable, goToStep, stepMissing]);

  const goPrev = useCallback(() => {
    const prev = prevWizardStepId(contract.type, stepRef.current);
    if (prev) goToStep(prev);
  }, [contract.type, goToStep]);

  // The blocking banner names what is missing. The moment the last missing
  // item of the step is filled it must clear itself — leaving a red alert
  // over a now-complete step is exactly the "error that won't go away" the
  // inline-validation contract forbids.
  useEffect(() => {
    if (advanceBlockedReason !== null && stepMissing.length === 0) {
      setAdvanceBlockedReason(null);
    }
  }, [advanceBlockedReason, stepMissing.length]);

  // Flush pending edits when the tab is hidden or the page unloads.
  useEffect(() => {
    const onHide = () => {
      if (dirtyRef.current) void flush();
    };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  const value: WizardContextValue = {
    contract,
    data,
    patchData,
    patchDataNow,
    setData,
    parties: contract.parties,
    payments,
    setPayments,
    completeness: serverCompleteness,
    progress: serverProgress,
    state: serverState,
    stepId,
    stepIndex,
    stepCount: def.wizardSteps.length,
    goToStep,
    goNext,
    goPrev,
    canGoNext: stepIndex < def.wizardSteps.length - 1,
    canGoPrev: stepIndex > 0,
    saveStatus,
    saveError,
    getSaveError: () => saveErrorRef.current,
    lastSavedAt,
    saveNow: () => flush(),
    editable,
    stepMissing,
    advanceBlockedReason,
    clearAdvanceBlocked: () => setAdvanceBlockedReason(null),
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
