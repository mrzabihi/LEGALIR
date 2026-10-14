// ============================================================
// LEGALIR — Top Bar (Desktop & Mobile Header)
// Glass-morphism header with animated user menu.
// ============================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLogout } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/hooks/useDashboard";
import { useRewardsSummary } from "@/hooks/useRewards";
import { UserAvatar } from "@/components/user/user-avatar";
import { SubscriptionStatusChip } from "@/components/subscription/subscription-status";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { toPersianNumber } from "@/lib/persian-utils";
import {
  IconPerson,
  IconLogout,
  IconSettings,
  IconSubscription,
  IconPhone,
  IconBolt,
} from "@/lib/icons";

export function TopBar() {
  const { data: meData } = useMe();
  const { data: rewards } = useRewardsSummary();
  const session = useAuthStore((s) => s.session);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = meData?.profile;
  const displayName = profile?.displayName;
  const mobileFallback = meData?.user?.mobileDisplay ?? session?.mobileDisplay;
  const avatarName = displayName ?? mobileFallback;
  const balance = rewards?.balance ?? 0;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setUserMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen, handleClickOutside]);

  return (
    <>
      {/* Rendered as three flex children of the header: a leading cluster, a
          reserved centre slot, and a trailing cluster. The `flex-1` clusters
          sit in their own boxes either side of the fixed centre slot, so no
          control can ever drift over the logo — the old absolutely-centred
          logo had no such guard and the energy pill and bell overlapped it at
          ≤375px. `min-w-0` lets a cluster shrink rather than widen the row. */}

      {/* Leading cluster — phones carry the plan chip + bell here. On desktop
          this cluster collapses to an empty `flex-1` spacer: the account group
          (chip · energy · bell · avatar) lives on the trailing side instead, so
          the two never split the identity controls across opposite edges. */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <div className="desktop:hidden">
          <SubscriptionStatusChip />
        </div>
        <div className="desktop:hidden">
          <NotificationBell />
        </div>
      </div>

      {/* Reserved centre slot — a fixed-width, non-shrinking box that holds
          the logo dead-centre. Its width is the logo's protected zone: the two
          `flex-1` clusters cannot enter it, so the mark is never overlapped. */}
      <div className="flex h-full w-[72px] shrink-0 items-center justify-center tablet:w-[96px]">
        <Link
          href="/dashboard"
          className="flex max-w-full items-center"
          aria-label="LEGALIR — داشبورد"
        >
          <img
            src="/legalir-logo-fa-type.png"
            alt="LEGALIR"
            className="h-6 tablet:h-8 w-auto max-w-full object-contain [[data-theme=dark]_&]:brightness-0 [[data-theme=dark]_&]:invert"
          />
        </Link>
      </div>

      {/* Trailing cluster — the account group, pinned to the end edge. On
          desktop it is the plan chip · energy · bell · avatar, in that source
          order (RTL: chip nearest the logo through avatar at the outer edge);
          on phones the chip + bell live in the leading cluster instead. */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 wide:gap-1.5">
        <div className="hidden min-w-0 desktop:block">
          <SubscriptionStatusChip />
        </div>

        {/* Energy balance — the header's single gold accent: a slim bordered
            pill (no fill, no shadow). The gold is rationed to the bolt glyph;
            the count stays neutral so it never competes with the logo. */}
        <Link
          href="/points"
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-secondary-200/70 px-1.5 transition-colors hover:bg-secondary-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 wide:gap-1.5 wide:px-2 [[data-theme=dark]_&]:border-secondary-500/25 [[data-theme=dark]_&]:hover:bg-secondary-500/10"
          aria-label={`امتیاز من: ${toPersianNumber(balance)} امتیاز`}
          title="امتیازهای من"
        >
          <IconBolt size={14} className="text-secondary-600 [[data-theme=dark]_&]:text-secondary-300" aria-hidden="true" />
          <span className="text-caption font-semibold tabular-nums text-on-surface-variant">
            {toPersianNumber(balance)}
          </span>
        </Link>

        {/* Desktop keeps the bell beside the avatar; on phones it lives in the
            leading cluster above. */}
        <div className="hidden desktop:block">
          <NotificationBell />
        </div>

        {/* User Menu — avatar (and name on desktop) in one pill. The open
            state is a soft brand tint, never a heavy box. */}
        <div className="relative min-w-0" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={[
              "flex h-8 min-w-0 items-center gap-2 rounded-full ps-1 pe-1 tablet:ps-1.5 tablet:pe-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400",
              userMenuOpen
                ? "bg-secondary-50/80 [[data-theme=dark]_&]:bg-secondary-500/15"
                : "hover:bg-surface-container [[data-theme=dark]_&]:hover:bg-surface-container-high",
            ].join(" ")}
            aria-label="منوی کاربری"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <UserAvatar
              avatarUrl={profile?.avatarUrl}
              name={avatarName}
              size={26}
              fallbackClassName="bg-primary-700 text-white text-labelSmall font-bold"
            />
            <span className="hidden min-w-0 tablet:inline text-body-2 text-on-surface font-medium truncate max-w-[84px]">
              {displayName ?? mobileFallback ?? "کاربر"}
            </span>
          </button>

          {userMenuOpen && <UserMenuDropdown onClose={() => setUserMenuOpen(false)} />}
        </div>
      </div>
    </>
  );
}

function UserMenuDropdown({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: meData } = useMe();
  const { logout, isPending: isLoggingOut } = useLogout();
  const session = useAuthStore((s) => s.session);

  const profile = meData?.profile;
  const displayName = profile?.displayName;
  const mobile = session?.mobileDisplay ?? meData?.user?.mobileDisplay;

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <div
      className="absolute top-full end-0 mt-3 w-64 rounded-large bg-surface border border-divider shadow-elevation-8 z-50 overflow-hidden animate-scale-in origin-top-end"
      role="menu"
    >
      {/* User info header */}
      <div className="px-4 py-3.5 border-b border-divider bg-surface-container-low">
        <p className="text-body-2 text-on-surface font-semibold">{displayName ?? "کاربر لیگالیر"}</p>
        {mobile && <p className="text-caption text-muted dir-ltr text-right mt-0.5">{mobile}</p>}
      </div>

      <div className="py-1.5">
        <MenuItem icon={<IconPerson size={18} className="text-on-surface-variant" />} label="پروفایل" onClick={() => { onClose(); router.push("/profile"); }} />
        <MenuItem icon={<IconSubscription size={18} className="text-on-surface-variant" />} label="اشتراک" onClick={() => { onClose(); router.push("/subscription"); }} />
        <MenuItem icon={<IconSettings size={18} className="text-on-surface-variant" />} label="تنظیمات" onClick={() => { onClose(); router.push("/settings"); }} />
        <MenuItem icon={<IconPhone size={18} className="text-on-surface-variant" />} label="پشتیبانی" onClick={() => { onClose(); router.push("/support"); }} />
      </div>

      <div className="border-t border-divider py-1.5">
        <MenuItem
          icon={<IconLogout size={18} className="text-error" />}
          label={isLoggingOut ? "در حال خروج..." : "خروج از حساب"}
          onClick={handleLogout}
          danger
        />
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-3 w-full px-4 py-3 text-body-2 transition-colors touch-target-min text-start",
        danger ? "text-error hover:bg-error-container" : "text-on-surface hover:bg-surface-hover",
      ].join(" ")}
      role="menuitem"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
