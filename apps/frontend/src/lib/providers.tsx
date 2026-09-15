"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/lib/theme";
import { ErrorBoundary } from "@/lib/error-boundary";
import { LocaleProvider } from "@legalir/i18n";
import { SnackbarProvider } from "@legalir/ui";
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

  // Initialize MSW only in browser AND only in development
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined"
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
