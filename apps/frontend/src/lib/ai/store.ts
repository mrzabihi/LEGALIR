// ============================================================
// LEGALIR — AI Chat Persistence & Usage (server-only)
// ============================================================
// Stores conversation messages in .data/conversation-messages.json
// and increments daily usage counters in .data/usage_stats.json.
// Keeps the streaming gateway's persistence side-effects separate
// from the provider/gateway logic.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import type { StructuredResponseSection, V1Reference } from "@legalir/types";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const MESSAGES_FILE = "conversation-messages.json";
const USAGE_FILE = "usage_stats.json";

// ============================================================
// Stored message shape
// ============================================================

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "draft" | "sending" | "sent" | "streaming" | "validating" | "completed" | "blocked" | "failed";
  sections?: StructuredResponseSection[];
  riskLevel?: string | null;
  references?: V1Reference[];
  createdAt: string;
}

type MessagesTable = Record<string, StoredMessage[]>;

// ============================================================
// JSON-DB primitives
// ============================================================

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readMessagesTable(): MessagesTable {
  ensureDir();
  const file = path.join(DATA_DIR, MESSAGES_FILE);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as MessagesTable;
  } catch {
    return {};
  }
}

function writeMessagesTable(table: MessagesTable): void {
  ensureDir();
  fs.writeFileSync(
    path.join(DATA_DIR, MESSAGES_FILE),
    JSON.stringify(table, null, 2),
    "utf-8"
  );
}

// ============================================================
// Message operations
// ============================================================

export function getMessages(conversationId: string): StoredMessage[] {
  return readMessagesTable()[conversationId] ?? [];
}

export function appendMessage(conversationId: string, message: StoredMessage): void {
  const table = readMessagesTable();
  const list = table[conversationId] ?? [];
  list.push(message);
  table[conversationId] = list;
  writeMessagesTable(table);
}

/** Remove all persisted messages for a conversation (used on delete). */
export function deleteMessages(conversationId: string): void {
  const table = readMessagesTable();
  if (!(conversationId in table)) return;
  delete table[conversationId];
  writeMessagesTable(table);
}

// ============================================================
// Usage accounting (§26 — real AI requests count against usage)
// ============================================================

interface UsageRow {
  user_id: string;
  daily_requests_used: number;
  daily_requests_total: number;
  tokens_used: number;
  tokens_total: number;
  document_analyses_used: number;
  document_analyses_total: number;
  contracts_generated: number;
  contracts_total: number;
}

export function incrementDailyRequest(userId: string): void {
  ensureDir();
  const file = path.join(DATA_DIR, USAGE_FILE);
  let rows: UsageRow[] = [];
  if (fs.existsSync(file)) {
    try {
      rows = JSON.parse(fs.readFileSync(file, "utf-8")) as UsageRow[];
    } catch {
      rows = [];
    }
  }

  const row = rows.find((r) => r.user_id === userId);
  if (row) {
    row.daily_requests_used = (row.daily_requests_used ?? 0) + 1;
  } else {
    rows.push({
      user_id: userId,
      daily_requests_used: 1,
      daily_requests_total: 300,
      tokens_used: 0,
      tokens_total: 1300000,
      document_analyses_used: 0,
      document_analyses_total: 10,
      contracts_generated: 0,
      contracts_total: 8,
    });
  }

  fs.writeFileSync(file, JSON.stringify(rows, null, 2), "utf-8");
}
