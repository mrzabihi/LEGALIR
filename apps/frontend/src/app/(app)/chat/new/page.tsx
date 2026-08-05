"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CategorySelector } from "@/components/chat/category-selector";
import { useCreateConversation } from "@/hooks/useConversations";

export default function NewConversationPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");

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
      router.push(`/chat/${result.id}`);
    } catch {
      setTitleError("خطا در ایجاد گفتگو");
    }
  }, [title, selectedCategory, createMutation, router]);

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
        <label
          htmlFor="conversation-title"
          className="block text-labelLarge text-onSurface mb-2"
        >
          عنوان گفتگو
        </label>
        <input
          id="conversation-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError("");
          }}
          placeholder="مثلاً: مشاوره قرارداد اجاره"
          className={[
            "w-full rounded-medium border bg-background px-4 py-3",
            "text-bodyMedium text-onSurface placeholder:text-muted",
            "focus:outline-2 focus:outline-primary",
            titleError ? "border-error" : "border-divider",
          ].join(" ")}
          autoFocus
          maxLength={200}
          aria-invalid={titleError ? "true" : undefined}
          aria-describedby={titleError ? "title-error" : undefined}
        />
        {titleError && (
          <p id="title-error" className="text-bodySmall text-error mt-1.5">
            {titleError}
          </p>
        )}
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
