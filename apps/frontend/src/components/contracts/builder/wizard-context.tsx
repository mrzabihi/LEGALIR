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
  ContractParty,
  ContractPayment,
  PropertyContractDetail,
  PropertyRentData,
  PropertySaleData,
  PropertyContractState,
} from "@legalir/types";
import { savePayments, updatePropertyContract } from "@/lib/api/property-contracts";
import { propertyContractKeys } from "@/hooks/usePropertyContracts";
import { getContractDefinition, nextWizardStepId, prevWizardStepId } from "@/lib/contracts/registry";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type DomainData = PropertyRentData | PropertySaleData;

interface WizardContextValue {
  contract: PropertyContractDetail;
  /** The working domain data (local, authoritative while editing). */
  data: DomainData;
  /** Patch the domain data. Deep-merges one level of nesting. */
  patchData: (patch: Partial<DomainData>) => void;
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
  lastSavedAt: string | null;
  saveNow: () => Promise<void>;
  /** True when the contract is still editable. */
  editable: boolean;
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [serverProgress, setServerProgress] = useState(contract.progress);
  const [serverState, setServerState] = useState(contract.state);
  const [serverCompleteness, setServerCompleteness] = useState(completeness);

  // Revision counter — bumped on every local edit. A save response is
  // only allowed to touch server-derived state if the revision it was
  // sent with is still the current one.
  const revisionRef = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const stepRef = useRef(stepId);
  stepRef.current = stepId;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
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

  const editable = useMemo(
    () =>
      ["DRAFT", "PARTIES_PENDING", "PROPERTY_PENDING", "DOCUMENTS_PENDING", "TERMS_PENDING", "CHANGES_REQUESTED"].includes(
        serverState
      ),
    [serverState]
  );

  /** Push the current local state to the server. */
  const flush = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const sentRevision = revisionRef.current;
    const payload = {
      currentStep: stepRef.current,
      data: dataRef.current as unknown as Record<string, unknown>,
    };
    setSaveStatus("saving");

    try {
      const detail = await updatePropertyContract(contract.id, payload);
      if (!mountedRef.current) return;

      // Server-derived fields always refresh; local data is only
      // adopted when nothing changed while the request was in flight.
      setServerProgress(detail.progress);
      setServerState(detail.state);
      setServerCompleteness(detail.completeness);
      queryClient.setQueryData(propertyContractKeys.detail(contract.id), detail);

      if (revisionRef.current === sentRevision) {
        dirtyRef.current = false;
        setSaveStatus("saved");
        setLastSavedAt(new Date().toISOString());
      } else {
        // A newer edit landed mid-flight — save again immediately.
        setSaveStatus("idle");
      }
      retryRef.current = 0;
    } catch {
      if (!mountedRef.current) return;
      setSaveStatus("error");
      if (retryRef.current < MAX_RETRIES) {
        retryRef.current += 1;
        const backoff = 1000 * 2 ** (retryRef.current - 1);
        retryPendingRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          retryPendingRef.current = false;
          if (mountedRef.current) void flush();
        }, backoff);
      }
    } finally {
      inFlightRef.current = false;
      // If edits arrived during the request, schedule another pass —
      // unless a retry is already queued, which would double-fire.
      if (dirtyRef.current && mountedRef.current && !retryPendingRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DEBOUNCE_MS);
      }
    }
  }, [contract.id, queryClient]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    // A fresh edit supersedes any queued retry — the debounce below
    // will carry the newest data, so drop the retry flag with it.
    if (timerRef.current) clearTimeout(timerRef.current);
    retryPendingRef.current = false;
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

  const goNext = useCallback(() => {
    const next = nextWizardStepId(contract.type, stepRef.current);
    if (next) goToStep(next);
  }, [contract.type, goToStep]);

  const goPrev = useCallback(() => {
    const prev = prevWizardStepId(contract.type, stepRef.current);
    if (prev) goToStep(prev);
  }, [contract.type, goToStep]);

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
    lastSavedAt,
    saveNow: flush,
    editable,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
