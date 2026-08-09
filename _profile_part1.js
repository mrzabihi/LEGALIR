"use client";

import { useState, useCallback } from "react";
import { useMe, useUpdateProfile } from "@/hooks/useDashboard";
import { useProfileUsage, useSubscriptionHistory } from "@/hooks/usePhase11";
import { useThemeStore } from "@/stores/theme-store";
import { toPersianNumber, toPersianDate } from "@/lib/persian-utils";
import {
  IconEdit, IconCheck, IconClose, IconPhone, IconShield,
  IconSettings, IconSubscription, IconEmail, IconCalendar,
  IconGender, IconLightMode, IconDarkMode,
} from "@/lib/icons";
import type { V1SubscriptionHistoryItem, V1ProfileUsage } from "@legalir/types";

const STATUS_BADGE_STYLES = {
  active: "bg-success/10 text-success",
  expired: "bg-error/10 text-error",
  cancelled: "bg-surfaceVariant text-muted",
  unknown: "bg-surfaceVariant text-muted",
};
