// ============================================================
// LEGALIR — AI Assistant Store (Zustand + persist)
// ============================================================
// Manages: panel open state, messages, unread count.
// Messages are persisted to localStorage.
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** The page context where this message was sent */
  context?: string;
}

export type PageContext =
  | "dashboard"
  | "chat"
  | "contracts"
  | "documents"
  | "settings"
  | "history"
  | "new"
  | "subscription"
  | "profile"
  | "memory";

interface AssistantState {
  /** Whether the assistant panel is open */
  isOpen: boolean;
  /** Toggle the panel open/closed */
  toggleOpen: () => void;
  /** Close the panel */
  closePanel: () => void;
  /** Open the panel */
  openPanel: () => void;

  /** Conversation messages */
  messages: AssistantMessage[];
  /** Add a message to the conversation */
  addMessage: (msg: Omit<AssistantMessage, "id" | "timestamp">) => void;
  /** Clear all messages */
  clearMessages: () => void;

  /** Count of unread assistant messages (shown as badge) */
  unreadCount: number;
  /** Mark all messages as read */
  markAllRead: () => void;
  /** Increment unread count (called when assistant sends a message while panel is closed) */
  incrementUnread: () => void;
}

let messageIdCounter = 0;
function generateId(): string {
  messageIdCounter += 1;
  return `asst-msg-${Date.now()}-${messageIdCounter}`;
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      isOpen: false,

      toggleOpen: () => {
        const next = !get().isOpen;
        set({ isOpen: next });
        if (next) {
          set({ unreadCount: 0 });
        }
      },

      closePanel: () => set({ isOpen: false }),

      openPanel: () => {
        set({ isOpen: true, unreadCount: 0 });
      },

      messages: [],

      addMessage: (msg) => {
        const message: AssistantMessage = {
          ...msg,
          id: generateId(),
          timestamp: Date.now(),
        };
        set((state) => ({
          messages: [...state.messages, message],
        }));
        // If panel is closed and this is an assistant message, increment unread
        if (!get().isOpen && msg.role === "assistant") {
          set((state) => ({ unreadCount: state.unreadCount + 1 }));
        }
      },

      clearMessages: () => set({ messages: [], unreadCount: 0 }),

      unreadCount: 0,

      markAllRead: () => set({ unreadCount: 0 }),

      incrementUnread: () =>
        set((state) => ({ unreadCount: state.unreadCount + 1 })),
    }),
    {
      name: "legalir-assistant",
      partialize: (state) => ({
        messages: state.messages.slice(-50), // keep last 50 messages
      }),
    }
  )
);
