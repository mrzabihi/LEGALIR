// ============================================================
// LEGALIR — Contextual chat tools & structured follow-ups
// ============================================================
// The additive contract shared by the chat UI, the SSE gateway and the
// admin panel. Nothing here changes an existing chat flow: every field is
// optional on the records that carry them.
//
// HONESTY RULE: a tool is only `available` when the backend can actually
// honour it. `judicial_opinions` requires a real precedent source in the
// legal library; an admin toggle alone can never make it available.
// ============================================================

/** The contextual tools the composer can attach to a turn. */
export type ChatToolId = "deep_analysis" | "legal_research" | "judicial_opinions";

/** Visual identity of a tool (the key the UI maps to a project icon). */
export type ChatToolIcon = "sparkle" | "search" | "gavel";

/** A tool as defined by the product (stable, not admin-editable). */
export interface ChatToolDefinition {
  id: ChatToolId;
  /** The default Persian label; an admin may override the display label. */
  labelFa: string;
  descriptionFa: string;
  /** A short, honest statement of what selecting the tool changes. */
  effectNoteFa: string;
  icon: ChatToolIcon;
  order: number;
  /** True when the tool needs a real connected source to work at all. */
  requiresSource: boolean;
}

/** A tool projected for the chat UI, after admin settings + capability checks. */
export interface ChatToolView extends ChatToolDefinition {
  /** The admin enabled the tool at all. */
  enabled: boolean;
  /** The admin allowed it for this service. */
  allowedForService: boolean;
  /** Enabled, allowed and backed by a real capability on this server. */
  available: boolean;
  /** Plain Persian reason shown when `available` is false. */
  unavailableReasonFa: string | null;
}

/** GET /api/v1/chat/tools?service=<serviceType> */
export interface ChatToolsResponse {
  serviceType: string;
  tools: ChatToolView[];
  /** The conversation's persisted, still-valid selection. */
  selected: ChatToolId[];
  /**
   * True when an ENABLED admin energy profile prices tool/rag usage, so the
   * UI may tell the user that a tool can change metered cost. Never a
   * fabricated number.
   */
  meteredByEnergyProfile: boolean;
}

/** The persisted admin settings row for one tool. */
export interface ChatToolSettings {
  toolId: ChatToolId;
  enabled: boolean;
  /** Service types the tool is allowed for; empty = all services. */
  allowedServiceTypes: string[];
  labelFa: string;
  descriptionFa: string;
  effectNoteFa: string;
  order: number;
  updatedBy: string | null;
  updatedAt: string;
}

/** Admin projection: settings + whether the server can really honour it. */
export interface ChatToolAdminView extends ChatToolSettings {
  available: boolean;
  unavailableReasonFa: string | null;
}

/** One quick answer offered for a follow-up question. */
export interface FollowUpQuickOption {
  labelFa: string;
  /** The value recorded as the fact when this option is chosen. */
  value: string;
}

/**
 * A structured clarification question. `id` is the stable fact key, so the
 * engine can avoid asking the same question twice in one conversation.
 */
export interface FollowUpQuestion {
  id: string;
  questionFa: string;
  /** Short reason why the information matters (shown only when required). */
  whyFa: string | null;
  required: boolean;
  quickOptionsFa: FollowUpQuickOption[];
}

/** A structured answer carried with the next user message. */
export interface FollowUpAnswer {
  id: string;
  value: string;
}

/** The user-safe workflow projection returned with a conversation. */
export interface WorkflowView {
  phase: string;
  domain: string | null;
  pendingFollowUps: FollowUpQuestion[];
  suggestCaseCreation: boolean;
}
