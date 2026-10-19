// ============================================================
// LEGALIR — ActionButton contract tests (§1 save/confirm feedback)
// ============================================================
// One write button, four honest states. These tests pin the rules the
// product asked for:
//
//   • a successful write says «ذخیره شد» / «تأیید شد»;
//   • a rejected write says «… نشد» and the SAME button retries;
//   • while the call is in flight the label says so and a second click
//     cannot fire a second write;
//   • a cancelled interaction (closed file picker) claims neither;
//   • the outcome is announced to assistive tech, not only drawn.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ActionButton } from "../primitives";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("ActionButton — save/confirm feedback", () => {
  it("switches to the success label only after the write resolves", async () => {
    const gate = deferred<boolean>();
    const onAction = vi.fn(() => gate.promise);
    render(<ActionButton idleLabel="ذخیره" onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    // In flight: progress is named, and the success word is not there yet.
    expect(screen.getByRole("button", { name: "در حال ذخیره…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "ذخیره شد" })).toBeNull();

    await act(async () => {
      gate.resolve(true);
      await gate.promise;
    });
    expect(await screen.findByRole("button", { name: "ذخیره شد" })).toBeInTheDocument();
  });

  it("uses the caller's confirm wording for an approval", async () => {
    render(
      <ActionButton idleLabel="تأیید یادداشت" successLabel="تأیید شد" onAction={async () => true} />
    );

    fireEvent.click(screen.getByRole("button", { name: "تأیید یادداشت" }));
    expect(await screen.findByRole("button", { name: "تأیید شد" })).toBeInTheDocument();
  });

  it("does not show success for a write the server rejected, and keeps retry possible", async () => {
    const onAction = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ActionButton idleLabel="ذخیره" onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    const retry = await screen.findByRole("button", { name: "ذخیره نشد — تلاش مجدد" });
    expect(screen.queryByRole("button", { name: "ذخیره شد" })).toBeNull();

    fireEvent.click(retry);
    expect(await screen.findByRole("button", { name: "ذخیره شد" })).toBeInTheDocument();
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("treats a thrown call as a failure, never as a save", async () => {
    render(
      <ActionButton
        idleLabel="بارگذاری"
        errorLabel="بارگذاری نشد"
        onAction={async () => {
          throw new Error("network");
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "بارگذاری" }));
    expect(await screen.findByRole("button", { name: "بارگذاری نشد" })).toBeInTheDocument();
  });

  it("returns to idle without claiming an outcome when the user cancelled", async () => {
    render(<ActionButton idleLabel="بارگذاری" onAction={async () => "cancelled"} />);

    fireEvent.click(screen.getByRole("button", { name: "بارگذاری" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "بارگذاری" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "ذخیره شد" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ذخیره نشد — تلاش مجدد" })).toBeNull();
  });

  it("blocks a second click while the write is in flight", async () => {
    const gate = deferred<boolean>();
    const onAction = vi.fn(() => gate.promise);
    render(<ActionButton idleLabel="ذخیره" onAction={onAction} />);

    const button = screen.getByRole("button", { name: "ذخیره" });
    fireEvent.click(button);
    // The same node is now disabled; a second click must not reach the write.
    fireEvent.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve(true);
      await gate.promise;
    });
    await screen.findByRole("button", { name: "ذخیره شد" });
  });

  it("announces the outcome in a polite live region", async () => {
    const { container } = render(<ActionButton idleLabel="ذخیره" onAction={async () => true} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    const live = container.querySelector('[role="status"]');
    expect(live).not.toBeNull();
    expect(live).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(live).toHaveTextContent("ذخیره شد"));
  });
});
