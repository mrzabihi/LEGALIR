// ============================================================
// LEGALIR — Top Bar (Desktop & Mobile Header)
// Glass-morphism header with animated user menu.
// ============================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { useLogout } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/hooks/useDashboard";
import {
  IconLightMode,
  IconDarkMode,
  IconPerson,
  IconLogout,
  IconSettings,
  IconSubscription,
  IconPhone,
} from "@/lib/icons";

export function TopBar() {
  const { data: meData } = useMe();
  const session = useAuthStore((s) => s.session);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = meData?.profile;
  const displayName = profile?.displayName;
  const mobileFallback = meData?.user?.mobileDisplay ?? session?.mobileDisplay;
  const avatarInitial = (displayName ?? mobileFallback)?.[0] ?? "ک";

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
      {/* Mobile logo */}
      <Link href="/dashboard" className="desktop:hidden flex items-center shrink-0">
        <img src="/legalir-logo.png" alt="LEGALIR" className="h-10 w-auto shrink-0" />
      </Link>

      <div className="flex-1" />

      {/* Theme Toggle */}
      <ThemeToggleButton />

      {/* Quick support button */}
      <Link
        href="/support"
        className="hidden tablet:flex w-10 h-10 items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors touch-target-min"
        aria-label="پشتیبانی"
      >
        <IconPhone size={20} className="text-neutral-500" />
      </Link>

      {/* User Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className={[
            "flex items-center gap-2 rounded-xl p-1.5 pr-2.5 transition-all duration-200 touch-target",
            userMenuOpen ? "bg-primary-50 ring-2 ring-primary-200" : "hover:bg-neutral-100",
          ].join(" ")}
          aria-label="منوی کاربری"
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white text-labelSmall font-bold shadow-elevation-1">
            {avatarInitial}
          </div>
          <span className="hidden tablet:inline text-labelLarge text-on-surface font-medium truncate max-w-[100px]">
            {displayName ?? mobileFallback ?? "کاربر"}
          </span>
        </button>

        {userMenuOpen && <UserMenuDropdown onClose={() => setUserMenuOpen(false)} />}
      </div>
    </>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-neutral-100 active:scale-95 transition-all duration-200 touch-target-min"
      aria-label={theme === "light" ? "حالت تیره" : "حالت روشن"}
    >
      {theme === "light" ? <IconDarkMode size={20} className="text-neutral-600" /> : <IconLightMode size={20} className="text-amber-400" />}
    </button>
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
      className="absolute top-full end-0 mt-3 w-64 rounded-2xl bg-surface border border-divider shadow-elevation-8 z-50 overflow-hidden animate-scale-in origin-top-end"
      role="menu"
    >
      {/* User info header */}
      <div className="px-4 py-3.5 border-b border-divider bg-neutral-50/50">
        <p className="text-body-2 text-on-surface font-semibold">{displayName ?? "کاربر LEGALIR"}</p>
        {mobile && <p className="text-caption text-muted dir-ltr text-right mt-0.5">{mobile}</p>}
      </div>

      <div className="py-1.5">
        <MenuItem icon={<IconPerson size={18} className="text-neutral-400" />} label="پروفایل" onClick={() => { onClose(); router.push("/profile"); }} />
        <MenuItem icon={<IconSubscription size={18} className="text-neutral-400" />} label="اشتراک" onClick={() => { onClose(); router.push("/subscription"); }} />
        <MenuItem icon={<IconSettings size={18} className="text-neutral-400" />} label="تنظیمات" onClick={() => { onClose(); router.push("/settings"); }} />
        <MenuItem icon={<IconPhone size={18} className="text-neutral-400" />} label="پشتیبانی" onClick={() => { onClose(); router.push("/support"); }} />
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
        danger ? "text-error hover:bg-error/5" : "text-on-surface hover:bg-neutral-50",
      ].join(" ")}
      role="menuitem"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
