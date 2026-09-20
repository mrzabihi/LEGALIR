// ============================================================
// LEGALIR — RTL-Safe Icons
// Material Design icon set as SVG components
// All icons use 24×24 viewBox and respect direction
// ============================================================

import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  /** Flip the icon for RTL context */
  rtlFlip?: boolean;
}

function createIcon(
  displayName: string,
  path: React.ReactNode,
  shouldRtlFlip = false
) {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 24, rtlFlip, className = "", ...rest },
    ref
  ) {
    const flip = rtlFlip ?? shouldRtlFlip;
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        data-icon={displayName}
        className={`shrink-0 ${flip ? "rtl-flip" : ""} ${className}`}
        aria-hidden="true"
        {...rest}
      >
        {path}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

// --- Navigation Icons ---
export const IconHome = createIcon("Home", (
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
));

export const IconDashboard = createIcon("Dashboard", (
  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
));

export const IconMenu = createIcon("Menu", (
  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
));

export const IconChevronRight = createIcon(
  "ChevronRight",
  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />,
  true // RTL: flip to chevron-left
);

export const IconChevronDown = createIcon("ChevronDown", (
  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
));

export const IconArrowBack = createIcon(
  "ArrowBack",
  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />,
  true
);

export const IconArrowForward = createIcon(
  "ArrowForward",
  <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />,
  true
);

// --- Action Icons ---
export const IconSearch = createIcon("Search", (
  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
));

export const IconClose = createIcon("Close", (
  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
));

export const IconMore = createIcon("More", (
  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
));

export const IconAdd = createIcon("Add", (
  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
));

export const IconEdit = createIcon("Edit", (
  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
));

export const IconDelete = createIcon("Delete", (
  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
));

export const IconSave = createIcon("Save", (
  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
));

export const IconRefresh = createIcon("Refresh", (
  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
));

// --- Status Icons ---
export const IconCheck = createIcon("Check", (
  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
));

export const IconInfo = createIcon("Info", (
  <path d="M11 17h2v-6h-2v6zm1-8c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 13C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
));

export const IconWarning = createIcon("Warning", (
  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
));

export const IconError = createIcon("Error", (
  <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
));

// --- Content Icons ---
export const IconDocument = createIcon("Document", (
  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
));

export const IconContract = createIcon("Contract", (
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
));

export const IconChat = createIcon("Chat", (
  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
));

export const IconHistory = createIcon("History", (
  <path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
));

export const IconPerson = createIcon("Person", (
  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
));

export const IconSettings = createIcon("Settings", (
  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.484.484 0 00-.41-.3h-3.98c-.18 0-.35.1-.43.25l-1.77 3.57c-.48.23-.94.5-1.36.84l-2.69-.68a.49.49 0 00-.56.25l-1.92 3.32c-.12.19-.07.44.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.19.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l1.77 3.57c.08.15.25.25.43.25h3.98c.18 0 .35-.1.43-.25l1.77-3.57c.48-.23.94-.5 1.36-.84l2.69.68c.22.07.47-.03.59-.22l1.92-3.32c.12-.19.07-.44-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
));

export const IconLightMode = createIcon("LightMode", (
  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z" />
));

export const IconDarkMode = createIcon("DarkMode", (
  <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-4.4-8.5c-.36.06-.72.12-1.08.26A8.987 8.987 0 0012 21a9 9 0 000-18z" />
));

export const IconUpload = createIcon("Upload", (
  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
));

export const IconLogout = createIcon(
  "Logout",
  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />,
  true
);

export const IconMemory = createIcon("Memory", (
  <path d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z" />
));

export const IconSubscription = createIcon("Subscription", (
  <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
));

// --- Plan-tier icons (silver · gold · diamond) ---

/** Silver — a single four-point sparkle. */
export const IconPlanSilver = createIcon("PlanSilver", (
  <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
));

/** Gold — a five-point star. */
export const IconPlanGold = createIcon("PlanGold", (
  <path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4 1.15 6.6L12 17.2l-5.9 3.1 1.15-6.6L2.5 9.3l6.6-1.04z" />
));

/** Diamond — a faceted gem. */
export const IconPlanDiamond = createIcon("PlanDiamond", (
  <path d="M12 2L3 9l9 13 9-13-9-7zm0 2.5L17.6 9H6.4L12 4.5zM6.9 11h10.2L12 19.2 6.9 11z" />
));

export const IconPhone = createIcon("Phone", (
  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
));

export const IconFile = createIcon("File", (
  <path d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6zm0 18V4h7v5h5v11H6z" />
));

export const IconCheckCircle = createIcon("CheckCircle", (
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
));

export const IconShield = createIcon("Shield", (
  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
));

export const IconBalance = createIcon("Balance", (
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71L10 14.17l-1.88-1.88a.996.996 0 10-1.41 1.41l2.59 2.59c.39.39 1.02.39 1.41 0L17.3 9.7a.996.996 0 000-1.41c-.39-.39-1.03-.39-1.42 0z" />
));

// --- Phase 7 & 8 Chat & Citation Icons ---

export const IconStop = createIcon("Stop", (
  <path d="M6 6h12v12H6z" />
));

export const IconRetry = createIcon("Retry", (
  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
));

export const IconArchive = createIcon("Archive", (
  <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" />
));

export const IconCopy = createIcon("Copy", (
  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
));

export const IconLinkSource = createIcon("LinkSource", (
  <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
));

export const IconLawBook = createIcon("LawBook", (
  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8V9zm0 3h4v2h-4v-2zm0-6h8v2h-8V6z" />
));

export const IconExpandMore = createIcon("ExpandMore", (
  <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
));

export const IconMinimize = createIcon("Minimize", (
  <path d="M6 19h12v2H6v-2z" />
));

export const IconZoomIn = createIcon("ZoomIn", (
  <>
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" />
  </>
));

export const IconZoomOut = createIcon("ZoomOut", (
  <>
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    <path d="M7 9h5v1H7z" />
  </>
));

export const IconFitWidth = createIcon("FitWidth", (
  <>
    <path d="M4 6h2v12H4zM18 6h2v12h-2z" />
    <path d="M10 8l-4 4 4 4v-3h4v3l4-4-4-4v3h-4z" />
  </>
));

export const IconChevronLeft = createIcon("ChevronLeft", (
  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
));

export const IconChevronRightSmall = createIcon("ChevronRightSmall", (
  <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
));

export const IconOpenInNew = createIcon("OpenInNew", (
  <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
));

export const IconStar = createIcon("Star", (
  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
));

export const IconCoin = createIcon("Coin", (
  <>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 9.5c0-.8.7-1.5 1.6-1.5h2.3c.9 0 1.6.7 1.6 1.6 0 .9-.7 1.4-1.4 1.8l-2.2.9c-.7.3-1.4.9-1.4 1.8 0 .9.7 1.6 1.6 1.6h2.3c.9 0 1.6-.7 1.6-1.5" />
    <line x1="12" y1="6.5" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="16" x2="12" y2="17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </>
));

export const IconSend = createIcon(
  "Send",
  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />,
  true
);

export const IconCategory = createIcon("Category", (
  <path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7a2.5 2.5 0 010-5 2.5 2.5 0 010 5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z" />
));

export const IconDownload = createIcon("Download", (
  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
));

export const IconEmail = createIcon("Email", (
  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
));

export const IconCalendar = createIcon("Calendar", (
  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
));

export const IconServices = createIcon("Services", (
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
));

export const IconGender = createIcon("Gender", (
  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
));

// --- Legal Service Icons ---

/** Document with a magnifier — contract review / risk analysis. */
export const IconFileSearch = createIcon("FileSearch", (
  <path d="M20 19.59V8l-6-6H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c.45 0 .85-.15 1.19-.4l-4.43-4.43c-.8.52-1.74.83-2.76.83-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 1.02-.31 1.96-.83 2.75L20 19.59zM9 13c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3-3 1.34-3 3z" />
));

/** Lines with a pen — contract drafting. */
export const IconFilePen = createIcon("FilePen", (
  <path d="M3 10h11v2H3v-2zm0-2h11V6H3v2zm0 8h7v-2H3v2zm15.01-3.13l.71-.71c.39-.39 1.02-.39 1.41 0l.71.71c.39.39.39 1.02 0 1.41l-.71.71-2.12-2.12zm-.71.71l-5.3 5.3V21h2.12l5.3-5.3-2.12-2.12z" />
));

/** Article / formal document — legal notice. */
export const IconFileText = createIcon("FileText", (
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
));

/** Stacked documents — document analysis. */
export const IconFiles = createIcon("Files", (
  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
));

/** Calculator keypad — legal calculations. */
/** Stacked cylinders — advanced resources / data sources. */
export const IconDatabase = createIcon("Database", (
  <path d="M12 2C7.58 2 4 3.34 4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5c0-1.66-3.58-3-8-3zm0 2c3.87 0 6 .99 6 1s-2.13 1-6 1-6-.99-6-1 2.13-1 6-1zm6 15c0 .01-2.13 1-6 1s-6-.99-6-1v-2.23c1.5.72 3.66 1.23 6 1.23s4.5-.51 6-1.23V19zm0-4.5c0 .01-2.13 1-6 1s-6-.99-6-1v-2.23c1.5.72 3.66 1.23 6 1.23s4.5-.51 6-1.23v2.23zm0-4.5c0 .01-2.13 1-6 1s-6-.99-6-1V7.77c1.5.72 3.66 1.23 6 1.23s4.5-.51 6-1.23V10z" />
));

/** Lightning bolt — priority / fast processing. */
export const IconBolt = createIcon("Bolt", (
  <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z" />
));

/** Bell — notifications / notification center. */
export const IconBell = createIcon("Bell", (
  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
));

export const IconCalculator = createIcon("Calculator", (
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
));
