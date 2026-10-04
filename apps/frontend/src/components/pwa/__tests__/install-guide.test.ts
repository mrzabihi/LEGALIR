import { describe, it, expect } from "vitest";
import { getIosGuide, getAndroidGuide } from "@/components/pwa/install-guide";

describe("getIosGuide", () => {
  it("tells Safari users to use Share → Add to Home Screen", () => {
    const guide = getIosGuide("safari");
    const text = guide.steps.map((s) => s.text).join(" ");
    expect(text).toContain("Safari");
    expect(text).toContain("Share");
    expect(text).toContain("Add to Home Screen");
    expect(guide.note).toBeUndefined();
  });

  it("tells non-Safari iOS users to open Safari first", () => {
    const guide = getIosGuide("other-browser");
    const text = guide.steps.map((s) => s.text).join(" ");
    expect(text).toContain("Safari");
    expect(guide.note).toContain("Safari");
  });
});

describe("getAndroidGuide", () => {
  it("uses the ⋮ menu wording for Chrome", () => {
    const text = getAndroidGuide("chrome").steps.map((s) => s.text).join(" ");
    expect(text).toContain("Install app");
  });

  it("uses the ⋮ menu wording for Firefox", () => {
    const text = getAndroidGuide("firefox").steps.map((s) => s.text).join(" ");
    expect(text).toContain("Add to Home screen");
  });

  it("uses the ☰ menu wording for Samsung Internet", () => {
    const text = getAndroidGuide("samsung").steps.map((s) => s.text).join(" ");
    expect(text).toContain("Home screen");
  });

  it("always provides at least one step", () => {
    for (const variant of ["chrome", "firefox", "samsung", "other"] as const) {
      expect(getAndroidGuide(variant).steps.length).toBeGreaterThan(0);
    }
  });
});
