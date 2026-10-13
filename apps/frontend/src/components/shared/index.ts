export { OfflineBanner } from "./offline-banner";
export { ForbiddenPage } from "./forbidden-page";
export { NotFoundView, hasInternalHistory, type HistoryProbe } from "./not-found-view";
export { MobileTable, MobileTableCard } from "./mobile-table";
export { SplashScreen } from "./SplashScreen";
export { AppSplashGate } from "./AppSplashGate";
export { PageContextHeader } from "./PageContextHeader";
export { PageIntroBanner, type PageIntroBannerProps } from "./page-intro-banner";
export { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
export { PromoArt, PromoPanel, PromoModule, type PromoArtKey } from "./promo-art";

// --- Shared list-surface primitives (MD3 compact-list language) ---
// One implementation of the search bar, compact header, status badge,
// filter chips, results bar and overflow menu, reused by /history,
// /cases, /contracts and /documents so the four lists stay identical.
export { CompactPageHeader, type CompactPageHeaderProps } from "./compact-page-header";
export { SearchField, type SearchFieldProps } from "./search-field";
export { OverflowMenu, type OverflowMenuProps, type OverflowMenuItem } from "./overflow-menu";
export {
  StatusBadge,
  RawStatusBadge,
  statusTone,
  STATUS_TONE_CLASSES,
  type StatusBadgeProps,
  type StatusTone,
} from "./status-badge";
export { FilterChips, type FilterChipsProps, type FilterChipOption } from "./filter-chips";
export { ResultsBar, type ResultsBarProps, type ActiveFilter } from "./results-bar";
