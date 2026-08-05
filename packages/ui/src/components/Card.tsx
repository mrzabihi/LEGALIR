"use client";

import React from "react";

type CardVariant = "elevated" | "filled" | "outlined";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "small" | "medium" | "large";
  interactive?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  elevated: "bg-surface shadow-elevation-1",
  filled: "bg-surfaceVariant",
  outlined: "bg-surface border border-outline",
};

const paddingClasses = {
  none: "p-0",
  small: "p-3",
  medium: "p-4",
  large: "p-6",
};

export function Card({
  variant = "elevated",
  padding = "medium",
  interactive = false,
  fullWidth = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-large",
        variantClasses[variant],
        paddingClasses[padding],
        interactive
          ? "cursor-pointer hover:shadow-elevation-4 active:shadow-elevation-1 transition-shadow duration-short3 hover:state-hover"
          : "",
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

// Compound sub-components for consistent layout
export function CardHeader({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardContent({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-4 flex items-center gap-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}
