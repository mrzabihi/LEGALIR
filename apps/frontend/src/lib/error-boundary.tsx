"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <div className="rounded-large bg-surface p-8 shadow-elevation-4 max-w-md">
            <div className="text-error text-4xl mb-4">!</div>
            <h1 className="text-h2 text-on-surface mb-2">
              خطای غیرمنتظره
            </h1>
            <p className="text-body-2 text-muted mb-6">
              مشکلی در اجرای برنامه رخ داده است. لطفاً دوباره تلاش کنید.
            </p>
            <button
              onClick={this.handleRetry}
              className="rounded-medium bg-primary text-white px-6 py-3 font-button hover:opacity-90 transition-opacity touch-target"
            >
              تلاش مجدد
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 text-left text-caption text-muted">
                <summary className="cursor-pointer">جزئیات خطا</summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-left dir-ltr">
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
