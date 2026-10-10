// ============================================================
// LEGALIR — LawyerAvatar behaviour tests
// ============================================================
// The single renderer every lawyer surface draws a portrait from. These lock
// in the fallback contract AND the recovery contract that the admin
// avatar-save bug violated: a component instance that once failed must retry
// when `avatarUrl` CHANGES, instead of staying on the initials chip forever
// (which is why a freshly saved portrait "did not appear").

import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { LawyerAvatar } from "@/components/lawyers/lawyer-avatar";

describe("LawyerAvatar", () => {
  it("renders the initials chip when no avatar is set", () => {
    const { container } = render(<LawyerAvatar name="علی ذبیحی" avatarUrl={null} avatarType="real" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("ع ذ");
  });

  it("renders an <img> for a stored portrait", () => {
    const { container } = render(
      <LawyerAvatar name="علی ذبیحی" avatarUrl="/api/v1/lawyers/l1/avatar?v=abc" avatarType="real" />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/api/v1/lawyers/l1/avatar?v=abc");
  });

  it("degrades to the initials chip when the image fails to load", () => {
    const { container } = render(
      <LawyerAvatar name="علی ذبیحی" avatarUrl="/api/v1/lawyers/l1/avatar?v=stale" avatarType="real" />
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("ع ذ");
  });

  it("retries the image when avatarUrl CHANGES after a prior failure", () => {
    const { container, rerender } = render(
      <LawyerAvatar name="علی ذبیحی" avatarUrl="/api/v1/lawyers/l1/avatar?v=old" avatarType="real" />
    );
    // The old portrait 404s → the instance falls back to initials.
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();

    // The operator saves a NEW portrait → the URL changes → the instance MUST
    // try to render it rather than latch on the fallback.
    rerender(
      <LawyerAvatar name="علی ذبیحی" avatarUrl="/api/v1/lawyers/l1/avatar?v=new" avatarType="real" />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/api/v1/lawyers/l1/avatar?v=new");
  });
});
