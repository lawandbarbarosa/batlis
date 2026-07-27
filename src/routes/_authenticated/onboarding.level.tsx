import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, setManualLevel } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import type { TranslationKey } from "@/i18n/sorani";
import { Loader2, HelpCircle } from "lucide-react";
import {
  OnboardingShell,
  OnboardingHeading,
  OptionCard,
  ConfirmationPanel,
} from "@/components/onboarding-ui";

export const Route = createFileRoute("/_authenticated/onboarding/level")({
  component: OnboardingLevelStep,
});

type Cefr = "A1" | "A2" | "B1" | "B2";
type Lang = "en" | "de" | "ar" | "ko";

const LEVEL_OPTIONS: { id: Cefr; titleKey: TranslationKey; subKey: TranslationKey }[] = [
  { id: "A1", titleKey: "level_a1", subKey: "level_a1_sub" },
  { id: "A2", titleKey: "level_a2", subKey: "level_a2_sub" },
  { id: "B1", titleKey: "level_b1", subKey: "level_b1_sub" },
  { id: "B2", titleKey: "level_b2", subKey: "level_b2_sub" },
];

/** Step 4 of 5: self-reported CEFR level, or a hop over to the placement test. */
function OnboardingLevelStep() {
  const { t } = useDialect();
  const navigate = useNavigate();
  const dash = useServerFn(getDashboard);
  const fn = useServerFn(setManualLevel);
  const [selectedId, setSelectedId] = useState<Cefr | null>(null);
  const [picked, setPicked] = useState<Cefr | null>(null);

  // Target language was chosen in the previous step (only "en" is offered
  // today, but read it back rather than hardcoding so a second language
  // going live doesn't silently mis-tag this step).
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-lite"],
    queryFn: () => dash({ data: {} }),
  });
  const language = (data?.activeLang ?? "en") as Lang;

  const mut = useMutation({
    mutationFn: (cefr: Cefr) => fn({ data: { language, cefr } }),
    onSuccess: (_r, cefr) => setPicked(cefr),
  });

  if (isLoading) {
    return (
      <OnboardingShell step={3} backTo="/onboarding/purpose">
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </OnboardingShell>
    );
  }

  if (picked) {
    return (
      <OnboardingShell step={3}>
        <ConfirmationPanel
          title={t("onboarding_level_confirm_title")}
          body={t("onboarding_level_confirm_body")}
          ctaLabel={t("continue")}
          onContinue={() => navigate({ to: "/onboarding/commitment" })}
        />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={3} backTo="/onboarding/purpose">
      <OnboardingHeading title={t("onboarding_level_title")} sub={t("onboarding_level_sub")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LEVEL_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.id}
            title={t(opt.titleKey)}
            subtitle={t(opt.subKey)}
            selected={selectedId === opt.id}
            onClick={() => {
              setSelectedId(opt.id);
              mut.mutate(opt.id);
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 my-5 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        {t("or")}
        <div className="h-px flex-1 bg-border" />
      </div>

      <OptionCard
        icon={<HelpCircle className="h-5 w-5" />}
        title={t("level_unsure")}
        subtitle={t("level_unsure_sub")}
        onClick={() =>
          navigate({
            to: "/placement/$lang",
            params: { lang: language },
            search: { from: "onboarding" },
          })
        }
      />
      {mut.isError && (
        <p className="text-sm text-destructive text-center mt-4">{t("onboarding_save_error")}</p>
      )}
    </OnboardingShell>
  );
}
