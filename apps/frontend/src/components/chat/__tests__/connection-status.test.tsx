// ============================================================
// LEGALIR — ConnectionStatus unit tests (§6)
// ============================================================
// The indicator must tell three DIFFERENT truths apart, all from real
// signals — never from `navigator.onLine` alone:
//   • offline             — the device reports no network (no probe sent)
//   • service-unavailable — the network is up but the health call fails
//   • online              — a real healthy call just succeeded
// It must also react to a real successful turn via `signalApiReachable()`
// and recover through its retry button.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import {
  ConnectionStatus,
  signalApiReachable,
} from "@/components/chat/connection-status";

const HEALTH_URL = "http://localhost:8000/api/v1/ai/stream";

/** jsdom defaults `onLine` to true; override per test via the instance. */
function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

/** The status region carries the label (twice: visible span + sr-only). */
function status() {
  return screen.getByRole("status");
}

describe("ConnectionStatus (§6)", () => {
  afterEach(() => setOnline(true));

  it("reports «اینترنت متصل» only after a real healthy probe", async () => {
    setOnline(true);
    server.use(http.get(HEALTH_URL, () => HttpResponse.json({ healthy: true })));

    render(<ConnectionStatus />);

    await waitFor(() => expect(status()).toHaveTextContent("اینترنت متصل"));
    // Nothing to retry when the service is genuinely reachable.
    expect(screen.queryByText("تلاش دوباره")).toBeNull();
  });

  it("shows «در حال اتصال…» while the probe is in flight", async () => {
    setOnline(true);
    server.use(
      http.get(HEALTH_URL, async () => {
        await delay(150);
        return HttpResponse.json({ healthy: true });
      })
    );

    render(<ConnectionStatus />);

    // The initial state is honest: we do not yet know, so we say so.
    await waitFor(() => expect(status()).toHaveTextContent("در حال اتصال…"));
    await waitFor(() => expect(status()).toHaveTextContent("اینترنت متصل"));
  });

  it("distinguishes a reachable network from an unavailable chat service", async () => {
    setOnline(true);
    // Network is up, but the endpoint answers unhealthy.
    server.use(http.get(HEALTH_URL, () => HttpResponse.json({ healthy: false })));

    render(<ConnectionStatus />);

    await waitFor(() =>
      expect(status()).toHaveTextContent("سرویس چت در دسترس نیست")
    );
    // A real retry affordance is offered.
    expect(screen.getByText("تلاش دوباره")).toBeInTheDocument();
  });

  it("reports «اینترنت قطع است» and sends no probe when the device is offline", async () => {
    setOnline(false);
    let probes = 0;
    server.use(
      http.get(HEALTH_URL, () => {
        probes += 1;
        return HttpResponse.json({ healthy: true });
      })
    );

    render(<ConnectionStatus />);

    await waitFor(() => expect(status()).toHaveTextContent("اینترنت قطع است"));
    // No point probing the service when the device itself has no network.
    expect(probes).toBe(0);
    expect(screen.getByText("تلاش دوباره")).toBeInTheDocument();
  });

  it("recovers to online when the user retries after an outage", async () => {
    setOnline(true);
    let healthy = false;
    server.use(http.get(HEALTH_URL, () => HttpResponse.json({ healthy })));

    render(<ConnectionStatus />);
    await waitFor(() =>
      expect(status()).toHaveTextContent("سرویس چت در دسترس نیست")
    );

    // The service comes back; the retry button re-probes for real.
    healthy = true;
    act(() => screen.getByText("تلاش دوباره").click());

    await waitFor(() => expect(status()).toHaveTextContent("اینترنت متصل"));
  });

  it("marks the service online when a real turn signals reachability", async () => {
    setOnline(true);
    server.use(http.get(HEALTH_URL, () => HttpResponse.json({ healthy: false })));

    render(<ConnectionStatus />);
    await waitFor(() =>
      expect(status()).toHaveTextContent("سرویس چت در دسترس نیست")
    );

    // A completed stream turn proves reachability without any extra poll.
    act(() => signalApiReachable());

    await waitFor(() => expect(status()).toHaveTextContent("اینترنت متصل"));
  });
});
