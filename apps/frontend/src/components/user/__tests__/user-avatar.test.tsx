// ============================================================
// LEGALIR — UserAvatar behaviour tests
// ============================================================
// The single renderer every surface draws the signed-in user from. These lock
// in the two guarantees the product depends on: the name initial is shown when
// no avatar is set, and a failed image load degrades to that initial rather
// than a broken/blank surface.

import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { UserAvatar, nameInitial, resolveAvatarSrc } from "@/components/user/user-avatar";

describe("nameInitial", () => {
  it("uses the first letter of the name", () => {
    expect(nameInitial("مریم محمدی")).toBe("م");
  });
  it("falls back to «ک» for an empty or missing name", () => {
    expect(nameInitial("")).toBe("ک");
    expect(nameInitial("   ")).toBe("ک");
    expect(nameInitial(null)).toBe("ک");
    expect(nameInitial(undefined)).toBe("ک");
  });
});

describe("resolveAvatarSrc", () => {
  it("returns null when there is no avatar", () => {
    expect(resolveAvatarSrc(null)).toBeNull();
    expect(resolveAvatarSrc(undefined)).toBeNull();
    expect(resolveAvatarSrc("")).toBeNull();
  });
  it("expands a preset token to a vector data-URI", () => {
    expect(resolveAvatarSrc("preset:indigo")).toMatch(/^data:image\/svg\+xml/);
  });
  it("passes through an uploaded URL unchanged", () => {
    expect(resolveAvatarSrc("/api/v1/me/avatar?v=abc")).toBe("/api/v1/me/avatar?v=abc");
  });
});

describe("UserAvatar", () => {
  it("renders the name initial when no avatar is set", () => {
    const { container } = render(<UserAvatar avatarUrl={null} name="مریم" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("م");
  });

  it("renders an <img> for a chosen preset", () => {
    const { container } = render(<UserAvatar avatarUrl="preset:sprout" name="مریم" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("degrades to the initial when the image fails to load", () => {
    const { container } = render(
      <UserAvatar avatarUrl="/api/v1/me/avatar?v=stale" name="مریم" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    // Simulate a broken/stale upload URL.
    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("م");
  });
});
