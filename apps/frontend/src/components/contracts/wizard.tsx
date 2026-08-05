// ============================================================
// LEGALIR — Contract Wizard (Phase 10)
// ============================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { V1ContractType, V1ContractQuestion } from "@legalir/types";
import { useContractQuestions, useCreateContractDraft, useSaveContractDraft, useContractDraft, useDeleteContractDraft, useCreateContract, useGenerateContract } from "@/hooks/useContracts";
import { useRouter } from "next/navigation";

interface ContractWizardProps {
  typeId: V1ContractType;
  title: string;
  onBack: () => void;
}

interface AutoSaveStatus {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
}

export function ContractWizard({ typeId, title, onBack }: ContractWizardProps) {
  const router = useRouter();
  const { data: questionsData, isLoading: questionsLoading } = useContractQuestions(typeId);
  const { data: draftData } = useContractDraft(typeId);
  const createDraft = useCreateContractDraft();
  const saveDraft = useSaveContractDraft();
  const deleteDraft = useDeleteContractDraft();
  const createContract = useCreateContract();
  const generateContract = useGenerateContract();

  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [autoSave, setAutoSave] = useState<AutoSaveStatus>({ status: "idle" });
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  const questions = questionsData?.questions ?? [];
  const totalSteps = Math.max(...questions.map((q) => q.step), 1) || 1;

  // Initialize from draft
  useEffect(() => {
    if (draftData && !initialized.current) {
      initialized.current = true;
      setCurrentStep(draftData.currentStep);
      setAnswers(draftData.answers);
    } else if (!draftData && questions.length > 0 && !initialized.current) {
      initialized.current = true;
      setAnswers({});
      setCurrentStep(1);
    }
  }, [draftData, questions.length]);

  // Auto-save with debounce
  const doAutoSave = useCallback(
    async (step: number, currentAnswers: Record<string, string>) => {
      setAutoSave({ status: "saving" });
      try {
        await saveDraft.mutateAsync({ typeId, currentStep: step, answers: currentAnswers });
        setAutoSave({ status: "saved" });
        setTimeout(() => setAutoSave((s) => (s.status === "saved" ? { status: "idle" } : s)), 2000);
      } catch {
        setAutoSave({ status: "error", message: "خطا در ذخیره خودکار" });
      }
    },
    [typeId, saveDraft]
  );

  // Trigger auto-save on answers change
  const triggerAutoSave = useCallback(
    (step: number, currentAnswers: Record<string, string>) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        doAutoSave(step, currentAnswers);
      }, 1500);
    },
    [doAutoSave]
  );

  // Initialize draft on first load
  useEffect(() => {
    if (questions.length > 0 && !draftData) {
      createDraft.mutate(typeId);
    }
  }, [typeId, questions.length, draftData, createDraft]);

  const stepQuestions = questions.filter((q) => q.step === currentStep);

  function validateStep(): boolean {
    const newErrors: Record<string, string> = {};
    stepQuestions.forEach((q) => {
      if (q.required && (!answers[q.fieldKey] || answers[q.fieldKey]!.trim() === "")) {
        newErrors[q.fieldKey] = `${q.labelFa} الزامی است`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleAnswer(fieldKey: string, value: string) {
    const newAnswers = { ...answers, [fieldKey]: value };
    setAnswers(newAnswers);
    setErrors((prev) => {
      const { [fieldKey]: _removed, ...next } = prev;
      return next;
    });
    triggerAutoSave(currentStep, newAnswers);
  }

  function handleNext() {
    if (!validateStep()) return;
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  }

  async function handleSubmit() {
    if (!validateStep()) return;

    // Save final draft
    await doAutoSave(currentStep, answers);

    setGenerating(true);
    setGenerateError(null);

    try {
      // Create contract from draft
      const created = await createContract.mutateAsync({
        typeId,
        title,
      });

      // Update contract with answers
      await saveDraft.mutateAsync({ typeId, currentStep, answers });
      await deleteDraft.mutateAsync(typeId);

      // Generate contract
      await generateContract.mutateAsync(created.id);

      // Navigate to contract detail
      router.push(`/contracts/${created.id}`);
    } catch (err) {
      setGenerateError(
        (err as Error)?.message ?? "خطا در تولید قرارداد. لطفاً مجدداً تلاش کنید."
      );
      setGenerating(false);
    }
  }

  function renderInput(question: V1ContractQuestion) {
    const value = answers[question.fieldKey] ?? "";
    const error = errors[question.fieldKey];

    const baseInputClass = `w-full rounded-medium px-4 py-3 text-body-2 text-on-surface placeholder:text-muted border ${
      error ? "border-error" : "border-divider"
    } focus:outline-none focus:ring-2 focus:ring-primary bg-surface touch-target`;

    switch (question.inputType) {
      case "text":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswer(question.fieldKey, e.target.value)}
            placeholder={question.placeholderFa}
            className={baseInputClass}
            aria-label={question.labelFa}
            aria-invalid={!!error}
            aria-describedby={error ? `err-${question.id}` : undefined}
          />
        );
      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswer(question.fieldKey, e.target.value)}
            placeholder={question.placeholderFa}
            className={`${baseInputClass} min-h-[100px] resize-y`}
            aria-label={question.labelFa}
            aria-invalid={!!error}
            aria-describedby={error ? `err-${question.id}` : undefined}
          />
        );
      case "number":
        return (
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => handleAnswer(question.fieldKey, e.target.value)}
            placeholder={question.placeholderFa}
            className={baseInputClass}
            aria-label={question.labelFa}
            aria-invalid={!!error}
            aria-describedby={error ? `err-${question.id}` : undefined}
          />
        );
      case "date":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswer(question.fieldKey, e.target.value)}
            placeholder="مثلاً ۱۴۰۵/۰۱/۰۱"
            className={baseInputClass}
            aria-label={question.labelFa}
            aria-invalid={!!error}
            aria-describedby={error ? `err-${question.id}` : undefined}
          />
        );
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleAnswer(question.fieldKey, e.target.value)}
            className={baseInputClass}
            aria-label={question.labelFa}
            aria-invalid={!!error}
            aria-describedby={error ? `err-${question.id}` : undefined}
          >
            <option value="">-- انتخاب کنید --</option>
            {question.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.labelFa}
              </option>
            ))}
          </select>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {question.options?.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 rounded-medium p-3 border cursor-pointer touch-target ${
                  value === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-divider"
                }`}
              >
                <input
                  type="radio"
                  name={question.fieldKey}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => handleAnswer(question.fieldKey, e.target.value)}
                  className="w-5 h-5 accent-primary"
                />
                <span className="text-body-2 text-on-surface">{opt.labelFa}</span>
              </label>
            ))}
          </div>
        );
      default:
        return null;
    }
  }

  if (questionsLoading) {
    return (
      <div className="p-6 text-center" aria-label="در حال بارگذاری پرسشنامه">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-surface-container rounded-small mx-auto" />
          <div className="h-20 bg-surface-container rounded-large" />
          <div className="h-20 bg-surface-container rounded-large" />
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center" dir="rtl" role="status" aria-label="در حال تولید قرارداد">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
        <h3 className="text-h3 text-on-surface mb-2">در حال تولید پیش‌نویس قرارداد</h3>
        <p className="text-body-2 text-muted">لطفاً چند لحظه صبر کنید...</p>
      </div>
    );
  }

  if (generateError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center" dir="rtl" role="alert">
        <div className="text-4xl mb-4">❌</div>
        <h3 className="text-h3 text-on-surface mb-2">خطا در تولید قرارداد</h3>
        <p className="text-body-2 text-muted mb-6">{generateError}</p>
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            className="rounded-medium bg-primary text-white px-5 py-3 text-button touch-target"
          >
            تلاش مجدد
          </button>
          <button
            onClick={onBack}
            className="rounded-medium bg-surface-container text-on-surface px-5 py-3 text-button touch-target border border-divider"
          >
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Step Indicator */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h2 text-on-surface">{title}</h2>
          <span className="text-caption text-muted">
            گام {currentStep} از {totalSteps}
          </span>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round((currentStep / totalSteps) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {stepQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <label className="block text-body-1 font-medium text-on-surface">
              {q.labelFa}
              {q.required && <span className="text-error mr-1">*</span>}
            </label>
            {q.hintFa && (
              <p className="text-caption text-muted">{q.hintFa}</p>
            )}
            {renderInput(q)}
            {errors[q.fieldKey] && (
              <p id={`err-${q.id}`} className="text-caption text-error" role="alert">
                {errors[q.fieldKey]}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Auto-save Status */}
      <div className="flex items-center justify-center text-caption">
        {autoSave.status === "saving" && (
          <span className="text-muted">در حال ذخیره...</span>
        )}
        {autoSave.status === "saved" && (
          <span className="text-green-600">ذخیره شد ✓</span>
        )}
        {autoSave.status === "error" && (
          <span className="text-error">{autoSave.message ?? "خطا در ذخیره"}</span>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-divider">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="rounded-medium bg-surface-container text-on-surface px-4 py-3 text-button touch-target border border-divider"
          >
            بازگشت
          </button>
          {currentStep > 1 && (
            <button
              onClick={handlePrev}
              className="rounded-medium bg-surface-container text-on-surface px-4 py-3 text-button touch-target border border-divider"
            >
              قبلی
            </button>
          )}
        </div>
        {currentStep < totalSteps ? (
          <button
            onClick={handleNext}
            className="rounded-medium bg-primary text-white px-6 py-3 text-button touch-target"
          >
            بعدی
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="rounded-medium bg-primary text-white px-6 py-3 text-button touch-target"
            aria-label="تولید پیش‌نویس قرارداد"
          >
            تولید پیش‌نویس
          </button>
        )}
      </div>
    </div>
  );
}
