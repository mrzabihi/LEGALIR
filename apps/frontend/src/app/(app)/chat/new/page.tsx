"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CategorySelector } from "@/components/chat/category-selector";
import { ServiceContextCard } from "@/components/chat/service-context-card";
import { useCreateConversation } from "@/hooks/useConversations";
import { serviceTypeFromQuery, type ServiceType } from "@/lib/ai/service-context";
import { TextField } from "@legalir/ui";

export default function NewConversationPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("legal_consultation");

  // Derive service context from the entry URL (?service= / ?category=).
  useEffect(() => {
    if (typeof window !== "undefined") {
      setServiceType(serviceTypeFromQuery(window.location.search));
    }
  }, []);

  const createMutation = useCreateConversation();

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("عنوان گفتگو الزامی است");
      return;
    }
    if (trimmed.length > 200) {
      setTitleError("عنوان گفتگو حداکثر ۲۰۰ حرف است");
      return;
    }
    setTitleError("");

    try {
      const result = await createMutation.mutateAsync({
        title: trimmed,
        category: selectedCategory ?? undefined,
      });
      router.push(`/chat/${result.id}?service=${serviceType}`);
    } catch {
      setTitleError("خطا در ایجاد گفتگو");
    }
  }, [title, selectedCategory, createMutation, router, serviceType]);

  return (
    <div className="p-4 tablet:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-h2 text-on-surface mb-1">گفتگوی جدید</h1>
        <p className="text-bodyMedium text-muted">
          یک گفتگوی حقوقی جدید شروع کنید و موضوع آن را مشخص نمایید
        </p>
      </div>

      {/* Title Input */}
      <div className="mb-6">
        <TextField
          id="conversation-title"
          label="عنوان گفتگو"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError("");
          }}
          placeholder="مثلاً: مشاوره قرارداد اجاره"
          errorMessage={titleError || undefined}
          autoFocus
          maxLength={200}
          fullWidth
        />
      </div>

      {/* Category Selection */}
      <div className="mb-6">
        <p className="text-labelLarge text-onSurface mb-3">
          دسته‌بندی
        </p>
        <CategorySelector
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      {/* Service context card (§21) */}
      <div className="mb-6">
        <ServiceContextCard serviceType={serviceType} compact />
      </div>

      {/* Create Button */}
      <button
        onClick={handleSubmit}
        disabled={createMutation.isPending}
        className={[
          "w-full rounded-medium px-6 py-3 text-button transition-colors touch-target",
          "bg-primary text-white hover:bg-primary-variant",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {createMutation.isPending ? "در حال ایجاد..." : "شروع گفتگو"}
      </button>
    </div>
  );
}
