// ============================================================
// LEGALIR — useStartContract
// ============================================================
// One implementation of "pick a template → create the contract → enter
// the wizard", shared by the /contracts rail and the full
// /contracts/templates listing.
//
// Both surfaces must behave identically:
//   • only ONE card may be mid-creation at a time;
//   • the creation is tracked once, in the same place;
//   • a failure is reported with the server's own message (never a
//     fabricated one) and the card returns to its idle state.
//
// Nothing is created until the user asks to start a contract — browsing
// either surface leaves no empty drafts behind.
// ============================================================

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { snackbar } from "@legalir/ui";
import { useCreatePropertyContract } from "@/hooks/usePropertyContracts";
import { DEFAULT_PROPERTY_KIND } from "@/lib/api/property-contracts";
import type { ContractDefinition } from "@/lib/contracts/registry";
import { trackContractEvent } from "@/lib/contracts/analytics";

export interface StartContractState {
  /** Create a contract of this template's type and open its wizard. */
  start: (definition: ContractDefinition) => Promise<void>;
  /** The template currently being created, or null. */
  startingTypeId: string | null;
}

export function useStartContract(): StartContractState {
  const router = useRouter();
  const create = useCreatePropertyContract();
  const [startingTypeId, setStartingTypeId] = useState<string | null>(null);

  const start = useCallback(
    async (definition: ContractDefinition) => {
      // A second click while the first request is in flight would create a
      // duplicate draft; the rail also disables the other cards.
      if (startingTypeId !== null) return;
      setStartingTypeId(definition.id);
      trackContractEvent("contract_template_started", { type: definition.id });
      try {
        const created = await create.mutateAsync({
          type: definition.id,
          propertyKind: DEFAULT_PROPERTY_KIND,
          initiatorRole: definition.defaultInitiatorRole,
        });
        router.push(`/contracts/${created.id}`);
      } catch (e) {
        snackbar.show({
          message: e instanceof Error ? e.message : "ایجاد قرارداد ناموفق بود.",
          variant: "error",
        });
        setStartingTypeId(null);
      }
    },
    [create, router, startingTypeId]
  );

  return { start, startingTypeId };
}
