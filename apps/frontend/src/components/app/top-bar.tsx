// ============================================================
// LEGALIR — Top Bar (Desktop & Mobile Header)
// ============================================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { useAppShellStore } from "@/lib/stores";
import { useLogout } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/hooks/useDashboard";
import {
  IconMenu,
  IconLightMode,
  IconDarkMode,
  IconPerson,
  IconLogout,
  IconSettings,
  IconSubscription,
} from "@/lib/icons";

export function TopBar() {
  const { theme: _theme } = useTheme();
  const toggleDrawer = useAppShellStore((s) => s.toggleDrawer);
  const { data: meData } = useMe();
  const session = useAuthStore((s) => s.session);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = meData?.profile;
  const displayName = profile?.displayName;
  const mobileFallback = meData?.user?.mobileDisplay ?? session?.mobileDisplay;
  const avatarInitial = (displayName ?? mobileFallback)?.[0] ?? "ک";

  // Close menu on outside click
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
      {/* Mobile hamburger button (rendered inside AppShell header) */}
      <button
        onClick={toggleDrawer}
        className="desktop:hidden w-12 h-12 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors touch-target-min"
        aria-label="منوی اصلی"
      >
        <IconMenu size={22} />
      </button>

      {/* Logo area — visible when sidebar is hidden */}
      <Link
        href="/dashboard"
        className="desktop:hidden flex items-center shrink-0"
      >
        <img
          src="/legalir-logo.png"
          alt="LEGALIR"
          className="h-14 w-auto"
        />
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme Toggle */}
      <ThemeToggleButton />

      {/* User Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-100 transition-colors touch-target"
          aria-label="منوی کاربری"
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          <div className="h-9 w-9 rounded-full bg-primary-700 flex items-center justify-center text-white text-labelSmall font-medium">
            {avatarInitial}
          </div>
          <span className="hidden tablet:inline text-labelLarge text-neutral-700 truncate max-w-[120px]">
            {displayName ?? meData?.user?.mobileDisplay ?? session?.mobileDisplay ?? "کاربر"}
          </span>
        </button>

        {userMenuOpen && <UserMenuDropdown onClose={() => setUserMenuOpen(false)} />}
      </div>
    </>
  );
}

// ============================================================
// ThemeToggleButton
// ============================================================

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors touch-target-min"
      aria-label={theme === "light" ? "حالت تیره" : "حالت روشن"}
    >
      {theme === "light" ? <IconDarkMode size={22} /> : <IconLightMode size={22} />}
    </button>
  );
}

// ============================================================
// UserMenuDropdown
// ============================================================

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
      className="absolute top-full end-0 mt-2 w-64 rounded-large bg-neutral-0 border border-neutral-200 shadow-elevation-8 z-50 overflow-hidden animate-fade-in"
      role="menu"
    >
      {/* User Info */}
      <div className="px-4 py-3 border-b border-neutral-100">
        <p className="text-labelLarge text-neutral-800 font-medium">
          {displayName ?? "کاربر LEGALIR"}
        </p>
        {mobile && <p className="text-caption text-neutral-500 dir-ltr text-right">{mobile}</p>}
      </div>

      {/* Menu Items */}
      <div className="py-1">
        <button
          onClick={() => {
            onClose();
            router.push("/profile");
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-labelLarge text-neutral-700 hover:bg-neutral-50 transition-colors touch-target-min"
          role="menuitem"
        >
          <IconPerson size={18} />
          <span>پروفایل</span>
        </button>
        <button
          onClick={() => {
            onClose();
            router.push("/subscription");
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-labelLarge text-neutral-700 hover:bg-neutral-50 transition-colors touch-target-min"
          role="menuitem"
        >
          <IconSubscription size={18} />
          <span>اشتراک</span>
        </button>
        <button
          onClick={() => {
            onClose();
            router.push("/settings");
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-labelLarge text-neutral-700 hover:bg-neutral-50 transition-colors touch-target-min"
          role="menuitem"
        >
          <IconSettings size={18} />
          <span>تنظیمات</span>
        </button>
      </div>

      {/* Logout */}
      <div className="border-t border-neutral-100 py-1">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 w-full px-4 py-3 text-labelLarge text-error hover:bg-error/[0.04] transition-colors disabled:opacity-50 touch-target-min"
          role="menuitem"
        >
          <IconLogout size={18} />
          <span>{isLoggingOut ? "در حال خروج..." : "خروج"}</span>
        </button>
      </div>
    </div>
  );
}
