// ============================================================
// Case Management — DB Types & Operations
// ============================================================

import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.resolve(process.cwd(), ".data");

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readTable<T>(name: string): T[] {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  ensureDir();
  const file = path.join(DB_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export interface DbCase {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface DbCaseTimelineEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbCaseTask {
  id: string;
  case_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

// --- Case CRUD ---

export function listCases(
  userId: string,
  params?: { status?: string; category?: string; priority?: string; search?: string; page?: number; pageSize?: number }
): { items: DbCase[]; total: number } {
  let rows = readTable<DbCase>("cases").filter((c) => c.user_id === userId);
  if (params?.status) rows = rows.filter((c) => c.status === params.status);
  if (params?.category) rows = rows.filter((c) => c.category === params.category);
  if (params?.priority) rows = rows.filter((c) => c.priority === params.priority);
  if (params?.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = rows.length;
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total };
}

export function getCaseById(caseId: string): DbCase | undefined {
  return readTable<DbCase>("cases").find((c) => c.id === caseId);
}

export function createCase(data: {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
}): DbCase {
  const now = new Date().toISOString();
  const row: DbCase = {
    id: data.id,
    user_id: data.userId,
    title: data.title,
    description: data.description,
    category: data.category,
    status: "ACTIVE",
    priority: data.priority,
    created_at: now,
    updated_at: now,
  };
  const cases = readTable<DbCase>("cases");
  cases.push(row);
  writeTable("cases", cases);
  return row;
}

export function updateCase(caseId: string, data: Record<string, unknown>): DbCase | undefined {
  const cases = readTable<DbCase>("cases");
  const idx = cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return undefined;
  cases[idx] = { ...cases[idx], ...data as Partial<DbCase>, updated_at: new Date().toISOString() } as DbCase;
  writeTable("cases", cases);
  return cases[idx];
}

// --- Case Timeline ---

export function getCaseTimeline(caseId: string): DbCaseTimelineEvent[] {
  return readTable<DbCaseTimelineEvent>("case_timeline")
    .filter((e) => e.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addCaseTimelineEvent(data: {
  id: string;
  caseId: string;
  eventType: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}): DbCaseTimelineEvent {
  const event: DbCaseTimelineEvent = {
    id: data.id,
    case_id: data.caseId,
    event_type: data.eventType,
    title: data.title,
    description: data.description,
    metadata: data.metadata,
    created_at: new Date().toISOString(),
  };
  const events = readTable<DbCaseTimelineEvent>("case_timeline");
  events.push(event);
  writeTable("case_timeline", events);
  return event;
}

// --- Case Tasks ---

export function getCaseTasks(caseId: string): DbCaseTask[] {
  return readTable<DbCaseTask>("case_tasks")
    .filter((t) => t.case_id === caseId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function createCaseTask(data: {
  id: string;
  caseId: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string | null;
}): DbCaseTask {
  const now = new Date().toISOString();
  const task: DbCaseTask = {
    id: data.id,
    case_id: data.caseId,
    title: data.title,
    description: data.description,
    status: "todo",
    priority: data.priority,
    due_date: data.dueDate,
    created_at: now,
    updated_at: now,
  };
  const tasks = readTable<DbCaseTask>("case_tasks");
  tasks.push(task);
  writeTable("case_tasks", tasks);
  return task;
}

export function updateCaseTask(caseId: string, taskId: string, data: Record<string, unknown>): DbCaseTask | undefined {
  const tasks = readTable<DbCaseTask>("case_tasks");
  const idx = tasks.findIndex((t) => t.id === taskId && t.case_id === caseId);
  if (idx === -1) return undefined;
  tasks[idx] = { ...tasks[idx], ...data as Partial<DbCaseTask>, updated_at: new Date().toISOString() } as DbCaseTask;
  writeTable("case_tasks", tasks);
  return tasks[idx];
}
