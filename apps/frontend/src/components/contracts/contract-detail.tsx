// ============================================================
// LEGALIR — Contract Detail View (Phase 10)
// ============================================================

"use client";

import { useState } from "react";
import type { V1ContractDetail as V1ContractDetailType } from "@legalir/types";
import { ContractStateBadge } from "./state-badge";
import { ContractPreview } from "./contract-preview";
import { ContractRiskPanel } from "./risk-panel";
import { ContractVersionHistory } from "./version-history";
import { ContractVersionCompare } from "./version-compare";
import { ContractActions } from "./contract-actions";

type DetailTab = "preview" | "risk" | "versions";

interface ContractDetailProps {
  contract: V1ContractDetailType;
}

export function ContractDetailView({ contract }: ContractDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("preview");
  const [viewedVersionId, setViewedVersionId] = useState<string | null>(
    contract.currentVersionId
  );
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCompareVersions, setSelectedCompareVersions] = useState<string[]>([]);

  const currentVersion = contract.versions.find(
    (v) => v.id === (viewedVersionId ?? contract.currentVersionId)
  );

  // Compare versions
  const comparePair =
    selectedCompareVersions.length === 2
      ? ([
          contract.versions.find((v) => v.id === selectedCompareVersions[0])!,
          contract.versions.find((v) => v.id === selectedCompareVersions[1])!,
        ] as const)
      : null;

  function handleToggleCompare(versionId: string) {
    setSelectedCompareVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1]!, versionId];
      }
      return [...prev, versionId];
    });
  }

  function handleViewVersion(versionId: string) {
    setViewedVersionId(versionId);
    setActiveTab("preview");
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "preview", label: "پیش‌نمایش" },
    { id: "risk", label: "تحلیل ریسک" },
    { id: "versions", label: "تاریخچه نسخه‌ها" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-4">
        <div>
          <h1 className="text-h2 text-on-surface">{contract.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-body-2 text-muted">{contract.typeFa}</span>
            <ContractStateBadge state={contract.state} />
            {contract.currentVersionNumber > 0 && (
              <span className="text-caption text-muted">
                نسخه {contract.currentVersionNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <ContractActions
        contractId={contract.id}
        state={contract.state}
        onGenerateNewVersion={() => {
          // Navigate to wizard with pre-filled data
          window.location.href = `/contracts/new?type=${contract.type}`;
        }}
      />

      {/* Tabs */}
      <div className="flex border-b border-divider" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-button border-b-2 transition-colors touch-target ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-on-surface"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div role="tabpanel">
        {activeTab === "preview" && currentVersion && (
          <ContractPreview
            version={currentVersion}
            disclaimer={contract.disclaimer}
          />
        )}
        {activeTab === "preview" && !currentVersion && (
          <div className="rounded-large bg-surface shadow-elevation-1 border border-divider p-6 text-center">
            <p className="text-muted">نسخه‌ای برای نمایش وجود ندارد</p>
          </div>
        )}

        {activeTab === "risk" && (
          <ContractRiskPanel
            contractId={contract.id}
            analysis={contract.analysis}
          />
        )}

        {activeTab === "versions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-h4 text-on-surface">مدیریت نسخه‌ها</h3>
              <label className="flex items-center gap-2 text-caption text-muted cursor-pointer touch-target">
                <input
                  type="checkbox"
                  checked={compareMode}
                  onChange={(e) => {
                    setCompareMode(e.target.checked);
                    if (!e.target.checked) setSelectedCompareVersions([]);
                  }}
                  className="w-4 h-4 accent-primary"
                />
                حالت مقایسه
              </label>
            </div>

            {comparePair && (
              <ContractVersionCompare
                versions={comparePair}
                onClose={() => setSelectedCompareVersions([])}
              />
            )}

            <ContractVersionHistory
              versions={contract.versions}
              currentVersionId={contract.currentVersionId}
              selectedVersions={selectedCompareVersions}
              onToggleCompare={handleToggleCompare}
              onViewVersion={handleViewVersion}
              compareMode={compareMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
