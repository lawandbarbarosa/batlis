import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateOnboardingPurpose } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import type { TranslationKey } from "@/i18n/sorani";
import { Plane, Briefcase, GraduationCap, Home, Users, Sparkles } from "lucide-react";
import {
  OnboardingShell,
  OnboardingHeading,
  OptionCard,
  ConfirmationPanel,
} from "@/components/onboarding-ui";

export const Route = createFileRoute("/_authenticated/onboarding/purpose")({
  component: OnboardingPurposeStep,
});

type Purpose = "travel" | "career" | "study" | "move_abroad" | "connect" | "fun";

const PURPOSE_OPTIONS: {
  id: Purpose;
  titleKey: TranslationKey;
  subKey: TranslationKey;
  icon: React.ReactNode;
}[] = [
  {
    id: "travel",
    titleKey: "purpose_travel",
    subKey: "purpose_travel_sub",
    icon: <Plane className="h-5 w-5" />,
  },
  {
    id: "career",
    titleKey: "purpose_career",
    subKey: "purpose_career_sub",
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    id: "study",
    titleKey: "purpose_study",
    subKey: "purpose_study_sub",
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    id: "move_abroad",
    titleKey: "purpose_move_abroad",
    subKey: "purpose_move_abroad_sub",
    icon: <Home className="h-5 w-5" />,
  },
  {
    id: "connect",
    titleKey: "purpose_connect",
    subKey: "purpose_connect_sub",
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: "fun",
    titleKey: "purpose_fun",
    subKey: "purpose_fun_sub",
    icon: <Sparkles className="h-5 w-5" />,
  },
];

/** Step 3 of 5: why they're learning — used to steer lesson recommendations later. */
function OnboardingPurposeStep() {
  const { t } = useDialect();
  const navigate = useNavigate();
  const fn = useServerFn(updateOnboardingPurpose);
  const [picked, setPicked] = useState<Purpose | null>(null);

  const mut = useMutation({
    mutationFn: (purpose: Purpose) => fn({ data: { purpose } }),
    onSuccess: (_r, purpose) => setPicked(purpose),
  });

  if (picked) {
    return (
      <OnboardingShell step={2}>
        <ConfirmationPanel
          title={t("onboarding_purpose_confirm_title")}
          body={t("onboarding_purpose_confirm_body")}
          ctaLabel={t("continue")}
          onContinue={() => navigate({ to: "/onboarding/level" })}
        />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={2} backTo="/onboarding/target">
      <OnboardingHeading title={t("onboarding_purpose_title")} sub={t("onboarding_purpose_sub")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PURPOSE_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.id}
            icon={opt.icon}
            title={t(opt.titleKey)}
            subtitle={t(opt.subKey)}
            selected={mut.variables === opt.id && mut.isPending}
            onClick={() => mut.mutate(opt.id)}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
