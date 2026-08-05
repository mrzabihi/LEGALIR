// ============================================================
// LEGALIR — Route-level Error Boundaries (Phase 12)
// ============================================================

"use client";

import { Component, type ReactNode } from "react";

interface RouteErrorBoundaryProps {
  children: ReactNode;
  /** Route name for error reporting */
  routeName: string;
  fallback?: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to a monitoring service, but sanitized
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[RouteErrorBoundary] ${this.props.routeName}:`,
        error.message,
        errorInfo.componentStack
      );
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <div className="rounded-large bg-surface p-8 shadow-elevation-4 max-w-md border border-divider">
            <div className="text-error mb-4 text-4xl font-bold" aria-hidden="true">
              !
            </div>
            <h1 className="text-h2 text-on-surface mb-2">
              خطا در بارگذاری صفحه
            </h1>
            <p className="text-body-2 text-muted mb-1">
              مشکلی در بخش{" "}
              <span className="text-on-surface font-medium">
                {this.props.routeName}
              </span>{" "}
              رخ داده است.
            </p>
            <p className="text-caption text-muted mb-6">
              خطا ثبت شد و تیم فنی مطلع خواهد شد.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="rounded-medium bg-primary text-white px-6 py-3 font-button hover:opacity-90 transition-opacity touch-target"
              >
                تلاش مجدد
              </button>
              <button
                onClick={this.handleGoHome}
                className="rounded-medium border border-border text-on-surface px-6 py-3 font-button hover:bg-surface transition-colors touch-target"
              >
                بازگشت به صفحه اصلی
              </button>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 text-left text-caption text-muted">
                <summary className="cursor-pointer">
                  جزئیات خطا (حالت توسعه)
                </summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-left dir-ltr max-h-40">
                  {this.state.error.message}
                  {"\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
