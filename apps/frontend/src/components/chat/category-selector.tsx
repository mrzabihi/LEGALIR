"use client";

import { IconCategory } from "@/lib/icons";

export interface CategoryOption {
  code: string;
  nameFa: string;
  description?: string;
}

const CATEGORIES: CategoryOption[] = [
  { code: "criminal", nameFa: "پرونده‌ها", description: "شکایت، دفاع، دعاوی کیفری" },
  { code: "contract", nameFa: "قراردادها", description: "تنظیم، بررسی، اختلافات قراردادی" },
  { code: "real_estate", nameFa: "املاک", description: "اجاره، خرید و فروش، ملک و مستغلات" },
  { code: "family", nameFa: "خانواده", description: "طلاق، مهریه، حضانت، نفقه" },
  { code: "commerce", nameFa: "تجارت", description: "چک، سفته، شرکت‌ها، ورشکستگی" },
  { code: "other", nameFa: "سایر", description: "سایر موضوعات حقوقی" },
];

interface CategorySelectorProps {
  selected: string | null;
  onSelect: (code: string) => void;
}

export function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat.code;
        return (
          <button
            key={cat.code}
            onClick={() => onSelect(cat.code)}
            className={[
              "flex items-start gap-3 p-4 rounded-large border-2 text-start transition-colors",
              "touch-target",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-divider bg-surface hover:border-onSurface/20",
            ].join(" ")}
            aria-pressed={isSelected}
          >
            <span
              className={[
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                isSelected ? "bg-primary text-white" : "bg-surfaceVariant text-onSurfaceVariant",
              ].join(" ")}
            >
              <IconCategory size={20} />
            </span>
            <div>
              <span
                className={[
                  "text-labelLarge block",
                  isSelected ? "text-primary font-medium" : "text-onSurface",
                ].join(" ")}
              >
                {cat.nameFa}
              </span>
              {cat.description && (
                <span className="text-bodySmall text-muted mt-0.5 block">
                  {cat.description}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function getCategoryName(code: string | null | undefined): string {
  if (!code) return "";
  return CATEGORIES.find((c) => c.code === code)?.nameFa ?? code;
}
