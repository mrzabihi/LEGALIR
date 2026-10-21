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

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { Dialog, Drawer, Button, IconButton } from "@legalir/ui";

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

/**
 * The short read-only prompt shape: the surface takes focus on open
 * (`initialFocus="container"`) so no ring lands on the dismiss glyph.
 *
 * The surface is `tabIndex=-1`, i.e. outside the Tab cycle. Before the trap
 * treated it as a boundary, Shift+Tab from it walked straight out of the
 * dialog and into the page behind the scrim — observed live as
 * NEXTJS-PORTAL → a nav link. This guard covers both directions.
 */
function PromptHarness() {
  return (
    <Dialog
      open
      onClose={() => undefined}
      title="پروفایلت رو کامل کن"
      initialFocus="container"
      closeButton={
        <IconButton variant="standard" size="medium" label="بستن" onClick={() => undefined}>
          ×
        </IconButton>
      }
      actions={<Button variant="filled">تکمیل پروفایل</Button>}
    >
      <button type="button">ردیف</button>
    </Dialog>
  );
}

// The traps skip controls that are not laid out (`offsetParent === null`), and
// jsdom never lays anything out — so every control would be filtered out and
// both traps would no-op. Report a parent for any attached node.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return this.parentNode;
    },
  });
});

describe("Dialog — the focus trap keeps a container-focused dialog closed", () => {

  it("focuses the surface on open, not a control", async () => {
    render(<PromptHarness />);
    await settle();

    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
  });

  it("wraps Shift+Tab from the surface to the last control inside the dialog", async () => {
    render(<PromptHarness />);
    await settle();

    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "تکمیل پروفایل" }));
  });

  it("wraps Tab from the surface to the first control inside the dialog", async () => {
    render(<PromptHarness />);
    await settle();

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(document, { key: "Tab" });

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "بستن" }));
  });
});

/**
 * The drawer's own gap: no on-open autofocus, so focus stays on whatever
 * opened the panel (a row's «ویرایش», the sidebar toggle) — outside the
 * drawer. Tab used to walk the page behind the scrim from there.
 */
function DrawerTrapHarness() {
  return (
    <Drawer open onClose={() => undefined} title="یادداشت">
      <input aria-label="یادداشت" />
      <button type="button">ذخیره</button>
    </Drawer>
  );
}

describe("Drawer — the focus trap pulls focus in from outside the panel", () => {
  it("pulls focus in at the first control when Tab starts outside the drawer", async () => {
    const outside = document.createElement("button");
    outside.textContent = "بیرون";
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    render(<DrawerTrapHarness />);
    fireEvent.keyDown(document, { key: "Tab" });

    const drawer = screen.getByRole("dialog");
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "بستن منو" }));

    outside.remove();
  });

  it("pulls focus in at the last control when Shift+Tab starts outside the drawer", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    render(<DrawerTrapHarness />);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "ذخیره" }));

    outside.remove();
  });

  it("leaves focus alone when a Dialog stacked above the drawer holds it", async () => {
    render(
      <>
        <DrawerTrapHarness />
        <Dialog open onClose={() => undefined} title="تأیید">
          <button type="button">تأیید حذف</button>
        </Dialog>
      </>,
    );

    const stackedButton = screen.getByRole("button", { name: "تأیید حذف" });
    act(() => stackedButton.focus());

    fireEvent.keyDown(document, { key: "Tab" });

    // The drawer must not steal focus out of the modal sitting on top of it.
    expect(document.activeElement).toBe(stackedButton);
  });
});

// ============================================================
// Stacked overlays — only the TOP layer answers Escape / holds the lock
// ============================================================
// A confirm Dialog is routinely opened from inside a Drawer («حذف» a row),
// and a Dialog over a Dialog is just as common. Each overlay used to register
// its own document keydown listener and its own unconditional
// `body.style.overflow` reset, which produced three live defects:
//   • one Escape ran BOTH `onClose`s — cancelling a confirm also tore down the
//     drawer (and the half-filled form) underneath it;
//   • closing the top layer released the scroll lock while the layer below was
//     still open, so the page behind the scrim became scrollable;
//   • the lower layer's Tab trap pulled focus out of the top layer before the
//     top layer could handle the key (a focus flash, and in a real browser a
//     scroll of the layer underneath).

