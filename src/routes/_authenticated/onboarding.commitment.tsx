import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import type { TranslationKey } from "@/i18n/sorani";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingShell, OnboardingHeading, ConfirmationPanel } from "@/components/onboarding-ui";

export const Route = createFileRoute("/_authenticated/onboarding/commitment")({
  component: OnboardingCommitmentStep,
});

const DAY_OPTIONS: { value: number; key: TranslationKey }[] = [
  { value: 3, key: "commitment_days_3" },
  { value: 5, key: "commitment_days_5" },
  { value: 7, key: "commitment_days_7" },
];
const MINUTE_OPTIONS = [5, 10, 15, 20];

function Chip({ label, sub, selected, onClick }: { label: React.ReactNode; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      dir="ltr"
      className={cn(
        "flex-1 rounded-xl squircle border-2 py-3 px-2 text-center transition-all",
        selected ? "border-primary-ink bg-primary/10" : "border-border hover:border-primary/40 bg-card",
      )}
    >
      <div className="font-display font-semibold text-lg">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </button>
  );
}

/** Step 5 of 5 (final step): how many days a week and minutes a day they're committing to. */
function OnboardingCommitmentStep() {
  const { t } = useDialect();
  const navigate = useNavigate();
  const fn = useServerFn(completeOnboarding);
  const [days, setDays] = useState(5);
  const [minutes, setMinutes] = useState(15);

  const mut = useMutation({
    mutationFn: () => fn({ data: { weeklyDaysGoal: days, dailyGoalMinutes: minutes } }),
  });

  if (mut.isSuccess) {
    return (
      <OnboardingShell step={4}>
        <ConfirmationPanel
          title={t("onboarding_commitment_confirm_title")}
          body={t("onboarding_commitment_confirm_body")}
          ctaLabel={t("go_to_dashboard")}
          onContinue={() => navigate({ to: "/dashboard" })}
        />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={4} backTo="/onboarding/level">
      <OnboardingHeading title={t("onboarding_commitment_title")} sub={t("onboarding_commitment_sub")} />

      <div className="mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-2">{t("commitment_days_label")}</div>
        <div className="flex gap-3">
          {DAY_OPTIONS.map((d) => (
            <Chip key={d.value} label={d.value} sub={t(d.key)} selected={days === d.value} onClick={() => setDays(d.value)} />
          ))}
        </div>
      </div>

      <div className="mb-8">
        <div className="text-sm font-medium text-muted-foreground mb-2">{t("commitment_minutes_label")}</div>
        <div className="flex gap-3">
          {MINUTE_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={m}
              sub={m === 15 ? t("commitment_recommended") : undefined}
              selected={minutes === m}
              onClick={() => setMinutes(m)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <Button size="lg" className="gradient-brand" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          {t("continue")}
        </Button>
      </div>
    </OnboardingShell>
  );
}
