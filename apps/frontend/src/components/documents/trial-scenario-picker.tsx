"use client";

// ============================================================
// LEGALIR — Trial scenario picker
// ============================================================
// The chooser shown when a model is not connected (or when the user
// explicitly wants a trial): pick one of the sample scenarios to see the
// review result, chat and lawyer UI. Selection is switchable at any time
// and every card is visibly a demo («نمونهٔ آزمایشی»).
//
// It renders the shared `SelectableCard` so it matches the rest of the
// design system (tonal green selected state), and uses the IconSparkle
// icon + text label — never colour alone.
// ============================================================

import { SelectableCard } from "@legalir/ui";
import { IconSparkle } from "@/lib/icons";
import {
  TRIAL_SCENARIOS,
  type TrialScenario,
  type TrialScenarioId,
} from "@/lib/documents/trial-scenarios";

interface TrialScenarioPickerProps {
  /** The currently selected scenario id (highlighted). */
  selectedId?: TrialScenarioId | null;
  /** Called when the user picks a scenario. */
  onSelect: (scenario: TrialScenario) => void;
  /** Optional heading override. */
  title?: string;
}

export function TrialScenarioPicker({
  selectedId = null,
  onSelect,
  title = "انتخاب سناریوی آزمایشی",
}: TrialScenarioPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IconSparkle size={18} className="text-secondary" aria-hidden="true" />
        <h3 className="text-titleSmall text-onSurface">{title}</h3>
      </div>
      <p className="text-caption text-muted leading-relaxed">
        هنوز به سرویس تحلیل متصل نشده‌ایم. می‌توانید یکی از سناریوهای نمونهٔ
        زیر را انتخاب کنید تا نتیجهٔ بررسی، گفتگو و پیشنهاد وکیل را با دادهٔ
        نمایشی ببینید.
      </p>

      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3" role="list">
        {TRIAL_SCENARIOS.map((scenario) => (
          <div role="listitem" key={scenario.id}>
            <SelectableCard
              title={scenario.titleFa}
              description={scenario.descriptionFa}
              selected={selectedId === scenario.id}
              icon={<IconSparkle size={18} />}
              onClick={() => onSelect(scenario)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
