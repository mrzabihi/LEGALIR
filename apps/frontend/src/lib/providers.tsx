"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/lib/theme";
import { ErrorBoundary } from "@/lib/error-boundary";
import { LocaleProvider } from "@legalir/i18n";
import { SnackbarProvider } from "@legalir/ui";
import { env } from "@legalir/config";
import { installConsoleGuard } from "@/lib/console-guard";

// Install console guard early
if (typeof window !== "undefined") {
  installConsoleGuard();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Initialize MSW only when the app is actually pointed at the mock backend.
  // The handlers intercept `http://localhost:8000` (see mocks/handlers), so if
  // NEXT_PUBLIC_API_BASE_URL is unset the client talks same-origin to the real
  // Next route handlers and MSW would match nothing — loading its ~2.3k-line
  // handler bundle plus registering a service worker for zero benefit.
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      env.apiMode === "mock" &&
      env.apiBaseUrl.length > 0
    ) {
      import("@/mocks/browser").then(({ initMsw }) => initMsw());
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider locale="fa-IR">
          <ThemeProvider>
            <SnackbarProvider>
              {children}
            </SnackbarProvider>
          </ThemeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
