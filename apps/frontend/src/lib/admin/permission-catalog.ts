// ============================================================
// LEGALIR — Permission catalog (admin presentation layer)
// ============================================================
// A read-only, Persian-labelled view over the RBAC model that already lives
// in `@legalir/types`. This file changes NOTHING about authorization — it only
// *describes* the existing `Permission` union so the staff / roles /
// permissions screens can group it by domain and level.
//
// `PERMISSION_META` is typed as `Record<Permission, …>`, so the day a new
// permission is added to the union TypeScript forces this catalog to stay
// complete. That is the single guarantee that the UI never silently drifts
// from the model.
// ============================================================

import {
  ROLE_PERMISSIONS,
  ROLE_FA,
  type Permission,
  type PlatformRole,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Groups (the domain a permission belongs to)
// ---------------------------------------------------------------------------

export type PermissionGroup =
  | "workspace"
  | "lawyer"
  | "org"
  | "overview"
  | "users"
  | "lawyers"
  | "requests"
  | "content"
  | "library"
  | "ai"
  | "finance"
  | "plans"
  | "energy"
  | "support"
  | "reports"
  | "governance";

/** Display order + Persian label for each domain group. */
export const PERMISSION_GROUP_ORDER: { group: PermissionGroup; labelFa: string }[] = [
  { group: "overview", labelFa: "نمای کلی" },
  { group: "users", labelFa: "کاربران و سازمان‌ها" },
  { group: "requests", labelFa: "درخواست‌ها و پرونده‌ها" },
  { group: "lawyers", labelFa: "وکلا" },
  { group: "content", labelFa: "محتوا و پایگاه دانش" },
  { group: "library", labelFa: "کتابخانه لیگالیر" },
  { group: "ai", labelFa: "هوش مصنوعی و RAG" },
  { group: "plans", labelFa: "پلن‌ها و خدمات" },
  { group: "finance", labelFa: "مالی، فروش و تسویه" },
  { group: "energy", labelFa: "انرژی و هزینهٔ خدمات" },
  { group: "support", labelFa: "پشتیبانی" },
  { group: "reports", labelFa: "گزارش‌ها و خروجی" },
  { group: "governance", labelFa: "حاکمیت، کارکنان و امنیت" },
  { group: "workspace", labelFa: "فضای کاری شخصی" },
  { group: "lawyer", labelFa: "فضای کاری وکیل" },
  { group: "org", labelFa: "فضای سازمانی" },
];

// ---------------------------------------------------------------------------
// Levels (the kind of action a permission grants)
// ---------------------------------------------------------------------------

export type PermissionLevel =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "manage"
  | "export"
  | "system";

export const PERMISSION_LEVEL_FA: Record<PermissionLevel, string> = {
  view: "مشاهده",
  create: "ایجاد",
  edit: "ویرایش",
  delete: "حذف",
  approve: "تأیید",
  manage: "مدیریت",
  export: "خروجی",
  system: "سیستمی",
};

/**
 * Derive the action level from the permission key. This is a *display*
 * classification only — authorization still reads the exact key from
 * `ROLE_PERMISSIONS`. Ordered most-specific first.
 */
export function permissionLevel(p: Permission): PermissionLevel {
  if (p === "admin:system:manage") return "system";
  if (p.endsWith(":export")) return "export";
  if (p.endsWith(":approve") || p.endsWith(":verify")) return "approve";
  if (p.endsWith(":manage")) return "manage";
  if (p.includes(":read")) return "view";
  if (
    p.endsWith(":create") ||
    p.endsWith(":invite") ||
    p.endsWith(":request") ||
    p.endsWith(":send")
  ) {
    return "create";
  }
  if (p.includes(":write") || p.endsWith(":publish") || p.endsWith(":update")) return "edit";
  if (p.endsWith(":delete") || p.endsWith(":remove")) return "delete";
  return "manage";
}

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

export interface PermissionMeta {
  /** Human, Persian label shown in tables and the role matrix. */
  fa: string;
  group: PermissionGroup;
}

/**
 * Every permission, its Persian label and its domain. Exhaustive by
 * construction: `Record<Permission, …>` fails to compile if a permission is
 * ever added to the union without a label here.
 */
export const PERMISSION_META: Record<Permission, PermissionMeta> = {
  // --- Personal workspace ---
  "case:read:own": { fa: "مشاهده پرونده‌های خود", group: "workspace" },
  "case:write:own": { fa: "ایجاد/ویرایش پرونده‌های خود", group: "workspace" },
  "contract:read:own": { fa: "مشاهده قراردادهای خود", group: "workspace" },
  "contract:write:own": { fa: "ایجاد/ویرایش قراردادهای خود", group: "workspace" },
  "document:read:own": { fa: "مشاهده اسناد خود", group: "workspace" },
  "document:write:own": { fa: "ایجاد/ویرایش اسناد خود", group: "workspace" },
  "consultation:create": { fa: "درخواست مشاوره", group: "workspace" },
  "lawyer:request": { fa: "ثبت درخواست وکیل", group: "workspace" },
  // --- Lawyer workspace ---
  "lawyer:profile:write": { fa: "ویرایش پروفایل حرفه‌ای", group: "lawyer" },
  "lawyer:request:read:assigned": { fa: "مشاهده درخواست‌های ارجاع‌شده", group: "lawyer" },
  "lawyer:request:respond": { fa: "پاسخ به درخواست ارجاع‌شده", group: "lawyer" },
  "lawyer:case:read:assigned": { fa: "مشاهده پرونده‌های ارجاع‌شده", group: "lawyer" },
  "lawyer:case:write:assigned": { fa: "ویرایش پرونده‌های ارجاع‌شده", group: "lawyer" },
  "lawyer:message:send": { fa: "ارسال پیام به کارفرما", group: "lawyer" },
  // --- Organization ---
  "org:read": { fa: "مشاهده اطلاعات سازمان", group: "org" },
  "org:member:invite": { fa: "دعوت عضو جدید", group: "org" },
  "org:member:manage": { fa: "مدیریت اعضای سازمان", group: "org" },
  "org:case:read:all": { fa: "مشاهده همه پرونده‌های سازمان", group: "org" },
  "org:case:write:all": { fa: "ویرایش همه پرونده‌های سازمان", group: "org" },
  "org:contract:read:all": { fa: "مشاهده همه قراردادهای سازمان", group: "org" },
  "org:contract:write:all": { fa: "ویرایش همه قراردادهای سازمان", group: "org" },
  "org:billing:manage": { fa: "مدیریت صورتحساب سازمان", group: "org" },
  "org:settings:manage": { fa: "مدیریت تنظیمات سازمان", group: "org" },
  // --- Overview ---
  "admin:overview:read": { fa: "مشاهده نمایهٔ کلی پلتفرم", group: "overview" },
  // --- Users ---
  "admin:users:read": { fa: "مشاهده کاربران", group: "users" },
  "admin:users:manage": { fa: "مدیریت کاربران", group: "users" },
  // --- Lawyers ---
  "admin:lawyer:read": { fa: "مشاهده وکلا", group: "lawyers" },
  "admin:lawyer:verify": { fa: "تأیید / رد وکیل", group: "lawyers" },
  "admin:lawyer:create": { fa: "ایجاد پروفایل وکیل", group: "lawyers" },
  "admin:lawyer:update": { fa: "ویرایش پروفایل وکیل", group: "lawyers" },
  "admin:lawyer:status": { fa: "تغییر وضعیت وکیل (فعال/غیرفعال)", group: "lawyers" },
  "admin:lawyer:suspend": { fa: "تعلیق وکیل", group: "lawyers" },
  "admin:lawyer:delete": { fa: "حذف وکیل", group: "lawyers" },
  "admin:lawyer:restore": { fa: "بازگردانی وکیل حذف‌شده", group: "lawyers" },
  "admin:lawyer:feature": { fa: "برجسته‌سازی وکیل", group: "lawyers" },
  "admin:lawyer:review:manage": { fa: "مدیریت نظرات وکلا", group: "lawyers" },
  "admin:lawyer:rating:manage": { fa: "مدیریت امتیاز نمایشی وکلا", group: "lawyers" },
  "admin:lawyer:avatar:manage": { fa: "مدیریت آواتار وکلا", group: "lawyers" },
  // --- Requests ---
  "admin:requests:read": { fa: "مشاهده درخواست‌ها", group: "requests" },
  "admin:requests:manage": { fa: "مدیریت درخواست‌ها و ارجاع", group: "requests" },
  // --- Content & knowledge ---
  "admin:content:read": { fa: "مشاهده محتوا و وبلاگ", group: "content" },
  "admin:content:manage": { fa: "مدیریت محتوا و وبلاگ", group: "content" },
  "admin:knowledge:read": { fa: "مشاهده پایگاه دانش حقوقی", group: "content" },
  "admin:knowledge:write": { fa: "ویرایش پایگاه دانش حقوقی", group: "content" },
  // --- Legal library (a product section of its own, distinct from the blog) ---
  "admin:library:read": { fa: "مشاهده کتابخانه لیگالیر", group: "library" },
  "admin:library:manage": { fa: "مدیریت و انتشار کتابخانه لیگالیر", group: "library" },
  // --- AI & RAG ---
  "admin:ai:read": { fa: "مشاهده پیکربندی هوش مصنوعی", group: "ai" },
  "admin:ai:manage": { fa: "مدیریت ارائه‌دهنده‌ها و پرامپت‌ها", group: "ai" },
  "admin:ai:secret": { fa: "مدیریت کلیدهای محرمانهٔ هوش مصنوعی", group: "ai" },
  "admin:rag:read": { fa: "مشاهده منابع RAG", group: "ai" },
  "admin:rag:manage": { fa: "مدیریت و بازبینی منابع RAG", group: "ai" },
  "admin:rag:publish": { fa: "انتشار منبع RAG", group: "ai" },
  // --- Plans & services ---
  "admin:plans:read": { fa: "مشاهده پلن‌ها", group: "plans" },
  "admin:plans:manage": { fa: "مدیریت پلن‌ها و سهمیه‌ها", group: "plans" },
  "admin:services:read": { fa: "مشاهده خدمات", group: "plans" },
  "admin:services:manage": { fa: "مدیریت خدمات", group: "plans" },
  "admin:flags:manage": { fa: "مدیریت پرچم‌های ویژگی", group: "plans" },
  "admin:calculators:read": { fa: "مشاهده محاسبه‌گرها", group: "plans" },
  "admin:calculators:manage": { fa: "مدیریت محاسبه‌گرها", group: "plans" },
  // --- Finance ---
  "admin:billing:read": { fa: "مشاهده فروش و سفارش‌ها", group: "finance" },
  "admin:billing:manage": { fa: "مدیریت فروش و سفارش‌ها", group: "finance" },
  "admin:refund:approve": { fa: "تأیید بازگشت وجه", group: "finance" },
  "admin:finance:read": { fa: "مشاهدهٔ مالی", group: "finance" },
  "admin:finance:manage": { fa: "مدیریت مالی و کمیسیون", group: "finance" },
  "admin:settlement:manage": { fa: "مدیریت تسویه‌حساب وکلا", group: "finance" },
  "admin:settlement:approve": { fa: "تأیید تسویه‌حساب وکلا", group: "finance" },
  // --- Energy ---
  "admin:energy:read": { fa: "مشاهدهٔ انرژی و هزینه", group: "energy" },
  "admin:energy:manage": { fa: "مدیریت مدل هزینه و قواعد انرژی", group: "energy" },
  // --- Support ---
  "admin:support:read": { fa: "مشاهده تیکت‌های پشتیبانی", group: "support" },
  "admin:support:manage": { fa: "مدیریت تیکت‌های پشتیبانی", group: "support" },
  // --- Reports ---
  "admin:reports:read": { fa: "مشاهده گزارش‌ها", group: "reports" },
  "admin:reports:export": { fa: "خروجی گزارش‌ها", group: "reports" },
  // --- Analytics (BI / product intelligence) ---
  "admin:analytics:read": { fa: "مشاهدهٔ تحلیل‌های کسب‌وکار", group: "reports" },
  "admin:analytics:export": { fa: "خروجی تحلیل‌های کسب‌وکار", group: "reports" },
  // --- Governance / security ---
  "admin:staff:read": { fa: "مشاهده کارکنان و نقش‌ها", group: "governance" },
  "admin:staff:manage": { fa: "مدیریت کارکنان و تخصیص نقش", group: "governance" },
  "admin:audit:read": { fa: "مشاهده رویدادهای امنیتی (ممیزی)", group: "governance" },
  "admin:settings:read": { fa: "مشاهده تنظیمات پلتفرم", group: "governance" },
  "admin:settings:manage": { fa: "مدیریت تنظیمات پلتفرم", group: "governance" },
  "admin:system:manage": { fa: "مدیریت سیستمی (خط‌قرمز)", group: "governance" },
};

/** Persian label for a permission key. */
export const PERMISSION_FA: Record<Permission, string> = Object.fromEntries(
  Object.entries(PERMISSION_META).map(([key, meta]) => [key, (meta as PermissionMeta).fa])
) as Record<Permission, string>;

/** Every permission in the model, in catalog order. */
export const ALL_PERMISSIONS = Object.keys(PERMISSION_META) as Permission[];

/** The permission keys grouped by domain, in display order. */
export function permissionsByGroup(): {
  group: PermissionGroup;
  labelFa: string;
  items: Permission[];
}[] {
  return PERMISSION_GROUP_ORDER.map(({ group, labelFa }) => ({
    group,
    labelFa,
    items: ALL_PERMISSIONS.filter((p) => PERMISSION_META[p].group === group),
  })).filter((g) => g.items.length > 0);
}

/** The roles (with Persian labels) that grant a given permission. */
export function rolesWithPermission(p: Permission): { role: PlatformRole; labelFa: string }[] {
  return (Object.keys(ROLE_PERMISSIONS) as PlatformRole[])
    .filter((role) => ROLE_PERMISSIONS[role].includes(p))
    .map((role) => ({ role, labelFa: ROLE_FA[role] ?? role }));
}
