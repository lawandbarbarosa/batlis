import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, updateActiveLanguage } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { FlagIcon } from "@/components/flag-icon";
import { Loader2 } from "lucide-react";
import {
  OnboardingShell,
  OnboardingHeading,
  OptionCard,
  ConfirmationPanel,
} from "@/components/onboarding-ui";

export const Route = createFileRoute("/_authenticated/onboarding/target")({
  component: OnboardingTargetStep,
});

// Same list as the dashboard's language switcher: only languages with real
// authored content behind them are selectable. Everything else in the
// `languages` table still shows up here, just disabled with a "coming soon"
// badge, so people can see what's on the roadmap.
const AVAILABLE_LANGS: readonly string[] = ["en"];

/** Step 2 of 5: which language they actually want to learn. */
function OnboardingTargetStep() {
  const { t, dialect } = useDialect();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dash = useServerFn(getDashboard);
  const setLang = useServerFn(updateActiveLanguage);
  const [picked, setPicked] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-lite"],
    queryFn: () => dash({ data: {} }),
  });

  const mut = useMutation({
    mutationFn: (language: "en" | "de" | "ar" | "ko") => setLang({ data: { language } }),
    onSuccess: (_r, language) => {
      qc.invalidateQueries();
      setPicked(language);
    },
  });

  if (isLoading) {
    return (
      <OnboardingShell step={1} backTo="/onboarding">
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </OnboardingShell>
    );
  }

  if (picked) {
    return (
      <OnboardingShell step={1}>
        <ConfirmationPanel
          title={t("onboarding_target_confirm_title")}
          body={t("onboarding_target_confirm_body")}
          ctaLabel={t("continue")}
          onContinue={() => navigate({ to: "/onboarding/purpose" })}
        />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={1} backTo="/onboarding">
      <OnboardingHeading title={t("onboarding_target_title")} sub={t("onboarding_target_sub")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(data?.languages ?? []).map((lang) => {
          const available = AVAILABLE_LANGS.includes(lang.code);
          const name =
            dialect === "sorani"
              ? lang.name_sorani
              : dialect === "badini"
                ? lang.name_badini
                : lang.name_en;
          return (
            <OptionCard
              key={lang.code}
              icon={
                <span className="text-3xl">
                  <FlagIcon code={lang.code} />
                </span>
              }
              title={name}
              subtitle={lang.name_en !== name ? lang.name_en : undefined}
              badge={available ? undefined : t("onboarding_coming_soon")}
              disabled={!available}
              onClick={
                available ? () => mut.mutate(lang.code as "en" | "de" | "ar" | "ko") : undefined
              }
            />
          );
        })}
      </div>
      {mut.isError && (
        <p className="text-sm text-destructive text-center mt-4">{t("onboarding_save_error")}</p>
      )}
    </OnboardingShell>
  );
}
