// ============================================================
// LEGALIR — Field hydration under browser-extension injection
// ============================================================
// Password managers, autofill, grammar and page-zoom extensions inject
// their own inline `style` (typically a `background-image:
// url("chrome-extension://…")` icon) onto form controls AFTER the
// server HTML is sent but BEFORE React hydrates. The server payload
// can never contain that client-only attribute, so React reported a
// hydration attribute mismatch on every outlined field — even though
// no code of ours was wrong.
//
// The shared field primitives now carry `suppressHydrationWarning`
// (see `packages/ui/src/components/field-shell.tsx → extensionSafe`).
// These tests reproduce the injection faithfully and pin the fix:
//   • the negative control proves the injection DOES reproduce the
//     mismatch on an unprotected element, and
//   • the guarded fields stay silent.
// ============================================================

import { describe, it, expect, afterEach, vi, beforeAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { act } from "react";
import { TextField, PasswordField, Textarea, Select } from "@legalir/ui";

beforeAll(() => {
  // React only treats `act()` as the test renderer when this flag is set;
  // without it hydration runs outside act and warns spuriously.
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** A client-only inline style, exactly the shape an extension injects. */
const EXTENSION_STYLE =
  'url("chrome-extension://abcdefghijklmnop/icon.png")';

const HYDRATION_WARNING = /hydrat|did ?not match|didn'?t match/i;

interface HydrateResult {
  warnings: string[];
}

const mounted: Root[] = [];

/**
 * Render `node` to server HTML, mount it, simulate an extension injecting
 * an inline style on every form control, then hydrate. Returns the
 * hydration warnings React emitted.
 */
async function hydrateWithInjection(node: React.ReactElement): Promise<HydrateResult> {
  const warnings: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (HYDRATION_WARNING.test(text)) warnings.push(text);
  });

  try {
    const container = document.createElement("div");
    container.innerHTML = renderToString(node);
    document.body.appendChild(container);

    // Simulate the extension: a client-only attribute React never saw on
    // the server. Applied before hydration, so React diffs against it.
    container.querySelectorAll("input, textarea, select").forEach((el) => {
      (el as HTMLElement).style.backgroundImage = EXTENSION_STYLE;
    });

    await act(async () => {
      const root = hydrateRoot(container, node, {
        onRecoverableError: (err) => {
          const text = String(err);
          if (HYDRATION_WARNING.test(text)) warnings.push(text);
        },
      });
      mounted.push(root);
    });

    spy.mockRestore();
    container.remove();
    return { warnings };
  } finally {
    spy.mockRestore();
  }
}

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((root) => root.unmount());
  });
});

describe("field hydration — extension-injected inline styles", () => {
  it("negative control: a bare input DOES warn about the injected style", async () => {
    const { warnings } = await hydrateWithInjection(
      React.createElement("input", { type: "text", defaultValue: "" })
    );
    // Guards the test itself — if this stops firing, the reproduction is
    // stale and the positive assertions below would pass vacuously.
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("TextField does not warn", async () => {
    const { warnings } = await hydrateWithInjection(
      React.createElement(TextField, { label: "شماره موبایل", name: "mobile" })
    );
    expect(warnings).toEqual([]);
  });

  it("PasswordField does not warn", async () => {
    const { warnings } = await hydrateWithInjection(
      React.createElement(PasswordField, { label: "رمز عبور", name: "password" })
    );
    expect(warnings).toEqual([]);
  });

  it("Textarea does not warn", async () => {
    const { warnings } = await hydrateWithInjection(
      React.createElement(Textarea, { label: "توضیحات", name: "notes" })
    );
    expect(warnings).toEqual([]);
  });

  it("Select does not warn", async () => {
    const { warnings } = await hydrateWithInjection(
      React.createElement(Select, {
        label: "نوع",
        name: "kind",
        options: [{ value: "a", label: "الف" }],
      })
    );
    expect(warnings).toEqual([]);
  });
});
