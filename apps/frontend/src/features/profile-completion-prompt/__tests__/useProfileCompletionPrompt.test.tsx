// ============================================================
// LEGALIR — Profile Completion Prompt Controller Unit Tests
// ============================================================
// Verifies the eligibility state machine and the critical
// distinction between انصراف (close only) and suppress (persist).
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn() }),
}));

// Mock the data hooks so we can drive eligibility deterministically.
const meState = vi.hoisted(() => ({
  isLoading: false,
  data: { profile: { completionPercent: 30 } },
}));
const prefsState = vi.hoisted(() => ({
  isLoading: false,
  data: { showProfileCompletionPrompt: true },
}));
const updatePrefs = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("@/hooks/useDashboard", () => ({
  useMe: () => meState,
}));
vi.mock("@/hooks/usePhase11", () => ({
  usePreferences: () => prefsState,
  useUpdatePreferences: () => updatePrefs,
}));

import { useProfileCompletionPrompt } from "../useProfileCompletionPrompt";

function resetState() {
  meState.isLoading = false;
  meState.data = { profile: { completionPercent: 30 } };
  prefsState.isLoading = false;
  prefsState.data = { showProfileCompletionPrompt: true };
  updatePrefs.mutate.mockReset();
  push.mockReset();
}

describe("useProfileCompletionPrompt — eligibility", () => {
  beforeEach(() => {
    resetState();
  });

  it("opens the prompt when profile is incomplete and prompt is enabled", async () => {
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.open).toBe(true));
    expect(result.current.loading).toBe(false);
  });

  it("never opens when profile is complete (highest-priority rule)", async () => {
    meState.data = { profile: { completionPercent: 100 } };
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.open).toBe(false);
  });

  it("never opens when the prompt is explicitly suppressed", async () => {
    prefsState.data = { showProfileCompletionPrompt: false };
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.open).toBe(false);
  });

  it("stays closed while user data is loading", async () => {
    meState.isLoading = true;
    const { result } = renderHook(() => useProfileCompletionPrompt());
    expect(result.current.loading).toBe(true);
    expect(result.current.open).toBe(false);
  });

  it("stays closed while preferences are loading", async () => {
    prefsState.isLoading = true;
    const { result } = renderHook(() => useProfileCompletionPrompt());
    expect(result.current.loading).toBe(true);
    expect(result.current.open).toBe(false);
  });
});

describe("useProfileCompletionPrompt — انصراف vs suppress", () => {
  beforeEach(() => {
    resetState();
  });

  it("انصراف closes the modal WITHOUT persisting any preference", async () => {
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.open).toBe(true));

    act(() => result.current.cancel());

    expect(result.current.open).toBe(false);
    // Critical: cancel must NOT call the preference mutation.
    expect(updatePrefs.mutate).not.toHaveBeenCalled();
  });

  it("suppress persists the preference then closes", async () => {
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.open).toBe(true));

    act(() => result.current.suppress());

    expect(updatePrefs.mutate).toHaveBeenCalledWith(
      { showProfileCompletionPrompt: false },
      expect.any(Object)
    );
    expect(result.current.saving).toBe(true);
  });

  it("suppress closes the modal on success", async () => {
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.open).toBe(true));

    act(() => result.current.suppress());
    // Simulate mutation success
    const onSuccess = updatePrefs.mutate.mock.calls[0]![1]!.onSuccess;
    act(() => onSuccess());

    expect(result.current.open).toBe(false);
    expect(result.current.saving).toBe(false);
  });

  it("suppress surfaces an error and stays open on failure", async () => {
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.open).toBe(true));

    act(() => result.current.suppress());
    const onError = updatePrefs.mutate.mock.calls[0]![1]!.onError;
    act(() => onError());

    expect(result.current.error).toBe(true);
    expect(result.current.open).toBe(false); // modal closed, error surfaced
  });

  it("retry reopens the modal after an error", async () => {
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.open).toBe(true));

    act(() => result.current.suppress());
    const onError = updatePrefs.mutate.mock.calls[0]![1]!.onError;
    act(() => onError());
    expect(result.current.error).toBe(true);

    act(() => result.current.retry());
    expect(result.current.error).toBe(false);
    expect(result.current.open).toBe(true);
  });

  it("goToProfile navigates to /profile", async () => {
    const { result } = renderHook(() => useProfileCompletionPrompt());
    await waitFor(() => expect(result.current.open).toBe(true));

    act(() => result.current.goToProfile());
    expect(push).toHaveBeenCalledWith("/profile");
  });
});
