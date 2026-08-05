// ============================================================
// LEGALIR — Conversation React Query Hooks (Phase 7 & 8)
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ConversationStatus,
} from "@legalir/types";
import {
  fetchConversations,
  createConversation,
  fetchConversation,
  updateConversation,
  sendMessage,
  createAiRun,
  fetchAiRun,
  cancelAiRun,
  fetchConversationReferences,
  fetchSource,
  fetchSourceVersions,
  fetchDocumentCitations,
} from "@/lib/api/v1";

// --- Conversation List ---

export function useConversations(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["conversations", page, pageSize],
    queryFn: () => fetchConversations(page, pageSize),
  });
}

// --- Conversation Detail ---

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}

// --- Create Conversation ---

export function useCreateConversation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; category?: string }) =>
      createConversation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// --- Update Conversation (rename, archive) ---

export function useUpdateConversation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { title?: string; status?: ConversationStatus };
    }) => updateConversation(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", variables.id] });
    },
  });
}

// --- Send Message ---

export function useSendMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => sendMessage(conversationId, content),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["conversation", variables.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// --- AI Runs ---

export function useAiRun(id: string | undefined, options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ["ai-run", id],
    queryFn: () => fetchAiRun(id!),
    enabled: options?.enabled ?? !!id,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateAiRun() {
  return useMutation({
    mutationFn: (data: { conversationId: string; messageId: string }) =>
      createAiRun(data),
  });
}

export function useCancelAiRun() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelAiRun(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-run"] });
    },
  });
}

// --- References (Phase 8) ---

export function useConversationReferences(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["conversation-references", conversationId],
    queryFn: () => fetchConversationReferences(conversationId!),
    enabled: !!conversationId,
  });
}

// --- Sources (Phase 8) ---

export function useSource(id: string | undefined) {
  return useQuery({
    queryKey: ["source", id],
    queryFn: () => fetchSource(id!),
    enabled: !!id,
    retry: false,
  });
}

export function useSourceVersions(id: string | undefined) {
  return useQuery({
    queryKey: ["source-versions", id],
    queryFn: () => fetchSourceVersions(id!),
    enabled: !!id,
  });
}

// --- Document Citations (Phase 8) ---

export function useDocumentCitations(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-citations", documentId],
    queryFn: () => fetchDocumentCitations(documentId!),
    enabled: !!documentId,
  });
}
