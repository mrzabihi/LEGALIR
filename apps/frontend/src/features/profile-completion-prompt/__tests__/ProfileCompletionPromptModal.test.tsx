// ============================================================
// LEGALIR — Profile Completion Prompt Modal Component Tests
// ============================================================
// Verifies the modal renders the incentive copy and wires the
// three distinct actions (انصراف / تکمیل پروفایل / suppress).
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ProfileCompletionPromptModal } from "../ProfileCompletionPromptModal";
import type { ProfileCompletionPromptController } from "../useProfileCompletionPrompt";

function makeController(overrides: Partial<ProfileCompletionPromptController> = {}): ProfileCompletionPromptController {
  return {
    phase: "OPEN",
    open: true,
    loading: false,
    saving: false,
    error: false,
    cancel: vi.fn(),
    goToProfile: vi.fn(),
    suppress: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

describe("ProfileCompletionPromptModal", () => {
  it("renders the incentive title and description", () => {
    render(<ProfileCompletionPromptModal controller={makeController()} />);
    expect(screen.getByText("پروفایلت رو کامل کن")).toBeInTheDocument();
    expect(screen.getByText(/با تکمیل پروفایل، امتیاز بیشتری می‌گیری/)).toBeInTheDocument();
  });

  it("shows the real 1000-point reward", () => {
    render(<ProfileCompletionPromptModal controller={makeController()} />);
    expect(screen.getByText(/۱٬۰۰۰ امتیاز/)).toBeInTheDocument();
  });

  it("renders the three distinct actions", () => {
    render(<ProfileCompletionPromptModal controller={makeController()} />);
    expect(screen.getByRole("button", { name: "انصراف" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تکمیل پروفایل" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "دیگر این پیام را به من نشان نده" })).toBeInTheDocument();
  });

  it("انصراف calls cancel (close only)", () => {
    const controller = makeController();
    render(<ProfileCompletionPromptModal controller={controller} />);
    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    expect(controller.cancel).toHaveBeenCalledTimes(1);
  });

  it("تکمیل پروفایل calls goToProfile", () => {
    const controller = makeController();
    render(<ProfileCompletionPromptModal controller={controller} />);
    fireEvent.click(screen.getByRole("button", { name: "تکمیل پروفایل" }));
    expect(controller.goToProfile).toHaveBeenCalledTimes(1);
  });

  it("suppress action calls suppress (persist)", () => {
    const controller = makeController();
    render(<ProfileCompletionPromptModal controller={controller} />);
    fireEvent.click(screen.getByRole("button", { name: "دیگر این پیام را به من نشان نده" }));
    expect(controller.suppress).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    render(<ProfileCompletionPromptModal controller={makeController({ open: false })} />);
    expect(screen.queryByText("پروفایلت رو کامل کن")).not.toBeInTheDocument();
  });

  it("shows error state with retry when error is set", () => {
    const controller = makeController({ error: true });
    render(<ProfileCompletionPromptModal controller={controller} />);
    expect(screen.getByText(/ذخیره‌ی تنظیمات انجام نشد/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(controller.retry).toHaveBeenCalledTimes(1);
  });
});
