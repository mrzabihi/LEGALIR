"use client";

import { IconCategory } from "@/lib/icons";
import { SelectableCard } from "@legalir/ui";

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
      {CATEGORIES.map((cat) => (
        <SelectableCard
          key={cat.code}
          selected={selected === cat.code}
          onClick={() => onSelect(cat.code)}
          icon={<IconCategory size={20} />}
          title={cat.nameFa}
          description={cat.description}
        />
      ))}
    </div>
  );
}

export function getCategoryName(code: string | null | undefined): string {
  if (!code) return "";
  return CATEGORIES.find((c) => c.code === code)?.nameFa ?? code;
}
