import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateDialect } from "@/lib/learn.functions";
import { useDialect, type Dialect } from "@/hooks/use-dialect";
import {
  OnboardingShell,
  OnboardingHeading,
  OptionCard,
  ConfirmationPanel,
} from "@/components/onboarding-ui";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  component: OnboardingLanguageStep,
});

// Written in each option's own script on purpose — this is the one screen in
// the whole wizard where the labels must NOT run through t(), since the
// person hasn't chosen a UI language yet. "English" has to say "English"
// regardless of whatever dialect happens to be active by default.
const DIALECT_OPTIONS: { id: Dialect; label: string; sub: string }[] = [
  { id: "sorani", label: "کوردیی سۆرانی", sub: "Central Kurdish · Sorani" },
  { id: "badini", label: "کوردیی بادینی", sub: "Northern Kurdish · Badini" },
  { id: "english", label: "English", sub: "English" },
];

/** Step 1 of 5: which language the app itself should speak to them in. */
function OnboardingLanguageStep() {
  const { t, dialect, setDialect } = useDialect();
  const navigate = useNavigate();
  const setDia = useServerFn(updateDialect);
  const [picked, setPicked] = useState<Dialect | null>(null);

  const mut = useMutation({
    mutationFn: (d: Dialect) => setDia({ data: { dialect: d } }),
    onSuccess: (_r, d) => setPicked(d),
  });

  if (picked) {
    return (
      <OnboardingShell step={0}>
        <ConfirmationPanel
          title={t("onboarding_ui_lang_confirm_title")}
          body={t("onboarding_ui_lang_confirm_body")}
          ctaLabel={t("continue")}
          onContinue={() => navigate({ to: "/onboarding/target" })}
        />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={0}>
      <OnboardingHeading title={t("onboarding_ui_lang_title")} sub={t("onboarding_ui_lang_sub")} />
      <div className="grid gap-3">
        {DIALECT_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.id}
            title={opt.label}
            subtitle={opt.sub}
            selected={dialect === opt.id}
            onClick={() => {
              setDialect(opt.id);
              mut.mutate(opt.id);
            }}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
