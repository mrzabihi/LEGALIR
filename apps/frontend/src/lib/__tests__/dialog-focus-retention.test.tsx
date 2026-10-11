// ============================================================
// LEGALIR — Dialog / Drawer focus retention while typing
// ============================================================
// Regression guard for the admin-panel defect where typing in a form field
// moved focus to another field / card (reported on /admin/plans). Root cause:
// the shared Dialog/Drawer keydown listener depended on `onClose`, whose
// identity changes on every parent render (inline arrow), so the focus effect
// re-ran on each keystroke — its cleanup restored focus to the element focused
// before the overlay opened, stealing focus mid-type.
//
// The harness mirrors an admin form exactly: a controlled field whose state
// lives in the SAME component that re-renders on each keystroke and passes a
// fresh `onClose` every render. With the fix, neither re-render touches focus.
// ============================================================

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { Dialog, Drawer } from "@legalir/ui";

/** Per-keystroke typing: one change event per incremental value. */
function typeInto(input: HTMLElement, text: string) {
  let value = "";
  for (const ch of text) {
    value += ch;
    fireEvent.change(input, { target: { value } });
  }
  return value;
}

/** Let a pending requestAnimationFrame (the overlay's on-open autofocus) run. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 32));
  });
}

/**
 * A re-rendering form with a fresh `onClose` identity each render. A BUTTON
 * precedes the field on purpose: the overlay's own autofocus targets the FIRST
 * focusable, so if a keystroke re-ran the focus effect it would pull focus off
 * the input and onto this button — exactly the reported defect, and observable
 * because the destination differs from the field being typed in.
 */
function DialogHarness() {
  const [name, setName] = useState("");
  return (
    <Dialog open onClose={() => undefined} title="ایجاد پلن" description="…">
      <button type="button">دکمهٔ اول</button>
      <input aria-label="نام نمایشی" value={name} onChange={(e) => setName(e.target.value)} />
    </Dialog>
  );
}

/**
 * The Drawer has no on-open autofocus, so its defect only manifests when a
 * real element held focus before the drawer opened (its restore target). That
 * mirrors the admin case: a row's «ویرایش» button opens the drawer.
 */
function DrawerHarness() {
  const [openState, setOpenState] = useState(false);
  const [note, setNote] = useState("");
  return (
    <>
      <button type="button" data-testid="trigger" onClick={() => setOpenState(true)}>
        باز کردن
      </button>
      <Drawer open={openState} onClose={() => undefined} title="یادداشت">
        <input aria-label="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} />
      </Drawer>
    </>
  );
}

describe("Dialog — focus is not stolen while typing", () => {
  it("keeps focus and the whole multi-word value in the field across keystrokes", async () => {
    render(<DialogHarness />);
    await settle(); // the on-open autofocus settles on the first button

    const input = screen.getByRole("textbox") as HTMLInputElement;
    act(() => input.focus());
    expect(document.activeElement).toBe(input);

    typeInto(input, "پلن طلایی سالانه");
    await settle(); // a buggy re-run would pull focus onto the first button here

    // Focus never left the field...
    expect(document.activeElement).toBe(input);
    // ...and every character stayed in it (nothing leaked to another field).
    expect(input.value).toBe("پلن طلایی سالانه");
  });

  it("does not restore focus away from a field when a sibling re-renders", async () => {
    render(<DialogHarness />);
    await settle();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    act(() => input.focus());

    // First keystroke forces the parent (and its inline onClose) to re-render.
    fireEvent.change(input, { target: { value: "ب" } });
    await settle();

    expect(document.activeElement).toBe(input);
  });
});

describe("Drawer — focus is not stolen while typing", () => {
  it("keeps focus and the whole multi-word value in the field across keystrokes", async () => {
    render(<DrawerHarness />);

    // Open the drawer from a focused trigger (like a row's «ویرایش» button).
    const trigger = screen.getByTestId("trigger");
    act(() => trigger.focus());
    fireEvent.click(trigger);
    await settle();

    const input = screen.getByRole("textbox") as HTMLInputElement;
    act(() => input.focus());
    expect(document.activeElement).toBe(input);

    typeInto(input, "یادداشت دوم");
    await settle(); // a buggy re-run would pull focus back onto the trigger here

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("یادداشت دوم");
  });
});
