import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InstallBanner } from "@/components/pwa/install-banner";
import type { UseInstallPromptResult } from "@/hooks/use-install-prompt";

const promptInstall = vi.fn().mockResolvedValue("accepted");
const dismiss = vi.fn();

const baseResult: UseInstallPromptResult = {
  visible: true,
  platform: "android",
  browser: "chrome",
  canPrompt: true,
  iosGuideVariant: "safari",
  androidGuideVariant: "chrome",
  promptInstall,
  dismiss,
};

let mockResult: UseInstallPromptResult = baseResult;

vi.mock("@/hooks/use-install-prompt", () => ({
  useInstallPrompt: () => mockResult,
}));

describe("InstallBanner", () => {
  beforeEach(() => {
    promptInstall.mockClear();
    dismiss.mockClear();
    mockResult = baseResult;
  });

  it("renders the required Persian copy and actions", () => {
    render(<InstallBanner />);
    expect(
      screen.getByText("لیگالیر را به صفحه اصلی گوشی اضافه کنید")
    ).toBeInTheDocument();
    expect(screen.getByText("دسترسی سریع‌تر به خدمات حقوقی")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /نصب لیگالیر/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "بعداً" })).toBeInTheDocument();
  });

  it("renders nothing when not visible", () => {
    mockResult = { ...baseResult, visible: false };
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fires the native prompt when one is available", () => {
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /نصب لیگالیر/ }));
    expect(promptInstall).toHaveBeenCalledTimes(1);
    // No guide sheet when a native prompt exists.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the Android guide when no native prompt is available", () => {
    mockResult = { ...baseResult, canPrompt: false };
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /نصب لیگالیر/ }));
    expect(promptInstall).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Install app");
  });

  it("shows the iOS Safari guide on iOS", () => {
    mockResult = { ...baseResult, platform: "ios", canPrompt: false };
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /نصب لیگالیر/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Add to Home Screen");
  });

  it("snoozes when «بعداً» is tapped", () => {
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: "بعداً" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("snoozes when the close button is tapped", () => {
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: "بستن" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
