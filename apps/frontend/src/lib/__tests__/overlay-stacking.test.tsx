// ============================================================
// LEGALIR — stacked overlays: Escape, scroll lock, labels
// ============================================================
// A Dialog is routinely opened FROM a Drawer (a confirm above a record panel),
// so two `role="dialog" aria-modal="true"` layers coexist — each with its own
// document-level keydown listener. Three defects followed from that:
//
//   1. ONE Escape closed BOTH layers: the drawer's listener and the dialog's
//      both fired for the same event, so dismissing the confirm also tore down
//      the panel the user was working in — and the unsaved form inside it.
//   2. The inner overlay's cleanup released `body.overflow` on close, so the
//      page behind the still-open drawer became scrollable again.
//   3. Every Dialog hard-coded `id="dialog-title"`, so two stacked dialogs
//      produced duplicate ids and the lower dialog's aria-labelledby resolved
//      to the upper dialog's heading.
//
// `packages/ui/src/lib/overlay-layer.ts` is the single answer to (1) and (2):
// only the newest open layer may consume Escape or move focus, and the body
// scroll lock is reference counted. (3) is fixed with `useId` per instance.
//
// Focus retention while typing, and the per-layer Tab boundaries, are covered
// in `dialog-focus-retention.test.tsx`; this file covers the stacking rules.
// ============================================================

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { Dialog, Drawer } from "@legalir/ui";

/** Let a pending requestAnimationFrame (the dialog's on-open autofocus) run. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 32));
  });
}

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
  it("closes the top layer and leaves the drawer underneath untouched", async () => {
    const onDrawerClose = vi.fn();
    const onDialogClose = vi.fn();
    render(<StackedDrawerDialog onDrawerClose={onDrawerClose} onDialogClose={onDialogClose} />);
    await settle();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onDialogClose).toHaveBeenCalledTimes(1);
    // The panel below keeps its state (and the form the user was filling in).
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

    // The drawer must not "helpfully" dismiss itself from under a modal that is
    // explicitly refusing to close.
    expect(onDialogClose).not.toHaveBeenCalled();
    expect(onDrawerClose).not.toHaveBeenCalled();
  });

  it("still closes a lone dialog on Escape", async () => {
    function LoneDialog() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onClose={() => setOpen(false)} title="تأیید">
          <button type="button">باشه</button>
        </Dialog>
      );
    }
    render(<LoneDialog />);
    await settle();

    fireEvent.keyDown(document, { key: "Escape" });
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
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

    // Close only the top layer; the drawer is still open behind it, so the page
    // beneath the scrim must stay frozen.
    rerender(<StackedDrawerDialog dialogOpen={false} />);
    expect(document.body.style.overflow).toBe("hidden");

    // Last layer out restores the page.
    rerender(<StackedDrawerDialog drawerOpen={false} dialogOpen={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("restores the overflow it found, not a hard-coded empty string", async () => {
    // A page may already be locked by its own logic (the app shell locks for
    // the mobile nav drawer). Taking and releasing an overlay lock must put
    // that value back rather than unlock the page behind the shell.
    document.body.style.overflow = "hidden";
    const { unmount } = render(
      <Dialog open onClose={() => undefined} title="تأیید">
        <button type="button">باشه</button>
      </Dialog>,
    );
    await settle();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("hidden");

    document.body.style.overflow = "";
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

  it("pulls focus into the top dialog when it sits in the drawer below", async () => {
    render(<StackedDrawerDialog />);
    await settle();

    const below = screen.getByRole("button", { name: "ذخیره" });
    act(() => below.focus());
    expect(document.activeElement).toBe(below);

    fireEvent.keyDown(document, { key: "Tab" });

    const topDialog = screen.getAllByRole("dialog").at(-1)!;
    expect(topDialog.contains(document.activeElement)).toBe(true);
  });
});

describe("Stacked dialogs — each surface is labelled by its own heading", () => {
  it("gives every dialog a distinct, self-contained label target", async () => {
    render(
      <>
        <Dialog open onClose={() => undefined} title="پلن پایه" description="توضیح پایه">
          <button type="button">الف</button>
        </Dialog>
        <Dialog open onClose={() => undefined} title="پلن طلایی" description="توضیح طلایی">
          <button type="button">ب</button>
        </Dialog>
      </>,
    );
    await settle();

    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(2);

    const labelIds = dialogs.map((d) => d.getAttribute("aria-labelledby"));
    const descriptionIds = dialogs.map((d) => d.getAttribute("aria-describedby"));

    // No shared ids between the two surfaces.
    expect(new Set(labelIds).size).toBe(2);
    expect(new Set(descriptionIds).size).toBe(2);

    dialogs.forEach((dialog) => {
      const label = document.getElementById(dialog.getAttribute("aria-labelledby")!);
      const description = document.getElementById(dialog.getAttribute("aria-describedby")!);

      expect(label).not.toBeNull();
      expect(description).not.toBeNull();
      // Each reference must resolve INSIDE this dialog, never to its sibling.
      expect(dialog.contains(label)).toBe(true);
      expect(dialog.contains(description)).toBe(true);
    });

    // And the text really is each dialog's own copy.
    expect(screen.getByRole("heading", { name: "پلن پایه" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "پلن طلایی" })).toBeInTheDocument();
  });

  it("omits both references when there is no title or description", async () => {
    render(
      <Dialog open onClose={() => undefined}>
        <button type="button">بدون عنوان</button>
      </Dialog>,
    );
    await settle();

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBeNull();
    expect(dialog.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("Drawer — the dismiss control is a real IconButton", () => {
  it("exposes an accessible name and the 48px MD3 target", async () => {
    render(
      <Drawer open onClose={() => undefined} title="یادداشت">
        <button type="button">ذخیره</button>
      </Drawer>,
    );
    await settle();

    const close = screen.getByRole("button", { name: "بستن منو" });
    // The shared IconButton's medium size — not the old 40px hand-rolled glyph.
    expect(close.className).toContain("h-12");
    expect(close.className).toContain("w-12");
    // And it is the first Tab stop inside the panel.
    expect(close.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

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
