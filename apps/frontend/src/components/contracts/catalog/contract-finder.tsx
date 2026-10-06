// ============================================================
// LEGALIR — Contract Finder
// ============================================================
// "Describe your need in plain language and we suggest the right
// contract." The matching is deliberately deterministic (title + category +
// keywords, see `findContractServices`) — there is no AI call here and no
// fabricated result. The component is isolated behind a single function so
// it can later be pointed at a real matching service without touching the
// page or the card.
//
// Honesty: results are suggestions drawn from the same catalog; they are
// labelled as «پیشنهاد» and each opens a real service detail page.

"use client";

import { useState } from "react";
import { findContractServices, type ContractService } from "@/lib/contract-services";
import { IconSearch, IconSparkle, IconClose } from "@/lib/icons";
import { ContractServiceCard } from "./contract-service-card";

const EXAMPLE_PROMPT = "می‌خواهم با یک برنامه‌نویس برای ساخت اپلیکیشن قرارداد ببندم";

export function ContractFinder() {
  const [prompt, setPrompt] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const results: ContractService[] = submitted ? findContractServices(submitted, 3) : [];

  const run = () => {
    const value = prompt.trim();
    if (!value) return;
    setSubmitted(value);
  };

  const reset = () => {
    setPrompt("");
    setSubmitted(null);
  };

  return (
    <section
      aria-labelledby="contract-finder-title"
      className="rounded-xlarge border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5 tablet:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-gradient-to-br from-secondary-600 to-secondary-800 text-white shadow-elevation-1"
        >
          <IconSparkle size={20} />
        </span>
        <div className="min-w-0">
          <h2 id="contract-finder-title" className="text-h4 font-bold text-on-surface">
            نمی‌دانید کدام قرارداد مناسب شماست؟
          </h2>
          <p className="mt-1 text-body-2 text-on-surface-variant">
            نیاز خود را به زبان ساده بنویسید تا قرارداد مناسب را به شما پیشنهاد دهیم.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 tablet:flex-row">
        <label className="sr-only" htmlFor="contract-finder-input">
          توضیح نیاز شما
        </label>
        <div className="relative min-w-0 flex-1">
          <input
            id="contract-finder-input"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
            placeholder={EXAMPLE_PROMPT}
            className="h-12 w-full rounded-medium border border-[color:var(--color-outline)] bg-surface ps-4 pe-10 text-body-2 text-on-surface placeholder:text-on-surface-variant/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
          {prompt && (
            <button
              type="button"
              onClick={reset}
              aria-label="پاک کردن متن"
              className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-on-surface/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <IconClose size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={run}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-medium bg-primary px-5 text-button font-medium text-white transition-colors hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-target"
        >
          <IconSearch size={18} aria-hidden="true" />
          پیدا کردن قرارداد مناسب
        </button>
      </div>

      {submitted && (
        <div className="mt-5" aria-live="polite">
          {results.length > 0 ? (
            <>
              <p className="mb-3 text-caption text-on-surface-variant">
                بر اساس توضیح شما، این قراردادها پیشنهاد می‌شوند:
              </p>
              <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
                {results.map((service) => (
                  <li key={service.id} className="h-full">
                    <ContractServiceCard service={service} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="rounded-large border border-[color:var(--color-outline-variant)] bg-surface px-4 py-5 text-center text-body-2 text-on-surface-variant">
              برای این توضیح، قرارداد مشخصی پیدا نشد. می‌توانید از جستجو یا دسته‌بندی‌های پایین
              استفاده کنید.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
