import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, updateActiveLanguage } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FlagIcon } from "@/components/flag-icon";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { t, dialect } = useDialect();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dash = useServerFn(getDashboard);
  const setLang = useServerFn(updateActiveLanguage);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-lite"],
    queryFn: () => dash({ data: {} }),
  });

  const pick = useMutation({
    mutationFn: (language: "en" | "de" | "ar" | "ko") => setLang({ data: { language } }),
    onSuccess: (_r, language) => {
      qc.invalidateQueries();
      navigate({ to: "/placement/$lang", params: { lang: language } });
    },
  });

  if (isLoading) return <AppShell><Loader2 className="h-6 w-6 animate-spin" /></AppShell>;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto text-center py-10">
        <h1 className="font-display text-3xl sm:text-4xl font-bold">{t("choose_language")}</h1>
        <p className="mt-3 text-muted-foreground">{t("choose_language_sub")}</p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data?.languages ?? []).map((lang) => (
            <button
              key={lang.code}
              onClick={() => pick.mutate(lang.code as "en" | "de" | "ar" | "ko")}
              disabled={pick.isPending}
              className="bento-card p-6 sm:p-8 text-center hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              <div className="text-5xl sm:text-6xl mb-4">
                <FlagIcon code={lang.code} />
              </div>
              <div className="font-display text-xl font-semibold">
                {dialect === "sorani" ? lang.name_sorani : dialect === "badini" ? lang.name_badini : lang.name_en}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{lang.name_en}</div>
            </button>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">{t("take_placement")}</p>
      </div>
    </AppShell>
  );
}
