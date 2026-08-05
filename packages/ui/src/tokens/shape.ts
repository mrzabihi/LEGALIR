// ============================================================
// LEGALIR — Material Design V2 Shape Tokens
// ============================================================

export const shape = {
  /** 4px — small components: chips, badges, small buttons */
  small: "4px",
  /** 8px — medium components: cards, dialogs */
  medium: "8px",
  /** 12px — large components: drawers, sheets */
  large: "12px",
  /** 16px — extra large: modals on mobile */
  xlarge: "16px",
  /** 28px — fully rounded: fab, pills */
  full: "28px",
  /** Circle */
  circle: "50%",
} as const;

export type ShapeSize = keyof typeof shape;