function StackedDrawerDialog({
  drawerOpen = true,
  dialogOpen = true,
  persistent = false,
  onDrawerClose = () => undefined,
  onDialogClose = () => undefined,
}: {
  drawerOpen?: boolean;
  dialogOpen?: boolean;
  persistent?: boolean;
  onDrawerClose?: () => void;
  onDialogClose?: () => void;
}) {
  return (
    <>
      <Drawer open={drawerOpen} onClose={onDrawerClose} title="ویرایش قرارداد">
        <button type="button">ذخیره</button>
      </Drawer>
      <Dialog
        open={dialogOpen}
        onClose={onDialogClose}
        title="تأیید حذف"
        persistent={persistent}
      >
        <button type="button">تأیید حذف</button>
      </Dialog>
    </>
  );
}

describe("Stacked overlays — Escape reaches only the top layer", () => {
  it("closes the top layer and leaves the drawer underneath open", async () => {
    const onDrawerClose = vi.fn();
    const onDialogClose = vi.fn();
    render(<StackedDrawerDialog onDrawerClose={onDrawerClose} onDialogClose={onDialogClose} />);
    await settle();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onDialogClose).toHaveBeenCalledTimes(1);
    expect(onDrawerClose).not.toHaveBeenCalled();
  });

  it("closes neither layer when the top layer is persistent", async () => {
    const onDrawerClose = vi.fn();
    const onDialogClose = vi.fn();
    render(
      <StackedDrawerDialog
        persistent
        onDrawerClose={onDrawerClose}
        onDialogClose={onDialogClose}
      />,
    );
    await settle();

    fireEvent.keyDown(document, { key: "Escape" });

    // The drawer must not "helpfully" dismiss itself from under a modal that
    // is explicitly refusing to close.
    expect(onDialogClose).not.toHaveBeenCalled();
    expect(onDrawerClose).not.toHaveBeenCalled();
  });
});

describe("Stacked overlays — the scroll lock is held by the stack", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("stays locked while a lower layer is still open", async () => {
    const { rerender } = render(<StackedDrawerDialog />);
    await settle();
    expect(document.body.style.overflow).toBe("hidden");

    // Close only the top layer; the drawer is still open behind it.
    rerender(<StackedDrawerDialog dialogOpen={false} />);
    expect(document.body.style.overflow).toBe("hidden");

    // Last layer out restores the page.
    rerender(<StackedDrawerDialog drawerOpen={false} dialogOpen={false} />);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("Stacked overlays — the lower layer never steals focus", () => {
  function StackedDialogs() {
    return (
      <>
        <Dialog open onClose={() => undefined} title="فرم قرارداد">
          <button type="button">فیلد فرم</button>
        </Dialog>
        <Dialog open onClose={() => undefined} title="تأیید">
          <button type="button">تأیید حذف</button>
          <button type="button">انصراف</button>
        </Dialog>
      </>
    );
  }

  it("lets the top layer pass Tab through instead of re-handling it", async () => {
    render(<StackedDialogs />);
    await settle();

    const topFirst = screen.getByRole("button", { name: "تأیید حذف" });
    const below = screen.getByRole("button", { name: "فیلد فرم" });
    // The innermost dialog owns focus after mount.
    expect(document.activeElement).toBe(topFirst);

    const focused: Element[] = [];
    const spy = (e: FocusEvent) => focused.push(e.target as Element);
    document.addEventListener("focusin", spy);
    // `fireEvent` reports whether the key's default (native Tab movement) was
    // left intact. Mid-cycle Tab inside the top dialog must not be cancelled.
    const notPrevented = fireEvent.keyDown(document, { key: "Tab" });
    document.removeEventListener("focusin", spy);

    expect(focused).not.toContain(below);
    expect(notPrevented).toBe(true);
    expect(document.activeElement).toBe(topFirst);
  });
});
