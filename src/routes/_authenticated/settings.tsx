import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, updateActiveLanguage, updateDialect } from "@/lib/learn.functions";
import { useDialect } from "@/hooks/use-dialect";
import { AppShell } from "@/components/app-shell";
import { AccessibilityToggle } from "@/components/accessibility-toggle";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t, dialect, setDialect } = useDialect();
  const qc = useQueryClient();
  const dash = useServerFn(getDashboard);
  const setLang = useServerFn(updateActiveLanguage);
  const setDia = useServerFn(updateDialect);

  const { data, isLoading } = useQuery({ queryKey: ["settings-dashboard"], queryFn: () => dash({ data: {} }) });

  const langMut = useMutation({
    mutationFn: (language: "en" | "de" | "ar" | "ko") => setLang({ data: { language } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success(t("save")); },
  });
  const diaMut = useMutation({
    mutationFn: (d: "sorani" | "badini" | "english") => setDia({ data: { dialect: d } }),
  });

  if (isLoading) return <AppShell showEmail><Loader2 className="h-6 w-6 animate-spin" /></AppShell>;

  return (
    <AppShell activeLang={data?.activeLang ?? undefined} showEmail>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="font-display text-3xl font-bold">{t("settings")}</h1>

        <div className="bento-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">{t("language_dialect")}</h2>
          <div className="flex gap-2 flex-wrap">
            {(["sorani", "badini", "english"] as const).map((d) => (
              <button
                key={d}
                onClick={() => { setDialect(d); diaMut.mutate(d); }}
                className={`px-4 py-2 rounded-lg squircle border-2 ${dialect === d ? "border-primary-ink bg-primary/10" : "border-border"}`}
              >
                {t(d)}
              </button>
            ))}
          </div>
        </div>

        <div className="bento-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">{t("target_language")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {(data?.languages ?? []).map((lang) => (
              <button
                key={lang.code}
                onClick={() => langMut.mutate(lang.code as "en" | "de" | "ar" | "ko")}
                className={`p-4 rounded-xl squircle border-2 flex items-center gap-3 ${
                  lang.code === data?.activeLang ? "border-primary-ink bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-3xl">{lang.flag_emoji}</span>
                <div className="text-left rtl:text-right">
                  <div className="font-semibold">{dialect === "sorani" ? lang.name_sorani : dialect === "badini" ? lang.name_badini : lang.name_en}</div>
                  <div className="text-xs text-muted-foreground">{lang.name_en}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bento-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">{t("accessibility")}</h2>
          <AccessibilityToggle />
        </div>
      </div>
    </AppShell>
  );
}
